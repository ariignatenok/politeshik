'use strict';

const App = {
  /**
   * Определяет, что показывать вместо приложения: загрузку, вход, выбор фамилии или секретный пароль.
   * @returns {string} режим экрана входа или пустая строка.
   */
  gateMode() {
    if (Cloud.status === 'pending' || ui.activating) return 'loading';
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
    if (logged && hasCab) return '';
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
    if (needClaim && mode === 'secret' && ui.secret) {
      g.innerHTML =
        '<div class="gate-card"><div class="gate-mascot">' +
        Mascot.svg('thinking', 110) +
        '</div><h1>Политешик</h1><p class="gate-sub">Секретный пароль админа</p>' +
        '<p class="gate-text">«' +
        U.esc(ROSTER_BY_ID[ui.secret.rid].name) +
        '» — фамилия админа группы. Чтобы продолжить, введите секретный пароль.</p>' +
        '<div class="warn secret-warn" hidden>Секретный пароль ещё не задан. Задайте его в Supabase: скрипт politeshik_rls.sql (строка с ПРИДУМАЙТЕ_СЕКРЕТНЫЙ_ПАРОЛЬ).</div>' +
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
    const teacherMode = ui.loginRole === 'teacher',
      draft = ui.loginDraft || {};
    g.innerHTML =
      '<div class="gate-card">' +
      '<div class="gate-mascot">' +
      Mascot.svg('wink', 110) +
      '</div>' +
      '<h1>Политешик</h1><p class="gate-sub">' +
      (teacherMode ? 'Вход для преподавателя' : 'Вход в приложение') +
      '</p>' +
      '<div class="seg role-seg" role="group" aria-label="Кто вы"><button class="' +
      (teacherMode ? '' : 'on') +
      '" data-action="login-role" data-role="student">Я студент</button><button class="' +
      (teacherMode ? 'on' : '') +
      '" data-action="login-role" data-role="teacher">Я преподаватель</button></div>' +
      '<p class="gate-text">' +
      (teacherMode
        ? 'Преподаватель видит расписание, журнал посещаемости (только чтение), новости и чат с админом группы.'
        : 'Войди, чтобы отмечаться на парах, писать заметки и общаться с админом. Данные сохраняются в облаке.') +
      '</p>' +
      '<div data-form="login">' +
      '<label class="field"><span>Email</span><input class="input" name="email" type="email" placeholder="ivan@mail.ru" autocomplete="email" value="' +
      U.esc(draft.email || '') +
      '"></label>' +
      '<label class="field"><span>Пароль аккаунта (минимум 6 символов)</span><input class="input" name="password" type="password" placeholder="••••••" autocomplete="current-password"></label>' +
      (teacherMode
        ? '<label class="field"><span>Как к вам обращаться</span><input class="input" name="teacher_name" type="text" placeholder="Иван Петрович" autocomplete="name"></label>' +
          '<label class="field"><span>Пароль преподавателя (его выдаёт админ группы)</span><input class="input" name="teacher_secret" type="password" placeholder="••••••••" autocomplete="off"></label>'
        : '') +
      '<button class="btn primary big" data-action="login-do">Войти</button>' +
      '<button class="btn big" style="margin-top:10px" data-action="signup-do">Зарегистрироваться</button>' +
      '</div>' +
      '<small class="gate-foot">' +
      (teacherMode
        ? 'Впервые здесь? Нажмите «Зарегистрироваться»: введите почту, пароль аккаунта и пароль преподавателя.'
        : 'Впервые здесь? Нажми «Зарегистрироваться», введи свою почту и пароль. Затем выбери свою фамилию из списка группы.') +
      '</small>' +
      '</div>';
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
    if (!Views[ui.tab] || (ui.tab === 'group' && !Cloud.isAdmin) || (Cloud.isTeacher && !Teacher.allows(ui.tab)))
      ui.tab = Cloud.isTeacher ? 'schedule' : 'dashboard';
    const v = $('#view');
    v.innerHTML = Safe.html(
      'view:' + ui.tab,
      () =>
        Cloud.status === 'online' && !Cloud.ready && Date.now() - (Cloud.initAt || 0) < 4000
          ? Skeleton.forTab(ui.tab)
          : Views[ui.tab](),
      Safe.card(ui.tab)
    );
    const at = $('.tab.on');
    if (at && at.scrollIntoView) {
      try {
        at.scrollIntoView({
          inline: 'center',
          block: 'nearest'
        });
      } catch (error) {}
    }
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
          (t.id === 'chat' ? badge(unread) : t.id === 'news' ? badge(News.unread()) : '') +
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
          on = id === 'more' ? MORE_TABS.includes(ui.tab) : ui.tab === id;
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
    if (bm && bm.dataset.m !== mo) {
      bm.dataset.m = mo;
      bm.innerHTML = Mascot.svg(mo, 44);
    }
    if (tm && tm.dataset.m !== mo) {
      tm.dataset.m = mo;
      tm.innerHTML = Mascot.svg(mo, 26);
    }
    if (ui.tab === 'chat') {
      const bx = $('#chat-box');
      if (bx) bx.scrollTop = bx.scrollHeight;
    }
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
