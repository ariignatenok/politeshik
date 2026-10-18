'use strict';

/**
 * Читает значение поля формы.
 * @param {HTMLElement} r Контейнер формы.
 * @param {string} n Имя поля.
 * @returns {string} Строка.
 */
const val = (r, n) => {
  const e = r.querySelector('[name="' + n + '"]');
  return e ? e.value : '';
};
/**
 * Читает выбранный вариант радиокнопок.
 * @param {HTMLElement} r Контейнер формы.
 * @param {string} n Имя группы.
 * @returns {string} Строка.
 */
const radio = (r, n) => {
  const e = r.querySelector('[name="' + n + '"]:checked');
  return e ? e.value : '';
};
/**
 * Оборачивает поле формы в подпись.
 * @param {string} label Подпись поля.
 * @param {string} inner HTML поля.
 * @returns {string} HTML.
 */
const field = (label, inner) => '<label class="field"><span>' + label + '</span>' + inner + '</label>';
/**
 * Строит список предметов для выбора.
 * @param {string} sel Выбранный предмет.
 * @param {boolean} none Добавить пункт «без предмета».
 * @returns {string} HTML.
 */
const subjectOptions = (sel, none) =>
  (none ? '<option value="">— без предмета —</option>' : '') +
  Store.s.subjects
    .map(x => '<option value="' + x.id + '"' + (x.id === sel ? ' selected' : '') + '>' + U.esc(x.name) + '</option>')
    .join('');
/**
 * Строит нижнюю панель формы с кнопками.
 * @param {string} del Действие кнопки «Удалить» или null.
 * @param {string} okLabel Подпись кнопки сохранения (необязательно).
 * @returns {string} HTML.
 */
const foot = (del, okLabel) =>
  '<div class="modal-foot">' +
  (del ? '<button class="btn danger left" data-action="' + del + '">Удалить</button>' : '') +
  '<button class="btn" data-action="modal-close">Отмена</button><button class="btn primary" data-action="save-form">' +
  (okLabel || 'Сохранить') +
  '</button></div>';
/**
 * Открывает форму работы.
 * @param {string} id Идентификатор записи.
 */
function openWorkForm(id) {
  const w = id
    ? Store.s.works.find(x => x.id === id)
    : {
        title: '',
        type: 'Работа',
        subjectId: '',
        date: '',
        time: '',
        notes: ''
      };
  UI.open(
    id ? 'Изменить работу' : 'Новая работа',
    '<div data-form="work" data-id="' +
      (id || '') +
      '">' +
      field(
        'Название',
        '<input class="input" name="title" value="' + U.esc(w.title) + '" placeholder="Например: контрольная по ЭВМ">'
      ) +
      '<div class="row2">' +
      field(
        'Тип',
        '<select class="input" name="type">' +
          WORK_TYPES.map(t => '<option' + (t === w.type ? ' selected' : '') + '>' + t + '</option>').join('') +
          '</select>'
      ) +
      field('Предмет', '<select class="input" name="subjectId">' + subjectOptions(w.subjectId, true) + '</select>') +
      '</div>' +
      '<div class="row2">' +
      field('Дата', '<input class="input" type="date" name="date" value="' + U.esc(w.date) + '">') +
      field('Время (необязательно)', '<input class="input" type="time" name="time" value="' + U.esc(w.time) + '">') +
      '</div>' +
      field('Заметки', '<textarea class="input" name="notes" rows="3">' + U.esc(w.notes) + '</textarea>') +
      foot(null) +
      '</div>'
  );
}
/**
 * Открывает форму ДЗ.
 * @param {string} id Идентификатор записи.
 */
function openHwForm(id) {
  const h = Store.s.homework.find(x => x.id === id);
  if (!h) return;
  UI.open(
    'Изменить задание',
    '<div data-form="hw" data-id="' +
      id +
      '">' +
      field('Задание', '<textarea class="input" name="text" rows="3">' + U.esc(h.text) + '</textarea>') +
      field('Дедлайн', '<input class="input" type="date" name="deadline" value="' + U.esc(h.deadline) + '">') +
      foot(null) +
      '</div>'
  );
}
/**
 * Строит блок отмены или замены пары на дату.
 * @param {Object} l Пара.
 * @param {string} date Дата.
 * @returns {string} HTML.
 */
function chgControls(l, date) {
  return (
    '<div class="chg-box"><b>Только на один день</b><div class="row2">' +
    field('Дата', '<input class="input" type="date" id="chg-date" value="' + (date || Changes.nextDate(l)) + '">') +
    '<div class="chg-btns"><button class="btn danger sm" data-action="chg-cancel" data-id="' +
    l.id +
    '">' +
    ICONS.crossMark +
    ' Отменить пару</button><button class="btn sm" data-action="chg-replace" data-id="' +
    l.id +
    '">' +
    ICONS.repeat +
    ' Заменить</button></div></div>' +
    '<p class="md-help">Шаблон расписания не меняется: изменение действует только в выбранный день.</p></div>'
  );
}
/**
 * Открывает форму замены пары.
 * @param {Object} pre Предзаполненные значения.
 */
