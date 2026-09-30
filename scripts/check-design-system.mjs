import { readFileSync, readdirSync } from 'node:fs';
import { dirname, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const sourceDirectory = resolve(root, 'frontend/src');
const indexPath = resolve(sourceDirectory, 'index.css');
const tokensPath = resolve(sourceDirectory, 'styles/tokens.css');
const errors = [];

function read(path) {
  return readFileSync(path, 'utf8');
}

function relativePath(path) {
  return relative(root, path).split(sep).join('/');
}

function walkCss(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) return walkCss(path);
    return entry.isFile() && entry.name.endsWith('.css') ? [path] : [];
  });
}

function addError(path, line, message) {
  errors.push(`${relativePath(path)}:${line}: ${message}`);
}

function lineAt(source, index) {
  return source.slice(0, index).split('\n').length;
}

function removeComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, (comment) => comment.replace(/[^\n]/g, ' '));
}

function declarations(source, offset = 0) {
  const clean = removeComments(source);
  const pattern = /(?:^|[;{}])\s*([\w-]+)\s*:\s*([^;{}]*?)(?=;|})/g;
  return [...clean.matchAll(pattern)].map((match) => ({
    property: match[1].toLowerCase(),
    value: match[2].trim(),
    line: lineAt(clean, offset + match.index + match[0].indexOf(match[1])),
  }));
}

function readBlock(source, selector) {
  const start = source.indexOf(selector);
  if (start < 0) return null;
  const open = source.indexOf('{', start);
  const close = source.indexOf('}', open);
  if (open < 0 || close < 0) return null;
  return { content: source.slice(open + 1, close), offset: open + 1 };
}

function parseVariables(source, offset = 0) {
  const result = new Map();
  for (const declaration of declarations(source, offset)) {
    if (declaration.property.startsWith('--')) {
      result.set(declaration.property, declaration);
    }
  }
  return result;
}

function parseColor(value) {
  const hex = value.trim().match(/^#([\da-f]{3}|[\da-f]{6})$/i);
  if (hex) {
    const digits = hex[1].length === 3 ? [...hex[1]].map((part) => part + part).join('') : hex[1];
    return {
      channels: [0, 2, 4].map((offset) => Number.parseInt(digits.slice(offset, offset + 2), 16)),
      alpha: 1,
    };
  }

  const rgb = value
    .trim()
    .match(/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*([\d.]+))?\s*\)$/i);
  if (!rgb) return null;
  return {
    channels: [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])],
    alpha: rgb[4] === undefined ? 1 : Number(rgb[4]),
  };
}

function composite(foreground, background) {
  return {
    channels: foreground.channels.map(
      (channel, index) =>
        channel * foreground.alpha + background.channels[index] * (1 - foreground.alpha),
    ),
    alpha: 1,
  };
}

