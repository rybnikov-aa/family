import { Fragment, createElement, type ReactNode } from 'react';

/**
 * Минимальный markdown-рендерер для контента страниц проектов (без внешних
 * зависимостей). Поддерживает: заголовки, абзацы, списки, цитаты, fenced-код,
 * горизонтальную линию и инлайн-разметку (**жирный**, *курсив*, `код`, ссылки).
 * Текст экранируется React'ом (вставляется как текст, а не HTML) — безопасно.
 */

/** Инлайн-токенизация: **bold**, *italic*, `code`, [text](url). */
function renderInline(src: string): ReactNode[] {
  const regex = /(\*\*([^*]+)\*\*|\*([^*\n]+)\*|`([^`\n]+)`|\[([^\]]+)\]\(([^)\s]+)\))/g;
  const out: ReactNode[] = [];
  let last = 0;
  let key = 0;
  let match: RegExpExecArray | null;

  regex.lastIndex = 0;
  while ((match = regex.exec(src)) !== null) {
    if (match.index > last) {
      out.push(<Fragment key={key++}>{src.slice(last, match.index)}</Fragment>);
    }
    if (match[2] !== undefined) {
      out.push(<strong key={key++}>{match[2]}</strong>);
    } else if (match[3] !== undefined) {
      out.push(<em key={key++}>{match[3]}</em>);
    } else if (match[4] !== undefined) {
      out.push(<code key={key++}>{match[4]}</code>);
    } else if (match[5] !== undefined && match[6] !== undefined) {
      out.push(
        <a key={key++} href={match[6]} target="_blank" rel="noreferrer">
          {match[5]}
        </a>,
      );
    }
    last = regex.lastIndex;
  }
  if (last < src.length) {
    out.push(<Fragment key={key++}>{src.slice(last)}</Fragment>);
  }
  return out;
}

/** Признак начала блока (не абзац) для строки. */
function isBlockStart(line: string): boolean {
  const t = line.trim();
  return (
    t === '' ||
    /^#{1,6}\s/.test(t) ||
    /^```/.test(t) ||
    /^>/.test(t) ||
    /^[-*+]\s/.test(t) ||
    /^\d+\.\s/.test(t) ||
    /^(-{3,}|\*{3,}|_{3,})$/.test(t)
  );
}

/** Рендерит markdown в React-узлы. */
export function renderMarkdown(markdown: string): ReactNode {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  const blocks: ReactNode[] = [];
  let i = 0;
  let key = 0;

  while (i < lines.length) {
    const trimmed = lines[i].trim();

    if (trimmed === '') {
      i++;
      continue;
    }

    // Заголовок (# … ###### …)
    const heading = /^(#{1,6})\s+(.*)$/.exec(trimmed);
    if (heading) {
      const level = heading[1].length;
      const content = renderInline(heading[2]);
      blocks.push(createElement(`h${level}`, { key: key++ }, ...content));
      i++;
      continue;
    }

    // Fenced-код (``` … ```)
    if (/^```/.test(trimmed)) {
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !/^```/.test(lines[i].trim())) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // закрывающая тройка кавычек
      blocks.push(
        <pre key={key++}>
          <code>{codeLines.join('\n')}</code>
        </pre>,
      );
      continue;
    }

    // Горизонтальная линия
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      blocks.push(<hr key={key++} />);
      i++;
      continue;
    }

    // Цитата (> …)
    if (trimmed.startsWith('>')) {
      const quote: string[] = [];
      while (i < lines.length && lines[i].trimStart().startsWith('>')) {
        quote.push(lines[i].trim().replace(/^>\s?/, ''));
        i++;
      }
      blocks.push(<blockquote key={key++}>{renderMarkdown(quote.join('\n'))}</blockquote>);
      continue;
    }

    // Список (маркированный или нумерованный)
    const unordered = /^[-*+]\s+(.*)$/.exec(trimmed);
    const ordered = /^\d+\.\s+(.*)$/.exec(trimmed);
    if (unordered || ordered) {
      const isOrdered = ordered !== null;
      const items: ReactNode[] = [];
      while (i < lines.length) {
        const t = lines[i].trim();
        const mu = /^[-*+]\s+(.*)$/.exec(t);
        const mo = /^\d+\.\s+(.*)$/.exec(t);
        if (isOrdered ? mo : mu) {
          const itemText = (isOrdered ? mo : mu)?.[1] ?? '';
          items.push(<li key={key++}>{renderInline(itemText)}</li>);
          i++;
        } else if (t === '') {
          i++;
          break;
        } else {
          break;
        }
      }
      blocks.push(isOrdered ? <ol key={key++}>{items}</ol> : <ul key={key++}>{items}</ul>);
      continue;
    }

    // Абзац — собираем строки до следующего блока.
    const paragraph: string[] = [lines[i]];
    i++;
    while (i < lines.length && !isBlockStart(lines[i])) {
      paragraph.push(lines[i]);
      i++;
    }
    blocks.push(<p key={key++}>{renderInline(paragraph.join(' '))}</p>);
  }

  return <>{blocks}</>;
}
