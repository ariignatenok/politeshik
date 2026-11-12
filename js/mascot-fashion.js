'use strict';

// Reference-inspired pieces remain independent catalogue selections.
Object.assign(Wardrobe.catalogue, {
  top: [
    ['none', 'Без дополнительного верха'],
    ['whitesweater', 'Белый свитер с горлом'],
    ['blacktee', 'Чёрная футболка'],
  ],
  chain: [
    ['none', 'Без цепей'],
    ['shortgold', 'Короткая золотая цепь'],
    ['chunkygold', 'Массивная золотая цепь'],
    ['doublegold', 'Обе цепи'],
  ],
  hat: [
    ['none', 'Без шляпы'],
    ['purplewitch', 'Фиолетовая шляпа'],
  ],
  shoes: [
    ['none', 'Обычные лапки'],
    ['chunkysneakers', 'Огромные серые кроссовки'],
  ],
  bag: [
    ['none', 'Без сумочки'],
    ['monogram', 'Сумочка с узором'],
  ],
});
Wardrobe.catalogue.glasses.push(['pinkheart', 'Розовые очки-сердечки']);
Wardrobe.presets.fashion = {
  name: 'Леопард и золото 🐆',
  look: {
    body: 'cream',
    outfit: 'leopard',
    top: 'whitesweater',
    chain: 'shortgold',
    hair: 'waves',
    hairColor: 'brown',
    bag: 'monogram',
    glasses: 'pinkheart',
  },
};
Wardrobe.presets.street = {
  name: 'Футболка и цепи ✨',
  look: {
    body: 'blue',
    top: 'blacktee',
    chain: 'doublegold',
    shoes: 'chunkysneakers',
    hair: 'pixie',
    hairColor: 'black',
  },
};
Wardrobe.presets.witch = {
  name: 'Волшебница 💜',
  look: {
    body: 'lilac',
    hat: 'purplewitch',
    top: 'blacktee',
    shoes: 'chunkysneakers',
    glasses: 'pinkheart',
    bag: 'monogram',
  },
};

Wardrobe.catalogue.face = [
  ['normal', 'Обычный'],
  ['vampire', 'Вампирские клыки'],
];
Wardrobe.catalogue.top.push(['polo', 'Светлое поло'], ['beigeknit', 'Бежевый джемпер']);
Wardrobe.catalogue.hat.push(['headphones', 'Игровые наушники'], ['blackcap', 'Чёрная бейсболка']);
Wardrobe.catalogue.outfit.push(['vampirecape', 'Вампирский плащ']);
Object.assign(Wardrobe.presets, {
  vampireboy: {
    name: 'Вампир 🧛',
    look: {
      body: 'white',
      face: 'vampire',
      outfit: 'vampirecape',
      hair: 'emo',
      hairColor: 'black',
      chain: 'shortgold',
    },
  },
  vampiregirl: {
    name: 'Вампирша 🧛‍♀️',
    look: {
      body: 'white',
      face: 'vampire',
      outfit: 'vampirecape',
      hair: 'long',
      hairColor: 'black',
      acc: ['earrings', 'lashes'],
    },
  },
  nordic: {
    name: 'Нордик ❄️',
    look: {
      body: 'blue',
      top: 'beigeknit',
      hair: 'pixie',
      hairColor: 'blonde',
      shoes: 'chunkysneakers',
      hand: 'coffee',
    },
  },
  nerd: {
    name: 'Ботан 📚',
    look: {body: 'cream', top: 'polo', hair: 'bob', hairColor: 'brown', glasses: 'round', hand: 'book'},
  },
  gamer: {
    name: 'Геймер 🎮',
    look: {
      body: 'lilac',
      top: 'blacktee',
      hair: 'emo',
      hairColor: 'black',
      hat: 'headphones',
      glasses: 'square',
      hand: 'phone',
    },
  },
  trend: {
    name: 'Модник 🕶️',
    look: {
      body: 'peach',
      top: 'blacktee',
      hair: 'pixie',
      hairColor: 'brown',
      glasses: 'sun',
      chain: 'chunkygold',
      bag: 'monogram',
      shoes: 'chunkysneakers',
    },
  },
  luxury: {
    name: 'Тихий люкс 🤎',
    look: {
      body: 'cream',
      top: 'beigeknit',
      hair: 'pixie',
      hairColor: 'brown',
      hand: 'coffee',
      glasses: 'sun',
    },
  },
  sporty: {
    name: 'Спортсмен 👟',
    look: {
      body: 'blue',
      outfit: 'hoodie',
      hat: 'blackcap',
      shoes: 'chunkysneakers',
      hair: 'pixie',
      hairColor: 'black',
    },
  },
});

