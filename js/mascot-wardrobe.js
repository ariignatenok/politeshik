'use strict';

// Public appearance contains only catalogue IDs; never user-supplied SVG or CSS.
const Wardrobe = {
  catalogue: {
    body: [
      ['green', 'Зелёный'],
      ['pink', 'Розовый'],
      ['blue', 'Голубой'],
      ['lilac', 'Лавандовый'],
      ['cream', 'Кремовый'],
      ['peach', 'Персиковый'],
      ['white', 'Белый'],
      ['dark', 'Графитовый'],
    ],
    outfit: [
      ['none', 'Без одежды'],
      ['hoodie', 'Худи'],
      ['cardigan', 'Кардиган'],
      ['uniform', 'Рубашка'],
      ['fur', 'Белая шубка'],
      ['pinkfur', 'Розовая шубка'],
      ['leopard', 'Леопардовое пальто'],
      ['leather', 'Косуха'],
      ['striped', 'Полосатый свитер'],
    ],
    hair: [
      ['none', 'Без волос'],
      ['bob', 'Каре'],
      ['long', 'Длинные'],
      ['waves', 'Волнистые'],
      ['twotails', 'Два хвостика'],
      ['bun', 'Пучок'],
      ['pixie', 'Пикси'],
      ['emo', 'Косая чёлка'],
      ['mohawk', 'Ирокез'],
      ['curls', 'Кудри'],
    ],
    hairColor: [
      ['black', 'Чёрные'],
      ['brown', 'Каштановые'],
      ['blonde', 'Светлые'],
      ['ginger', 'Рыжие'],
      ['pink', 'Розовые'],
      ['blue', 'Синие'],
      ['purple', 'Фиолетовые'],
      ['white', 'Белые'],
    ],
    glasses: [
      ['none', 'Без очков'],
      ['round', 'Круглые'],
      ['square', 'Прямоугольные'],
      ['cat', 'Кошачьи'],
      ['heart', 'Сердечки'],
      ['sun', 'Солнечные'],
      ['stars', 'Звёздочки'],
    ],
    hand: [
      ['none', 'Свободные лапки'],
      ['coffee', 'Кофе'],
      ['tea', 'Чай'],
      ['bubbletea', 'Бабл-ти'],
      ['book', 'Книга'],
      ['phone', 'Телефон'],
      ['flower', 'Цветок'],
    ],
  },
  palettes: {
    green: ['#8be0a4', '#2f8a58', '#c8f4d4', '#6fd08f', '#5fc486'],
    pink: ['#f6a6ce', '#b74e85', '#ffe0ef', '#e98ebc', '#dc79aa'],
    blue: ['#8fcafa', '#397db9', '#d9efff', '#72b6ec', '#61a2db'],
    lilac: ['#c6adf4', '#7861ac', '#eee3ff', '#ad91e0', '#9d80d0'],
    cream: ['#f1ddb1', '#a48a56', '#fff5d9', '#e1c992', '#d0b87e'],
    peach: ['#ffc5a8', '#b8795c', '#ffe8d8', '#edac8a', '#dd9b79'],
    white: ['#eef3f7', '#8498ab', '#ffffff', '#dbe4ed', '#c5d2df'],
    dark: ['#687485', '#343d4c', '#a2adbd', '#586577', '#485568'],
  },
  hairColors: {
    black: '#292634',
    brown: '#754b39',
    blonde: '#f0d27d',
    ginger: '#d97935',
    pink: '#ef83bb',
    blue: '#629eea',
    purple: '#a275d8',
    white: '#eef0fa',
  },
  presets: {
    alt: {
      name: 'Альтушка 🖤',
      look: {
        body: 'pink',
        outfit: 'striped',
        hair: 'twotails',
        hairColor: 'black',
        glasses: 'heart',
        hand: 'coffee',
        acc: ['earrings', 'lashes'],
      },
    },
    rock: {
      name: 'Нефор 🎸',
      look: {
        body: 'lilac',
        outfit: 'leather',
        hair: 'emo',
        hairColor: 'purple',
        glasses: 'sun',
        hand: 'phone',
        acc: ['earrings'],
      },
    },
    leopard: {
      name: 'Леопард 🐆',
      look: {
        body: 'cream',
        outfit: 'leopard',
        hair: 'waves',
        hairColor: 'brown',
        glasses: 'cat',
        hand: 'coffee',
        acc: [],
      },
    },
    pink: {
      name: 'Розовая шубка 🎀',
      look: {
        body: 'pink',
        outfit: 'pinkfur',
        hair: 'long',
        hairColor: 'blonde',
        glasses: 'heart',
        hand: 'bubbletea',
        acc: ['lashes'],
      },
    },
    study: {
      name: 'На пары 📚',
      look: {
        body: 'blue',
        outfit: 'uniform',
        hair: 'bob',
        hairColor: 'blue',
        glasses: 'round',
        hand: 'book',
        acc: ['bow'],
      },
    },
    tea: {
      name: 'Чайный вечер 🍵',
      look: {
        body: 'lilac',
        outfit: 'cardigan',
        hair: 'bun',
        hairColor: 'ginger',
        glasses: 'round',
        hand: 'tea',
        acc: [],
      },
    },
  },
  normalize(value) {
    const source = value && typeof value === 'object' ? value : {},
      out = {};
    Object.entries(Wardrobe.catalogue).forEach(([key, items]) => {
      out[key] = items.some((x) => x[0] === source[key]) ? source[key] : items[0][0];
    });
    out.acc = Array.isArray(source.acc)
      ? [...new Set(source.acc.filter((id) => Mascot.userItems.some((x) => x.id === id)))]
      : [];
    out.mood = Mascot.userMoods.some((x) => x.id === source.mood) ? source.mood : '';
    return out;
  },
  set(key, value) {
    if (!Wardrobe.catalogue[key]) return;
    const selection = {...Mascot.chosen(), [key]: value};
    const coats = ['none', 'leopard', 'fur', 'pinkfur', 'leather', 'vampirecape'];
    if (key === 'hat' && value !== 'none')
      selection.acc = (selection.acc || []).filter((id) => !['hat', 'beret'].includes(id));
    if (key === 'top' && value !== 'none' && !coats.includes(selection.outfit || 'none'))
      selection.outfit = 'none';
    if (key === 'outfit' && !coats.includes(value)) selection.top = 'none';
    Store.s.settings.mascot = Wardrobe.normalize(selection);
    Mascot.persist();
  },
  preset(id) {
    if (!Wardrobe.presets[id]) return;
    Store.s.settings.mascot = Wardrobe.normalize({...Wardrobe.presets[id].look, mood: Mascot.userMood()});
    Mascot.persist();
  },
  layers(look) {
    const l = Wardrobe.normalize(look),
      color = Wardrobe.hairColors[l.hairColor],
      out = {back: '', clothes: '', hair: '', hold: '', hat: '', face: ''};
    const path = (d, fill, stroke = '#403646', w = 2) =>
      '<path d="' +
      d +
      '" fill="' +
      fill +
      '" stroke="' +
      stroke +
      '" stroke-width="' +
      w +
      '" stroke-linejoin="round" stroke-linecap="round"/>';
    if (l.outfit !== 'none') {
      const coats = ['fur', 'pinkfur', 'leopard', 'leather'].includes(l.outfit),
        c = {
          hoodie: '#829bda',
          cardigan: '#c9a1b3',
          uniform: '#f3f1ec',
          fur: '#faf3ed',
          pinkfur: '#f2a6ca',
          leopard: '#d7a165',
          leather: '#373341',
          striped: '#45404e',
        }[l.outfit];
      out.clothes = path('M27 90Q37 96 46 94L60 99L74 94Q84 96 93 90L97 103Q83 114 60 111Q37 114 23 103Z', c);
      if (coats)
        out.clothes += path(
          'M39 93L52 98L60 108L68 98L81 93L74 105L64 100L60 111L56 100L46 105Z',
          l.outfit === 'leather' ? '#787183' : l.outfit === 'leopard' ? '#ead2a6' : c,
        );
      if (l.outfit === 'fur' || l.outfit === 'pinkfur')
        for (let i = 0; i < 8; i++)
          out.clothes +=
            '<circle cx="' +
            (30 + i * 8.6) +
            '" cy="' +
            (100 + Math.sin(i) * 2) +
            '" r="5" fill="' +
            c +
            '" stroke="#a88396" stroke-opacity=".45"/>';
      if (l.outfit === 'leopard')
        for (let i = 0; i < 13; i++)
          out.clothes +=
            '<ellipse cx="' +
            (31 + (i % 7) * 9) +
            '" cy="' +
            (100 + Math.floor(i / 7) * 7) +
            '" rx="2.7" ry="1.9" fill="#a96a39" stroke="#453329" stroke-width="1.4"/>';
      if (l.outfit === 'striped')
        out.clothes += path('M27 99Q60 114 93 99M29 106Q60 117 91 106', 'none', '#e9d8e7', 3);
      if (l.outfit === 'hoodie')
        out.clothes += path('M46 96L44 105M74 96L76 105M46 107Q60 112 74 107', 'none', '#eee3fc', 2);
      if (l.outfit === 'uniform')
        out.clothes += path('M46 94L53 103L60 99L67 103L74 94M60 99V111', 'none', '#8f95af', 1.5);
      if (l.outfit === 'leather') out.clothes += path('M61 101L67 110M77 104L85 102', 'none', '#d7d3e4', 2);
    }
    if (l.hair !== 'none') {
      out.hat = '<!-- custom hair hides graduation cap -->';
      if (['long', 'waves', 'twotails', 'emo', 'curls'].includes(l.hair))
        out.back = path('M28 48Q29 24 60 26Q92 23 94 53L105 96Q92 110 82 98L38 98Q22 111 15 96Z', color);
      const fringe = {
        bob: 'M27 60Q26 32 60 28Q94 32 94 61L85 84L83 57L67 61L61 48L54 62L37 57L35 84Z',
        long: 'M28 65Q25 31 60 27Q95 31 93 65L83 66L78 48L62 39L42 52L37 69Z',
        waves:
          'M26 65Q20 48 33 39Q32 24 52 27Q67 18 79 32Q100 30 96 50Q109 65 91 75L83 56Q65 65 50 43Q44 62 26 65Z',
        twotails: 'M27 58Q24 32 60 27Q96 32 93 58L82 61L71 46L60 56L48 46L38 62Z',
        bun: 'M29 59Q27 34 60 29Q93 34 91 59L81 59Q60 49 51 41Q48 54 29 59Z',
        pixie: 'M28 56L34 37L48 32L52 23L64 31L82 31L94 49L80 59L71 46L52 56L42 49Z',
        emo: 'M26 60Q24 32 59 26Q96 29 94 58L83 89L76 60L47 79L57 48L32 67Z',
        mohawk: 'M45 53L43 37L51 39L52 16L61 25L70 15L72 35L80 31L76 52Z',
        curls:
          'M26 63Q15 55 27 46Q20 32 36 32Q36 20 50 27Q61 16 70 26Q86 20 87 35Q104 34 97 49Q110 61 95 68L84 63Q77 47 64 49Q45 42 36 64Z',
      }[l.hair];
      out.hair = path(fringe, color);
      if (l.hair === 'bun') out.hair += path('M45 31Q34 10 59 10Q85 11 76 32Z', color);
      if (l.hair === 'twotails')
        out.hair +=
          path('M29 48Q9 34 10 64L20 94L31 72ZM91 48Q111 34 110 64L100 94L89 72Z', color) +
          path('M19 53L29 56M91 56L101 53', 'none', '#f38bbc', 4);
      out.hair += path('M38 43Q48 33 61 34', 'none', '#ffffff', 1.5).replace(
        'stroke-width="1.5"',
        'stroke-opacity=".3" stroke-width="1.5"',
      );
    }
    if (l.glasses !== 'none') {
      const g = l.glasses,
        fill = g === 'sun' ? '#37313f' : '#e4eaff',
        opacity = g === 'sun' ? '.9' : '.25';
      let lenses = '';
      if (g === 'round' || g === 'sun')
        lenses = '<circle cx="46" cy="75" r="11"/><circle cx="74" cy="75" r="11"/>';
      if (g === 'square')
        lenses =
          '<rect x="34" y="66" width="24" height="18" rx="4"/><rect x="62" y="66" width="24" height="18" rx="4"/>';
      if (g === 'cat')
        lenses = '<path d="M32 64L57 69Q58 86 44 84Q34 82 32 64ZM88 64L63 69Q62 86 76 84Q86 82 88 64Z"/>';
      if (g === 'heart')
        lenses =
          '<path d="M46 86Q24 72 36 66Q42 62 46 69Q50 62 56 66Q68 72 46 86ZM74 86Q52 72 64 66Q70 62 74 69Q78 62 84 66Q96 72 74 86Z"/>';
      if (g === 'stars')
        lenses =
          '<path d="M46 61L50 69L59 70L52 77L54 87L46 82L38 87L40 77L33 70L42 69ZM74 61L78 69L87 70L80 77L82 87L74 82L66 87L68 77L61 70L70 69Z"/>';
      out.face =
        '<g fill="' +
        fill +
        '" fill-opacity="' +
        opacity +
        '" stroke="' +
        (g === 'heart' ? '#bf4886' : '#383142') +
        '" stroke-width="2.2">' +
        lenses +
        '<path d="M58 73Q60 71 62 73M33 71L27 69M87 71L93 69" fill="none"/></g>';
    }
    if (l.hand !== 'none') {
      if (['coffee', 'tea', 'bubbletea'].includes(l.hand)) {
        const tea = l.hand === 'tea',
          bubble = l.hand === 'bubbletea';
        out.hold = path('M88 84L110 84L107 105L91 105Z', tea ? '#b9dbcb' : bubble ? '#d2b79c' : '#eee3d2');
        if (tea)
          out.hold +=
            path('M110 88Q122 87 115 98L109 98', 'none', '#81a99a', 3) +
            path('M99 85L102 95L106 95L106 100L101 100L101 95', 'none', '#5a7667', 1);
        else
          out.hold +=
            path('M87 83H111V87H87Z', '#54423f') + path('M90 92H109V99H90Z', bubble ? '#ae8aa2' : '#b6916f');
        if (bubble) {
          out.hold += path('M103 86L106 69', 'none', '#df8fbc', 3);
          for (let i = 0; i < 5; i++)
            out.hold +=
              '<circle cx="' + (94 + i * 2.5) + '" cy="' + (101 + (i % 2)) + '" r="1.4" fill="#50404b"/>';
        } else out.hold += path('M96 78Q91 72 97 67M104 77Q100 72 105 67', 'none', '#b9b3bc', 1.6);
      }
      if (l.hand === 'book')
        out.hold =
          path('M86 80L98 83L111 79V104L98 108L86 105Z', '#a98acb') +
          path('M98 83V108M90 86L95 87M102 86L107 84', 'none', '#f8f0ff', 1.5);
      if (l.hand === 'phone')
        out.hold =
          path('M91 78H108V107H91Z', '#383544') +
          path('M94 82H105V100H94Z', '#adbbeb') +
          '<circle cx="99.5" cy="103.5" r="1.5" fill="#ddd"/>';
      if (l.hand === 'flower')
        out.hold =
          path('M99 104L101 81M100 96Q87 88 94 85', 'none', '#518a58', 2.5) +
          '<g fill="#f7a2cd" stroke="#bc648c">' +
          [0, 72, 144, 216, 288]
            .map((a) => '<ellipse cx="101" cy="73" rx="4" ry="7" transform="rotate(' + a + ' 101 80)"/>')
            .join('') +
          '<circle cx="101" cy="80" r="4" fill="#f6d875"/></g>';
      out.hold +=
        '<ellipse cx="90" cy="96" rx="5" ry="6" fill="' +
        Wardrobe.palettes[l.body][3] +
        '" stroke="' +
        Wardrobe.palettes[l.body][1] +
        '" stroke-width="2"/>';
    }
    return out;
  },
};

