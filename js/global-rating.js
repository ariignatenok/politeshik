'use strict';
const GlobalRating = {
  owner: null,
  data: null,
  error: '',
  loading: false,
  at: 0,
  async load(force = false) {
    if (GlobalRating.owner !== Cloud.uid) {
      GlobalRating.data = null;
      GlobalRating.error = '';
      GlobalRating.owner = Cloud.uid;
      GlobalRating.at = 0;
    }
    if (GlobalRating.loading || (!force && Date.now() - GlobalRating.at < 60000)) return;
    GlobalRating.loading = true;
    const owner = Cloud.uid;
    try {
      const data = await Social.call('profile_leaderboard');
      if (owner !== Cloud.uid) return;
      GlobalRating.data = data;
      GlobalRating.error = '';
      GlobalRating.at = Date.now();
    } catch (error) {
      if (owner === Cloud.uid) GlobalRating.error = error.message;
    } finally {
      GlobalRating.loading = false;
      if (ui.tab === 'rating') App.renderSoft();
    }
  },
  tabs() {
    return (
      '<div class="seg"><button data-action="rating-scope" data-scope="group" class="' +
      (ui.ratingScope !== 'global' ? 'on' : '') +
      '">Моя группа</button><button data-action="rating-scope" data-scope="global" class="' +
      (ui.ratingScope === 'global' ? 'on' : '') +
      '">Все профили</button></div>'
    );
  },
  view() {
    if (
      !GlobalRating.loading &&
      !GlobalRating.error &&
      (!GlobalRating.data || GlobalRating.owner !== Cloud.uid)
    )
      GlobalRating.load();
    const data = GlobalRating.owner === Cloud.uid ? GlobalRating.data : null;
    return (
      '<div class="page-head"><div><h1>Рейтинг всех профилей</h1><p>Общий рейтинг студентов всех групп за месяц. При равных баллах место общее (1, 1, 2, 3).</p></div><button class="btn" data-action="global-rating-refresh">Обновить</button></div>' +
      GlobalRating.tabs() +
      '<section class="card"><h2>Как считаются баллы</h2><p>До 60 за посещаемость, до 20 за изученные карточки и до 20 за активность: сообщения, клуб и время в приложении.</p><p class="hint">Активность ограничена за день: до 10 сообщений, 5 действий в клубе и 12 отметок активности (не чаще раза в 5 минут). Каждые 5 таких действий дают 1 балл. Для карточек учитывается сохранённый прогресс. Активность копится с этого обновления. Первого числа — новый рейтинг. Чужие отметки, справки и содержимое переписок здесь не показываются.</p></section>' +
      (GlobalRating.error ? '<p class="warn">' + U.esc(GlobalRating.error) + '</p>' : '') +
      (data
        ? '<p class="hint">Месяц: ' +
          U.esc(data.month) +
          '. Откройте профиль нажатием на строку.</p><div class="rank">' +
          data.rows
            .map(
              (card) =>
                '<button class="rank-row profile-rank' +
                (card.uid === Cloud.uid ? ' me' : '') +
                '" data-action="social-profile" data-uid="' +
                card.uid +
                '"><span class="rk-p">' +
                card.place +
                '</span>' +
                Social.avatar(card, 42) +
                '<span class="rk-n">' +
                U.esc(card.name) +
                '<small>' +
                U.esc(card.group_name) +
                '</small></span><b>' +
                Number(card.score) +
                ' бал.</b></button>',
            )
            .join('') +
          '</div>'
        : '<p class="hint">Загружаем рейтинг…</p>')
    );
  },
};
Object.assign(A, {
  'rating-scope': (el) => {
    ui.ratingScope = el.dataset.scope;
    App.render();
  },
  'global-rating-refresh': () => GlobalRating.load(true),
});