function openChangeForm(pre) {
  const state = Store.s,
    p = Object.assign(
      {
        date: '',
        pair: 1,
        subjectId: '',
        reason: ''
      },
      pre || {}
    );
  UI.open(
    'Замена пары',
    '<div data-form="change">' +
      '<div class="row2">' +
      field('Дата', '<input class="input" type="date" name="date" value="' + U.esc(p.date) + '">') +
      field(
        'Пара',
        '<select class="input" name="pair">' +
          state.settings.pairs
            .map(
              (x, i) =>
                '<option value="' +
                (i + 1) +
                '"' +
                (p.pair === i + 1 ? ' selected' : '') +
                '>' +
                (i + 1) +
                ' пара</option>'
            )
            .join('') +
          '</select>'
      ) +
      '</div>' +
      field('Новый предмет', '<select class="input" name="newSubjectId">' + subjectOptions(p.subjectId) + '</select>') +
      '<div class="row2">' +
      field('Преподаватель', '<input class="input" name="newTeacher" placeholder="Фамилия И.О.">') +
      field('Аудитория', '<input class="input" name="newRoom" placeholder="305">') +
      '</div>' +
      field(
        'Причина (необязательно)',
        '<input class="input" name="reason" placeholder="Например: преподаватель на больничном">'
      ) +
      foot(null, 'Заменить') +
      '</div>'
  );
}
/**
 * Открывает форму пары расписания.
 * @param {string} id Идентификатор пары.
 * @param {Object} pre Предзаполненные значения.
 * @param {string} date Дата.
 */
function openLessonForm(id, pre, date) {
  const state = Store.s,
    ws = Weeks.start(date || ui.schedWs || U.today());
  const l = id
    ? Weeks.find(id, ws)
    : Object.assign(
        {
          day: 0,
          pair: 1,
          subjectId: (
            state.subjects[0] || {
              id: '__new'
            }
          ).id,
          room: '',
          subgroup: '',
          who: '',
          start: '',
          end: ''
        },
        pre || {}
      );
  if (!l) return toast('Эта пара не найдена на выбранной неделе');
  const inTemplate = !!(id && state.schedule.some(x => x.id === id));
  const pairOpts = state.settings.pairs
    .map(
      (p, i) =>
        '<option value="' +
        (i + 1) +
        '"' +
        (l.pair === i + 1 ? ' selected' : '') +
        '>' +
        (i + 1) +
        ' пара' +
        (pairTime(i + 1) ? ' · ' + pairTime(i + 1) : '') +
        '</option>'
    )
    .join('');
  const dayOpts = DAYS_FULL.map(
    (d, i) => '<option value="' + i + '"' + (l.day === i ? ' selected' : '') + '>' + d + '</option>'
  ).join('');
  UI.open(
    id ? 'Изменить пару' : 'Новая пара',
    '<div data-form="lesson" data-id="' +
      (id || '') +
      '" data-ws="' +
      ws +
      '">' +
      field(
        'Предмет',
        '<select class="input" name="subjectId" data-change="lesson-subject">' +
          subjectOptions(l.subjectId) +
          '<option value="__new">' +
          ICONS.plus +
          ' Новый предмет…</option></select>'
      ) +
      '<label class="field new-subj" hidden><span>Название нового предмета</span><input class="input" name="newName" placeholder="Например: Физика"></label>' +
      '<div class="row2">' +
      field('День', '<select class="input" name="day">' + dayOpts + '</select>') +
      field('Пара', '<select class="input" name="pair">' + pairOpts + '</select>') +
      '</div>' +
      '<div class="row2">' +
      field('Кабинет', '<input class="input" name="room" value="' + U.esc(l.room) + '" placeholder="215">') +
      field(
        'Подгруппа / примечание',
        '<input class="input" name="subgroup" value="' + U.esc(l.subgroup) + '" placeholder="подгр.1">'
      ) +
      '</div>' +
      field(
        'Преподаватель',
        '<input class="input" name="who" value="' + U.esc(l.who) + '" placeholder="Фамилия И.О.">'
      ) +
      '<div class="row2">' +
      field(
        'Начало (если не по звонку)',
        '<input class="input" type="time" name="start" value="' + U.esc(l.start) + '">'
      ) +
      field('Конец', '<input class="input" type="time" name="end" value="' + U.esc(l.end) + '">') +
      '</div>' +
      '<p class="md-help">Сохранится только для недели ' +
      Weeks.label(ws) +
      '.</p>' +
      '<label class="check-row"><input type="checkbox" name="everyWeek"> Повторять каждую неделю (изменить шаблон)</label>' +
      (id && canEdit() ? chgControls(l, date) : '') +
      (id && inTemplate && canEdit()
        ? '<button class="btn ghost" data-action="lesson-del-all">Удалить из шаблона (все недели)</button>'
        : '') +
      foot(id ? 'lesson-del' : null) +
      '</div>',
    {
      wide: false
    }
  );
}
/**
 * Открывает форму времени пар.
 */
