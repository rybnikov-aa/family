// Полифилл для pdf.js v6 в старых браузерах.
//
// pdf.js v6 использует `Map.prototype.getOrInsertComputed` (ES2025) в горячем
// пути рендера страниц. Метод есть в Chrome/Edge 130+, Safari 18.2+, Firefox
// 134+, но отсутствует в Samsung Internet (Chromium < 130) и ряде старых
// WebView — без него просмотр PDF падает с
// `this[#t].getOrInsertComputed is not a function`. Полифилл реализует
// поведение по спецификации: если ключ уже есть — вернуть значение; иначе
// вызвать колбэк с ключом, вставить результат (кроме `undefined`) и вернуть его.

export function installPdfPolyfills(): void {
  // В либах TS проекта метода ещё нет (ES2025) — обращаемся через Record.
  const mapProto = Map.prototype as unknown as Record<string, unknown>;
  if (typeof mapProto.getOrInsertComputed !== 'function') {
    Object.defineProperty(mapProto, 'getOrInsertComputed', {
      configurable: true,
      writable: true,
      value(this: Map<unknown, unknown>, key: unknown, callback: (key: unknown) => unknown) {
        if (this.has(key)) {
          return this.get(key);
        }
        const value = callback(key);
        if (value !== undefined) {
          this.set(key, value);
        }
        return value;
      },
    });
  }
}