Wardrobe.catalogue.outfit.push(
  ['detective', 'Куртка опера'],
  ['medicalcoat', 'Халат медика'],
  ['firegear', 'Форма пожарного'],
);
Wardrobe.catalogue.hat.push(['medicalcap', 'Медицинская шапочка'], ['firehelmet', 'Пожарная каска']);
Wardrobe.catalogue.hand.push(['medkit', 'Аптечка'], ['radio', 'Рация']);
Object.assign(Wardrobe.presets, {
  rapper: {
    name: 'Рэпер 🎤',
    look: {
      body: 'dark',
      top: 'blacktee',
      hat: 'blackcap',
      chain: 'doublegold',
      glasses: 'sun',
      shoes: 'chunkysneakers',
      hand: 'phone',
    },
  },
  detective: {
    name: 'Опер 🕵️',
    look: {
      body: 'blue',
      outfit: 'detective',
      hat: 'blackcap',
      hair: 'pixie',
      hairColor: 'black',
      hand: 'radio',
      glasses: 'sun',
    },
  },
  medic: {
    name: 'Медик 🩺',
    look: {
      body: 'cream',
      outfit: 'medicalcoat',
      hat: 'medicalcap',
      hair: 'pixie',
      hairColor: 'brown',
      hand: 'medkit',
    },
  },
  firefighter: {
    name: 'Пожарный 🚒',
    look: {body: 'peach', outfit: 'firegear', hat: 'firehelmet', hand: 'radio'},
  },
});

