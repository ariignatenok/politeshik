'use strict';
Object.assign(Club, {
  barExpanded:false,
  moves: [
    ['still', 'Стоять'],
    ['bounce', 'Прыгать'],
    ['sway', 'Качаться'],
    ['spin', 'Кружиться'],
    ['shuffle', 'Шаффл'],
    ['wave', 'Махать лапкой'],
  ],
  drinks: [
    ['none', 'Пустые лапки', '🐾'],
    ['coffee', 'Кофе', '☕'],
    ['tea', 'Чай', '🍵'],
    ['lemonade', 'Лимонад', '🍋'],
    ['orange', 'Апельсиновый сок', '🍊'],
    ['apple', 'Яблочный сок', '🍏'],
    ['cherry', 'Вишнёвый сок', '🍒'],
    ['mango', 'Манговый сок', '🥭'],
    ['water', 'Вода', '💧'],
  ],
  mascot(card, size = 88) {
    const look = Wardrobe.normalize(card.uid === Cloud.uid ? Mascot.chosen() : card.mascot),
      drink = Club.drinks.some((x) => x[0] === card.drink) ? card.drink : 'none';
    look.hand = ['coffee', 'tea'].includes(drink) ? drink : 'none';
    let svg = Mascot.svg((card.dance || 'bounce') === 'still' ? 'happy' : 'cheer', size, '', {
      look,
      season: '',
    });
    if (['none', 'coffee', 'tea'].includes(drink)) return svg;
    const color = {
      lemonade: '#f3db76',
      orange: '#f7a344',
      apple: '#bdd477',
      cherry: '#c95879',
      mango: '#f5c453',
      water: '#a3d6eb',
    }[drink];
    const cup =
      '<g data-club-drink="' +
      drink +
      '"><path d="M88 82H111L107 106H92Z" fill="#e2f3f5" fill-opacity=".7" stroke="#7a9ba8" stroke-width="1.5"/><path d="M91 88H108L105 103H94Z" fill="' +
      color +
      '"/><path d="M101 84L107 69" stroke="#ef94b5" stroke-width="2.5" stroke-linecap="round"/><path d="M90 83H110" stroke="#fff" stroke-width="1.4"/><circle cx="101" cy="95" r="4" fill="' +
      color +
      '" stroke="#fff8" stroke-width="1.4"/><ellipse cx="90" cy="96" rx="5" ry="6" fill="' +
      Wardrobe.palettes[look.body][3] +
      '" stroke="' +
      Wardrobe.palettes[look.body][1] +
      '" stroke-width="2"/></g>';
    return svg.replace('class="mascot ', 'class="mascot m-has-hold ').replace('</svg>', cup + '</svg>');
  },
  own() {
    return (
      Club.visitors.find((v) => v.uid === Cloud.uid) || {
        uid: Cloud.uid,
        dance: Club.dance,
        drink: Club.drink,
        thought: Club.thought,
      }
    );
  },
  captureThought() {
    const input = document.querySelector('[data-form="club-thought"] textarea');
    if (input) Club.thoughtDraft = input.value;
  },
  openOwn(keep = false) {
    if (!Club.joined) return toast('Сначала зайдите на танцпол');
    if (!keep || Club.thoughtDraft === undefined) Club.thoughtDraft = Club.thought;
    UI.open('Мой маскот на танцполе', Club.ownHtml(), {wide: true, noFocus: true});
  },
  ownHtml() {
    return (
      '<div class="club-own-editor"><div class="club-own-preview club-guest move-' +
      Club.dance +
      '">' +
      Club.mascot(Club.own(), 120) +
      '</div><h3>Движения</h3><div class="my-chips">' +
      Club.moves
        .map(
          ([id, name]) =>
            '<button class="my-chip' +
            (Club.dance === id ? ' on' : '') +
            '" data-action="club-move" data-move="' +
            id +
            '" aria-pressed="' +
            (Club.dance === id) +
            '">' +
            name +
            '</button>',
        )
        .join('') +
      '</div><h3>Напиток в лапке</h3><button class="btn" data-action="club-bar">' +
      U.esc((Club.drinks.find((x) => x[0] === Club.drink) || Club.drinks[0])[1]) +
      ' · Выбрать в баре</button><h3>💭 Мысли</h3><div data-form="club-thought"><label class="field"><span>Это сообщение увидят все в клубе · до 160 символов</span><textarea class="input" name="thought" maxlength="160" rows="3" placeholder="О чём думаешь?">' +
      U.esc(Club.thoughtDraft || '') +
      '</textarea></label><div class="head-actions"><button class="btn primary" data-action="save-form">Опубликовать мысль</button><button class="btn" data-action="club-thought-clear">Убрать мысль</button></div></div><div class="head-actions" style="margin-top:20px"><button class="btn ghost" data-action="social-profile" data-uid="' +
      Cloud.uid +
      '">Мой профиль</button><button class="btn" data-action="modal-close">Готово</button></div></div>'
    );
  },
  openBar() {
    Club.captureThought();
    UI.open(
      'Бар Политешика',
      '<div class="club-bar-menu"><p>Выберите напиток — он появится в лапке вашего маскота в клубе.</p>' +
        (!Club.joined ? '<p class="hint">Сначала зайдите на танцпол, чтобы взять напиток.</p>' : '') +
        '<div class="club-drink-grid">' +
        Club.drinks
          .map(
            ([id, name, icon]) =>
              '<button class="club-drink' +
              (Club.drink === id ? ' on' : '') +
              '" data-action="club-drink" data-drink="' +
              id +
              '" aria-pressed="' +
              (Club.drink === id) +
              '"' +
              (!Club.joined ? ' disabled' : '') +
              '><span>' +
              icon +
              '</span><b>' +
              name +
              '</b></button>',
          )
          .join('') +
        '</div>' +
        (Club.joined ? '<button class="btn" data-action="club-own-back">← Мой маскот</button>' : '') +
        '</div>',
      {wide: true, noFocus: true},
    );
  },
  async customize(patch) {
    if (!Club.joined) return toast('Сначала зайдите на танцпол');
    if (Club.saving) return;
    Club.captureThought();
    Club.saving = true;
    Club.roomVersion=(Club.roomVersion||0)+1;
    const uid = Cloud.uid,
      draft = Club.thoughtDraft;
    const controls = Array.from(
      document.querySelectorAll(
        '[data-action="club-move"],[data-action="club-drink"],[data-action="club-thought-clear"],[data-form="club-thought"] [data-action="save-form"]',
      ),
    ).map((button) => ({button, disabled: button.disabled}));
    controls.forEach((x) => (x.button.disabled = true));
    const ownOpen = !!document.querySelector('.club-own-editor'),
      barOpen = !!document.querySelector('.club-bar-menu');
    try {
      const data = await Social.call('club_customize', {
        p_dance: null,
        p_drink: null,
        p_thought: null,
        ...patch,
      });
      if (uid !== Cloud.uid) return;
      Club.captureThought();
      Club.apply(data);
      Club.error = '';
      if (patch.p_thought !== undefined && Club.thoughtDraft === draft) Club.thoughtDraft = Club.thought;
      if (ownOpen && document.querySelector('.club-own-editor')) Club.openOwn(true);
      if (barOpen && document.querySelector('.club-bar-menu')) Club.openBar();
      if (ui.tab === 'club') App.render();
      else App.renderSoft();
    } catch (error) {
      toast(error.message);
    } finally {
      Club.saving = false;
      controls.forEach((x) => {
        if (x.button.isConnected) x.button.disabled = x.disabled;
      });
    }
  },
});
Object.assign(A, {
  'club-guest'(el) {
    if (el.dataset.uid === Cloud.uid) Club.openOwn();
    else Social.profile(el.dataset.uid);
  },
  'club-own'() {
    Club.openOwn();
  },
  'club-own-back'() {
    Club.openOwn(true);
  },
  'club-bar'() {
    Club.openBar();
  },
  'club-move'(el) {
    return Club.customize({p_dance: el.dataset.move});
  },
  'club-drink'(el) {
    return Club.customize({p_drink: el.dataset.drink});
  },
  'club-thought-clear'() {
    return Club.customize({p_thought: ''});
  },
});
Forms['club-thought'] = (form) => Club.customize({p_thought: val(form, 'thought')});
