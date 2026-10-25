'use strict';

const ACH = [
  {
    id: 'first',
    g: 'Посещаемость',
    ico: ICONS.medalGold,
    name: 'Первая пара',
    desc: 'Отметился впервые',
    t: c => c.marked > 0
  },
  {
    id: 'streak7',
    g: 'Посещаемость',
    ico: ICONS.fire,
    name: '7 дней подряд',
    desc: 'Неделя без пропусков',
    t: c => c.streak >= 7,
    p: c => [Math.min(c.streak, 7), 7]
  },
  {
    id: 'streak30',
    g: 'Посещаемость',
    ico: ICONS.fire + ICONS.fire,
    name: '30 дней подряд',
    desc: 'Месяц без пропусков',
    t: c => c.streak >= 30,
    p: c => [Math.min(c.streak, 30), 30]
  },
  {
    id: 'perfect',
    g: 'Посещаемость',
    ico: ICONS.hundred,
    name: 'Идеальный месяц',
    desc: '100% посещаемость за месяц',
    t: c => c.perfectMonth
  },
  {
    id: 'progress',
    g: 'Посещаемость',
    ico: ICONS.chartIncreasing,
    name: 'Прогресс',
    desc: 'Посещаемость выросла на 20%',
    t: c => c.progress
  },
  {
    id: 'card1',
    g: 'Карточки',
    ico: ICONS.openBook,
    name: 'Первая карточка',
    desc: 'Выучил первую карточку',
    t: c => c.known >= 1
  },
  {
    id: 'card50',
    g: 'Карточки',
    ico: ICONS.jokerCard,
    name: '50 карточек',
    desc: 'Выучено 50 карточек',
    t: c => c.known >= 50,
    p: c => [Math.min(c.known, 50), 50]
  },
  {
    id: 'card200',
    g: 'Карточки',
    ico: ICONS.jokerCard + ICONS.jokerCard,
    name: '200 карточек',
    desc: 'Выучено 200 карточек',
    t: c => c.known >= 200,
    p: c => [Math.min(c.known, 200), 200]
  },
  {
    id: 'exam',
    g: 'Карточки',
    ico: ICONS.brain,
    name: 'Экзаменатор',
    desc: 'Режим «Экзамен» без ошибок',
    t: c => !!c.examPerfect
  },
  {
    id: 'dm1',
    g: 'Общение',
    ico: ICONS.envelope,
    name: 'На связи',
    desc: 'Написал(а) админу в личный чат',
    t: c => c.dmSent >= 1
  },
  {
    id: 'comment1',
    g: 'Общение',
    ico: ICONS.thought,
    name: 'Первый комментарий',
    desc: 'Оставил(а) комментарий под новостью',
    t: c => c.comments >= 1
  },
  {
    id: 'comeback',
    g: 'Учёба',
    ico: ICONS.muscle,
    name: 'Возвращение',
    desc: 'Сходил(а) на пару после напоминания Политешика',
    t: c => c.comeback
  },
  {
    id: 'comment10',
    g: 'Общение',
    ico: ICONS.speakingHead,
    name: 'Душа группы',
    desc: '10 комментариев к новостям',
    t: c => c.comments >= 10,
    p: c => [Math.min(c.comments, 10), 10]
  },
  {
    id: 'msg1',
    g: 'Общение',
    ico: ICONS.speech,
    name: 'Первое сообщение',
    desc: 'Написал первое сообщение',
    t: c => c.msgs >= 1
  },
  {
    id: 'msg100',
    g: 'Общение',
    ico: ICONS.handshake,
    name: 'Активный',
    desc: '100 сообщений',
    t: c => c.msgs >= 100,
    p: c => [Math.min(c.msgs, 100), 100]
  },
  {
    id: 'photo10',
    g: 'Общение',
    ico: ICONS.cameraFlash,
    name: 'Фотохудожник',
    desc: '10 фото профиля',
    hidden: true,
    t: c => c.photos >= 10,
    p: c => [Math.min(c.photos, 10), 10]
  },
  {
    id: 'newbie',
    g: 'Особые',
    ico: ICONS.seedling,
    name: 'Новичок',
    desc: 'Создал кабинет',
    t: c => c.cabinet
  },
  {
    id: 'owl',
    g: 'Особые',
    ico: ICONS.owl,
    name: 'Полуночник',
    desc: 'Зашёл после 23:00',
    hidden: true,
    t: c => !!c.owl
  },
  {
    id: 'early',
    g: 'Особые',
    ico: ICONS.alarmClock,
    name: 'Рано встал',
    desc: 'Зашёл до 7:00',
    hidden: true,
    t: c => !!c.early
  },
  {
    id: 'grad',
    g: 'Особые',
    ico: ICONS.graduationCap,
    name: 'Выпускник',
    desc: '100% посещаемости за семестр',
    hidden: true,
    t: c => c.semPerfect
  },
  {
    id: 'top3',
    g: 'Рейтинг',
    ico: ICONS.medalBronze,
    name: 'Тройка лидеров',
    desc: 'Вошёл в топ-3 рейтинга группы',
    t: c => c.top3
  },
  {
    id: 'winner',
    g: 'Рейтинг',
    ico: ICONS.medalGold,
    name: 'Победитель',
    desc: 'Занял 1 место в рейтинге',
    t: c => c.winner
  }
];
const Ach = {
  /**
   * Собирает данные студента для проверки достижений.
   * @returns {Object} показатели: отметки, серии, карточки, сообщения.
   */
  ctx() {
    const state = Store.s,
      marks = state.attendance.marks,
      certs = Cloud.my.certs,
      sub = state.settings.subgroup,
      today = U.iso(U.today()),
      now = new Date(),
      m = state.meta;
    let streak = 0,
      cur = 0;
    for (let d = U.fromISO(ATT_START), e = U.fromISO(today); d <= e; d = U.addDays(d, 1)) {
      const di = U.iso(d),
        prs = Att.pairs(di, sub);
      if (!prs.length) continue;
      const effs = prs.map(p => Att.eff(marks, certs, di, p.pair)),
        full = effs.every(x => x);
      if (di === today && !full) continue;
      if (full && effs.every(x => x !== 'н')) {
        cur++;
        streak = Math.max(streak, cur);
      } else cur = 0;
    }
    const ym = today.slice(0, 7),
      mm = (a, n) => U.iso(new Date(+a.slice(0, 4), +a.slice(5, 7) - 1 + n, 1)).slice(0, 7);
    let perfectMonth = false;
    for (let k = ATT_START.slice(0, 7); k <= ym; k = mm(k, 1)) {
      if (monthEnd(k) >= today) continue;
      const st = Att.stats(marks, certs, sub, k + '-01', monthEnd(k));
      if (st.total >= 8 && st.pct === 100 && st.u === 0) perfectMonth = true;
    }
    const cs = Att.stats(marks, certs, sub, ym + '-01', monthEnd(ym)),
      ps = Att.stats(marks, certs, sub, mm(ym, -1) + '-01', monthEnd(mm(ym, -1)));
    const progress = cs.pct != null && ps.pct != null && cs.total >= 6 && ps.total >= 6 && cs.pct - ps.pct >= 20;
    const y = now.getFullYear(),
      sem = now.getMonth() < 6 ? [y + '-01-01', y + '-06-30'] : [y + '-09-01', y + '-12-31'];
    let semPerfect = false;
    if (today > sem[1]) {
      const st = Att.stats(marks, certs, sub, sem[0] < ATT_START ? ATT_START : sem[0], sem[1]);
      semPerfect = st.total >= 20 && st.pct === 100;
    }
    const R = Cloud.ratings,
      rid = Cloud.profile && Cloud.profile.rid;
    let top3 = false,
      winner = false;
    if (R && rid) {
      Object.keys(R.periods || {}).forEach(k => {
        const r = (R.periods[k].rows || []).find(x => x.rid === rid);
        if (r && r.place <= 3) top3 = true;
      });
      Object.keys(R.results || {}).forEach(k => {
        if (R.results[k].rid === rid) winner = true;
      });
    }
    const h = now.getHours();
    return {
      marked: Object.keys(marks).length,
      streak,
      perfectMonth,
      progress,
      semPerfect,
      known: state.cards.filter(c => c.known).length,
      examPerfect: m.examPerfect,
      dmSent: Dm.msgs.filter(x => x.thread_uid === Cloud.uid && x.sender === Cloud.uid).length,
      comments: News.comments.filter(x => x.author === Cloud.uid).length,
      comeback:
        !!Store.s.meta.motivationAt &&
        Object.keys(Store.s.attendance.marks).some(
          k => k.slice(0, 10) >= Store.s.meta.motivationAt && Store.s.attendance.marks[k] === 'п'
        ),
      msgs: state.chat.msgs.filter(x => x.from === 'me').length + (m.msgSent || 0),
      photos: m.photos || 0,
      cabinet: Cloud.status !== 'online' || Cloud.hasCabinet(),
      owl: m.owl || h >= 23,
      early: m.early || h < 7,
      top3,
      winner
    };
  },
  /**
   * Проверяет все достижения и выдаёт новые с поздравлением.
   * @returns {Array<Object>|undefined} только что полученные достижения.
   */
  check() {
    if (App.gateMode() || Cloud.isStaff) return;
    const state = Store.s,
      now = new Date(),
      h = now.getHours();
    if (h >= 23) state.meta.owl = true;
    if (h < 7) state.meta.early = true;
    const c = Ach.ctx(),
      fresh = [];
    ACH.forEach(a => {
      if (!state.ach[a.id] && a.t(c)) {
        state.ach[a.id] = now.toISOString();
        fresh.push(a);
      }
    });
    if (fresh.length) {
      Store.save();
      Profile.push();
      const base = Math.max(0, Mascot.cheerUntil - Date.now() + 200);
      fresh.forEach((a, i) =>
        setTimeout(
          () => {
            Mascot.celebrate(ICONS.trophy + ' ' + a.ico + ' ' + a.name);
            Confetti.burst({
              count: 60
            });
            Notifier.show('ach', 'Ты получил ачивку!', a.ico + ' ' + a.name + ' — ' + a.desc, {
              tag: 'ach' + a.id
            });
          },
          base + i * 3900
        )
      );
    }
    return fresh;
  },
  /**
   * Строит страницу достижений с прогрессом.
   * @returns {string} HTML.
   */
  html() {
    const state = Store.s,
      c = Ach.ctx(),
      got = ACH.filter(a => state.ach[a.id]).length;
    const groups = [...new Set(ACH.map(a => a.g))];
    return (
      '<div class="ach-head"><h2>Открыто ' +
      got +
      ' из ' +
      ACH.length +
      '</h2><div class="progress"><i style="width:' +
      Math.round((got * 100) / ACH.length) +
      '%"></i></div></div>' +
      groups
        .map(
          g =>
            '<h3 class="fgroup">' +
            g +
            '</h3><div class="ach-grid">' +
            ACH.filter(a => a.g === g)
              .map(a => {
                const at = state.ach[a.id],
                  hid = a.hidden && !at,
                  pr = a.p && !at ? a.p(c) : null;
                return (
                  '<div class="ach' +
                  (at ? ' got' : '') +
                  '"><div class="ach-ico">' +
                  (hid ? ICONS.questionMark : a.ico) +
                  '</div><div class="ach-t"><b>' +
                  (hid ? '???' : U.esc(a.name)) +
                  '</b><small>' +
                  (hid ? 'Скрытое достижение' : U.esc(a.desc)) +
                  '</small>' +
                  (at
                    ? '<small class="ach-d">Получено ' + new Date(at).toLocaleDateString('ru-RU') + '</small>'
                    : pr
                      ? '<div class="progress sm"><i style="width:' +
                        Math.round((pr[0] * 100) / pr[1]) +
                        '%"></i></div><small>' +
                        pr[0] +
                        ' / ' +
                        pr[1] +
                        '</small>'
                      : '') +
                  '</div></div>'
                );
              })
              .join('') +
            '</div>'
        )
        .join('')
    );
  }
};
