import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { env } from '../../../config/env';

/**
 * Адаптер извлечения PDF → текст/таблицы через `pdfplumber` (Python).
 *
 * pdfplumber — Python-библиотека, рантайм приложения — Node, поэтому запускаем
 * скрипт `backend/scripts/extract_pdf.py` как subprocess и читаем JSON из stdout.
 * (Решение зафиксировано в ADR-19, `docs/specification.md` §12.)
 *
 * Кросс-платформенно (разработка на Windows, сервер — Debian/Ubuntu). Пути по
 * умолчанию — относительно CWD (в dev — папка `backend/`; на сервере — каталог
 * приложения `server/`):
 *   - python: `../.venv/<Scripts/python.exe | bin/python>` — локальный venv
 *     с pdfplumber; расположение платформозависимое (Windows — `Scripts/`,
 *     Linux — `bin/`); если venv не найден — fallback `python` (Windows) /
 *     `python3` (Debian/Ubuntu);
 *   - скрипт: `scripts/extract_pdf.py`.
 * Переопределяются переменными `RENOVATION_PYTHON` и `RENOVATION_EXTRACT_SCRIPT`
 * (на сервере python с pdfplumber ставится отдельно и путь задаётся явно,
 * см. docs/server.md).
 */

export interface PdfTable {
  page: number;
  rows: string[][];
  nrows: number;
  ncols: number;
}

export interface PdfExtraction {
  pages: number;
  text: string;
  tables: PdfTable[];
}

/** Дефолтный python: локальный venv с pdfplumber (путь зависит от ОС) или системный. */
function defaultPython(): string {
  const base = resolve(process.cwd(), '..', '.venv');
  const candidates =
    process.platform === 'win32'
      ? [join(base, 'Scripts', 'python.exe')]
      : [join(base, 'bin', 'python'), join(base, 'bin', 'python3')];
  const found = candidates.find((p) => existsSync(p));
  return found ?? (process.platform === 'win32' ? 'python' : 'python3');
}

function resolvePython(): string {
  return env.RENOVATION_PYTHON || defaultPython();
}

function resolveScript(): string {
  return env.RENOVATION_EXTRACT_SCRIPT ?? resolve(process.cwd(), 'scripts/extract_pdf.py');
}

function runPython(args: string[]): Promise<Buffer> {
  const py = resolvePython();
  return new Promise((resolvePromise, reject) => {
    const child = spawn(py, args, { windowsHide: true });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    child.stdout.on('data', (d: Buffer) => stdout.push(d));
    child.stderr.on('data', (d: Buffer) => stderr.push(d));
    child.on('error', (err) =>
      reject(
        new Error(
          `Не удалось запустить python (${py}): ${err.message} — задайте RENOVATION_PYTHON с pdfplumber`,
        ),
      ),
    );
    child.on('close', (code) => {
      if (code === 0) {
        resolvePromise(Buffer.concat(stdout));
      } else {
        const msg = Buffer.concat(stderr).toString('utf8').trim() || `exit ${code}`;
        reject(new Error(`extract_pdf.py: ${msg}`));
      }
    });
  });
}

/** Извлекает текст и таблицы из PDF-буфера. */
export async function extractPdf(buffer: Buffer, fileName: string): Promise<PdfExtraction> {
  const dir = mkdtempSync(join(tmpdir(), 'renov-pdf-'));
  const tmpFile = join(dir, `doc-${Date.now()}.pdf`);
  writeFileSync(tmpFile, buffer);

  try {
    const stdout = await runPython([resolveScript(), tmpFile]);
    const data = JSON.parse(stdout.toString('utf8')) as PdfExtraction;
    if (
      typeof data.pages !== 'number' ||
      typeof data.text !== 'string' ||
      !Array.isArray(data.tables)
    ) {
      throw new Error('Некорректный ответ extract_pdf.py');
    }
    return data;
  } catch (err) {
    throw new Error(
      `Не удалось извлечь PDF «${fileName}»: ${err instanceof Error ? err.message : String(err)}`,
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
