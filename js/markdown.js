'use strict';

const Md = (() => {
  /**
   * Разбирает строчное оформление: жирный, код, выделение.
   * @param {string} s Строка текста.
   * @returns {string} HTML.
   */
  const inline = s => {
    const stash = [];
    let t = U.esc(s).replace(/`([^`]+)`/g, (m, c) => {
      stash.push('<code>' + c + '</code>');
      return '\u0000' + (stash.length - 1) + '\u0000';
    });
    t = t
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/==([^=]+)==/g, '<mark>$1</mark>')
      .replace(/(^|[^*])\*([^*\s][^*]*)\*/g, '$1<em>$2</em>')
      .replace(
        /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
        '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>'
      );
    return t.replace(/\u0000(\d+)\u0000/g, (m, i) => stash[+i]);
  };
  /**
   * Проверяет, что строка разделяет шапку таблицы.
   * @param {string} l Строка текста.
   * @returns {boolean} true, если условие выполнено.
   */
  const isTableSep = l => /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)+\|?\s*$/.test(l || '');
  /**
   * Разбивает строку таблицы на ячейки.
   * @param {string} l Строка таблицы.
   * @returns {Array<string>} Массив.
   */
  const cells = l =>
    l
      .trim()
      .replace(/^\|/, '')
      .replace(/\|$/, '')
      .split('|')
      .map(c => c.trim());
  /**
   * Проверяет, начинает ли строка отдельный блок текста.
   * @param {string} l Строка текста.
   * @returns {boolean} true, если условие выполнено.
   */
  const isBlock = l => /^(#{1,3}\s|```|~~~|>\s?|\s*[-*]\s+|\s*\d+[.)]\s+|-{3,}\s*$|\|)/.test(l);

  /**
   * Преобразует текст конспекта в HTML.
   * @param {string} src Исходный текст.
   * @returns {string} Строка.
   */
  function render(src) {
    const L = String(src || '')
      .replace(/\r/g, '')
      .split('\n');
    const out = [];
    let i = 0,
      m;
    while (i < L.length) {
      const l = L[i];
      if (/^(```|~~~)/.test(l)) {
        const fence = l.slice(0, 3);
        const buf = [];
        i++;
        while (i < L.length && !L[i].startsWith(fence)) {
          buf.push(L[i]);
          i++;
        }
        i++;
        out.push('<pre><code>' + U.esc(buf.join('\n')) + '</code></pre>');
        continue;
      }
      if (!l.trim()) {
        i++;
        continue;
      }
      if ((m = l.match(/^(#{1,3})\s+(.*)$/))) {
        const n = m[1].length + 1;
        out.push('<h' + n + '>' + inline(m[2]) + '</h' + n + '>');
        i++;
        continue;
      }
      if (/^(-{3,}|\*{3,})\s*$/.test(l)) {
        out.push('<hr>');
        i++;
        continue;
      }
      if (/^>\s?/.test(l)) {
        const b = [];
        while (i < L.length && /^>\s?/.test(L[i])) {
          b.push(L[i].replace(/^>\s?/, ''));
          i++;
        }
        out.push('<blockquote>' + b.map(inline).join('<br>') + '</blockquote>');
        continue;
      }
      if (/^\s*[-*]\s+/.test(l)) {
        const b = [];
        while (i < L.length && /^\s*[-*]\s+/.test(L[i])) {
          b.push('<li>' + inline(L[i].replace(/^\s*[-*]\s+/, '')) + '</li>');
          i++;
        }
        out.push('<ul>' + b.join('') + '</ul>');
        continue;
      }
      if (/^\s*\d+[.)]\s+/.test(l)) {
        const b = [];
        while (i < L.length && /^\s*\d+[.)]\s+/.test(L[i])) {
          b.push('<li>' + inline(L[i].replace(/^\s*\d+[.)]\s+/, '')) + '</li>');
          i++;
        }
        out.push('<ol>' + b.join('') + '</ol>');
        continue;
      }
      if (/^\|/.test(l) && isTableSep(L[i + 1])) {
        const head = cells(l);
        i += 2;
        const rows = [];
        while (i < L.length && /^\|/.test(L[i])) {
          rows.push(cells(L[i]));
          i++;
        }
        out.push(
          '<div class="tbl"><table><thead><tr>' +
            head.map(c => '<th>' + inline(c) + '</th>').join('') +
            '</tr></thead><tbody>' +
            rows.map(r => '<tr>' + r.map(c => '<td>' + inline(c) + '</td>').join('') + '</tr>').join('') +
            '</tbody></table></div>'
        );
        continue;
      }
      const p = [];
      while (i < L.length && L[i].trim() && (p.length === 0 || !isBlock(L[i]))) {
        p.push(inline(L[i]));
        i++;
      }
      out.push('<p>' + p.join('<br>') + '</p>');
    }
    return out.join('');
  }
  return {render, inline};
})();
