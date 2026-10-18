'use strict';

Object.assign(A, {
  /**
   * Вход по email и паролю.
   * @param {HTMLElement} el Элемент, по которому кликнули; параметры передаются через его data-атрибуты.
   */
  async 'login-do'(el) {
    const f = el.closest('[data-form="login"]') || $('#gate');
    const email = (f.querySelector('[name=email]') || {}).value || '';
    const password = (f.querySelector('[name=password]') || {}).value || '';
    const secret = (f.querySelector('[name=teacher_secret]') || {}).value || '',
      teacherName = (f.querySelector('[name=teacher_name]') || {}).value || '';
    const asTeacher = ui.loginRole === 'teacher';
    if (!email || !password) {
      toast('Введи email и пароль');
      return;
    }
    if (asTeacher && !secret.trim()) {
      toast('Введите пароль преподавателя');
      return;
    }
    el.disabled = true;
    el.textContent = 'Входим…';
    ui.activating = asTeacher;
    const r = await Cloud.login(email.trim(), password);
    el.disabled = false;
    el.textContent = 'Войти';
    if (!r.ok) {
      ui.activating = false;
      toast('Ошибка: ' + r.msg);
      return;
    }
    if (asTeacher && !Cloud.isTeacher) {
      const t = await Teacher.activate(secret, teacherName);
      if (!t.ok) {
        ui.activating = false;
        await supa.auth.signOut();
        await Cloud.init();
        $('#gate').dataset.mode = '';
        App.render(true);
        toast(t.msg);
        return;
      }
    }
    ui.activating = false;
    Chat.tick();
    Ach.check();
    App.render(true);
    toast('Добро пожаловать!');
  },
  /**
   * Регистрация нового аккаунта по email и паролю.
   * @param {HTMLElement} el Элемент, по которому кликнули; параметры передаются через его data-атрибуты.
   */
  async 'signup-do'(el) {
    const f = el.closest('[data-form="login"]') || $('#gate');
    const email = (f.querySelector('[name=email]') || {}).value || '';
    const password = (f.querySelector('[name=password]') || {}).value || '';
    const secret = (f.querySelector('[name=teacher_secret]') || {}).value || '',
      teacherName = (f.querySelector('[name=teacher_name]') || {}).value || '';
    const asTeacher = ui.loginRole === 'teacher';
    if (!email || !password) {
      toast('Введи email и пароль');
      return;
    }
    if (password.length < 6) {
      toast('Пароль минимум 6 символов');
      return;
    }
    if (asTeacher && !secret.trim()) {
      toast('Введите пароль преподавателя');
      return;
    }
    el.disabled = true;
    el.textContent = 'Создаём…';
    ui.activating = asTeacher;
    const r = await Cloud.signup(email.trim(), password);
    el.disabled = false;
    el.textContent = 'Зарегистрироваться';
    if (!r.ok) {
      ui.activating = false;
      toast('Ошибка: ' + r.msg);
      return;
    }
    if (asTeacher) {
      const t = await Teacher.activate(secret, teacherName);
      ui.activating = false;
      if (!t.ok) {
        await supa.auth.signOut();
        await Cloud.init();
        $('#gate').dataset.mode = '';
        App.render(true);
        toast('Аккаунт создан, но ' + t.msg.charAt(0).toLowerCase() + t.msg.slice(1));
        return;
      }
      App.render(true);
      toast('Добро пожаловать!');
      return;
    }
    toast('Аккаунт создан! Выбери свою фамилию из списка.');
    App.render(true);
  },
  /**
   * Проверяет секретный пароль админа на сервере и завершает создание кабинета админа.
   * @param {HTMLElement} el Элемент, по которому кликнули; параметры передаются через его data-атрибуты.
   */
  async 'secret-do'(el) {
    const f = el.closest('[data-form]'),
      v = ((f && f.querySelector('[name=secret]')) || {}).value || '',
      st = ui.secret;
    if (!st) return;
    if (!v) return toast('Введите секретный пароль');
    let good = false;
    try {
      const {data, error} = await supa.rpc('become_admin', {
        p_secret: v
      });
      if (error) throw error;
      good = data === true;
    } catch (error) {
      return toast(
        /не задан/i.test(error.message || '')
          ? 'Секретный пароль ещё не задан в Supabase'
          : error.message || 'Не удалось проверить пароль'
      );
    }
    if (!good) {
      ui.secret = null;
      $('#gate').dataset.mode = '';
      toast('Неверный секретный пароль');
      App.render();
      return;
    }
    await Cloud.init();
    if (!Cloud.isAdmin) return toast('Не удалось получить права админа');
    const c = await Cloud.claim(st.rid);
    if (!c.ok) return toast('Не удалось занять фамилию');
    try {
      await Cloud.saveProfile(st.rid, st.sg);
    } catch (error) {
      return toast('Не удалось создать кабинет');
    }
    ui.secret = null;
    $('#gate').dataset.mode = '';
    UI.locked = false;
    UI.close();
    Chat.tick();
    App.render(true);
    toast('Добро пожаловать, админ!');
  },
  /**
   * Возвращает с экрана секретного пароля к выбору фамилии.
   */
  'secret-back'() {
    ui.secret = null;
    $('#gate').dataset.mode = '';
    App.render();
  },
  /**
   * Выход из аккаунта без подтверждения.
   */
  async 'logout-now'() {
    await Cloud.logout();
  },
  /**
   * Выход из аккаунта после подтверждения.
   */
  async logout() {
    if (!(await UI.confirm('Выйти из аккаунта? Данные останутся в облаке.', 'Выйти'))) return;
    await Cloud.logout();
  },
  /**
   * Повторяет подключение к облаку.
   */
  'gate-retry'() {
    Cloud.status = 'pending';
    $('#gate').dataset.mode = '';
    App.render();
    Cloud.init().then(() => {
      UI.applyTheme();
      Chat.tick();
      App.render(true);
    });
  },
  /**
   * Открывает приложение без облака.
   */
  'gate-local'() {
    ui.localOk = true;
    $('#gate').dataset.mode = '';
    App.render(true);
  }
});