const originalMascotLayers = Mascot.userLayers.bind(Mascot),
  originalMascotSvg = Mascot.svg.bind(Mascot);
Mascot.userLayers = (mood, season, look) => {
  const l = Wardrobe.normalize(look || Mascot.chosen()),
    old = originalMascotLayers(mood, season, {
      ...l,
      acc: l.glasses === 'none' ? l.acc : l.acc.filter((x) => x !== 'glasses'),
    }),
    extra = Wardrobe.layers(l);
  return {
    ...old,
    ...extra,
    hat: l.hat && l.hat !== 'none' ? extra.hat : old.hat || extra.hat,
    face: old.face + extra.face,
    neck: old.neck,
  };
};
Mascot.svg = (mood, size, cls, opts) => {
  const look = Wardrobe.normalize((opts && opts.look) || Mascot.chosen());
  const dressed =
    look.outfit !== 'none' ||
    look.hair !== 'none' ||
    look.hand !== 'none' ||
    look.glasses !== 'none' ||
    look.acc.length ||
    ['top', 'chain', 'hat', 'shoes', 'bag'].some((key) => look[key] && look[key] !== 'none');
  const options = {...opts, look};
  if (dressed && options.season === undefined) options.season = '';
  let svg = originalMascotSvg(mood, size, cls, options);
  Wardrobe.palettes.green.forEach((hex, i) => {
    svg = svg.replaceAll(hex, Wardrobe.palettes[look.body][i]);
  });
  return svg;
};
Mascot.signature = () => JSON.stringify(Wardrobe.normalize(Mascot.chosen()));
Mascot.setAccessory = (id) => {
  if (!Mascot.userItems.some((x) => x.id === id)) return;
  const look = Wardrobe.normalize(Mascot.chosen());
  look.acc = look.acc.includes(id) ? look.acc.filter((x) => x !== id) : [...look.acc, id];
  if (['hat', 'beret'].includes(id) && look.acc.includes(id)) look.hat = 'none';
  Store.s.settings.mascot = look;
  Mascot.persist();
};
Mascot.chooseMood = (id) => {
  Store.s.settings.mascot = Wardrobe.normalize({...Mascot.chosen(), mood: id});
  Mascot.persist();
};
Mascot.resetLook = () => {
  Store.s.settings.mascot = Wardrobe.normalize({});
  Mascot.persist();
};
Mascot.syncFromProfile = () => {
  if (Store.s.meta && Store.s.meta.mascotPending) return;
  const saved = Cloud.profile && Cloud.profile.mascot;
  if (saved && typeof saved === 'object') {
    Store.s.settings.mascot = Wardrobe.normalize(saved);
    Store.save();
  }
};
Wardrobe.revision = 0;
Wardrobe.saveState = '';
Wardrobe.save = async () => {
  if (Wardrobe.saving || Cloud.status !== 'online' || !Cloud.uid) return;
  Wardrobe.saving = true;
  const uid = Cloud.uid,
    snapshot = JSON.stringify(Wardrobe.normalize(Mascot.chosen()));
  Wardrobe.saveState = 'Сохраняем внешний вид…';
  try {
    const {error} = await supa.rpc('save_my_mascot', {p_look: JSON.parse(snapshot)});
    if (error) throw error;
    if (Cloud.uid !== uid) return;
    if (snapshot === JSON.stringify(Wardrobe.normalize(Mascot.chosen()))) {
      Store.s.meta.mascotPending = false;
      Store.save();
      Wardrobe.saveState = 'Внешний вид сохранён. Его видят в вашей группе.';
    }
  } catch (error) {
    Wardrobe.saveState = 'Не удалось сохранить. Ваш выбор остался на устройстве; нажмите «Повторить».';
  } finally {
    Wardrobe.saving = false;
    const status = document.getElementById('mascot-save-status');
    if (status) status.textContent = Wardrobe.saveState;
    if (Cloud.uid === uid && snapshot !== JSON.stringify(Wardrobe.normalize(Mascot.chosen())))
      Wardrobe.save();
  }
};
Mascot.persist = () => {
  Wardrobe.revision++;
  const look = Wardrobe.normalize(Mascot.chosen());
  Store.s.settings.mascot = look;
  Store.s.meta = Store.s.meta || {};
  Store.s.meta.mascotPending = true;
  Store.save();
  if (Cloud.profile) Cloud.profile.mascot = JSON.parse(JSON.stringify(look));
  if (typeof Avatars !== 'undefined' && Cloud.uid) Avatars.looks[Cloud.uid] = look;
  ['brand-mascot', 'top-mascot'].forEach((id) => {
    const node = document.getElementById(id);
    if (node) node.dataset.m = '';
  });
  clearTimeout(Wardrobe.saveTimer);
  Wardrobe.saveState = 'Сохраняем внешний вид…';
  Wardrobe.saveTimer = setTimeout(Wardrobe.save, 350);
};
Mascot.cardHtml = () => {
  if (Cloud.isStaff) return '';
  const look = Wardrobe.normalize(Mascot.chosen());
  if (!Wardrobe.editing)
    return (
      '<section class="card mascot-summary"><h2>Мой Политешик</h2><div class="mascot-summary-row">' +
      Mascot.svg(look.mood || 'happy', 100, '', {look, season: ''}) +
      '<div><b>Ваш персональный маскот</b><p>Его видят рядом с вашим фото и именем.</p><button class="btn" data-action="mascot-edit">Изменить</button></div></div></section>'
    );
  const chip = (action, value, label, on, key = 'id') =>
    '<button class="my-chip' +
    (on ? ' on' : '') +
    '" data-action="' +
    action +
    '" data-' +
    key +
    '="' +
    value +
    '" aria-pressed="' +
    !!on +
    '">' +
    label +
    '</button>';
  const labels = {
    body: 'Цвет маскота',
    outfit: 'Одежда',
    hair: 'Причёска',
    hairColor: 'Цвет волос',
    glasses: 'Очки',
    hand: 'В лапках',
    top: 'Свитер, поло и футболка',
    face: 'Черты персонажа',
    chain: 'Цепи',
    hat: 'Шляпа',
    shoes: 'Обувь',
    bag: 'Сумочка',
  };
  return (
    '<section class="card my-mascot wardrobe"><div class="wardrobe-title"><h2>Мой Политешик</h2><button class="btn sm" data-action="mascot-done">Готово</button></div><p>Ваш маленький спутник рядом с фото и именем. Его видят другие участники группы.</p><div class="my-mascot-body"><div class="my-preview">' +
    Mascot.svg(look.mood || 'happy', 180, '', {season: '', look}) +
    '<span>Это ваш образ</span></div><div class="my-controls"><h3>Готовые образы</h3><div class="my-chips">' +
    Object.entries(Wardrobe.presets)
      .map(([id, p]) => chip('mascot-preset', id, p.name, false))
      .join('') +
    '</div>' +
    Object.entries(Wardrobe.catalogue)
      .map(
        ([key, items]) =>
          '<h3>' +
          labels[key] +
          '</h3><div class="my-chips">' +
          items
            .map(
              ([id, label]) =>
                '<button class="my-chip' +
                (look[key] === id ? ' on' : '') +
                '" data-action="mascot-part" data-part="' +
                key +
                '" data-id="' +
                id +
                '" aria-pressed="' +
                (look[key] === id) +
                '">' +
                (key === 'body'
                  ? '<span class="wardrobe-swatch" style="background:' +
                    Wardrobe.palettes[id][0] +
                    '"></span>'
                  : '') +
                label +
                '</button>',
            )
            .join('') +
          '</div>',
      )
      .join('') +
    '<h3>Украшения</h3><div class="my-chips">' +
    Mascot.userItems.map((i) => chip('my-acc', i.id, i.name, look.acc.includes(i.id))).join('') +
    '</div><h3>Эмоция</h3><div class="my-chips">' +
    chip('my-mood', '', 'Авто', !look.mood, 'mood') +
    Mascot.userMoods.map((m) => chip('my-mood', m.id, m.name, look.mood === m.id, 'mood')).join('') +
    '</div><p id="mascot-save-status" role="status">' +
    U.esc(
      Wardrobe.saveState ||
        (Store.s.meta && Store.s.meta.mascotPending
          ? 'Есть несохранённые изменения'
          : 'Выберите образ — он сохранится автоматически.'),
    ) +
    '</p><div class="wardrobe-footer"><button class="btn sm ghost" data-action="mascot-save">Повторить сохранение</button><button class="btn sm ghost" data-action="my-mascot-reset">Сбросить образ</button></div></div></div></section>'
  );
};
