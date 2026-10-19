'use strict';

const Solutions = {
  fileMax: 300000,
  filesPerItem: 3,
  timer: null,
  /**
   * Возвращает все готовые решения по предмету, новые сверху.
   * @param {string} subjectId Идентификатор предмета.
   * @returns {Array<Object>} Массив.
   */
  all(subjectId) {
    const out = [];
    Object.keys(Cloud.solutions).forEach(uid => {
      (Cloud.solutions[uid] || []).forEach(item => {
        if (item.subjectId === subjectId)
          out.push(
            Object.assign(
              {
                uid
              },
              item
            )
          );
      });
    });
    return out.sort((a, b) => String(b.at).localeCompare(String(a.at)));
  },
  /**
   * Считает решения по предмету.
   * @param {string} subjectId Идентификатор предмета.
   * @returns {number} Число.
   */
  count(subjectId) {
    return Solutions.all(subjectId).length;
  },
  /**
   * Проверяет, может ли пользователь удалить решение: автор или админ.
   * @param {Object} item Решение.
   * @returns {boolean} true, если условие выполнено.
   */
  canDelete(item) {
    return Cloud.isAdmin || item.uid === Cloud.uid;
  },
  /**
   * Включает обновление решений, пока открыта вкладка.
   */
  ensurePolling() {
    if (Solutions.timer || Cloud.status !== 'online') return;
    const refresh = async () => {
      if (ui.tab !== 'subjects' || ui.subjTab !== 'solutions') {
        clearInterval(Solutions.timer);
        Solutions.timer = null;
        return;
      }
      if (await Cloud.refreshSolutions()) App.renderSoft();
    };
    Solutions.timer = setInterval(refresh, 15000);
    refresh();
  },
  /**
   * Загружает файлы и сохраняет новое решение.
   * @param {string} subjectId Предмет.
   * @param {string} title Название.
   * @param {string} text Текст решения.
   * @returns {Promise<Object>} результат записи.
   */
  async save(subjectId, title, text) {
    const files = ui.solFiles || [];
    for (const f of files) {
      const stored = await Cloud.addSolutionFile(f);
      if (!stored.ok)
        return {
          ok: false,
          error: stored.error
        };
    }
    const item = {
      id: U.uid('sol'),
      subjectId,
      title,
      text,
      author: CampusMap.shortName(),
      at: new Date().toISOString(),
      files: files.map(f => ({
        id: f.id,
        name: f.name,
        type: f.type,
        size: f.size
      }))
    };
    const items = (Cloud.solutions[Cloud.uid] || []).concat([item]);
    const result = await Cloud.saveSolutions(items);
    if (result.ok) Cloud.solutions[Cloud.uid] = items;
    return result;
  },
  /**
   * Удаляет решение вместе с его файлами.
   * @param {string} uid Автор решения.
   * @param {string} id Идентификатор решения.
   * @returns {Promise<Object>} результат.
   */
  async remove(uid, id) {
    const before = Cloud.solutions[uid] || [],
      target = before.find(x => x.id === id);
    if (!target)
      return {
        ok: true
      };
    const items = before.filter(x => x.id !== id),
      result = await Cloud.saveSolutions(items, uid);
    if (!result.ok) return result;
    Cloud.solutions[uid] = items;
    for (const f of target.files || []) await Cloud.delSolutionFile(uid, f.id);
    return {
      ok: true
    };
  }
};
/**
 * Строит вкладку «Готовое ДЗ»: плашка-предупреждение и список решений.
 * @param {Object} subject Предмет.
 * @returns {string} HTML.
 */