const baseWardrobeLayers = Wardrobe.layers.bind(Wardrobe);
Wardrobe.layers = (look) => {
  const l = Wardrobe.normalize(look),
    out = baseWardrobeLayers(l);
  const p = (d, fill, stroke = '#473c3e', w = 1.5) =>
    '<path d="' +
    d +
    '" fill="' +
    fill +
    '" stroke="' +
    stroke +
    '" stroke-width="' +
    w +
    '" stroke-linecap="round" stroke-linejoin="round"/>';
  let top = '';
  if (l.top === 'whitesweater') {
    top =
      '<g data-item="whitesweater">' +
      p(
        'M33 89Q44 90 47 87H73Q76 90 87 89L99 99L91 106L85 102L88 112Q60 118 32 112L35 102L29 106L21 99Z',
        '#f4f1eb',
        '#aaa8a6',
      );
    top += p('M44 87Q60 92 76 87L76 95Q60 100 44 95Z', '#fffcf6', '#c5c1b9');
    for (let i = 0; i < 9; i++) top += p('M' + (48 + i * 3) + ' 89v6', 'none', '#d2cfc8', 0.7);
    for (let i = 0; i < 14; i++) top += p('M' + (37 + i * 3.5) + ' 102l-1 9', 'none', '#dedbd5', 0.6);
    top += p('M33 111Q60 117 88 111M25 99L31 103M89 103L96 99', 'none', '#c4c0b8', 1.3) + '</g>';
  }
  if (l.top === 'blacktee')
    top =
      '<g data-item="blacktee">' +
      p(
        'M33 89L45 87Q60 98 75 87L87 89L103 99L94 107L86 102L89 113Q60 119 31 113L34 102L26 107L17 99Z',
        '#24252a',
        '#111318',
      ) +
      p('M45 88Q60 100 75 88M34 103L33 111M86 103L87 111', 'none', '#535159', 1.5) +
      '</g>';
  if (l.top === 'polo' || l.top === 'beigeknit') {
    const knit = l.top === 'beigeknit';
    top =
      '<g data-item="' +
      l.top +
      '">' +
      p(
        'M33 89L45 87Q60 93 75 87L87 89L99 100L91 107L85 102L88 113Q60 119 32 113L35 102L29 107L21 100Z',
        knit ? '#cbb494' : '#f1eadc',
        '#a38d75',
      );
    top += p('M45 87L51 99L60 93L69 99L75 87L66 90L60 94L54 90Z', knit ? '#f5efe5' : '#e7dcc9', '#a9957b', 1);
    if (knit) for (let i = 0; i < 13; i++) top += p('M' + (37 + i * 3.7) + ' 102v10', 'none', '#b6a080', 0.7);
    top +=
      p('M60 94V104M34 112Q60 117 87 112', 'none', '#a68c6f', 1.2) +
      '<circle cx="62" cy="99" r=".8" fill="#957d61"/></g>';
  }
  if (l.outfit === 'leopard') {
    // Broad sleeves, open lapels and irregular rosettes distinguish the coat from a skirt.
    const coatShape =
      'M31 88L43 88L48 96L43 115L27 114L25 103L18 110L8 103L19 91ZM89 88L77 88L72 96L77 115L93 114L95 103L102 110L112 103L101 91Z';
    let coat = p(coatShape, '#b88052', '#51372c', 1.8);
    const spots = [
      [25, 94],
      [33, 92],
      [39, 98],
      [30, 102],
      [35, 111],
      [42, 106],
      [17, 101],
      [80, 94],
      [89, 93],
      [96, 97],
      [84, 103],
      [90, 110],
      [102, 103],
      [78, 111],
    ];
    spots.forEach(([x, y], i) => {
      coat += p(
        'M' + (x - 2.8) + ' ' + (y - 1) + 'q-2 -3 1 -3q3 -1 4 2q2 3 -1 4q-3 2 -4 -1',
        'none',
        '#352822',
        1.8,
      );
      coat +=
        '<ellipse cx="' +
        x +
        '" cy="' +
        y +
        '" rx="1.7" ry="1.2" fill="' +
        (i % 2 ? '#97613f' : '#d6a06d') +
        '"/>';
    });
    coat += p(
      'M31 88Q37 84 44 89L48 97L42 109L38 98L33 98ZM89 88Q83 84 76 89L72 97L78 109L82 98L87 98Z',
      '#d8a475',
      '#5c3c2d',
      1.8,
    );
    for (let i = 0; i < 8; i++)
      coat += p(
        'M' +
          (32 + i * 1.7) +
          ' ' +
          (89 + i * 0.6) +
          'l-2 2M' +
          (88 - i * 1.7) +
          ' ' +
          (89 + i * 0.6) +
          'l2 2',
        'none',
        '#90603f',
        0.7,
      );
    out.clothes = top + '<g data-item="leopard">' + coat + '</g>';
  } else if (top) out.clothes = ['fur', 'pinkfur', 'leather'].includes(l.outfit) ? top + out.clothes : top;
  if (l.outfit === 'vampirecape') {
    out.back +=
      '<g data-item="vampirecape">' +
      p(
        'M31 83L13 72L21 96L10 116L38 111L60 115L82 111L110 116L99 96L107 72L89 83Z',
        '#302536',
        '#15101e',
        1.8,
      ) +
      p('M17 78L34 91L27 111L15 114L25 94ZM103 78L86 91L93 111L105 114L95 94Z', '#a33557', '#62213e', 1.3) +
      '</g>';
    out.clothes =
      top +
      p('M34 93L47 90L60 99L73 90L86 93L87 113Q60 118 33 113Z', '#392b41', '#17121e', 1.5) +
      p('M47 90L60 97L73 90L66 102L60 97L54 102Z', '#f5e8e9', '#b09cae', 1) +
      p('M57 98L63 98L65 108L60 113L55 108Z', '#ad3553', '#701d3d', 1);
  }
  if (l.face === 'vampire') {
    out.back += p(
      'M26 70L15 63L20 81L26 84M94 70L105 63L100 81L94 84',
      Wardrobe.palettes[l.body][0],
      Wardrobe.palettes[l.body][1],
      1.5,
    );
    out.face +=
      '<g data-item="vampire">' +
      p('M51 85Q60 91 69 85Q67 95 60 95Q53 95 51 85Z', '#7c2947', '#3e203b', 1) +
      p('M53 87L57 88L55 94ZM63 88L67 87L65 94Z', '#fff7f1', '#dac7d4', 0.6) +
      '<circle cx="46" cy="75" r="2.6" fill="#bb3655"/><circle cx="74" cy="75" r="2.6" fill="#bb3655"/></g>';
  }
  if (l.hat === 'headphones')
    out.hat =
      '<g data-item="headphones">' +
      p('M23 77Q20 36 60 35Q100 36 97 77', 'none', '#35303e', 7) +
      p('M24 59Q29 36 60 38Q91 37 96 59', 'none', '#a08ee1', 2.5) +
      p('M19 66H29V86H19ZM91 66H101V86H91Z', '#54426d', '#211c2e', 2) +
      p('M20 72V80M100 72V80', 'none', '#ac88ef', 2) +
      p('M98 84Q99 94 78 94', 'none', '#34303f', 2) +
      '<circle cx="77" cy="94" r="2" fill="#a08ee1"/></g>';
  if (l.hat === 'blackcap')
    out.hat =
      '<g data-item="blackcap">' +
      p('M29 53Q32 27 60 29Q85 29 90 53L73 59Z', '#302e37', '#19171f', 2) +
      p('M60 52Q86 44 104 55Q109 62 91 62L63 58Z', '#45414d', '#19171f', 1.7) +
      p('M52 35Q47 41 47 51', 'none', '#6e6777', 1) +
      '<circle cx="59" cy="29" r="2" fill="#45414d"/></g>';
  if (['detective', 'medicalcoat', 'firegear'].includes(l.outfit)) {
    const medic = l.outfit === 'medicalcoat',
      fire = l.outfit === 'firegear';
    out.clothes =
      '<g data-item="' +
      l.outfit +
      '">' +
      p(
        'M31 89L45 88L60 95L75 88L89 89L102 99L95 106L86 101L89 113Q60 118 31 113L34 101L25 106L18 99Z',
        medic ? '#f3f6f5' : fire ? '#625743' : '#2d3442',
        medic ? '#8ca3a4' : '#222a31',
        1.7,
      );
    if (medic)
      out.clothes +=
        p('M45 88L52 100L60 94L68 100L75 88L68 93L60 97L52 93Z', '#bfe0df', '#73a3a1', 1) +
        p('M60 98V114M41 103H51V110H41Z', 'none', '#9ab3b5', 1.1) +
        p('M40 94Q36 104 47 104Q56 104 52 94M47 104V109', 'none', '#596876', 1.5) +
        '<circle cx="47" cy="110" r="2" fill="#7ab2ad"/>';
    else if (fire)
      out.clothes +=
        p('M26 97L33 101M87 101L95 97M34 108Q60 114 86 108', 'none', '#e4f27f', 4) +
        p('M60 95V114M39 97H50V103H39ZM70 97H81V103H70Z', 'none', '#aca584', 1.3);
    else
      out.clothes +=
        p('M43 89L51 100L60 96L69 100L77 89M60 96V114M38 104H49M72 104H83', 'none', '#737f91', 1.2) +
        p('M77 95L83 96L82 102L79 104L76 102Z', '#d5bd78', '#978147', 0.7);
    out.clothes += '</g>';
  }
  if (l.hat === 'medicalcap')
    out.hat =
      '<g data-item="medicalcap">' +
      p('M30 47L35 30Q60 23 85 30L90 47Z', '#eef8f5', '#719b9b', 1.7) +
      p('M30 44Q60 50 90 44V53Q60 59 30 53Z', '#b9ddda', '#719b9b', 1.3) +
      p('M58 31H64V36H69V42H64V47H58V42H53V36H58Z', '#4b9e98', 'none', 0) +
      '</g>';
  if (l.hat === 'firehelmet')
    out.hat =
      '<g data-item="firehelmet">' +
      p('M26 50Q26 23 60 22Q94 23 94 50L102 53L99 59Q60 64 21 59L18 53Z', '#e8b542', '#8b601c', 1.8) +
      p('M52 24L49 47H71L68 24Z', '#f6d66c', '#b28028', 1.2) +
      p('M24 49Q60 54 96 49V57Q60 62 24 57Z', '#3c4853', '#27333e', 1) +
      p('M55 36H65L67 46L60 50L53 46Z', '#b94a3d', '#7c3029', 1) +
      p('M58 39L63 44M63 39L58 44', 'none', '#f7d383', 1.4) +
      '</g>';
  if (l.hand === 'medkit')
    out.hold =
      '<g data-item="medkit">' +
      p('M91 86V81H104V86', 'none', '#638d8d', 2.5) +
      p('M85 86H111V108H85Z', '#edf6f2', '#638d8d', 1.7) +
      p('M95 91H101V95H105V101H101V105H95V101H91V95H95Z', '#56a6a0', 'none', 0) +
      '</g>';
  if (l.hand === 'radio')
    out.hold =
      '<g data-item="radio">' +
      p('M99 85L102 68', 'none', '#2b3039', 2.7) +
      p('M88 82H108V108H88Z', '#384654', '#202a34', 1.7) +
      p('M92 86H104V92H92Z', '#98bba1', '#263d38', 0.8) +
      p('M92 97H104M92 100H104M92 103H104', 'none', '#15232e', 1.3) +
      '<circle cx="91" cy="81" r="2" fill="#667987"/></g>';
  if (l.chain !== 'none') {
    const necklace = (big) => {
      let links = '';
      const count = big ? 11 : 14;
      for (let i = 0; i < count; i++) {
        const t = i / (count - 1),
          x = (big ? 38 : 43) + t * (big ? 44 : 34),
          y = (big ? 92 : 90) + Math.sin(t * Math.PI) * (big ? 16 : 8),
          angle = -55 + t * 110;
        links +=
          '<ellipse cx="' +
          x.toFixed(2) +
          '" cy="' +
          y.toFixed(2) +
          '" rx="' +
          (big ? 4.8 : 3.2) +
          '" ry="' +
          (big ? 2.8 : 1.8) +
          '" transform="rotate(' +
          angle +
          ' ' +
          x +
          ' ' +
          y +
          ')" fill="none" stroke="#8f601c" stroke-width="' +
          (big ? 2.6 : 1.9) +
          '"/>';
        links +=
          '<ellipse cx="' +
          x.toFixed(2) +
          '" cy="' +
          (y - 0.5).toFixed(2) +
          '" rx="' +
          (big ? 4.4 : 2.9) +
          '" ry="' +
          (big ? 2.4 : 1.5) +
          '" transform="rotate(' +
          angle +
          ' ' +
          x +
          ' ' +
          y +
          ')" fill="none" stroke="#f6d774" stroke-width="' +
          (big ? 1.7 : 1.2) +
          '"/>';
      }
      return links;
    };
    out.clothes +=
      '<g data-item="' +
      l.chain +
      '">' +
      (l.chain !== 'chunkygold' ? necklace(false) : '') +
      (l.chain !== 'shortgold' ? necklace(true) : '') +
      '</g>';
  }
  if (l.hat === 'purplewitch')
    out.hat =
      '<g data-item="purplewitch">' +
      p(
        'M29 45Q34 33 43 27Q44 15 58 10Q71 1 80 7Q88 12 91 17Q95 20 104 12Q107 25 95 28Q82 29 78 19Q69 18 66 28L79 47Z',
        '#65339b',
        '#3e1e64',
        2,
      ) +
      p('M42 30Q57 36 69 28M40 38Q56 40 74 35M57 13Q68 7 77 11', 'none', '#a876cd', 2.2) +
      p(
        'M17 45Q23 40 36 44Q60 54 88 45Q104 42 112 49Q117 58 96 61Q70 63 46 57Q23 54 17 49Z',
        '#7942b2',
        '#3e1e64',
        2,
      ) +
      p('M32 41Q56 47 76 40L80 48Q58 54 29 48Z', '#4cdbce', '#258d9b', 1.5) +
      p('M43 42L57 44L55 53L41 51Z', '#ffb583', '#f47e72', 2) +
      p('M46 45L53 46L52 50L45 49Z', '#4bc7ba', 'none', 0) +
      p('M83 54Q98 57 107 52', 'none', '#b087e0', 2) +
      '</g>';
  if (l.glasses === 'pinkheart') {
    const hearts =
      'M46 86C42 83 30 77 33 69C35 62 42 63 46 68C50 62 57 63 59 69C62 77 50 84 46 86ZM74 86C70 83 58 77 61 69C63 62 70 63 74 68C78 62 85 63 87 69C90 77 78 84 74 86Z';
    out.face +=
      '<g data-item="pinkheart"><path d="' +
      hearts +
      '" fill="#f79bc4" fill-opacity=".4" stroke="#ee8cb7" stroke-width="3.2"/><path d="' +
      hearts +
      '" fill="none" stroke="#ffe1ef" stroke-width=".8"/>' +
      p('M59 73Q60 72 61 73M33 72L27 68M87 72L93 68', 'none', '#ef99bc', 2.5) +
      p('M36 69l3 -2M64 69l3 -2', 'none', '#fff3fa', 1.4) +
      '<g fill="#fff4fa"><circle cx="35" cy="75" r=".8"/><circle cx="83" cy="67" r=".8"/><circle cx="40" cy="82" r=".7"/><circle cx="78" cy="83" r=".8"/></g></g>';
  }
  out.front = '';
  if (l.shoes === 'chunkysneakers') {
    const shoe = (mirror) =>
      '<g transform="' +
      (mirror ? 'translate(120 0) scale(-1 1)' : 'translate(0 0)') +
      '">' +
      p(
        'M23 101Q29 96 42 100L48 108Q56 109 56 114Q54 120 37 119L12 118Q4 117 6 111L15 108Z',
        '#c2c6bb',
        '#777e78',
        1.5,
      ) +
      p('M7 112Q18 113 27 112L52 114L54 118Q31 123 8 118Z', '#e4e5db', '#929991', 1.3) +
      p('M18 105L27 101L40 104L44 110L26 112Z', '#d7dacd', '#969e93', 1) +
      p('M28 102L39 108M26 105L40 106M27 108L41 104', 'none', '#f0f0e6', 1.8) +
      p('M10 111L17 114L13 118L7 116M43 117L52 116', 'none', '#414844', 1.5) +
      p('M19 109L23 106M20 112L24 110M46 110L49 112', 'none', '#8c9389', 1) +
      '<circle cx="34" cy="100" r="2.7" fill="#424a44"/>' +
      p('M30 99L32 103L40 104', 'none', '#aeb6aa', 2) +
      '</g>';
    out.front += '<g data-item="chunkysneakers">' + shoe(false) + shoe(true) + '</g>';
  }
  if (l.bag === 'monogram') {
    let bag =
      p('M9 92Q18 86 34 91L38 107Q38 113 28 114L8 112Q3 109 5 103Z', '#c8b790', '#735442', 1.8) +
      p('M10 93Q5 69 20 68Q32 68 34 92', 'none', '#5c4033', 2.3) +
      p('M9 92Q22 98 34 91L34 95Q22 101 8 96Z', '#785645', '#594132', 1.1);
    for (let r = 0; r < 3; r++)
      for (let c = 0; c < 4; c++)
        bag += p(
          'M' + (10 + c * 6) + ' ' + (100 + r * 4) + 'q-3 -3 -4 0q0 3 3 1m1 -1q3 3 4 0q0 -3 -3 -1',
          'none',
          '#8d795b',
          0.65,
        );
    bag +=
      '<circle cx="21" cy="96" r="2.5" fill="none" stroke="#e3c16c" stroke-width="1.1"/><circle cx="24" cy="96" r="2.5" fill="none" stroke="#e3c16c" stroke-width="1.1"/>' +
      p('M8 95L4 107', 'none', '#735442', 1.5);
    out.front += '<g data-item="monogram">' + bag + '</g>';
  }
  return out;
};
