import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const errors = [];

function read(relativePath) {
  return readFileSync(resolve(root, relativePath), 'utf8');
}

function recordFiles(directory, prefix) {
  return readdirSync(resolve(root, directory))
    .filter((file) => new RegExp(`^${prefix}-\\d{3}-[^/]+\\.md$`).test(file))
    .sort();
}

function checkCategory(prefix, directory, indexPath, heading) {
  const files = recordFiles(directory, prefix);
  const index = read(indexPath);
  const traceability = read('docs/traceability.md');
  const ids = new Set();

  for (const file of files) {
    const id = file.slice(0, 7).toUpperCase();
    const content = read(`${directory}/${file}`);
    if (ids.has(id)) errors.push(`${directory}: duplicate ${id}`);
    ids.add(id);
    if (!index.includes(`(${file})`)) errors.push(`${file} is missing from ${indexPath}`);
    if (!traceability.includes(`(${directory.replace('docs/', '')}/${file})`)) {
      errors.push(`${file} is missing from docs/traceability.md`);
    }
    if (!content.includes(heading)) errors.push(`${file} is missing ${heading}`);
  }

  const links = [...index.matchAll(new RegExp(`\\(((${prefix}-\\d{3}-[^)]+\\.md))\\)`, 'g'))];
  for (const [, , link] of links) {
    if (!files.includes(link)) errors.push(`${indexPath} links missing file ${link}`);
  }
  return files.length;
}

const cjCount = checkCategory('cj', 'docs/cj', 'docs/cj/index.md', '## Трассировка');
const frCount = checkCategory('fr', 'docs/fr', 'docs/fr/index.md', '## Проверяемость');
const cjIndex = read('docs/cj/index.md');
const traceability = read('docs/traceability.md');

if (/Планы.*без маршрута|Карточка «Планы».*не имеет/.test(cjIndex + traceability)) {
  errors.push('stale statement says that Plans are not implemented');
}

if (errors.length > 0) {
  console.error('Documentation check failed:');
  for (const error of errors) console.error(`- ${error}`);
  process.exitCode = 1;
} else {
  console.log(
    `Documentation check passed: ${cjCount} CJ records and ${frCount} FR records are indexed and traced.`,
  );
}