function openTimesForm() {
  const ps = Store.s.settings.pairs;
  UI.open(
    'Время пар',
    '<div data-form="times"><p class="md-help" style="margin:0 0 12px">Укажите начало и конец каждой пары — время появится в расписании и на главной.</p>' +
      ps
        .map(
          (p, i) =>
            '<div class="row2" style="align-items:end;margin-bottom:10px"><label class="field" style="margin:0"><span>' +
            (i + 1) +
            ' пара · начало</span><input class="input" type="time" name="s' +
            i +
            '" value="' +
            U.esc(p.start) +
            '"></label>' +
            '<label class="field" style="margin:0"><span>конец</span><input class="input" type="time" name="e' +
            i +
            '" value="' +
            U.esc(p.end) +
            '"></label></div>'
        )
        .join('') +
      '<div class="modal-foot"><button class="btn left" data-action="pair-add">＋ Пара</button>' +
      (ps.length > 1 ? '<button class="btn danger" data-action="pair-del">Убрать последнюю</button>' : '') +
      '<button class="btn" data-action="modal-close">Отмена</button><button class="btn primary" data-action="save-form">Сохранить</button></div></div>'
  );
}
/**
 * Открывает форму предмета.
 * @param {string} id Идентификатор записи.
 */
function openSubjectForm(id) {
  const x = id
    ? subj(id)
    : {
        name: '',
        short: '',
        color: COLORS[Store.s.subjects.length % COLORS.length]
      };
  UI.open(
    id ? 'Изменить предмет' : 'Новый предмет',
    '<div data-form="subject" data-id="' +
      (id || '') +
      '">' +
      field('Название', '<input class="input" name="name" value="' + U.esc(x.name) + '">') +
      field(
        'Короткое название',
        '<input class="input" name="short" value="' + U.esc(x.short) + '" placeholder="Для ячеек расписания">'
      ) +
      '<div class="field"><span class="lbl">Цвет</span><div class="swatches">' +
      COLORS.map(
        c =>
          '<label><input type="radio" name="color" value="' +
          c +
          '"' +
          (c === x.color ? ' checked' : '') +
          '><span style="background:' +
          c +
          '"></span></label>'
      ).join('') +
      '</div></div>' +
      '<label class="chk" style="margin-bottom:8px"><input type="checkbox" name="noNotes"' +
      (noNotes(x) ? ' checked' : '') +
      '> Без конспектов: карточки ведут к конспектам предмета «ОАП»</label><label class="chk" style="margin-bottom:14px"><input type="checkbox" name="hasFormulas"' +
      (x.hasFormulas ? ' checked' : '') +
      '> Вкладка «Формулы» у этого предмета</label>' +
      foot(null) +
      '</div>'
  );
}
/**
 * Открывает конспект для чтения.
 * @param {string} id Идентификатор записи.
 */
function openNoteReader(id) {
  const n = Store.s.notes.find(x => x.id === id);
  if (!n) return;
  const editable = canEdit() || !n.subjectId;
  const files = (n.files || [])
    .map(
      f =>
        '<div class="note-file"><div class="note-file-info"><b>' +
        U.esc(f.name) +
        '</b><small>' +
        sizeText(f.size) +
        '</small></div><button class="btn primary sm" data-action="note-file-dl" data-id="' +
        f.id +
        '" data-name="' +
        U.esc(f.name) +
        '">' +
        ICONS.paperclip +
        ' Скачать файл</button></div>'
    )
    .join('');
  UI.open(
    n.title || 'Конспект',
    '<div class="md">' +
      Md.render(n.text) +
      '</div>' +
      (files ? '<div class="note-files">' + files + '</div>' : '') +
      '<div class="modal-foot" style="margin-top:18px">' +
      (editable ? '<button class="btn danger left" data-action="note-del" data-id="' + id + '">Удалить</button>' : '') +
      '<button class="btn" data-action="modal-close">Закрыть</button>' +
      (editable
        ? '<button class="btn primary" data-action="note-edit" data-id="' +
          id +
          '">' +
          ICONS.pencil +
          ' Редактировать</button>'
        : '') +
      '</div>',
    {
      wide: true,
      noFocus: true
    }
  );
}
const NOTE_FILE_MAX = 5 * 1024 * 1024;
/**
 * Строит список файлов в редакторе конспекта.
 * @returns {string} HTML.
 */