function solutionsBody(subject) {
  Solutions.ensurePolling();
  const list = Solutions.all(subject.id);
  const cards = list
    .map(item => {
      const files = (item.files || [])
        .map(
          f =>
            '<button class="btn sm" data-action="sol-file-dl" data-uid="' +
            item.uid +
            '" data-id="' +
            U.esc(f.id) +
            '" data-name="' +
            U.esc(f.name) +
            '">' +
            ICONS.paperclip +
            ' ' +
            U.esc(f.name) +
            ' · ' +
            sizeText(f.size) +
            '</button>'
        )
        .join('');
      return (
        '<article class="card sol-card"><header><div><h3>' +
        U.esc(item.title || 'Решение') +
        '</h3><small>' +
        U.esc(item.author || 'Студент') +
        ' · ' +
        U.esc(U.fmtShort(new Date(item.at))) +
        '</small></div>' +
        (Solutions.canDelete(item)
          ? '<button class="icon-btn" data-action="sol-del" data-uid="' +
            item.uid +
            '" data-id="' +
            U.esc(item.id) +
            '" aria-label="Удалить решение">' +
            ICONS.wastebasket +
            '</button>'
          : '') +
        '</header>' +
        (item.text ? '<pre class="sol-text">' + U.esc(item.text) + '</pre>' : '') +
        (files ? '<div class="sol-files">' + files + '</div>' : '') +
        '</article>'
      );
    })
    .join('');
  return (
    '<div class="sol-warn" role="alert"><span class="sol-warn-ico">' +
    ICONS.warning +
    '</span><b>СЛОВО В СЛОВО НЕ КАТАТЬ! ПРОВЕРЯЙТЕ И ПЕРЕДЕЛЫВАЙТЕ ПОД СЕБЯ</b></div>' +
    '<div class="head-actions" style="margin:0 0 14px"><button class="btn primary" data-action="sol-add">＋ Добавить решение</button></div>' +
    (Cloud.status !== 'online'
      ? '<p class="md-help">Чтобы решения видели одногруппники, нужен вход в аккаунт.</p>'
      : '') +
    (cards || '<div class="empty">Пока нет готовых решений по этому предмету. Добавьте первое: текст или файл.</div>')
  );
}
/**
 * Открывает форму нового решения.
 */
function openSolutionForm() {
  if (Cloud.status !== 'online') return toast('Решения хранятся в облаке: нужен вход в аккаунт');
  ui.solFiles = [];
  UI.open(
    'Готовое ДЗ',
    '<div data-form="solution" data-sid="' +
      U.esc(ui.subjectId || '') +
      '">' +
      '<div class="sol-warn small" role="alert"><span class="sol-warn-ico">' +
      ICONS.warning +
      '</span><b>СЛОВО В СЛОВО НЕ КАТАТЬ! ПРОВЕРЯЙТЕ И ПЕРЕДЕЛЫВАЙТЕ ПОД СЕБЯ</b></div>' +
      field(
        'Название',
        '<input class="input" name="title" placeholder="Например: Лаба 3, вариант 5" maxlength="120">'
      ) +
      field(
        'Решение (текст, код, ответы)',
        '<textarea class="input" name="text" rows="7" placeholder="Вставьте решение или опишите ход работы" maxlength="8000"></textarea>'
      ) +
      '<div class="field"><span class="lbl">Файлы (фото или PDF)</span><input class="input" type="file" name="file" accept="image/*,application/pdf" data-change="sol-file"><div id="sol-files" class="md-help">До ' +
      Solutions.filesPerItem +
      ' файлов. Фото сожмутся сами, PDF до 300 КБ.</div></div>' +
      foot(null, 'Опубликовать') +
      '</div>'
  );
}
/**
 * Строит список прикреплённых к решению файлов.
 * @returns {string} HTML.
 */
function solutionFilesHtml() {
  const files = ui.solFiles || [];
  if (!files.length) return 'До ' + Solutions.filesPerItem + ' файлов. Фото сожмутся сами, PDF до 300 КБ.';
  return files
    .map(
      (f, i) =>
        '<span class="note-file">' +
        U.esc(f.name) +
        ' · ' +
        sizeText(f.size) +
        ' <button class="icon-btn" data-action="sol-file-rm" data-index="' +
        i +
        '" aria-label="Убрать файл">' +
        ICONS.crossMark +
        '</button></span>'
    )
    .join(' ');
}
/**
 * Принимает файл для решения: сжимает фото, проверяет PDF.
 * @param {HTMLInputElement} input Поле выбора файла.
 */
async function handleSolutionFile(input) {
  const file = input.files && input.files[0];
  input.value = '';
  if (!file) return;
  const isImage = /^image\//.test(file.type),
    isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
  if (!isImage && !isPdf) return toast('Подходят фото и PDF');
  if ((ui.solFiles || []).length >= Solutions.filesPerItem)
    return toast('Не больше ' + Solutions.filesPerItem + ' файлов');
  if (isPdf && file.size > Solutions.fileMax)
    return toast('PDF больше 300 КБ: сожмите файл или сфотографируйте страницы');
  try {
    const data = isImage ? await compressImage(file) : await readDataUrl(file);
    ui.solFiles.push({
      id: U.uid('sf'),
      name: isImage ? file.name.replace(/\.[^.]+$/, '') + '.jpg' : file.name,
      type: isImage ? 'image/jpeg' : 'application/pdf',
      size: isImage ? Math.round(data.length * 0.75) : file.size,
      data
    });
    const box = document.getElementById('sol-files');
    if (box) box.innerHTML = solutionFilesHtml();
  } catch (error) {
    toast('Не удалось обработать файл');
  }
}
