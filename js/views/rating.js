'use strict';

const MEDAL = [ICONS.medalGold, ICONS.medalSilver, ICONS.medalBronze];
/**
 * Отрисовывает экран «Рейтинг группы».
 * @returns {string} HTML.
 */
function viewRating() {
  const R = Cloud.ratings,
    per = Rating.periods(),
    k = ui.ratePeriod || 'month';
  const head =
    '<div class="page-head"><div><h1>' +
    ICONS.trophy +
    ' Рейтинг группы</h1><p>Посещаемость 80% + карточки 20%. Обновляется раз в час.</p></div><div class="head-actions"><div class="seg">' +
    [
      ['month', 'Месяц'],
      ['semester', 'Семестр'],
      ['all', 'Всё время']
    ]
      .map(
        x =>
          '<button class="' +
          (k === x[0] ? 'on' : '') +
          '" data-action="rate-period" data-p="' +
          x[0] +
          '">' +
          x[1] +
          '</button>'
      )
      .join('') +
    '</div></div></div>';
  if (Cloud.status !== 'online') return head + empty(ICONS.cloud, 'Рейтинг доступен после входа через облако.');
  const doc = R && R.periods && R.periods[k],
    prize = R && R.prizes && R.prizes[per[k].key];
  if (!doc || !doc.rows.length)
    return (
      head +
      (Cloud.isAdmin ? ratingAdmin(k, per) : '') +
      empty(ICONS.hourglass, 'Рейтинг ещё не посчитан. Он появится, когда админ откроет приложение.')
    );
  const rid = Cloud.profile && Cloud.profile.rid,
    mine = doc.rows.find(x => x.rid === rid),
    next = mine && mine.place > 1 ? doc.rows[mine.place - 2] : null;
  return (
    head +
    '<div class="card prize-bar"><div><b>' +
    (prize ? ICONS.gift + ' Приз за 1 место: ' + U.esc(prize.text) : ICONS.gift + ' Приз за 1 место пока не назначен') +
    '</b><small>' +
    U.esc(doc.label) +
    '</small></div>' +
    (mine
      ? '<div class="myplace"><b>Ты на ' +
        mine.place +
        ' месте</b><small>' +
        (next
          ? 'до следующего места: ' + Math.max(0, Math.round((next.score - mine.score) * 10) / 10) + ' балла'
          : 'ты впереди всех ' + ICONS.partyPopper) +
        '</small></div>'
      : '') +
    '</div>' +
    (Cloud.isAdmin ? ratingAdmin(k, per) : '') +
    '<div class="rank">' +
    doc.rows
      .map(
        x =>
          '<div class="rank-row' +
          (x.rid === rid ? ' me' : '') +
          (x.place <= 3 ? ' top t' + x.place : '') +
          '"><span class="rk-p">' +
          (x.place <= 3 ? MEDAL[x.place - 1] : x.place) +
          '</span><span class="rk-av">' +
          avatarOf(x.avatar, 34) +
          '</span><span class="rk-n">' +
          U.esc(x.name) +
          (x.rid === rid ? ' <small>(ты)</small>' : '') +
          '</span>' +
          (Cloud.isAdmin ? '<span class="rk-s">' + x.score + '</span>' : '') +
          '</div>'
      )
      .join('') +
    '</div>' +
    '<p class="hint">Видны только имена и места — чужие пропуски никому, кроме админа, не показываются.</p>'
  );
}
/**
 * Строит блок админа: призы и разбор баллов.
 * @param {string} k Ключ периода.
 * @param {Object} per Период рейтинга.
 * @returns {string} HTML.
 */
function ratingAdmin(k, per) {
  const R = Cloud.ratings || {},
    rows = Cloud.admReady ? Rating.rows(per[k]) : [],
    prize = (R.prizes || {})[per[k].key];
  const hist = Object.keys(R.results || {}).map(x => R.results[x]);
  return (
    '<div class="card" style="margin-bottom:14px"><h2>Для админа</h2>' +
    '<div class="prize-form" data-form="prize"><input class="input" name="prize" placeholder="Например: Кофе в подарок / +1 автомат / Сертификат в кино" value="' +
    U.esc(prize ? prize.text : '') +
    '"><button class="btn primary" data-action="save-form">' +
    ICONS.gift +
    ' Назначить приз за 1 место</button>' +
    (prize ? '<button class="btn danger" data-action="prize-del">Убрать</button>' : '') +
    '</div>' +
    (rows.length
      ? '<div class="tbl-wrap"><table class="grid-tbl"><thead><tr><th>#</th><th>Студент</th><th>Баллы</th><th>Посещ.</th><th>Карточки</th><th></th></tr></thead><tbody>' +
        rows
          .map(
            x =>
              '<tr><td>' +
              x.place +
              '</td><td>' +
              U.esc(x.name) +
              '</td><td><b>' +
              x.score +
              '</b></td><td>' +
              x.att +
              '%</td><td>' +
              x.cards +
              '%</td><td title="100% посещаемости без единого опоздания — проверьте отметки">' +
              (x.suspicious ? ICONS.star : '') +
              '</td></tr>'
          )
          .join('') +
        '</tbody></table></div><p class="hint">' +
        ICONS.star +
        ' — «подозрительно идеально»: 100% без опозданий. Если вы правите отметки вручную, рейтинг пересчитывается сам.</p>'
      : '') +
    (hist.length
      ? '<h3 style="margin:14px 0 6px">История призов</h3><div class="items">' +
        hist
          .map(
            h =>
              '<div class="item"><div class="item-main"><div class="item-title">' +
              ICONS.medalGold +
              ' ' +
              U.esc(h.name) +
              '</div><div class="item-meta"><span class="tag">' +
              U.esc(h.label) +
              '</span><span class="tag">' +
              ICONS.gift +
              ' ' +
              U.esc(h.prize) +
              '</span></div></div></div>'
          )
          .join('') +
        '</div>'
      : '') +
    '</div>'
  );
}