function noteFilesEditHtml() {
  return ui.noteFiles.length
    ? ui.noteFiles
        .map(
          f =>
            '<div class="note-file"><div class="note-file-info"><b>' +
            U.esc(f.name) +
            '</b><small>' +
            sizeText(f.size) +
            (f.data ? ' · новый' : '') +
            '</small></div><button class="icon-btn" data-action="note-file-rm" data-id="' +
            f.id +
            '" aria-label="Убрать файл">' +
            ICONS.wastebasket +
            '</button></div>'
        )
        .join('')
    : '<small class="md-help">Файлов нет</small>';
}
/**
 * Принимает выбранный PDF или фото для конспекта: проверяет тип и размер, сжимает изображения.
 * @param {HTMLInputElement} input Поле выбора файла.
 */
async function handleNoteFile(input) {
  const f = input.files && input.files[0];
  input.value = '';
  if (!f) return;
  const isImg = /^image\//.test(f.type),
    isPdf = f.type === 'application/pdf' || /\.pdf$/i.test(f.name);
  if (!isImg && !isPdf) return toast('Подходят PDF и фотографии');
  if (!isImg && f.size > NOTE_FILE_MAX) return toast('PDF больше 5 МБ: сожмите файл');
  try {
    const data = isImg ? await compressImage(f) : await readDataUrl(f);
    ui.noteFiles.push({
      id: U.uid('nf'),
      name: isImg ? f.name.replace(/\.[^.]+$/, '') + '.jpg' : f.name,
      type: isImg ? 'image/jpeg' : 'application/pdf',
      size: isImg ? Math.round(data.length * 0.75) : f.size,
      data
    });
    const box = $('#note-files');
    if (box) box.innerHTML = noteFilesEditHtml();
  } catch (error) {
    toast('Не удалось обработать файл');
  }
}
/**
 * Открывает редактор конспекта.
 * @param {string} id Идентификатор записи.
 * @param {string} sid Идентификатор предмета.
 */
function openNoteEditor(id, sid) {
  const n = id
      ? Store.s.notes.find(x => x.id === id)
      : {
          title: '',
          text: '',
          files: []
        },
    sidv = sid === undefined ? ui.subjectId || '' : sid;
  ui.noteFiles = (n.files || []).map(f => Object.assign({}, f));
  ui.noteRemoved = [];
  const withFiles = canEdit() && sidv && Cloud.status === 'online';
  UI.open(
    id ? 'Редактировать конспект' : 'Новый конспект',
    '<div data-form="note" data-id="' +
      (id || '') +
      '" data-sid="' +
      U.esc(sidv) +
      '" class="editor">' +
      '<input class="input" name="title" placeholder="Заголовок" value="' +
      U.esc(n.title) +
      '">' +
      '<textarea class="input" name="text" placeholder="Текст конспекта…">' +
      U.esc(n.text) +
      '</textarea>' +
      '<div class="md" id="note-preview" hidden></div>' +
      (withFiles
        ? '<div class="note-files-edit"><div id="note-files">' +
          noteFilesEditHtml() +
          '</div><label class="btn sm">' +
          ICONS.paperclip +
          ' Прикрепить файл<input type="file" accept="application/pdf,image/*" data-change="note-file" hidden></label> <small class="md-help">PDF или фото, до 5 МБ</small></div>'
        : '') +
      '<div class="md-help"># заголовок · **жирный** · *курсив* · ==выделение== · `код` · - список · 1. нумерация · &gt; цитата · | таблица |</div>' +
      '<div class="modal-foot"><button class="btn left" data-action="preview-toggle">' +
      ICONS.eye +
      ' Предпросмотр</button><button class="btn" data-action="modal-close">Отмена</button><button class="btn primary" data-action="save-form">Сохранить</button></div></div>',
    {
      wide: true
    }
  );
}
/**
 * Открывает форму карточки.
 * @param {string} id Идентификатор записи.
 */
function openCardForm(id) {
  const state = Store.s;
  const c = id
    ? state.cards.find(x => x.id === id)
    : {
        subjectId: ui.subjectId,
        cat: ui.cardCat && ui.cardCat !== 'all' ? ui.cardCat : '',
        q: '',
        a: ''
      };
  const cats = [...new Set(state.cards.filter(x => x.subjectId === c.subjectId && x.cat).map(x => x.cat))];
  UI.open(
    id ? 'Изменить карточку' : 'Новая карточка',
    '<div data-form="card" data-id="' +
      (id || '') +
      '">' +
      field(
        'Вопрос',
        '<textarea class="input" name="q" rows="2" placeholder="Что такое…?">' + U.esc(c.q) + '</textarea>'
      ) +
      field(
        'Ответ (можно **жирный**, списки, ==выделение==)',
        '<textarea class="input" name="a" rows="6">' + U.esc(c.a) + '</textarea>'
      ) +
      '<div class="row2">' +
      field(
        'Категория',
        '<input class="input" name="cat" list="card-cats" value="' +
          U.esc(c.cat) +
          '" placeholder="Например: Определения"><datalist id="card-cats">' +
          cats.map(x => '<option value="' + U.esc(x) + '">').join('') +
          '</datalist>'
      ) +
      field('Предмет', '<select class="input" name="subjectId">' + subjectOptions(c.subjectId) + '</select>') +
      '</div>' +
      field(
        'Ссылка на файл (необязательно; без неё карточка ведёт к конспектам предмета)',
        '<input class="input" name="link" value="' + U.esc(c.link || '') + '" placeholder="https://…">'
      ) +
      foot(null) +
      '</div>',
    {
      wide: true
    }
  );
}
/**
 * Открывает карточку для чтения.
 * @param {string} id Идентификатор записи.
 */
