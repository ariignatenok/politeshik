'use strict';

const App = {
  /**
   * Определяет, что показывать вместо приложения: загрузку, вход, выбор фамилии или секретный пароль.
   * @returns {string} режим экрана входа или пустая строка.
   */
  gateMode() {
    if (Cloud.status === 'pending' || ui.activating) return 'loading';
    if (Cloud.status === 'online' && (Cloud.role === 'pending' || Cloud.role === 'rejected') && Cloud.hasCabinet())
      return Cloud.role;
    if (Cloud.status === 'online' && !Cloud.hasCabinet())
      return Cloud.claimsLoaded ? (ui.secret ? 'secret' : 'register') : 'loading';
    if (Cloud.status === 'offline' && !ui.localOk) return 'offline';
    return '';
  },
  /**
   * Рисует экран входа, выбора фамилии или секретного пароля.
   * @param {string} mode Режим: loading, register, secret или offline.
   */
  renderGate(mode) {
    const g = $('#gate');
    const logged = Cloud.status === 'online';
    const hasCab = logged && Cloud.hasCabinet();
    const needClaim = logged && !hasCab && Cloud.claimsLoaded;
    if (logged && hasCab && mode !== 'pending' && mode !== 'rejected') return '';
    document.body.classList.add('gated');
    $('#view').innerHTML = '';
    $('#nav-side').innerHTML = '';
    $('#nav-bottom').innerHTML = '';
    g.hidden = false;
    if (g.dataset.mode === mode) return '';
    g.dataset.mode = mode;
    const busy = Cloud.status === 'pending' || (logged && !Cloud.claimsLoaded);
    if (busy) {
      g.innerHTML =
        '<div class="gate-card"><div class="gate-mascot">' +
        Mascot.svg('thinking', 110) +
        '</div><h1>Политешик</h1><p class="gate-text">Подключаемся<span class="gate-dots"><span>.</span><span>.</span><span>.</span></span></p><div class="sk-gate"><span class="sk sk-line sk-w80"></span><span class="sk sk-line sk-w60"></span><span class="sk sk-line sk-w40"></span></div></div>';
      return '';
    }
    if (mode === 'pending' || mode === 'rejected') {
      const rejected = mode === 'rejected';
      g.innerHTML =
        '<div class="gate-card"><div class="gate-mascot">' +
        Mascot.svg(rejected ? 'sad' : 'thinking', 110) +
        '</div><h1>Политешик</h1><p class="gate-sub">' +
        (rejected ? 'Заявка отклонена' : 'Заявка отправлена') +
        '</p><p class="gate-text">' +
        (rejected
          ? 'Староста не одобрила доступ. Если это ошибка, напишите ей лично.'
          : 'Староста группы должна одобрить доступ. Страница обновится сама, когда это произойдёт.') +
        '</p>' +
        (rejected ? '' : '<button class="btn primary big" data-action="pending-check">Проверить сейчас</button>') +
        '<button class="btn ghost" style="margin-top:10px;width:100%" data-action="logout-now">Выйти из аккаунта</button></div>';
      if (!rejected) App.watchPending();
      return '';
    }
    if (needClaim && mode === 'secret' && ui.secret) {
      g.innerHTML =
        '<div class="gate-card"><div class="gate-mascot">' +
        Mascot.svg('thinking', 110) +
        '</div><h1>Политешик</h1><p class="gate-sub">Секретный пароль админа</p>' +
        '<p class="gate-text">«' +
        U.esc(ROSTER_BY_ID[ui.secret.rid].name) +
        '» — фамилия админа группы. Чтобы продолжить, введите секретный пароль.</p>' +
        '<div class="warn secret-warn" hidden>Секретный пароль ещё не задан. Задайте его в Supabase: запустите скрипт politeshik_full.sql (две первые подстановки в первой строке).</div>' +
        '<div data-form="secret"><label class="field"><span>Секретный пароль</span><input class="input" name="secret" type="password" autocomplete="off" placeholder="••••••••"></label>' +
        '<button class="btn primary big" data-action="secret-do">Войти</button></div>' +
        '<button class="btn ghost" style="margin-top:10px;width:100%" data-action="secret-back">← Назад к выбору фамилии</button>' +
        '<button class="btn ghost" style="margin-top:6px;width:100%" data-action="logout-now">Выйти из аккаунта</button></div>';
      try {
        supa.rpc('admin_secret_is_set').then(r => {
          if (r && r.data === false) {
            const w = g.querySelector('.secret-warn');
            if (w) w.hidden = false;
          }
        });
      } catch (error) {}
      const f0 = g.querySelector('input');
      if (f0)
        setTimeout(() => {
          try {
            f0.focus();
          } catch (error) {}
        }, 80);
      return '';
    }
    if (needClaim) {
      const avail = ROSTER.filter(r => !r.flag),
        taken = r => Cloud.claims[r.id] && Cloud.claims[r.id] !== Cloud.uid,
        locked = r => false;
      g.innerHTML =
        '<div class="gate-card"><div class="gate-mascot">' +
        Mascot.svg('cheer', 120) +
        '</div><h1>Политешик</h1><p class="gate-sub">Создай личный кабинет</p>' +
        '<p class="gate-text">Ты вошёл(ла). Теперь выбери свою фамилию из списка группы — её нельзя будет сменить.</p>' +
        '<div data-form="profile">' +
        field(
          'Это я',
          '<select class="input" name="rid" data-change="rid-pick"><option value="">— выбери свою фамилию —</option>' +
            avail
              .map(
                r =>
                  '<option value="' +
                  r.id +
                  '"' +
                  (taken(r) || locked(r) ? ' disabled' : '') +
                  '>' +
                  U.esc(r.name) +
                  (taken(r) ? ' — занято' : r.id === ADMIN_RID && !Cloud.isAdmin ? ' — нужен секретный пароль' : '') +
                  '</option>'
              )
              .join('') +
            '</select>'
        ) +
        field(
          'Подгруппа',
          '<select class="input" name="subgroup"><option value="">выбери</option><option value="1">1 подгруппа</option><option value="2">2 подгруппа</option></select>'
        ) +
        '<button class="btn primary big" data-action="save-form">Создать кабинет и войти</button></div>' +
        '<button class="btn ghost" style="margin-top:10px;width:100%" data-action="logout-now">Выйти из аккаунта</button>' +
        '<small class="gate-foot">Одну фамилию может занять только один аккаунт. Если выбрали не ту — напишите админу.</small></div>';
      return '';
    }
    const role = ui.loginRole || 'student',
      teacherMode = role === 'teacher',
      draft = ui.loginDraft || {};
    const roleBtn = (id, label) =>
      '<button class="' +
      (role === id ? 'on' : '') +
      '" data-action="login-role" data-role="' +
      id +
      '">' +
      label +
      '</button>';
    const intro = {
      student: 'Войдите или создайте аккаунт. Доступ откроется после одобрения старостой.',
      parent: 'Родитель видит успеваемость и пропуски своего ребёнка. Доступ откроется после одобрения старостой.',
      staff: 'Куратор или отделение: укажите ФИО и должность, староста назначит роль.',
      teacher: 'Вход для преподавателя: нужен пароль, который выдали в колледже.'
    }[role];
    const extra =
      role === 'parent'
        ? '<label class="field"><span>Ваше ФИО</span><input class="input" name="person_name" placeholder="Иванова Мария Петровна" value="' +
          U.esc(draft.person_name || '') +
          '"></label><label class="field"><span>ФИО ребёнка (как в списке группы)</span><input class="input" name="child_name" placeholder="Иванов Пётр" value="' +
          U.esc(draft.child_name || '') +
          '"></label>'
        : role === 'staff'
          ? '<label class="field"><span>Ваше ФИО</span><input class="input" name="person_name" placeholder="Петрова Анна Сергеевна" value="' +
            U.esc(draft.person_name || '') +
            '"></label><label class="field"><span>Должность и группа</span><input class="input" name="person_note" placeholder="Куратор группы 3091" value="' +
            U.esc(draft.person_note || '') +
            '"></label>'
          : teacherMode
            ? '<label class="field"><span>Как к вам обращаться</span><input class="input" name="teacher_name" placeholder="Иван Петрович" value="' +
              U.esc(draft.teacher_name || '') +
              '"></label><label class="field"><span>Пароль преподавателя</span><input class="input" name="teacher_secret" type="password" autocomplete="off" placeholder="••••••••"></label>'
            : '';
    g.innerHTML =
      '<div class="gate-card">' +
      '<div class="gate-mascot">' +
      Mascot.svg('wink', 110) +
      '</div>' +
      '<h1>Политешик</h1><div class="role-seg role-seg4">' +
      roleBtn('student', 'Студент') +
      roleBtn('parent', 'Родитель') +
      roleBtn('staff', 'Куратор / отделение') +
      roleBtn('teacher', 'Преподаватель') +
      '</div>' +
      '<p class="gate-text">' +
      intro +
      '</p>' +
      '<div data-form="login"><label class="field"><span>Эл. почта</span><input class="input" name="email" type="email" autocomplete="email" placeholder="you@mail.ru" value="' +
      U.esc(draft.email || '') +
      '"></label>' +
      '<label class="field"><span>Пароль</span><input class="input" name="password" type="password" autocomplete="current-password" placeholder="не короче 6 символов"></label>' +
      extra +
      '<button class="btn primary big" data-action="login-do">Войти</button><button class="btn big" style="margin-top:8px" data-action="signup-do">Создать аккаунт</button></div>' +
      '<small class="gate-foot">Пароль хранится в Supabase в зашифрованном виде.</small></div>';
    const f = g.querySelector('input');
    if (f)
      setTimeout(() => {
        try {
          f.focus();
        } catch (error) {}
      }, 80);
    return '';
  },
  /**
   * Перерисовывает приложение: меню, текущий экран и бейджи.
   * @param {boolean} animate Нужна ли анимация (необязательно).
   */
  render(animate) {
    const gm = App.gateMode();
    if (gm) {
      App.renderGate(gm);
      return;
    }
    document.body.classList.toggle('ro', !canEdit());
    if (document.body.classList.contains('gated')) {
      document.body.classList.remove('gated');
      const g = $('#gate');
      g.hidden = true;
      g.innerHTML = '';
      g.dataset.mode = '';
      animate = true;
    }
    if (
      !Views[ui.tab] ||
      (ui.tab === 'group' && !Cloud.isAdmin) ||
      (ui.tab === 'requests' && !Cloud.isAdmin) ||
      (Cloud.isStaff && ui.tab !== 'more' && !Roles.allows(ui.tab)) ||
      (!Cloud.isStaff && Roles.staffOnly.indexOf(ui.tab) >= 0)
    )
      ui.tab = Cloud.isStaff ? Roles.home() : 'dashboard';
    const v = $('#view');
    const sameScreen = !animate && App.shown === ui.tab && !!v.firstChild;
    const html = Safe.html(
      'view:' + ui.tab,
      () =>
        Cloud.status === 'online' && !Cloud.ready && Date.now() - (Cloud.initAt || 0) < 4000
          ? Skeleton.forTab(ui.tab)
          : Views[ui.tab](),
      Safe.card(ui.tab)
    );
    const fingerprint = App.fingerprint(html);
    if (!(sameScreen && fingerprint === App.shownKey)) {
      const snapshot = sameScreen ? App.scrollSnapshot(v) : null;
      if (sameScreen) v.style.minHeight = v.offsetHeight + 'px';
      v.innerHTML = html;
      if (snapshot) App.scrollRestore(v, snapshot);
      v.style.minHeight = '';
    }
    App.shown = ui.tab;
    App.shownKey = fingerprint;
    App.centerTab();
    if (animate) {
      v.classList.remove('rise');
      void v.offsetWidth;
      v.classList.add('rise');
      clearTimeout(App.riseTimer);
      App.riseTimer = setTimeout(() => v.classList.remove('rise'), 900);
    }
    const unread = chatUnread(),
      badge = n => (n ? '<span class="badge">' + n + '</span>' : '');
    $('#nav-side').innerHTML = navItems()
      .map(
        t =>
          '<button class="nav-btn' +
          (ui.tab === t.id ? ' on' : '') +
          '" data-action="nav" data-tab="' +
          t.id +
          '"><span class="ico">' +
          t.ico +
          '</span>' +
          t.label +
          (t.id === 'chat'
            ? badge(unread)
            : t.id === 'news'
              ? badge(News.unread())
              : t.id === 'requests'
                ? badge(Cloud.pendingCount || 0)
                : '') +
          '</button>'
      )
      .join('');
    $('#nav-bottom').innerHTML = bottomNav()
      .map(id => {
        const t =
            id === 'more'
              ? {
                  id: 'more',
                  ico: '☰',
                  short: 'Ещё'
                }
              : NAV_ALL.find(x => x.id === id),
          on =
            id === 'more'
              ? Roles.tabs()
                ? Roles.tabs().slice(4).includes(ui.tab)
                : MORE_TABS.includes(ui.tab)
              : ui.tab === id;
        return (
          '<button class="nav-btn' +
          (on ? ' on' : '') +
          '" data-action="nav" data-tab="' +
          t.id +
          '"><span class="ico">' +
          t.ico +
          '</span>' +
          t.short +
          (id === 'chat' ? badge(unread) : '') +
          '</button>'
        );
      })
      .join('');
    $('#side-date').textContent = U.fmtLong(new Date());
    QuickAdd.sync();
    const mo = Mascot.current(),
      bm = $('#brand-mascot'),
      tm = $('#top-mascot');
    if (bm && bm.dataset.m !== mo + Mascot.signature()) {
      bm.dataset.m = mo + Mascot.signature();
      bm.innerHTML = Mascot.svg(mo, 44);
    }
    if (tm && tm.dataset.m !== mo + Mascot.signature()) {
      tm.dataset.m = mo + Mascot.signature();
      tm.innerHTML = Mascot.svg(mo, 26);
    }
    if (ui.tab === 'chat') {
      const bx = $('#chat-box');
      if (bx) bx.scrollTop = bx.scrollHeight;
    }
  },
  /**
   * Убирает из HTML случайные подробности (задержки морганий, номера слоёв), чтобы понять, изменился ли экран на самом деле.
   * @param {string} html HTML экрана.
   * @returns {string} Строка.
   */
  fingerprint(html) {
    return html.replace(/animation-duration:[\d.]+s;animation-delay:[\d.]+s/g, '').replace(/mc\d+/g, 'mc');
  },
  /**
   * Запоминает положение прокрутки страницы и внутренних блоков перед перерисовкой.
   * @param {HTMLElement} root Корень экрана.
   * @returns {Object} Объект.
   */
  scrollSnapshot(root) {
    const spots = [];
    root.querySelectorAll('*').forEach(el => {
      if (!el.scrollLeft && !el.scrollTop) return;
      const same = Array.prototype.filter.call(root.querySelectorAll('*'), x => x.className === el.className);
      spots.push({
        cls: el.className,
        nth: same.indexOf(el),
        left: el.scrollLeft,
        top: el.scrollTop
      });
    });
    return {
      x: window.scrollX,
      y: window.scrollY,
      spots
    };
  },
  /**
   * Возвращает прокрутку на прежнее место после перерисовки.
   * @param {HTMLElement} root Корень экрана.
   * @param {Object} snapshot Сохранённое положение.
   */
  scrollRestore(root, snapshot) {
    if (Math.abs(window.scrollY - snapshot.y) > 1 || Math.abs(window.scrollX - snapshot.x) > 1)
      window.scrollTo(snapshot.x, snapshot.y);
    snapshot.spots.forEach(spot => {
      const same = Array.prototype.filter.call(root.querySelectorAll('*'), x => x.className === spot.cls),
        el = same[spot.nth];
      if (el) {
        el.scrollLeft = spot.left;
        el.scrollTop = spot.top;
      }
    });
  },
  /**
   * Прокручивает полосу вкладок так, чтобы активная была по центру, не трогая саму страницу.
   */
  centerTab() {
    const tab = $('.tab.on'),
      bar = tab ? tab.parentElement : null;
    if (!bar || bar.scrollWidth <= bar.clientWidth) return;
    const delta =
      tab.getBoundingClientRect().left - bar.getBoundingClientRect().left - (bar.clientWidth - tab.offsetWidth) / 2;
    if (Math.abs(delta) > 4) bar.scrollLeft += delta;
  },
  /**
   * Раз в несколько секунд проверяет, одобрили ли заявку.
   */
  watchPending() {
    clearInterval(App.pendingTimer);
    App.pendingTimer = setInterval(async () => {
      if (Cloud.role !== 'pending') {
        clearInterval(App.pendingTimer);
        return;
      }
      await Cloud.refreshMember();
      if (Cloud.role !== 'pending') {
        clearInterval(App.pendingTimer);
        await Cloud.init();
        App.render(true);
      }
    }, 8000);
  },
  /**
   * Перерисовывает экран, если пользователь сейчас не вводит текст и не открыто окно.
   */
  renderSoft() {
    if ($('#modal-root').firstChild || $('#confirm-root').firstChild) return;
    const a = document.activeElement;
    if (a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)) return;
    App.render();
  },
  /**
   * Запускает приложение: загружает данные, подключает облако и таймеры.
   */
  init() {
    Store.load();
    UI.applyTheme();
    App.render(true);
    Cloud.init()
      .catch(error => Safe.report('init', error))
      .then(() => {
        Safe.run('mascot', () => Mascot.syncFromProfile());
        Safe.run('requests', () => Cloud.loadRequests(true));
        Safe.run('staff-docs', () => Cloud.loadStaffDocs());
        Safe.run('focus', () => Focus.restore());
        Safe.run('solutions', () => Cloud.refreshSolutions());
        Safe.run('theme', () => UI.applyTheme());
        Safe.run('announce', () => Themes.announce());
        Safe.run('chat', () => Chat.tick());
        Safe.run('profile', () => Profile.push());
        Safe.run('achievements', () => Ach.check());
        Safe.run('messages', () => Dm.start());
        Safe.run('news', () => News.start());
        App.render(true);
        Safe.selfCheck();
      });
    setTimeout(() => App.renderSoft(), 4300);
    setInterval(() => {
      if ($('#modal-root').firstChild || $('#confirm-root').firstChild) return;
      const ch = Safe.run('chat.tick', () => Chat.tick());
      if (ch || ui.tab === 'dashboard') App.renderSoft();
    }, 60000);
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && Chat.tick()) App.renderSoft();
    });
    const setNet = () => {
      const b = $('#net-badge');
      if (b) b.hidden = navigator.onLine !== false;
    };
    window.addEventListener('offline', setNet);
    window.addEventListener('online', () => {
      setNet();
      if (Cloud.status === 'online') {
        Cloud.pushAtt();
        Cloud.pushChat();
        Cloud.pushProfile();
      }
      toast('Синхронизировано ✓');
    });
    setNet();
    ['pointerdown', 'keydown'].forEach(ev =>
      document.addEventListener(
        ev,
        () => {
          Reminders.lastTouch = Date.now();
        },
        {
          passive: true
        }
      )
    );
    setInterval(() => {
      Safe.run('reminders', () => Reminders.tick());
      Safe.run('achievements', () => Ach.check());
      Safe.run('rating', () => Rating.compute());
    }, 30000);
    setTimeout(() => {
      Reminders.tick();
      Ach.check();
    }, 1500);
    const roStyle = document.createElement('style');
    roStyle.textContent =
      [...RO_ACTIONS]
        .filter(a => ['times', 'cell-add', 'cell-edit', 'pair-add', 'pair-del'].indexOf(a) < 0)
        .map(a => 'body.ro [data-action="' + a + '"]')
        .join(',') + '{display:none!important}';
    document.head.appendChild(roStyle);
  }
};
window.StudyPlanner = {
  Store,
  Md,
  U,
  Fm,
  Content,
  Cloud,
  Chat,
  Att,
  Mascot,
  ui,
  Changes,
  Notifier,
  Reminders,
  canEdit,
  Themes,
  THEMES,
  Ach,
  ACH,
  Rating,
  Profile,
  FAQ_DEFAULT,
  faqItems
};
App.init();
