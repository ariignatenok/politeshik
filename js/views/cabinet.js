'use strict';

/**
 * Строит карточку профиля с аватаром и текстом «О себе».
 * @returns {string} HTML.
 */
function aboutCard() {
  const state = Store.s,
    w = Profile.weekStats();
  return (
    '<section class="card about-card"><div class="about-top"><button class="cab-av avbtn" data-action="avatar-open" title="Сменить аватар" aria-label="Сменить аватар">' +
    avatarOf(myAvatar(), 72) +
    '<span class="av-edit">' +
    ICONS.pencil +
    '</span></button>' +
    '<div class="about-meta"><span class="tag">группа ' +
    GROUP_NAME +
    '</span> ' +
    (state.settings.subgroup ? '<span class="tag">подгруппа ' + U.esc(state.settings.subgroup) + '</span> ' : '') +
    '<span class="tag">за неделю: ' +
    (w.pct == null ? '—' : w.pct + '%') +
    ' · п ' +
    w.p +
    ' · о ' +
    w.l +
    ' · н ' +
    w.a +
    '</span></div></div>' +
    '<label class="field" style="margin:12px 0 0"><span>О себе (до 500 символов)</span><textarea class="input" id="about-text" rows="3" maxlength="500" placeholder="Расскажи о себе в паре предложений…">' +
    U.esc(state.settings.about || '') +
    '</textarea></label>' +
    '<div class="head-actions" style="margin-top:8px"><button class="btn primary sm" data-action="about-save">Сохранить</button>' +
    (Cloud.status === 'online' ? '<button class="btn ghost sm" data-action="logout">Выйти из аккаунта</button>' : '') +
    '</div></section>'
  );
}
/**
 * Строит плашки побед в рейтинге.
 * @returns {string} HTML.
 */
function winnerPlaque() {
  return Rating.mine()
    .map(
      r =>
        '<div class="card plaque">' +
        ICONS.medalGold +
        ' Победитель ' +
        U.esc(r.label.replace(/^month:|^sem:/, '')) +
        ': <b>' +
        U.esc(r.prize) +
        '</b> — обратись к админу</div>'
    )
    .join('');
}
/**
 * Отрисовывает экран «Личный кабинет» с вкладками.
 * @returns {string} HTML.
 */
function viewCabinet() {
  const tabs =
    '<div class="tabs"><button class="tab' +
    (ui.cabTab !== 'ach' ? ' on' : '') +
    '" data-action="cab-tab" data-t="main">' +
    ICONS.user +
    ' Профиль</button><button class="tab' +
    (ui.cabTab === 'ach' ? ' on' : '') +
    '" data-action="cab-tab" data-t="ach">' +
    ICONS.trophy +
    ' Достижения <span class="tag">' +
    ACH.filter(a => Store.s.ach[a.id]).length +
    '/' +
    ACH.length +
    '</span></button></div>';
  return tabs + (ui.cabTab === 'ach' ? Ach.html() : viewCabinetMain());
}
/**
 * Отрисовывает основную вкладку кабинета.
 * @returns {string} HTML.
 */
