'use strict';

/**
 * Проверяет, что у предмета нет конспектов.
 * @param {Object} sb Предмет.
 * @returns {boolean} true, если условие выполнено.
 */
const noNotes = sb => (sb.noNotes !== undefined ? !!sb.noNotes : sb.id === 's_mdk0101' || sb.id === 's_mdk0102');
/**
 * Возвращает предмет, к чьим конспектам ведут карточки.
 * @param {Object} sb Предмет.
 * @returns {string} Строка.
 */
const linkTarget = sb => (noNotes(sb) ? sb.linkNotesTo || 's_oap' : '');
/**
 * Подписывает кнопку перехода к конспектам.
 * @param {Object} sb Предмет.
 * @returns {string} Строка.
 */
function linkLabel(sb) {
  const t = subj(linkTarget(sb));
  if (!t) return 'Открыть конспект';
  const tt = teachersOf(t.id)[0];
  return 'Открыть конспект: ' + (t.short || t.name) + (tt ? ' · ' + surname(tt.name) : '');
}
/**
 * Строит список предметов.
 * @returns {string} HTML.
 */
function subjectCards() {
  const state = Store.s,
    q = U.norm(ui.subjQuery);
  const list = state.subjects.filter(x => !q || U.norm(x.name + ' ' + x.short).includes(q));
  if (!list.length) return empty(ICONS.books, 'Ничего не найдено');
  return (
    '<div class="cards">' +
    list
      .map(x => {
        const hw = state.homework.filter(h => h.subjectId === x.id && !h.done).length,
          nn = state.notes.filter(n => n.subjectId === x.id).length,
          cc = state.cards.filter(c => c.subjectId === x.id).length;
        const tt = teachersOf(x.id)
          .map(t => surname(t.name))
          .join(', ');
        return (
          '<button class="scard" style="--c:' +
          x.color +
          '" data-action="subj-open" data-id="' +
          x.id +
          '"><h3>' +
          U.esc(x.short || x.name) +
          '</h3>' +
          '<div class="sub">' +
          U.esc(x.name) +
          (tt ? '<br>' + ICONS.user + ' ' + U.esc(tt) : '') +
          '</div><div class="meta"><span class="tag">' +
          ICONS.memo +
          ' ДЗ: ' +
          hw +
          '</span>' +
          (noNotes(x) ? '' : '<span class="tag">' + ICONS.notebook + ' Конспекты: ' + nn + '</span>') +
          (cc ? '<span class="tag">' + ICONS.jokerCard + ' ' + cc + '</span>' : '') +
          (x.hasFormulas ? '<span class="tag">∑ формулы</span>' : '') +
          '</div></button>'
        );
      })
      .join('') +
    '</div>'
  );
}
/**
 * Строит список ДЗ предмета.
 * @param {Object} sb Предмет.
 * @returns {string} HTML.
 */
function hwList(sb) {
  const hs = Store.s.homework
    .filter(h => h.subjectId === sb.id)
    .sort((a, b) => hwUpcoming(b) - hwUpcoming(a) || ((a.deadline || '9999') > (b.deadline || '9999') ? 1 : -1));
  if (!hs.length) return emptyMascot('Ура, домашки нет!', 'happy');
  return '<div class="items">' + hs.map(hwRow).join('') + '</div>';
}
/**
 * Сравнивает конспекты для сортировки.
 * @param {Object} a Первый конспект.
 * @param {Object} b Второй конспект.
 * @returns {number} Число.
 */
const noteSort = (a, b) => {
  const ao = a.order != null,
    bo = b.order != null;
  if (ao && bo) return a.order - b.order;
  if (ao !== bo) return ao ? 1 : -1;
  return String(b.updated).localeCompare(String(a.updated));
};
/**
 * Строит список конспектов предмета.
 * @param {Object} sb Предмет.
 * @returns {string} HTML.
 */
