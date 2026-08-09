#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""Извлечение текста и таблиц из PDF для модуля «Ремонт» (импорт из PDF).

Запускается Node-бэкендом как subprocess (см. services/renovation/import/pdfExtractor.ts),
потому что pdfplumber — Python-библиотека, а рантайм приложения — Node.

Использование: python extract_pdf.py <путь-к-pdf>
Вывод (stdout): JSON
  {
    "pages": int,
    "text": "текст по страницам (разделитель «[стр. N]»)",
    "tables": [ { "page": int, "rows": [[...]], "nrows": int, "ncols": int } ]
  }
Ошибки — в stderr + ненулевой код выхода.
"""
import json
import sys

import pdfplumber

# Node-бэкенд читает stdout как UTF-8; на Windows Python по умолчанию пишет
# в консольную кодировку (cp1251/cp866) — принудительно включаем UTF-8.
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8")


def main() -> None:
    if len(sys.argv) < 2:
        sys.stderr.write("usage: extract_pdf.py <pdf>\n")
        sys.exit(2)
    path = sys.argv[1]
    out: dict = {"pages": 0, "text": "", "tables": []}
    try:
        with pdfplumber.open(path) as pdf:
            out["pages"] = len(pdf.pages)
            for i, page in enumerate(pdf.pages, start=1):
                try:
                    text = page.extract_text() or ""
                except Exception:  # noqa: BLE001 — не роняем весь файл из-за одной страницы
                    text = ""
                if text:
                    out["text"] += f"[стр. {i}]\n{text}\n"
                try:
                    tables = page.extract_tables() or []
                except Exception:  # noqa: BLE001
                    tables = []
                for table in tables:
                    rows = [["" if c is None else str(c) for c in row] for row in table]
                    if rows:
                        out["tables"].append(
                            {
                                "page": i,
                                "rows": rows,
                                "nrows": len(rows),
                                "ncols": max((len(r) for r in rows), default=0),
                            }
                        )
    except Exception as exc:  # noqa: BLE001
        sys.stderr.write(f"extract error: {exc}\n")
        sys.exit(1)
    json.dump(out, sys.stdout, ensure_ascii=False)
    sys.stdout.write("\n")


if __name__ == "__main__":
    main()