function openCardReader(id) {
  const c = Store.s.cards.find(x => x.id === id);
  if (!c) return;
  const csb = subj(c.subjectId),
    lnk =
      csb && (c.link || linkTarget(csb))
        ? '<button class="btn sm" data-action="card-linked" data-id="' +
          id +
          '">' +
          ICONS.paperclip +
          ' ' +
          U.esc(c.link ? 'Открыть файл' : linkLabel(csb)) +
          '</button>'
        : '';
  UI.open(
    c.cat || 'Карточка',
    '<div style="font-size:18px;font-weight:700;margin-bottom:12px">' +
      Md.inline(c.q) +
      '</div><div class="md">' +
      Md.render(c.a) +
      '</div>' +
      '<div class="modal-foot" style="margin-top:18px">' +
      (lnk ? '<div class="left">' + lnk + '</div>' : '') +
      (canEdit() ? '<button class="btn danger" data-action="card-del" data-id="' + id + '">Удалить</button>' : '') +
      '<button class="btn" data-action="card-toggle" data-id="' +
      id +
      '">' +
      (c.known ? ICONS.undo + ' Не выучено' : '✓ Выучено') +
      '</button>' +
      (canEdit()
        ? '<button class="btn primary" data-action="card-edit" data-id="' +
          id +
          '">' +
          ICONS.pencil +
          ' Изменить</button>'
        : '') +
      '</div>',
    {
      wide: true,
      noFocus: true
    }
  );
}
/**
 * Открывает форму формулы.
 * @param {string} id Идентификатор записи.
 */
function openFormulaForm(id) {
  const sb = subj(ui.subjectId);
  const f = id
    ? sb.formulas.find(x => x.id === id)
    : {
        group: '',
        title: '',
        f: '',
        note: ''
      };
  const groups = [...new Set(sb.formulas.map(x => x.group).filter(Boolean))];
  UI.open(
    id ? 'Изменить формулу' : 'Новая формула',
    '<div data-form="formula" data-id="' +
      (id || '') +
      '">' +
      '<div class="row2">' +
      field(
        'Раздел',
        '<input class="input" name="group" list="f-groups" value="' +
          U.esc(f.group) +
          '" placeholder="Например: Определители"><datalist id="f-groups">' +
          groups.map(x => '<option value="' + U.esc(x) + '">').join('') +
          '</datalist>'
      ) +
      field(
        'Название',
        '<input class="input" name="title" value="' + U.esc(f.title) + '" placeholder="Определитель 2×2">'
      ) +
      '</div>' +
      field(
        'Формула',
        '<textarea class="input" name="f" rows="2" data-input="fm-preview" style="font-family:ui-monospace,Menlo,monospace">' +
          U.esc(f.f) +
          '</textarea>'
      ) +
      '<div class="field"><span class="lbl">Как будет выглядеть</span><div id="fm-preview">' +
      Fm.render(f.f) +
      '</div></div>' +
      '<p class="md-help" style="margin:-6px 0 14px">a_{ij} — нижний индекс · x^{2} — верхний индекс · {числитель|знаменатель} — дробь</p>' +
      field('Пояснение', '<input class="input" name="note" value="' + U.esc(f.note) + '">') +
      foot(null) +
      '</div>'
  );
}
/**
 * Открывает форму профиля.
 */
function openProfileForm() {
  const p = Cloud.profile || {},
    sg = p.subgroup || Store.s.settings.subgroup || '';
  UI.open(
    'Профиль',
    '<div data-form="profile"><div class="field"><span class="lbl">Фамилия и имя</span><div class="static-name">' +
      U.esc(p.name || '') +
      '</div></div>' +
      field(
        'Подгруппа (для английского и ИТ)',
        '<select class="input" name="subgroup"><option value="">не выбрана</option><option value="1"' +
          (sg === '1' ? ' selected' : '') +
          '>1 подгруппа</option><option value="2"' +
          (sg === '2' ? ' selected' : '') +
          '>2 подгруппа</option></select>'
      ) +
      field(
        'Дата рождения',
        '<input class="input" type="date" name="birthday" min="1940-01-01" max="' +
          U.iso(U.today()) +
          '" value="' +
          U.esc(p.birthday || '') +
          '">'
      ) +
      '<label class="check-row"><input type="checkbox" name="birthdayPublic"' +
      (p.birthdayPublic === false ? '' : ' checked') +
      '> Поздравлять меня в новостях группы</label>' +
      '<p class="md-help">Фамилию изменить нельзя — её выбирают один раз из списка группы. Ошиблись? Напишите админу.</p>' +
      '<div class="modal-foot"><button class="btn" data-action="modal-close">Отмена</button><button class="btn primary" data-action="save-form">Сохранить</button></div></div>'
  );
}
/**
 * Открывает форму справки.
 */