function noteList(sb) {
  const q = U.norm(ui.noteQuery);
  const ns = Store.s.notes
    .filter(n => n.subjectId === sb.id && (!q || U.norm(n.title + ' ' + n.text).includes(q)))
    .sort(noteSort);
  if (!ns.length) return empty(ICONS.notebook, q ? 'Ничего не найдено' : 'Конспектов пока нет');
  return (
    '<div class="cards">' +
    ns
      .map(
        n =>
          '<button class="note-card" data-action="note-open" data-id="' +
          n.id +
          '"><b>' +
          U.esc(n.title || 'Без заголовка') +
          '</b><p>' +
          U.esc(
            n.text
              .replace(/[#*`>|_=~-]/g, ' ')
              .replace(/\s+/g, ' ')
              .trim()
              .slice(0, 150)
          ) +
          '</p><small>' +
          new Date(n.updated).toLocaleDateString('ru-RU') +
          ((n.files || []).length ? ' · ' + ICONS.paperclip + ' ' + n.files.length : '') +
          '</small></button>'
      )
      .join('') +
    '</div>'
  );
}
/**
 * Строит список материалов предмета.
 * @param {Object} sb Предмет.
 * @returns {string} HTML.
 */
function linkList(sb) {
  if (!sb.links.length) return empty(ICONS.link, 'Материалов пока нет');
  return (
    '<div class="items">' +
    sb.links
      .map(
        (l, i) =>
          '<div class="link-row">' +
          ICONS.link +
          '<a href="' +
          U.esc(l.url) +
          '" target="_blank" rel="noopener noreferrer">' +
          U.esc(l.title || l.url) +
          '<small>' +
          U.esc(l.url) +
          '</small></a>' +
          '<button class="icon-btn" data-action="link-del" data-i="' +
          i +
          '" aria-label="Удалить ссылку">' +
          ICONS.wastebasket +
          '</button></div>'
      )
      .join('') +
    '</div>'
  );
}
/**
 * Возвращает карточки предмета.
 * @param {Object} sb Предмет.
 * @returns {Array<Object>} Массив.
 */
const deckCards = sb => Store.s.cards.filter(c => c.subjectId === sb.id);
/**
 * Возвращает тему карточки.
 * @param {Object} c Запись.
 * @returns {string} Строка.
 */
const catOf = c => c.cat || 'Без категории';
/**
 * Собирает темы карточек.
 * @param {Array<Object>} cs Карточки.
 * @returns {Array<string>} Массив.
 */
function cardCats(cs) {
  const m = new Map();
  cs.forEach(c => m.set(catOf(c), (m.get(catOf(c)) || 0) + 1));
  return m;
}
/**
 * Возвращает карточки с учётом темы и поиска.
 * @param {Object} sb Предмет.
 * @returns {Array<Object>} Массив.
 */
function filteredCards(sb) {
  const q = U.norm(ui.cardQuery);
  return deckCards(sb).filter(
    c =>
      (ui.cardCat === 'all' || catOf(c) === ui.cardCat) &&
      (!ui.cardUnknown || !c.known) &&
      (!q || U.norm(c.q + ' ' + c.a).includes(q))
  );
}
/**
 * Строит список карточек.
 * @param {Object} sb Предмет.
 * @returns {string} HTML.
 */
function cardList(sb) {
  const cs = filteredCards(sb);
  if (!cs.length)
    return empty(ICONS.jokerCard, ui.cardUnknown ? 'Невыученных карточек нет — отлично!' : 'Карточек не найдено');
  return (
    '<div class="crows">' +
    cs
      .map(
        c =>
          '<button class="crow' +
          (c.known ? ' ok' : '') +
          '" data-action="card-open" data-id="' +
          c.id +
          '"><span class="dot"></span><span class="crow-q">' +
          Md.inline(c.q) +
          '</span>' +
          (c.cat ? '<span class="tag">' + U.esc(c.cat) + '</span>' : '') +
          '</button>'
      )
      .join('') +
    '</div>'
  );
}
/**
 * Строит вкладку карточек предмета.
 * @param {Object} sb Предмет.
 * @returns {string} HTML.
 */
function cardsBody(sb) {
  if (ui.study && ui.study.sid === sb.id) return studyView(sb);
  const all = deckCards(sb),
    known = all.filter(c => c.known).length,
    pct = all.length ? Math.round((known * 100) / all.length) : 0,
    cats = cardCats(all);
  return (
    '<div class="deck-head"><div class="deck-stat"><b>' +
    known +
    ' / ' +
    all.length +
    '</b><small>выучено · ' +
    pct +
    '%</small><div class="progress"><i style="width:' +
    pct +
    '%"></i></div></div>' +
    '<div class="head-actions"><button class="btn primary" data-action="study-start">' +
    ICONS.playRight +
    ' Учить</button><button class="btn" data-action="study-exam" title="20 случайных карточек без подсказок: сдать без ошибок">' +
    ICONS.brain +
    ' Экзамен</button><button class="btn" data-action="card-add">＋ Карточка</button></div></div>' +
    (cats.size > 1
      ? '<div class="chips"><button class="fchip' +
        (ui.cardCat === 'all' ? ' on' : '') +
        '" data-action="card-cat" data-cat="all">Все · ' +
        all.length +
        '</button>' +
        [...cats]
          .map(
            e =>
              '<button class="fchip' +
              (ui.cardCat === e[0] ? ' on' : '') +
              '" data-action="card-cat" data-cat="' +
              U.esc(e[0]) +
              '">' +
              U.esc(e[0]) +
              ' · ' +
              e[1] +
              '</button>'
          )
          .join('') +
        '</div>'
      : '') +
    '<div class="searchbar"><input class="input" id="cardQ" placeholder="' +
    ICONS.magnifier +
    ' Поиск по карточкам…" value="' +
    U.esc(ui.cardQuery) +
    '" data-input="card-search">' +
    '<div class="seg"><button class="' +
    (!ui.cardUnknown ? 'on' : '') +
    '" data-action="card-unknown" data-v="0">Все</button><button class="' +
    (ui.cardUnknown ? 'on' : '') +
    '" data-action="card-unknown" data-v="1">Невыученные</button></div>' +
    '<label class="chk"><input type="checkbox" data-change="card-shuffle"' +
    (ui.cardShuffle ? ' checked' : '') +
    '> перемешать</label></div>' +
    '<div id="card-list">' +
    cardList(sb) +
    '</div>'
  );
}
/**
 * Строит экран заучивания карточек.
 * @param {Object} sb Предмет.
 * @returns {string} HTML.
 */
function studyView(sb) {
  const st = ui.study,
    total = st.ids.length;
  if (st.i >= total) {
    return (
      '<div class="study done"><div class="big">' +
      ICONS.partyPopper +
      '</div><h2>' +
      (st.exam
        ? st.no === 0
          ? 'Экзамен сдан без ошибок! ' + ICONS.brain
          : 'Экзамен: ошибок — ' + st.no
        : 'Круг пройден') +
      '</h2><p style="color:var(--muted)">Знаю: <b>' +
      st.yes +
      '</b> · Повторить: <b>' +
      st.no +
      '</b></p>' +
      '<div class="head-actions" style="justify-content:center">' +
      (st.missed.length
        ? '<button class="btn primary" data-action="study-missed">↻ Повторить ошибки (' +
          st.missed.length +
          ')</button>'
        : '') +
      '<button class="btn" data-action="study-start">Ещё раз</button><button class="btn ghost" data-action="study-exit">Закончить</button></div></div>'
    );
  }
  const c = Store.s.cards.find(x => x.id === st.ids[st.i]);
  if (!c) {
    st.i++;
    return studyView(sb);
  }
  const pct = Math.round((st.i * 100) / total);
  return (
    '<div class="study"><div class="study-top"><button class="btn ghost sm" data-action="study-exit">← Выйти</button>' +
    (st.exam ? '<span class="tag">' + ICONS.brain + ' Экзамен</span>' : '') +
    (c.cat ? '<span class="tag">' + U.esc(c.cat) + '</span>' : '') +
    '<span class="study-n">' +
    (st.i + 1) +
    ' / ' +
    total +
    '</span></div>' +
    '<div class="progress"><i style="width:' +
    pct +
    '%"></i></div>' +
    '<div class="flip" data-action="study-flip" tabindex="0" role="button" aria-label="Перевернуть карточку">' +
    (st.flip
      ? '<div class="face back rise"><small>Ответ</small><div class="md">' +
        Md.render(c.a) +
        '</div>' +
        (subj(c.subjectId) && (c.link || linkTarget(subj(c.subjectId)))
          ? '<div class="study-link"><button class="btn sm" data-action="card-linked" data-id="' +
            c.id +
            '">' +
            ICONS.paperclip +
            ' ' +
            U.esc(c.link ? 'Открыть файл' : linkLabel(subj(c.subjectId))) +
            '</button></div>'
          : '') +
        '</div>'
      : '<div class="face front rise"><small>Вопрос</small><div class="qtxt">' +
        Md.inline(c.q) +
        '</div><span class="tap">нажмите, чтобы увидеть ответ</span></div>') +
    '</div><div class="study-actions">' +
    (st.flip
      ? '<button class="btn danger" data-action="study-no">↻ Повторить</button><button class="btn primary" data-action="study-yes">✓ Знаю</button>'
      : '<button class="btn primary" data-action="study-flip">Показать ответ</button>') +
    '</div>' +
    '<p class="hint" style="text-align:center">Пробел — перевернуть · → знаю · ← повторить</p></div>'
  );
}
/**
 * Принимает ответ «знаю» или «повторить» и переходит дальше.
 * @param {boolean} known Знает ли студент карточку.
 */
function studyAnswer(known) {
  const st = ui.study;
  if (!st || st.i >= st.ids.length) return;
  const id = st.ids[st.i],
    c = Store.s.cards.find(x => x.id === id);
  if (c && !st.exam) c.known = known;
  if (known) st.yes++;
  else {
    st.no++;
    st.missed.push(id);
  }
  st.i++;
  st.flip = false;
  Store.commit();
  if (st.i >= st.ids.length) {
    if (st.exam && st.no === 0 && st.ids.length >= 10) {
      Store.s.meta.examPerfect = true;
      Store.save();
      Mascot.celebrate('Экзамен без ошибок! ' + ICONS.brain);
    } else if (!st.exam && st.yes >= 10) Mascot.celebrate('Выучено карточек: ' + st.yes + ' ' + ICONS.jokerCard);
  }
  Profile.push();
  Ach.check();
}
/**
 * Строит список формул.
 * @param {Object} sb Предмет.
 * @returns {string} HTML.
 */
function formulaList(sb) {
  const q = U.norm(ui.fQuery);
  const fs = sb.formulas.filter(f => !q || U.norm(f.group + ' ' + f.title + ' ' + f.f + ' ' + f.note).includes(q));
  if (!fs.length) return empty('∑', q ? 'Ничего не найдено' : 'Формул пока нет');
  const groups = new Map();
  fs.forEach(f => {
    const g = f.group || 'Другое';
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g).push(f);
  });
  return [...groups]
    .map(
      e =>
        '<h3 class="fgroup">' +
        U.esc(e[0]) +
        ' <span class="tag">' +
        e[1].length +
        '</span></h3><div class="fgrid">' +
        e[1]
          .map(
            f =>
              '<div class="fcard"><div class="ftitle">' +
              U.esc(f.title) +
              '</div><div class="fexpr">' +
              Fm.render(f.f) +
              '</div>' +
              (f.note ? '<div class="fnote">' + U.esc(f.note) + '</div>' : '') +
              '<div class="fact"><button class="icon-btn" data-action="formula-edit" data-id="' +
              f.id +
              '" aria-label="Изменить">' +
              ICONS.pencil +
              '</button><button class="icon-btn" data-action="formula-del" data-id="' +
              f.id +
              '" aria-label="Удалить">' +
              ICONS.wastebasket +
              '</button></div></div>'
          )
          .join('') +
        '</div>'
    )
    .join('');
}
/**
 * Строит вкладку формул.
 * @param {Object} sb Предмет.
 * @returns {string} HTML.
 */
function formulasBody(sb) {
  return (
    '<div class="searchbar"><input class="input" id="fQ" placeholder="' +
    ICONS.magnifier +
    ' Поиск формулы…" value="' +
    U.esc(ui.fQuery) +
    '" data-input="formula-search"><button class="btn primary" data-action="formula-add">＋ Формула</button></div>' +
    '<div id="formula-list">' +
    formulaList(sb) +
    '</div>'
  );
}
/**
 * Отрисовывает экран «Предметы».
 * @returns {string} HTML.
 */
function viewSubjects() {
  const state = Store.s;
  if (!ui.subjectId || !subj(ui.subjectId)) {
    ui.subjectId = null;
    return (
      '<div class="page-head"><div><h1>Предметы</h1><p>Домашка, конспекты, карточки и формулы по каждому предмету</p></div>' +
      '<div class="head-actions"><button class="btn primary" data-action="subj-add">＋ Предмет</button></div></div>' +
      '<div class="searchbar"><input class="input" id="subjQ" placeholder="' +
      ICONS.magnifier +
      ' Поиск предмета…" value="' +
      U.esc(ui.subjQuery) +
      '" data-input="subj-search"></div>' +
      '<div id="subj-list">' +
      subjectCards() +
      '</div>'
    );
  }
  const sb = subj(ui.subjectId);
  const tabs0 = [
    ['hw', ICONS.memo + ' Домашка', state.homework.filter(h => h.subjectId === sb.id && !h.done).length],
    ['notes', ICONS.notebook + ' Конспекты', state.notes.filter(n => n.subjectId === sb.id).length],
    ['cards', ICONS.jokerCard + ' Карточки', deckCards(sb).length]
  ];
  const tabs = noNotes(sb) ? tabs0.filter(t => t[0] !== 'notes') : tabs0;
  if (sb.hasFormulas) tabs.push(['formulas', '∑ Формулы', sb.formulas.length]);
  tabs.push(['links', ICONS.link + ' Материалы', sb.links.length]);
  if (!tabs.some(t => t[0] === ui.subjTab)) ui.subjTab = 'hw';
  let body = '';
  if (ui.subjTab === 'hw') {
    body =
      '<div class="inline-add" data-form="hw-new" data-subject="' +
      sb.id +
      '"><input class="input" name="text" placeholder="Новое задание…"><input class="input" type="date" name="deadline" aria-label="Дедлайн"><button class="btn primary" data-action="save-form">Добавить</button></div><div id="hw-list">' +
      hwList(sb) +
      '</div>';
  } else if (ui.subjTab === 'notes') {
    body =
      '<div class="searchbar"><input class="input" id="noteQ" placeholder="' +
      ICONS.magnifier +
      ' Поиск по конспектам…" value="' +
      U.esc(ui.noteQuery) +
      '" data-input="note-search"><button class="btn primary" data-action="note-add">＋ Конспект</button></div><div id="note-list">' +
      noteList(sb) +
      '</div>';
  } else if (ui.subjTab === 'cards') {
    body = cardsBody(sb);
  } else if (ui.subjTab === 'formulas') {
    body = formulasBody(sb);
  } else {
    body =
      '<div class="inline-add" data-form="link-new" style="grid-template-columns:1fr 1.4fr auto"><input class="input" name="title" placeholder="Название"><input class="input" name="url" placeholder="https://…"><button class="btn primary" data-action="save-form">Добавить</button></div><div id="link-list">' +
      linkList(sb) +
      '</div>';
  }
  const tt = teachersOf(sb.id);
  return (
    '<button class="btn ghost sm back" data-action="subj-back">← Все предметы</button>' +
    '<div class="page-head"><div><h1><span class="chip" style="--c:' +
    sb.color +
    ';font-size:14px;vertical-align:middle">' +
    U.esc(sb.short || '') +
    '</span> ' +
    U.esc(sb.name) +
    '</h1>' +
    (tt.length ? '<p>' + ICONS.user + ' ' + tt.map(t => U.esc(t.name)).join(', ') + '</p>' : '') +
    '</div>' +
    '<div class="head-actions"><button class="btn sm" data-action="subj-edit">' +
    ICONS.pencil +
    ' Изменить</button><button class="btn danger sm" data-action="subj-del">' +
    ICONS.wastebasket +
    ' Удалить</button></div></div>' +
    '<div class="tabs">' +
    tabs
      .map(
        t =>
          '<button class="tab' +
          (ui.subjTab === t[0] ? ' on' : '') +
          '" data-action="subj-tab" data-tab="' +
          t[0] +
          '">' +
          t[1] +
          ' <span class="tag">' +
          t[2] +
          '</span></button>'
      )
      .join('') +
    '</div>' +
    body
  );
}
