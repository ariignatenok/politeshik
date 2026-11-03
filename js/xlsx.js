'use strict';

/**
 * Простой писатель файлов Excel (.xlsx): один лист, цвета, объединённые ячейки, закреплённые строки.
 * Файл .xlsx — это zip-архив с XML-файлами; здесь архив собирается без сжатия.
 */
const Xlsx = {
  /** Названия стилей ячеек и их номера в styles.xml. */
  STYLES: {
    plain: 0,
    head: 1,
    date: 2,
    name: 3,
    p: 4,
    o: 5,
    n: 6,
    b: 7,
    z: 8,
    blank: 9,
    num: 10,
    pct: 11,
    bold: 12,
    note: 13,
    title: 14
  },
  crcTable: null,

  /**
   * Считает контрольную сумму CRC-32.
   * @param {Uint8Array} bytes Данные.
   * @returns {number} Сумма.
   */
  crc32(bytes) {
    if (!Xlsx.crcTable) {
      Xlsx.crcTable = [];
      for (let n = 0; n < 256; n++) {
        let c = n;
        for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
        Xlsx.crcTable[n] = c >>> 0;
      }
    }
    let crc = 0xffffffff;
    for (let i = 0; i < bytes.length; i++) crc = Xlsx.crcTable[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
    return (crc ^ 0xffffffff) >>> 0;
  },

  /**
   * Собирает zip-архив без сжатия.
   * @param {Array<Object>} files Файлы: {name, data: Uint8Array}.
   * @returns {Uint8Array} Архив.
   */
  zip(files) {
    const enc = new TextEncoder(),
      parts = [],
      central = [];
    let offset = 0;
    const u16 = v => [v & 255, (v >>> 8) & 255],
      u32 = v => [v & 255, (v >>> 8) & 255, (v >>> 16) & 255, (v >>> 24) & 255];
    files.forEach(f => {
      const name = enc.encode(f.name),
        crc = Xlsx.crc32(f.data),
        size = f.data.length,
        local = Uint8Array.from([].concat(u32(0x04034b50), u16(20), u16(0x0800), u16(0), u16(0), u16(0x21), u32(crc), u32(size), u32(size), u16(name.length), u16(0)));
      parts.push(local, name, f.data);
      central.push(
        Uint8Array.from(
          [].concat(u32(0x02014b50), u16(20), u16(20), u16(0x0800), u16(0), u16(0), u16(0x21), u32(crc), u32(size), u32(size), u16(name.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(offset))
        ),
        name
      );
      offset += local.length + name.length + size;
    });
    const cdSize = central.reduce((s, x) => s + x.length, 0),
      end = Uint8Array.from([].concat(u32(0x06054b50), u16(0), u16(0), u16(files.length), u16(files.length), u32(cdSize), u32(offset), u16(0)));
    const all = parts.concat(central, [end]),
      out = new Uint8Array(all.reduce((s, x) => s + x.length, 0));
    let pos = 0;
    all.forEach(x => {
      out.set(x, pos);
      pos += x.length;
    });
    return out;
  },

  /**
   * Возвращает букву колонки Excel по номеру (1 = A).
   * @param {number} n Номер колонки.
   * @returns {string} Буквы.
   */
  col(n) {
    let s = '';
    while (n > 0) {
      const m = (n - 1) % 26;
      s = String.fromCharCode(65 + m) + s;
      n = Math.floor((n - 1) / 26);
    }
    return s;
  },

  /**
   * Экранирует текст для XML.
   * @param {string} t Текст.
   * @returns {string} Текст.
   */
  esc(t) {
    return String(t)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '');
  },

  /**
   * Собирает XML со стилями: шрифты, заливки, рамки и форматы ячеек.
   * @returns {string} XML.
   */
  stylesXml() {
    const fill = rgb => '<fill><patternFill patternType="solid"><fgColor rgb="FF' + rgb + '"/><bgColor indexed="64"/></patternFill></fill>',
      xf = (font, fillId, border, align, numFmt) =>
        '<xf numFmtId="' + (numFmt || 0) + '" fontId="' + font + '" fillId="' + fillId + '" borderId="' + border + '" xfId="0"' + (numFmt ? ' applyNumberFormat="1"' : '') + ' applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="' + align + '" vertical="center" wrapText="1"/></xf>';
    return (
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
      '<numFmts count="1"><numFmt numFmtId="164" formatCode="0&quot;%&quot;"/></numFmts>' +
      '<fonts count="5"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font><font><i/><sz val="10"/><color rgb="FF555555"/><name val="Calibri"/></font><font><b/><sz val="14"/><name val="Calibri"/></font></fonts>' +
      '<fills count="9"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>' +
      fill('2F5D62') + fill('C6EFCE') + fill('FFE0B2') + fill('FFC7CE') + fill('BDD7EE') + fill('FFEB9C') + fill('E7E6E6') +
      '</fills>' +
      '<borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border><left style="thin"><color rgb="FFBFBFBF"/></left><right style="thin"><color rgb="FFBFBFBF"/></right><top style="thin"><color rgb="FFBFBFBF"/></top><bottom style="thin"><color rgb="FFBFBFBF"/></bottom><diagonal/></border></borders>' +
      '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
      '<cellXfs count="15">' +
      xf(0, 0, 0, 'left') +
      xf(2, 2, 1, 'center') +
      xf(1, 2, 1, 'center').replace('fontId="1"', 'fontId="2"') +
      xf(0, 0, 1, 'left') +
      xf(1, 3, 1, 'center') +
      xf(1, 4, 1, 'center') +
      xf(1, 5, 1, 'center') +
      xf(1, 6, 1, 'center') +
      xf(1, 7, 1, 'center') +
      xf(0, 8, 1, 'center') +
      xf(0, 0, 1, 'center') +
      xf(0, 0, 1, 'center', 164) +
      xf(1, 0, 0, 'left') +
      xf(3, 0, 0, 'left') +
      xf(4, 0, 0, 'left') +
      '</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>'
    );
  },

  /**
   * Собирает файл .xlsx из описания листа.
   * @param {Object} spec name — название листа; rows — строки (ячейка: текст, число, null или {v, s});
   *   merges — объединения вида 'B1:D1'; widths — ширины колонок; freeze — {cols, rows}.
   * @returns {Uint8Array} Файл.
   */
  build(spec) {
    const enc = new TextEncoder(),
      S = Xlsx.STYLES,
      sid = s => (typeof s === 'number' ? s : S[s] || 0);
    let sheetData = '';
    spec.rows.forEach((row, ri) => {
      let cells = '';
      row.forEach((cell, ci) => {
        if (cell === null || cell === undefined) return;
        const c = typeof cell === 'object' ? cell : {v: cell, s: 'plain'},
          ref = Xlsx.col(ci + 1) + (ri + 1),
          st = sid(c.s);
        if (c.v === '' || c.v === null || c.v === undefined) cells += '<c r="' + ref + '" s="' + st + '"/>';
        else if (typeof c.v === 'number') cells += '<c r="' + ref + '" s="' + st + '"><v>' + c.v + '</v></c>';
        else cells += '<c r="' + ref + '" s="' + st + '" t="inlineStr"><is><t xml:space="preserve">' + Xlsx.esc(c.v) + '</t></is></c>';
      });
      sheetData += '<row r="' + (ri + 1) + '"' + (spec.heights && spec.heights[ri] ? ' ht="' + spec.heights[ri] + '" customHeight="1"' : '') + '>' + cells + '</row>';
    });
    const fr = spec.freeze || {cols: 0, rows: 0},
      pane =
        fr.cols || fr.rows
          ? '<pane' + (fr.cols ? ' xSplit="' + fr.cols + '"' : '') + (fr.rows ? ' ySplit="' + fr.rows + '"' : '') + ' topLeftCell="' + Xlsx.col(fr.cols + 1) + (fr.rows + 1) + '" activePane="' + (fr.cols && fr.rows ? 'bottomRight' : fr.rows ? 'bottomLeft' : 'topRight') + '" state="frozen"/>'
          : '';
    const cols = (spec.widths || []).map((w, i) => '<col min="' + (i + 1) + '" max="' + (i + 1) + '" width="' + w + '" customWidth="1"/>').join(''),
      merges = spec.merges && spec.merges.length ? '<mergeCells count="' + spec.merges.length + '">' + spec.merges.map(m => '<mergeCell ref="' + m + '"/>').join('') + '</mergeCells>' : '';
    const sheet =
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0" showGridLines="0">' +
      pane +
      '</sheetView></sheetViews><sheetFormatPr defaultRowHeight="15"/>' +
      (cols ? '<cols>' + cols + '</cols>' : '') +
      '<sheetData>' +
      sheetData +
      '</sheetData>' +
      merges +
      '<pageMargins left="0.5" right="0.5" top="0.6" bottom="0.6" header="0.3" footer="0.3"/><pageSetup orientation="landscape" fitToHeight="0"/></worksheet>';
    const name = Xlsx.esc(String(spec.name || 'Журнал').replace(/[\\/?*[\]:]/g, ' ').slice(0, 31));
    const files = [
      {
        name: '[Content_Types].xml',
        data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>'
      },
      {
        name: '_rels/.rels',
        data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'
      },
      {
        name: 'xl/workbook.xml',
        data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="' + name + '" sheetId="1" r:id="rId1"/></sheets></workbook>'
      },
      {
        name: 'xl/_rels/workbook.xml.rels',
        data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>'
      },
      {name: 'xl/styles.xml', data: Xlsx.stylesXml()},
      {name: 'xl/worksheets/sheet1.xml', data: sheet}
    ].map(f => ({name: f.name, data: enc.encode(f.data)}));
    return Xlsx.zip(files);
  }
};