function viewCabinetMain() {
  const state = Store.s,
    online = Cloud.status === 'online',
    today = U.iso(U.today()),
    ym = today.slice(0, 7);
  const name = (Cloud.profile && Cloud.profile.name) || state.settings.displayName || 'Гость';
  const st = Att.stats(state.attendance.marks, Cloud.my.certs, state.settings.subgroup, ym + '-01', monthEnd(ym));
  const certs = Cloud.my.certs.slice().sort((a, b) => b.from.localeCompare(a.from));
  const notes = state.notes.filter(n => !n.subjectId).sort(noteSort);
  /**
   * Возвращает название предмета по идентификатору.
   * @param {string} id Идентификатор записи.
   * @returns {string} Строка.
   */
  const subjName = id => {
    const x = subj(id);
    return x ? x.short || x.name : '';
  };
  return (
    '<div class="page-head"><div class="cab-head"><div class="cab-av">' +
    avatarOf(myAvatar(), 72) +
    '</div><div><h1>' +
    U.esc(name) +
    '</h1><p>' +
    (Cloud.isAdmin ? '<span class="tag adm">админ-студент</span> ' : '') +
    (online ? '<span class="tag">' + ICONS.cloud + ' в сети</span>' : '<span class="tag">без облака</span>') +
    (state.settings.subgroup ? ' <span class="tag">подгруппа ' + U.esc(state.settings.subgroup) + '</span>' : '') +
    ' <span class="tag">группа ' +
    GROUP_NAME +
    '</span></p></div></div>' +
    '<div class="head-actions">' +
    (online ? '<button class="btn" data-action="profile-edit">' + ICONS.pencil + ' Профиль</button>' : '') +
    '</div></div>' +
    aboutCard() +
    Safe.html('my-mascot', () => Mascot.cardHtml()) +
    winnerPlaque() +
    absCard(Att.absHours(state.attendance.marks, Cloud.my.certs, state.settings.subgroup)) +
    '<div class="dash-cols"><section class="card"><h2>Моя посещаемость · ' +
    monthName(ym) +
    ' <button class="btn sm" data-action="nav" data-tab="attendance">Открыть</button></h2>' +
    (st.total
      ? '<div class="cab-pct ' +
        pctCls(st.pct) +
        '"><b>' +
        (st.pct == null ? '—' : st.pct + '%') +
        '</b><small>п ' +
        st.p +
        ' · о ' +
        st.l +
        ' · н ' +
        st.a +
        ' · справка ' +
        st.x +
        '</small></div>'
      : '<div class="empty">Отметок за этот месяц пока нет</div>') +
    '</section>' +
    '<section class="card"><h2>Справки и больничные <button class="btn sm primary" data-action="cert-add">＋ Добавить</button></h2>' +
    (certs.length
      ? '<div class="items">' +
        certs
          .map(
            c =>
              '<div class="item"><div class="item-main"><div class="item-title">' +
              (c.kind === 'Больничный' ? ICONS.hospital : c.kind === 'Записка' ? ICONS.memo : ICONS.document) +
              ' ' +
              U.esc(c.kind) +
              ' · ' +
              U.esc(certPeriod(c)) +
              '</div>' +
              '<div class="item-meta">' +
              (c.note ? '<span class="tag">' + U.esc(c.note) + '</span>' : '') +
              '<span class="tag status ' +
              (c.confirmed ? 'prep' : 'review') +
              '">' +
              (c.confirmed ? 'Подтверждена админом' : 'На проверке') +
              '</span></div>' +
              '</div><div class="item-actions"><button class="icon-btn" data-action="cert-view" data-uid="' +
              Cloud.uid +
              '" data-id="' +
              c.id +
              '" aria-label="Показать фото">' +
              ICONS.picture +
              '</button><button class="icon-btn" data-action="cert-del" data-id="' +
              c.id +
              '" aria-label="Удалить">' +
              ICONS.wastebasket +
              '</button></div></div>'
          )
          .join('') +
        '</div>'
      : empty(ICONS.stethoscope, 'Справок нет. Дни по справке не считаются пропусками.')) +
    '</section></div>' +
    '<div class="dash-cols"><section class="card"><h2>Мои работы (файлы) <button class="btn sm primary" data-action="file-add">＋ Прикрепить</button></h2>' +
    (!online
      ? '<div class="empty">Файлы сохраняются в облаке — откройте приложение по приглашению.</div>'
      : Cloud.my.files.length
        ? '<div class="items">' +
          Cloud.my.files
            .slice()
            .reverse()
            .map(
              f =>
                '<div class="item"><div class="item-main"><div class="item-title">' +
                U.esc(f.title) +
                '</div><div class="item-meta">' +
                (f.subjectId ? '<span class="tag">' + U.esc(subjName(f.subjectId)) + '</span>' : '') +
                '<span class="tag">' +
                Math.max(1, Math.round(f.size / 1024)) +
                ' КБ</span>' +
                (f.note ? '<span class="tag">' + U.esc(f.note) + '</span>' : '') +
                '</div></div>' +
                '<div class="item-actions"><button class="icon-btn" data-action="file-open" data-id="' +
                f.id +
                '" aria-label="Открыть">' +
                ICONS.openFolder +
                '</button><button class="icon-btn" data-action="file-del" data-id="' +
                f.id +
                '" aria-label="Удалить">' +
                ICONS.wastebasket +
                '</button></div></div>'
            )
            .join('') +
          '</div>'
        : empty(
            ICONS.paperclip,
            'Здесь можно хранить свои работы: фото тетради, лабораторные (до ~170 КБ). Видите их только вы.'
          )) +
    '</section>' +
    '<section class="card"><h2>Мои заметки <button class="btn sm primary" data-action="cab-note-add">＋ Заметка</button></h2>' +
    (notes.length
      ? '<div class="items">' +
        notes
          .map(
            n =>
              '<button class="note-card" data-action="note-open" data-id="' +
              n.id +
              '"><b>' +
              U.esc(n.title) +
              '</b><p>' +
              U.esc(
                n.text
                  .replace(/[#*`>|_=~-]/g, ' ')
                  .replace(/\s+/g, ' ')
                  .trim()
                  .slice(0, 110)
              ) +
              '</p></button>'
          )
          .join('') +
        '</div>'
      : empty(ICONS.memo, 'Личные заметки вне предметов. Заметки по предметам — во вкладке «Предметы».')) +
    '</section></div>'
  );
}