function luminance(color) {
  const [red, green, blue] = color.channels.map((channel) => {
    const value = channel / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function contrastRatio(first, second) {
  const values = [luminance(first), luminance(second)].sort((left, right) => right - left);
  return (values[0] + 0.05) / (values[1] + 0.05);
}

const cssFiles = walkCss(sourceDirectory);
const indexCss = read(indexPath);
const tokensCss = read(tokensPath);
const rootBlock = readBlock(tokensCss, ':root');
const darkBlock = readBlock(tokensCss, "[data-theme='dark']");
const rootTokens = rootBlock ? parseVariables(rootBlock.content, rootBlock.offset) : new Map();
const darkOverrides = darkBlock ? parseVariables(darkBlock.content, darkBlock.offset) : new Map();
const allVariables = new Map();
const scaleTokens = {
  spacing: new Map(),
  radius: new Map(),
  typography: new Map(),
};

for (const path of cssFiles) {
  for (const name of parseVariables(read(path)).keys()) {
    allVariables.set(name, path);
  }
}

for (const [name, declaration] of rootTokens) {
  const value = declaration.value.toLowerCase();
  if (name.startsWith('--space-') && !value.includes('var(')) {
    scaleTokens.spacing.set(value, name);
  } else if (name.startsWith('--radius-') && !value.includes('var(')) {
    scaleTokens.radius.set(value, name);
  } else if (name.startsWith('--font-size-') && !value.includes('var(')) {
    scaleTokens.typography.set(value, name);
  }
}

const layerStatement = indexCss.match(/@layer\s+([^;]+);/);
const expectedLayers = ['tokens', 'base', 'layout', 'components', 'pages', 'domains', 'responsive'];
const declaredLayerList = layerStatement
  ? layerStatement[1].split(',').map((layer) => layer.trim())
  : [];
const declaredLayers = new Set(declaredLayerList);
if (!layerStatement) addError(indexPath, 1, 'declare the design-system cascade layer order');
else if (declaredLayerList.join(',') !== expectedLayers.join(',')) {
  addError(
    indexPath,
    lineAt(indexCss, layerStatement.index),
    `cascade layer order must be ${expectedLayers.join(', ')}`,
  );
}

const importedFiles = new Set();
const importPattern = /@import\s+['"]([^'"]+\.css)['"]\s+layer\(([\w-]+)\)\s*;/g;
for (const match of indexCss.matchAll(importPattern)) {
  const importedPath = resolve(dirname(indexPath), match[1]);
  const line = lineAt(indexCss, match.index);
  if (!declaredLayers.has(match[2])) {
    addError(indexPath, line, `import layer "${match[2]}" is not declared`);
  }
  const filename = match[1]
    .split('/')
    .at(-1)
    .replace(/\.css$/, '');
  const expectedLayer =
    new Map([
      ['tokens', 'tokens'],
      ['base', 'base'],
      ['layout', 'layout'],
      ['modal', 'components'],
      ['tooltip', 'components'],
      ['forms', 'components'],
      ['content', 'components'],
      ['pages', 'pages'],
      ['login', 'pages'],
      ['responsive', 'responsive'],
    ]).get(filename) ?? (/^(?:renovation|diary)(?:-|$)/.test(filename) ? 'domains' : null);
  if (!expectedLayer) {
    addError(indexPath, line, `register CSS module "${filename}" in its owning cascade layer`);
  } else if (match[2] !== expectedLayer) {
    addError(indexPath, line, `${filename}.css belongs in layer "${expectedLayer}"`);
  }
  if (!cssFiles.includes(importedPath)) {
    addError(indexPath, line, `imported CSS file does not exist: ${match[1]}`);
  }
  if (importedFiles.has(importedPath)) {
    addError(indexPath, line, `CSS file is imported more than once: ${match[1]}`);
  }
  importedFiles.add(importedPath);
}

for (const path of cssFiles) {
  if (path !== indexPath && !importedFiles.has(path)) {
    addError(path, 1, 'runtime CSS must be imported from index.css in a named cascade layer');
  }
}

const basePath = resolve(sourceDirectory, 'styles/base.css');
const baseCss = read(basePath);
if (!baseCss.includes(':focus-visible') || !baseCss.includes('var(--focus-ring)')) {
  addError(basePath, 1, 'provide the shared visible :focus-visible indicator using --focus-ring');
}

const spacingProperties = /^(?:padding|margin)(?:-[\w-]+)?$|^(?:gap|row-gap|column-gap)$/;
const colorProperties = new Set([
  'accent-color',
  'background',
  'background-color',
  'border',
  'border-bottom',
  'border-bottom-color',
  'border-color',
  'border-left',
  'border-left-color',
  'border-right',
  'border-right-color',
  'border-top',
  'border-top-color',
  'box-shadow',
  'caret-color',
  'color',
  'fill',
  'outline',
  'outline-color',
  'stroke',
  'text-decoration-color',
  'text-shadow',
]);
const dimension = /(?<![-\w.])\d*\.?\d+(?:px|rem)\b/gi;
const colorFunction = /\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\([^)]*\)/i;
const colorSyntaxWords =
  /\b(?:transparent|currentcolor|inherit|initial|unset|revert|revert-layer|none|solid|dashed|dotted|double|groove|ridge|inset|outset|hidden|in|srgb|srgb-linear|display-p3|xyz|center|left|right|top|bottom|cover|contain|no-repeat|repeat|repeat-x|repeat-y|scroll|fixed|local|infinite|normal|ease|linear|both|forwards|backwards|alternate|running|paused|to)\b/gi;

function hasRawColor(value) {
  const withoutUrls = value.replace(/url\([^)]*\)/gi, ' ');
  if (/#\s*[\da-f]{3,8}\b/i.test(withoutUrls) || colorFunction.test(withoutUrls)) return true;

  const remainder = withoutUrls
    .replace(/var\([^)]*\)/gi, ' ')
    .replace(/#[\da-f]{3,8}\b/gi, ' ')
    .replace(/\b[\w-]+\(/gi, ' ')
    .replace(colorSyntaxWords, ' ')
    .replace(/[-+]?\d*\.?\d+(?:px|rem|em|%|deg|turn|s|ms)?/gi, ' ')
    .replace(/[(),/]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return remainder.length > 0;
}

for (const path of cssFiles) {
  if (path === tokensPath || path === indexPath) continue;
  const source = read(path);
  for (const declaration of declarations(source)) {
    const { property, value, line } = declaration;
    const scale =
      property === 'font-size'
        ? scaleTokens.typography
        : property === 'border-radius'
          ? scaleTokens.radius
          : spacingProperties.test(property)
            ? scaleTokens.spacing
            : null;

    if (scale) {
      for (const match of value.matchAll(dimension)) {
        const token = scale.get(match[0].toLowerCase());
        if (token) {
          addError(
            path,
            line,
            `${property} value ${match[0]} duplicates ${token}; use var(${token})`,
          );
        }
      }
    }

    if (property.startsWith('--') && hasRawColor(value)) {
      addError(path, line, 'custom-property colors must reference a semantic color token');
    } else if (colorProperties.has(property) && hasRawColor(value)) {
      addError(
        path,
        line,
        'color literals must use a semantic token; transparent/currentColor are allowed',
      );
    }
  }

  for (const match of source.matchAll(/var\(\s*(--[\w-]+)/g)) {
    if (!allVariables.has(match[1])) {
      addError(path, lineAt(source, match.index), `undefined CSS custom property ${match[1]}`);
    }
  }
}

const surfaceNames = [
  '--bg',
  '--surface',
  '--surface-muted',
  '--surface-hover',
  '--card-bg',
  '--card-hover-bg',
  '--card-renov-bg',
];
const textNames = ['--text', '--text-strong', '--text-muted', '--text-faint', '--text-fainter'];

function checkContrast(
  themeName,
  variables,
  foregroundName,
  backgroundName,
  minimum,
  backgroundOverride,
) {
  const foreground = variables.get(foregroundName);
  const background = backgroundOverride ?? variables.get(backgroundName);
  if (!foreground || !background) {
    addError(
      tokensPath,
      1,
      `${themeName}: missing contrast token ${foregroundName} or ${backgroundName}`,
    );
    return;
  }

  const foregroundColor = parseColor(foreground.value);
  const backgroundColor = parseColor(background.value);
  if (!foregroundColor || !backgroundColor) {
    addError(
      tokensPath,
      foreground.line,
      `${themeName}: cannot calculate ${foregroundName}/${backgroundName}`,
    );
    return;
  }

  const ratio = contrastRatio(foregroundColor, backgroundColor);
  if (ratio < minimum) {
    addError(
      tokensPath,
      foreground.line,
      `${themeName}: ${foregroundName} on ${backgroundName} is ${ratio.toFixed(2)}:1; minimum is ${minimum}:1`,
    );
  }
}

for (const [themeName, overrides] of [
  ['light', new Map()],
  ['dark', darkOverrides],
]) {
  const variables = new Map([...rootTokens, ...overrides]);
  for (const foreground of textNames) {
    for (const background of surfaceNames) {
      checkContrast(themeName, variables, foreground, background, 4.5);
    }
  }

  for (const status of ['success', 'warning', 'critical', 'danger']) {
    const marker = `--color-${status}`;
    const strong = `--color-${status}-strong`;
    const tint = `--color-${status}-bg`;
    for (const surface of surfaceNames) {
      checkContrast(themeName, variables, marker, surface, 3);
      const background = variables.get(tint);
      const surfaceColor = variables.get(surface);
      const tintColor = background && parseColor(background.value);
      const surfaceColorValue = surfaceColor && parseColor(surfaceColor.value);
      if (tintColor && surfaceColorValue) {
        checkContrast(themeName, variables, strong, `${tint} over ${surface}`, 4.5, {
          value: `#${composite(tintColor, surfaceColorValue)
            .channels.map((channel) => Math.round(channel).toString(16).padStart(2, '0'))
            .join('')}`,
        });
      }
    }
  }

  for (const surface of surfaceNames) {
    checkContrast(themeName, variables, '--color-accent-orange-strong', surface, 4.5);
  }
}

if (errors.length > 0) {
  console.error('Design-system check failed:');
  for (const error of errors) console.error(`- ${error}`);
  process.exitCode = 1;
} else {
  console.log(
    `Design-system check passed: ${cssFiles.length} CSS files conform to tokens, layers, focus, and contrast rules.`,
  );
}
