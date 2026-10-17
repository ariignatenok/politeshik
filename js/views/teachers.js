'use strict';

/**
 * Строит карточки преподавателей.
 * @returns {string} HTML.
 */
function teacherCards() {
  const s = Store.s,
    q = U.norm(ui.teacherQuery),
    sf = ui.teacherSubject;
  const list = s.teachers
    .filter(
      t =>
        (sf === 'all' || t.subjectIds.includes(sf)) &&
        (!q ||
          U.norm(
            [t.name, t.email, t.phone, t.room, t.notes, t.subjectIds.map(i => (subj(i) || {}).name).join(' ')].join(' ')
          ).includes(q))
    )
    .sort((a, b) => a.name.localeCompare(b.name, 'ru'));
  if (!list.length) return empty(ICONS.teacher, 'Преподавателей не найдено');
  return (
    '<div class="cards">' +
    list
      .map(t => {
        const first = subj(t.subjectIds[0]),
          c = first ? first.color : '#6366f1';
        return (
          '<article class="tcard"><div class="t-top"><div class="avatar" style="--c:' +
          c +
          '">' +
          U.esc(U.initials(t.name)) +
          '</div><div><h3>' +
          U.esc(t.name) +
          '</h3></div></div>' +
          '<div class="meta" style="display:flex;gap:6px;flex-wrap:wrap">' +
          t.subjectIds
            .map(id => {
              const x = subj(id);
              return x ? '<span class="chip" style="--c:' + x.color + '">' + U.esc(x.short || x.name) + '</span>' : '';
            })
            .join('') +
          '</div>' +
          '<div class="t-info">' +
          (t.email ? '<a href="mailto:' + U.esc(t.email) + '">' + ICONS.envelope + ' ' + U.esc(t.email) + '</a>' : '') +
          (t.phone
            ? '<a href="tel:' +
              U.esc(t.phone.replace(/[^\d+]/g, '')) +
              '">' +
              ICONS.telephone +
              ' ' +
              U.esc(t.phone) +
              '</a>'
            : '') +
          (t.room ? '<span>' + ICONS.door + ' ауд. ' + U.esc(t.room) + '</span>' : '') +
          '</div>' +
          (t.notes ? '<div class="t-notes">' + U.esc(t.notes) + '</div>' : '') +
          '<div class="t-actions"><button class="btn sm" data-action="t-edit" data-id="' +
          t.id +
          '">' +
          ICONS.pencil +
          ' Изменить</button><button class="btn danger sm" data-action="t-del" data-id="' +
          t.id +
          '">' +
          ICONS.wastebasket +
          '</button></div></article>'
        );
      })
      .join('') +
    '</div>'
  );
}
/**
 * Отрисовывает экран «Преподаватели».
 * @returns {string} HTML.
 */
function viewTeachers() {
  const s = Store.s;
  return (
    '<div class="page-head"><div><h1>Преподаватели</h1><p>Контакты, требования и заметки</p></div><div class="head-actions"><button class="btn primary" data-action="t-add">＋ Преподаватель</button></div></div>' +
    '<div class="searchbar"><input class="input" id="tQ" placeholder="' +
    ICONS.magnifier +
    ' Поиск по имени, заметкам, контактам…" value="' +
    U.esc(ui.teacherQuery) +
    '" data-input="teacher-search">' +
    '<select class="input" data-change="teacher-filter" aria-label="Фильтр по предмету"><option value="all">Все предметы</option>' +
    s.subjects
      .map(
        x =>
          '<option value="' +
          x.id +
          '"' +
          (ui.teacherSubject === x.id ? ' selected' : '') +
          '>' +
          U.esc(x.short || x.name) +
          '</option>'
      )
      .join('') +
    '</select></div>' +
    '<div id="t-list">' +
    teacherCards() +
    '</div>'
  );
}