function openCertForm() {
  ui.draft = null;
  const t = U.iso(U.today());
  UI.open(
    'Справка или больничный',
    '<div data-form="cert">' +
      '<div class="row2">' +
      field('Тип', '<select class="input" name="kind"><option>Справка</option><option>Больничный</option></select>') +
      field(
        'Комментарий (необязательно)',
        '<input class="input" name="note" placeholder="Например: врач, поликлиника">'
      ) +
      '</div>' +
      '<div class="row2">' +
      field('С какого дня', '<input class="input" type="date" name="from" value="' + t + '">') +
      field('По какой день (включительно)', '<input class="input" type="date" name="to" value="' + t + '">') +
      '</div>' +
      '<div class="field"><span class="lbl">Фото или скриншот</span><input class="input" type="file" name="file" accept="image/*" data-change="cert-file"><div id="draft-prev" class="md-help">Фото сожмётся автоматически. PDF не подходит — сделайте фото страницы.</div></div>' +
      '<p class="md-help">Документ увидят только вы и админ группы. Загружайте только страницу, которая подтверждает дни отсутствия.</p>' +
      foot(null, 'Прикрепить') +
      '</div>'
  );
}
/**
 * Открывает форму личного файла.
 */
function openFileForm() {
  ui.draft = null;
  UI.open(
    'Прикрепить работу',
    '<div data-form="file">' +
      field('Название', '<input class="input" name="title" placeholder="Например: Лаба 3 по сетям">') +
      '<div class="row2">' +
      field('Предмет', '<select class="input" name="subjectId">' + subjectOptions('', true) + '</select>') +
      field('Заметка', '<input class="input" name="note">') +
      '</div>' +
      '<div class="field"><span class="lbl">Файл</span><input class="input" type="file" name="file" data-change="work-file"><div id="draft-prev" class="md-help">Фото сожмутся сами; другие файлы — до ~170 КБ. Видите их только вы.</div></div>' +
      foot(null, 'Прикрепить') +
      '</div>'
  );
}
/**
 * Показывает изображение, когда оно загрузится.
 * @param {string} title Заголовок окна.
 * @param {Promise<string>} promise Загрузка изображения.
 */
async function showImage(title, promise) {
  UI.open(title, '<div class="img-box"><div class="empty">Загрузка…</div></div>', {
    wide: true,
    noFocus: true
  });
  let data = null;
  try {
    data = await promise;
  } catch (error) {}
  const box = $('#modal-root .img-box');
  if (!box) return;
  if (!data) {
    box.innerHTML = '<div class="empty">Не удалось загрузить файл</div>';
    return;
  }
  box.innerHTML = /^data:image\//.test(data)
    ? '<img src="' + data + '" alt="' + U.esc(title) + '">'
    : '<div class="empty">Это не изображение — скачайте файл</div>';
}
/**
 * Открывает карточку студента для админа.
 * @param {string} uid Идентификатор студента.
 * @param {string} date0 Дата, ГГГГ-ММ-ДД (необязательно).
 */
