'use strict';

const Chat = {
  /**
   * Создаёт пустое состояние чата с Политешиком.
   * @returns {Object} Объект.
   */
  blank: () => ({msgs: [], answers: {}, asked: {}, follow: {}, flags: {}, reqs: [], updated: '', readAt: ''}),
  /**
   * Возвращает состояние чата с Политешиком.
   * @returns {Object} Объект.
   */
  st: () => Store.s.chat,
  /**
   * Сохраняет чат локально и в облаке.
   */
  save() {
    const c = Chat.st();
    c.updated = new Date().toISOString();
    Store.save();
    if (Cloud.status === 'online') Cloud.pushChat();
  },
  /**
   * Добавляет сообщение в чат с Политешиком (у админа чата нет).
   * @param {string} from Автор: me или bot.
   * @param {string} text Текст сообщения.
   * @param {Object} extra Дополнительные поля (необязательно).
   */
  push(from, text, extra) {
    if (Cloud.isAdmin) return;
    const c = Chat.st();
    c.msgs.push(Object.assign({id: U.uid('m'), t: new Date().toISOString(), from, text}, extra || {}));
    if (c.msgs.length > 80) c.msgs = c.msgs.slice(-80);
    if (from === 'bot' && document.hidden)
      Notifier.show('chat', 'Политешик', String(text).slice(0, 100), {tag: 'chat'});
  },
  /**
   * Считает непрочитанные сообщения Политешика.
   * @returns {number} Число.
   */
  unread() {
    const c = Chat.st();
    return c.msgs.filter(m => (m.from === 'bot' || m.from === 'admin') && m.t > (c.readAt || '')).length;
  },
  /**
   * Помечает чат с Политешиком прочитанным.
   */
  markRead() {
    const c = Chat.st();
    c.readAt = new Date().toISOString();
    Store.save();
  },
  /**
   * Считает окно напоминания о работе: с 9:00 накануне до 9:00 дня работы.
   * @param {Object} w Работа.
   * @returns {Object} начало и конец окна.
   */
  window(w) {
    const end = U.fromISO(w.date);
    end.setHours(9, 0, 0, 0);
    const start = new Date(end);
    start.setDate(start.getDate() - 1);
    return {start, end};
  },
  /**
   * Раз в минуту проверяет, не пора ли Политешику писать.
   * @returns {boolean} изменился ли чат.
   */
  tick() {
    if (Cloud.isAdmin) return false;
    if (Cloud.status === 'online' && !(Cloud.chatLoaded && Cloud.attLoaded && Cloud.certsLoaded)) return false;
    const c = Chat.st(),
      now = new Date();
    let changed = false;
    if (!c.msgs.length) {
      Chat.push(
        'bot',
        'Привет! Я Политешик — житель этого приложения ' +
          ICONS.seedling +
          '\nЗа сутки до работы я напишу тебе и спрошу, готов(а) ли ты. Если нет — пришлю конспекты и карточки. Ещё могу рассказать про пары и работы: спроси «что сегодня?» или «какие работы?».',
        {mood: 'wink'}
      );
      changed = true;
    }
    allWorks().forEach(w => {
      if (w.done) return;
      const win = Chat.window(w);
      if (now < win.start || now >= win.end) return;
      const wk = w.id + '@' + w.date,
        sb = subj(w.subjectId);
      if (!c.asked[wk]) {
        const hrs = Math.max(1, Math.round((dueDate(w.date, w.time || '09:00') - now) / 36e5));
        const when =
          hrs >= 23 && hrs <= 25 ? 'Через 24 часа' : 'Через ' + hrs + ' ' + U.plural(hrs, 'час', 'часа', 'часов');
        Chat.push(
          'bot',
          ICONS.alarmClock +
            ' ' +
            when +
            ' — «' +
            w.title +
            '»' +
            (sb ? '\nПредмет: ' + sb.name : '') +
            '\n(' +
            U.fmtShort(U.fromISO(w.date)) +
            (w.time ? ', ' + w.time : '') +
            ')\n\nТы готов(а)?',
          {mood: 'worried', ask: wk}
        );
        c.asked[wk] = now.toISOString();
        changed = true;
      } else if (c.answers[wk] && c.answers[wk].a === 'n' && c.follow[wk] && now >= new Date(c.follow[wk])) {
        Chat.push(
          'bot',
          'Как подготовка по «' +
            w.title +
            '»? Осталось ' +
            Math.max(1, Math.round((win.end - now) / 36e5)) +
            ' ч. Теперь готов(а)?',
          {mood: 'happy', ask: wk}
        );
        c.follow[wk] = '';
        changed = true;
      }
    });
    if (Chat.missCheck()) changed = true;
    if (Chat.absCheck()) changed = true;
    if (Chat.monthly()) changed = true;
    if (changed) Chat.save();
    return changed;
  },

  /**
   * Напоминает об отметке за прошлый день и предлагает попросить админа.
   * @returns {boolean} true, если условие выполнено.
   */
  missCheck() {
    const c = Chat.st(),
      s = Store.s;
    c.flags = c.flags || {};
    let changed = false;
    for (let i = 1; i <= 7; i++) {
      const d = U.iso(U.addDays(U.today(), -i));
      if (d < ATT_START) break;
      const prs = Att.pairs(d, s.settings.subgroup);
      if (!prs.length) continue;
      const miss = prs.filter(p => !s.attendance.marks[d + '|' + p.pair] && !Att.covered(Cloud.my.certs, d));
      if (miss.length && !c.flags['miss:' + d]) {
        c.flags['miss:' + d] = 1;
        Chat.push('bot', 'Привет! Ты не отметился за ' + U.fmtShort(U.fromISO(d)) + '. Напомнить админу?', {
          mood: 'thinking',
          req: d
        });
        changed = true;
      }
    }
    return changed;
  },
  /**
   * Сохраняет просьбу к админу поставить отметку.
   * @param {string} mid Идентификатор сообщения Политешика.
   * @param {string} date Дата пропущенной отметки.
   */
  reqAdmin(mid, date) {
    const c = Chat.st();
    c.reqs = c.reqs || [];
    c.msgs.forEach(m => {
      if (m.id === mid) m.done = true;
    });
    if (!c.reqs.some(r => r.date === date)) c.reqs.push({date, at: new Date().toISOString(), done: false});
    Chat.push('me', 'Да, попросить админа');
    Chat.push(
      'bot',
      'Готово! Передал админу просьбу поставить отметку за ' +
        U.fmtShort(U.fromISO(date)) +
        '. Он увидит её и отметит сам ' +
        ICONS.okHand,
      {mood: 'happy'}
    );
    Chat.save();
    App.render();
  },
  /**
   * Отвечает на готовый вопрос из списка.
   * @param {number} i Номер вопроса.
   */
  faq(i) {
    const it = faqItems()[i];
    if (!it) return;
    Chat.push('me', it.q);
    Chat.push('bot', it.a.replace(/\[дата\]/g, U.fmtShort(U.today())), {mood: 'happy'});
    Store.s.meta.msgSent = (Store.s.meta.msgSent || 0) + 1;
    Chat.save();
    App.render();
    Ach.check();
  },

  /**
   * Предупреждает о приближении к лимиту пропусков и о красной зоне.
   * @returns {boolean} true, если условие выполнено.
   */
  absCheck() {
    const c = Chat.st(),
      s = Store.s;
    c.flags = c.flags || {};
    const h = Att.absHours(s.attendance.marks, Cloud.my.certs, s.settings.subgroup),
      last = c.flags.abs || 0;
    if (h === last) return false;
    c.flags.abs = h;
    if (h < last) return true;
    const z = Att.zone(h);
    if (z.cls === 'red') {
      Chat.push(
        'bot',
        last >= ABS_LIMIT
          ? ICONS.circleRed +
              ' Ещё один пропуск без уважительной причины: теперь ' +
              h +
              ' ч из ' +
              ABS_LIMIT +
              '. Ты в красной зоне — больше пропускать нельзя! Если пропуски были по болезни, прикрепи справку в личном кабинете.'
          : ICONS.circleRed +
              ' Ты в красной зоне! У тебя набралось ' +
              h +
              ' ч пропусков без уважительной причины из ' +
              ABS_LIMIT +
              ' разрешённых. Больше пропускать нельзя!\nЕсли пропуски были по болезни, прикрепи справку или больничный в личном кабинете.',
        {mood: 'worried'}
      );
    } else if (z.cls === 'warn') {
      Chat.push(
        'bot',
        ICONS.circleOrange +
          ' Осторожно: у тебя осталось ' +
          z.left +
          ' ' +
          U.plural(z.left, 'час', 'часа', 'часов') +
          ' пропусков без уважительной причины (набрано ' +
          h +
          ' из ' +
          ABS_LIMIT +
          ').\nХоди на пары и готовься — лимит почти исчерпан.',
        {mood: 'worried'}
      );
    }
    return true;
  },

  /**
   * Присылает итоги прошедшего месяца.
   * @returns {boolean} true, если условие выполнено.
   */
  monthly() {
    const c = Chat.st(),
      s = Store.s;
    c.flags = c.flags || {};
    const t = U.today(),
      pm = U.iso(new Date(t.getFullYear(), t.getMonth() - 1, 1)).slice(0, 7);
    if (pm < ATT_START.slice(0, 7) || (c.flags.report || '') >= pm) return false;
    if (Cloud.isAdmin && !Cloud.admReady) return false;
    const sub = s.settings.subgroup,
      st = Att.stats(s.attendance.marks, Cloud.my.certs, sub, pm + '-01', monthEnd(pm));
    const total = Att.absHours(s.attendance.marks, Cloud.my.certs, sub),
      z = Att.zone(total);
    let text = ICONS.barChart + ' Итоги месяца: ' + monthName(pm) + '\n';
    text += st.total
      ? 'Посещаемость: ' +
        (st.pct == null ? '—' : st.pct + '%') +
        ' (п ' +
        st.p +
        ' · о ' +
        st.l +
        ' · н ' +
        st.a +
        ' · по справке ' +
        st.x +
        (st.u ? ' · не отмечено ' + st.u : '') +
        ')\nПропуски без уважительной причины: ' +
        st.a * PAIR_HOURS +
        ' ч за месяц, всего ' +
        total +
        ' из ' +
        ABS_LIMIT +
        ' ч.'
      : 'В этом месяце пар по расписанию не было.';
    text +=
      z.cls === 'red'
        ? '\n' + ICONS.circleRed + ' Ты в красной зоне — больше пропускать нельзя!'
        : z.cls === 'warn'
          ? '\n' + ICONS.circleOrange + ' Осталось ' + z.left + ' ч пропусков — ходи на пары и готовься.'
          : '\n' + ICONS.circleGreen + ' С лимитом всё в порядке: осталось ' + z.left + ' ч.';
    Chat.push('bot', text, {mood: z.cls === 'ok' ? 'cheer' : 'worried'});
    if (Cloud.isAdmin) Chat.push('bot', Chat.groupSummary(pm), {mood: 'happy'});
    c.flags.report = pm;
    return true;
  },
  /**
   * Собирает итоги месяца по группе.
   * @param {string} pm Месяц ГГГГ-ММ.
   * @returns {string} текст.
   */
  groupSummary(pm) {
    const P = Cloud.adm.profiles,
      rows = [],
      seen = {};
    Object.keys(P).forEach(id => {
      const p = P[id],
        r = ROSTER_BY_ID[p.rid];
      if (!r || r.flag || r.admin) return;
      seen[r.id] = true;
      const marks = (Cloud.adm.att[id] || {}).marks || {},
        certs = (Cloud.adm.certs[id] || {}).items || [],
        h = Att.absHours(marks, certs, p.subgroup);
      rows.push({name: r.name, st: Att.stats(marks, certs, p.subgroup, pm + '-01', monthEnd(pm)), h, z: Att.zone(h)});
    });
    const wp = rows.filter(x => x.st.pct != null),
      avg = wp.length ? Math.round(wp.reduce((a, x) => a + x.st.pct, 0) / wp.length) : null;
    const names = a => (a.length ? a.map(x => x.name + ' (' + x.h + ' ч)').join(', ') : '—');
    const active = ROSTER.filter(r => !r.flag && !r.admin);
    return (
      ICONS.barChart +
      ' Итоги месяца по группе: ' +
      monthName(pm) +
      '\nВошли в приложение: ' +
      rows.length +
      ' из ' +
      active.length +
      '\nСредняя посещаемость: ' +
      (avg == null ? '—' : avg + '%') +
      '\n' +
      ICONS.circleRed +
      ' Красная зона (24 ч и больше): ' +
      names(rows.filter(x => x.z.cls === 'red')) +
      '\n' +
      ICONS.circleOrange +
      ' Осталось 4 ч и меньше: ' +
      names(rows.filter(x => x.z.cls === 'warn')) +
      '\nНе заходили: ' +
      (active
        .filter(r => !seen[r.id])
        .map(r => r.name)
        .join(', ') || '—')
    );
  },
  /**
   * Реагирует на ответ «готов» или «не готов» перед работой.
   * @param {string} wk Идентификатор работы.
   * @param {boolean} yes Готов ли студент.
   */
  answer(wk, yes) {
    const c = Chat.st(),
      w = allWorks().find(x => x.id + '@' + x.date === wk),
      now = new Date();
    c.msgs.forEach(m => {
      if (m.ask === wk) m.done = true;
    });
    Chat.push('me', yes ? 'Готов(а) ' + ICONS.check : 'Не готов(а) ' + ICONS.grimace);
    c.answers[wk] = {a: yes ? 'y' : 'n', at: now.toISOString()};
    if (yes) {
      Chat.push('bot', 'Отлично! Желаю удачи на работе — у тебя всё получится! ' + ICONS.clover, {mood: 'cheer'});
    } else {
      const sid = w && w.subjectId,
        sb = subj(sid);
      if (sb) {
        const ns = Store.s.notes.filter(n => n.subjectId === sid).sort(noteSort),
          cards = Store.s.cards.filter(x => x.subjectId === sid).length,
          links = [];
        ns.slice(0, 3).forEach(n => links.push({l: ICONS.notebook + ' ' + n.title, sid, tab: 'notes', nid: n.id}));
        if (ns.length > 3) links.push({l: ICONS.notebook + ' Все конспекты (' + ns.length + ')', sid, tab: 'notes'});
        if (cards) links.push({l: ICONS.jokerCard + ' Учить карточки (' + cards + ')', sid, tab: 'cards', study: true});
        if (sb.hasFormulas && sb.formulas.length) links.push({l: '∑ Формулы', sid, tab: 'formulas'});
        Chat.push(
          'bot',
          'Ничего страшного — время ещё есть! На подготовку 24 часа: с 9:00 до 9:00 следующего дня. Вот материалы по предмету «' +
            sb.name +
            '»:',
          {mood: 'happy', links: links.length ? links : undefined}
        );
      } else
        Chat.push(
          'bot',
          'Ничего страшного — время ещё есть! Повтори темы по этой работе, у тебя 24 часа: с 9:00 до 9:00 следующего дня.',
          {mood: 'happy'}
        );
      Chat.push('bot', 'Готовься, а я загляну позже и спрошу, как дела ' + ICONS.muscle);
      const end = w ? Chat.window(w).end : new Date(now.getTime() + 864e5);
      c.follow[wk] = new Date(Math.min(now.getTime() + 3 * 36e5, end.getTime() - 36e5)).toISOString();
    }
    Chat.save();
    App.render();
  },
  /**
   * Отвечает на свободный вопрос студента.
   * @param {string} text Вопрос студента.
   */
  reply(text) {
    Chat.push('me', text);
    Store.s.meta.msgSent = (Store.s.meta.msgSent || 0) + 1;
    const t = U.norm(text),
      ws = allWorks()
        .filter(w => !w.done)
        .sort(byDue)
        .slice(0, 4),
      today = U.today(),
      idx = U.dayIdx(today);
    let ans,
      mood = 'happy';
    if (/привет|здравств|хай|добр/.test(t))
      ans = 'Привет! Рад тебя видеть ' + ICONS.seedling + ' Спроси «что сегодня?» или «какие работы?».';
    else if (/работ|контрольн|зач[её]т|дедлайн|когда/.test(t))
      ans = ws.length
        ? 'Ближайшее:\n' + ws.map(w => '• ' + U.fmtShort(U.fromISO(w.date)) + ' — ' + w.title).join('\n')
        : 'Ближайших работ нет — можно выдохнуть ' + ICONS.faceRelieved;
    else if (/пар|расписан|сегодня|завтра/.test(t)) {
      const d = /завтра/.test(t) ? U.addDays(today, 1) : today,
        ps = Att.pairs(U.iso(d), Store.s.settings.subgroup);
      ans = ps.length
        ? (/завтра/.test(t) ? 'Завтра' : 'Сегодня') +
          ':\n' +
          ps
            .map(
              p =>
                '• ' +
                p.pair +
                '-я пара — ' +
                p.lessons
                  .map(l => {
                    const sb = subj(l.subjectId);
                    return (sb ? sb.short || sb.name : '?') + (l.room ? ' (ауд. ' + l.room + ')' : '');
                  })
                  .join(' / ')
            )
            .join('\n')
        : (/завтра/.test(t) ? 'Завтра' : 'Сегодня') + ' пар нет ' + ICONS.coffee;
    } else if (/спасиб/.test(t)) {
      ans = 'Всегда пожалуйста! ' + ICONS.heartGreen;
      mood = 'cheer';
    } else if (/помощ|умеешь|что ты/.test(t))
      ans =
        'Я пишу за сутки до работы, спрашиваю, готов(а) ли ты, и присылаю конспекты и карточки. Ещё отвечаю на «работы», «что сегодня?» и «что завтра?».';
    else ans = 'Пока я умею отвечать на «работы», «что сегодня?», «что завтра?» и «помощь» ' + ICONS.faceSmile;
    Chat.push('bot', ans, {mood});
    Chat.save();
    App.render();
  }
};
