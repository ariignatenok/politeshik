'use strict';

const Backup = {
  /**
   * Собирает резервную копию данных.
   * @returns {string} JSON.
   */
  json() {
    return JSON.stringify(Store.s, null, 2);
  },

  /**
   * Скачивает резервную копию файлом.
   */
  async download() {
    const text = Backup.json(),
      name = 'politeshik-' + U.iso(new Date()) + '.json';
    let dl = null;
    try {
      if (window.claude && typeof window.claude.use === 'function') dl = await window.claude.use('downloads');
    } catch (e) {}
    if (dl) {
      try {
        await dl.save({filename: name, data: text});
        toast('Файл сохранён');
      } catch (e) {
        if (!e || e.code !== 'declined') toast('Не удалось сохранить — скопируйте текст');
        if (!e || e.code !== 'declined') Backup.show();
      }
      return;
    }
    try {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([text], {type: 'application/json'}));
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      toast('Скачивание запущено');
    } catch (e) {
      Backup.show();
    }
  },
  /**
   * Показывает резервную копию текстом в окне.
   */
  show() {
    UI.open(
      'Экспорт: JSON',
      '<p class="md-help" style="margin:0 0 10px">Скопируйте текст и сохраните в заметки или файл — потом его можно вставить в «Импорт».</p>' +
        '<textarea class="input" id="json-out" rows="14" readonly style="font-family:ui-monospace,Menlo,monospace;font-size:12px">' +
        U.esc(Backup.json()) +
        '</textarea>' +
        '<div class="modal-foot"><button class="btn" data-action="modal-close">Закрыть</button><button class="btn primary" data-action="copy-json">' +
        ICONS.clipboard +
        ' Копировать</button></div>',
      {wide: true, noFocus: true}
    );
  },
  /**
   * Копирует резервную копию в буфер обмена.
   */
  async copy() {
    const ta = $('#json-out');
    if (!ta) return;
    try {
      await navigator.clipboard.writeText(ta.value);
      toast('Скопировано');
    } catch (e) {
      ta.select();
      try {
        document.execCommand('copy');
        toast('Скопировано');
      } catch (_) {
        toast('Выделите текст и скопируйте вручную');
      }
    }
  },
  /**
   * Открывает окно для вставки копии.
   */
  pasteDialog() {
    UI.open(
      'Импорт: вставьте JSON',
      '<textarea class="input" id="import-text" rows="12" placeholder="{ &quot;subjects&quot;: [...] }" style="font-family:ui-monospace,Menlo,monospace;font-size:12px"></textarea>' +
        '<div class="modal-foot"><button class="btn" data-action="modal-close">Отмена</button><button class="btn primary" data-action="import-run">Импортировать</button></div>',
      {wide: true}
    );
  },

  /**
   * Загружает данные из текста резервной копии.
   * @param {string} text Текст резервной копии.
   */
  async run(text) {
    let d;
    try {
      d = JSON.parse(text);
    } catch (e) {
      return toast('Это не JSON — проверьте текст');
    }
    const keys = ['subjects', 'teachers', 'works', 'homework', 'notes', 'schedule'];
    if (!d || typeof d !== 'object' || !keys.some(k => Array.isArray(d[k])))
      return toast('Не похоже на данные планировщика');
    if (!(await UI.confirm('Заменить текущие данные импортируемыми? Это действие нельзя отменить.', 'Заменить')))
      return;
    UI.close();
    ui.subjectId = null;
    Store.replace(d);
    toast('Данные импортированы');
  },
  /**
   * Читает файл резервной копии и загружает данные.
   * @param {HTMLInputElement} input Поле выбора файла.
   */
  async file(input) {
    const f = input.files && input.files[0];
    if (!f) return;
    try {
      const text = await (f.text
        ? f.text()
        : new Promise((res, rej) => {
            const r = new FileReader();
            r.onload = () => res(r.result);
            r.onerror = rej;
            r.readAsText(f);
          }));
      await Backup.run(text);
    } catch (e) {
      toast('Не удалось прочитать файл');
    }
    input.value = '';
  }
};