function openStudent(uid, date0) {
  const r = studentRows().find(x => x.id === uid);
  if (!r) return;
  ui.stud = {
    uid,
    date: date0 || (ui.stud && ui.stud.uid === uid ? ui.stud.date : U.iso(U.today()))
  };
  const rg = attRange(),
    today = U.iso(U.today());
  const marks = r.marks,
    certs = r.certs,
    date = ui.stud.date;
  UI.open(
    r.p.name || 'Студент',
    '<div class="stud-modal"><div class="head-actions" style="margin-bottom:10px"><button class="btn sm primary" data-action="att-edit" data-id="' +
      uid +
      '">Изменить посещаемость</button><button class="btn sm" data-action="open-chat" data-with="' +
      uid +
      '">Написать в чат</button></div>' +
      '<p class="md-help" style="margin:0 0 10px">Заходил(а): ' +
      U.esc(fmtAgo(r.p.seen)) +
      (r.p.subgroup ? ' · подгруппа ' + U.esc(r.p.subgroup) : '') +
      ' · период: ' +
      (ui.attScope === 'all' ? 'с 15.10.2026' : monthName(ui.attMonth)) +
      '</p>' +
      statCards(r.st) +
      absCard(Att.absHours(r.marks, r.certs, r.p.subgroup)) +
      '<h3 style="margin:14px 0 8px">По предметам</h3>' +
      subjTable(r.st) +
      '<h3 style="margin:16px 0 8px">Справки и больничные</h3>' +
      (certs.length
        ? '<div class="items">' +
          certs
            .map(
              c =>
                '<div class="item"><div class="item-main"><div class="item-title">' +
                (c.kind === 'Больничный' ? ICONS.hospital : ICONS.document) +
                ' ' +
                U.esc(c.kind) +
                ' · ' +
                U.esc(U.fmtShort(U.fromISO(c.from))) +
                ' — ' +
                U.esc(U.fmtShort(U.fromISO(c.to))) +
                '</div>' +
                '<div class="item-meta">' +
                (c.note ? '<span class="tag">' + U.esc(c.note) + '</span>' : '') +
                '<span class="tag status ' +
                (c.confirmed ? 'prep' : 'past') +
                '">' +
                (c.confirmed ? 'Подтверждена админом' : 'Ждёт подтверждения') +
                '</span></div>' +
                '</div><div class="item-actions"><button class="btn sm" data-action="cert-view" data-uid="' +
                uid +
                '" data-id="' +
                c.id +
                '">' +
                ICONS.picture +
                ' Фото</button></div></div>'
            )
            .join('') +
          '</div>'
        : '<div class="empty" style="padding:14px">Справок нет</div>') +
      '<h3 style="margin:16px 0 8px">Исправить отметки за день</h3>' +
      '<div class="field"><input class="input" type="date" id="stud-date" data-change="stud-date" value="' +
      date +
      '" min="' +
      ATT_START +
      '" max="' +
      today +
      '"></div><div id="stud-day">' +
      attDayHtml(date, marks, certs, r.p.subgroup, uid, false) +
      '</div>' +
      '</div>',
    {
      wide: true,
      noFocus: true
    }
  );
}
/**
 * Открывает форму работы группы.
 * @param {string} id Идентификатор записи.
 */
function openGWorkForm(id) {
  const w = id
    ? Cloud.gworks.find(x => x.id === id)
    : {
        title: '',
        type: 'Работа',
        subjectId: '',
        date: '',
        time: '',
        notes: ''
      };
  if (!w) return;
  UI.open(
    id ? 'Изменить работу группы' : 'Работа для всей группы',
    '<div data-form="gwork" data-id="' +
      (id || '') +
      '">' +
      field(
        'Название',
        '<input class="input" name="title" value="' + U.esc(w.title) + '" placeholder="Например: контрольная по ЭВМ">'
      ) +
      '<div class="row2">' +
      field(
        'Тип',
        '<select class="input" name="type">' +
          WORK_TYPES.map(t => '<option' + (t === w.type ? ' selected' : '') + '>' + t + '</option>').join('') +
          '</select>'
      ) +
      field('Предмет', '<select class="input" name="subjectId">' + subjectOptions(w.subjectId, true) + '</select>') +
      '</div>' +
      '<div class="row2">' +
      field('Дата', '<input class="input" type="date" name="date" value="' + U.esc(w.date) + '">') +
      field(
        'Время (необязательно)',
        '<input class="input" type="time" name="time" value="' + U.esc(w.time || '') + '">'
      ) +
      '</div>' +
      field('Заметки', '<textarea class="input" name="notes" rows="3">' + U.esc(w.notes || '') + '</textarea>') +
      foot(null) +
      '</div>'
  );
}
/**
 * Обрабатывает выбранный файл или фото перед сохранением.
 * @param {HTMLInputElement} input Поле выбора файла.
 * @param {boolean} imageOnly Принимать только изображения.
 */
async function handleDraftFile(input, imageOnly) {
  const f = input.files && input.files[0],
    prev = $('#draft-prev');
  ui.draft = null;
  if (!f) return;
  try {
    if (/^image\//.test(f.type)) {
      const data = await compressImage(f);
      ui.draft = {
        data,
        name: f.name.replace(/\.[^.]+$/, '') + '.jpg',
        type: 'image/jpeg',
        size: Math.round(data.length * 0.75)
      };
      if (prev)
        prev.innerHTML =
          '<img src="' +
          data +
          '" alt="" style="max-width:100%;max-height:180px;border-radius:10px"><div>Готово: ' +
          Math.round(ui.draft.size / 1024) +
          ' КБ</div>';
    } else if (imageOnly) {
      toast('Для справки нужна фотография (JPG или PNG)');
      input.value = '';
    } else if (f.size <= 170000) {
      const data = await readDataUrl(f);
      ui.draft = {
        data,
        name: f.name,
        type: f.type || 'application/octet-stream',
        size: f.size
      };
      if (prev) prev.textContent = 'Файл готов: ' + f.name + ' (' + Math.max(1, Math.round(f.size / 1024)) + ' КБ)';
    } else {
      toast('Файл слишком большой (до ~170 КБ). Сделайте фото или сожмите файл.');
      input.value = '';
    }
  } catch (error) {
    toast('Не удалось обработать файл');
    input.value = '';
  }
}
/**
 * Открывает форму преподавателя.
 * @param {string} id Идентификатор записи.
 */
function openTeacherForm(id) {
  const t = id
    ? Store.s.teachers.find(x => x.id === id)
    : {
        name: '',
        subjectIds: [],
        email: '',
        phone: '',
        room: '',
        notes: ''
      };
  UI.open(
    id ? 'Изменить преподавателя' : 'Новый преподаватель',
    '<div data-form="teacher" data-id="' +
      (id || '') +
      '">' +
      field('ФИО', '<input class="input" name="name" value="' + U.esc(t.name) + '">') +
      '<div class="field"><span class="lbl">Предметы</span><div class="checks">' +
      Store.s.subjects
        .map(
          x =>
            '<label><input type="checkbox" name="subj" value="' +
            x.id +
            '"' +
            (t.subjectIds.includes(x.id) ? ' checked' : '') +
            '><span>' +
            U.esc(x.short || x.name) +
            '</span></label>'
        )
        .join('') +
      '</div></div>' +
      '<div class="row2">' +
      field('Email', '<input class="input" type="email" name="email" value="' + U.esc(t.email) + '">') +
      field('Телефон', '<input class="input" type="tel" name="phone" value="' + U.esc(t.phone) + '">') +
      '</div>' +
      field('Кабинет', '<input class="input" name="room" value="' + U.esc(t.room) + '">') +
      field('Заметки', '<textarea class="input" name="notes" rows="5">' + U.esc(t.notes) + '</textarea>') +
      foot(null) +
      '</div>'
  );
}
/**
 * Открывает форму новости.
 */
function openNewsForm() {
  UI.open(
    'Новая новость',
    '<div data-form="news">' +
      field('Заголовок', '<input class="input" name="title" maxlength="200" placeholder="О чём новость">') +
      field('Текст', '<textarea class="input" name="body" rows="6" placeholder="Подробности"></textarea>') +
      field('Дата', '<input class="input" type="date" name="date" value="' + U.iso(U.today()) + '">') +
      foot(null, 'Опубликовать') +
      '</div>'
  );
}
/**
 * Открывает окно, где админ выбирает П, О или Н по каждой паре дня и сохраняет их.
 * @param {string} uid Идентификатор студента.
 * @param {string} date Дата, ГГГГ-ММ-ДД (необязательно).
 */
function openAttendanceEditor(uid, date) {
  const r = studentRows().find(x => x.id === uid);
  if (!r) return;
  const today = U.iso(U.today()),
    day = date || (ui.stud && ui.stud.uid === uid ? ui.stud.date : today),
    prs = Att.pairs(day, r.p.subgroup);
  /**
   * Строит строку пары в редакторе посещаемости.
   * @param {Object} pr Пара дня.
   * @returns {string} HTML.
   */
  const row = pr => {
    const cur = r.marks[day + '|' + pr.pair] || '',
      l = pr.lessons[0],
      sb = subj(l.subjectId);
    /**
     * Строит вариант отметки в редакторе.
     * @param {*} v Значение.
     * @param {string} label Подпись.
     * @returns {string} HTML.
     */
    const opt = (v, label) =>
      '<label class="ed-opt ' +
      (v ? ST_INFO[v][1] : 'none') +
      '" title="' +
      label +
      '"><input type="radio" name="p' +
      pr.pair +
      '" value="' +
      v +
      '"' +
      (cur === v ? ' checked' : '') +
      '><span>' +
      (v ? v.toUpperCase() : '—') +
      '</span></label>';
    return (
      '<div class="ed-row" data-pair="' +
      pr.pair +
      '"><div class="ed-name"><b>' +
      pr.pair +
      '. ' +
      U.esc(sb ? sb.short || sb.name : '') +
      '</b><small>' +
      (l.room ? 'ауд. ' + U.esc(l.room) : '') +
      '</small></div>' +
      '<div class="ed-opts">' +
      opt('п', 'Присутствовал(а)') +
      opt('о', 'Опоздал(а)') +
      opt('н', 'Нет') +
      opt('', 'Нет отметки') +
      '</div></div>'
    );
  };
  UI.open(
    'Изменить посещаемость: ' + (r.p.name || 'студент'),
    '<div data-form="att-edit" data-uid="' +
      uid +
      '" data-date="' +
      day +
      '">' +
      field(
        'Дата',
        '<input class="input" type="date" name="date" data-change="att-edit-date" value="' +
          day +
          '" min="' +
          ATT_START +
          '" max="' +
          today +
          '">'
      ) +
      (Att.covered(r.certs, day)
        ? '<p class="md-help">В этот день у студента справка: пары считаются «по справке».</p>'
        : '') +
      (prs.length ? prs.map(row).join('') : '<div class="empty">В этот день у студента пар нет</div>') +
      '<div class="modal-foot"><button class="btn" data-action="modal-close">Отмена</button><button class="btn primary" data-action="save-form">Сохранить</button></div></div>'
  );
}
