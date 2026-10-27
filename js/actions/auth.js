'use strict';

Object.assign(A, {
  /**
   * Вход по email и паролю.
   * @param {HTMLElement} el Элемент, по которому кликнули; параметры передаются через его data-атрибуты.
   */
  async 'login-do'(el) {
    const f = el.closest('[data-form="login"]') || $('#gate');
    const read = name => (f.querySelector('[name=' + name + ']') || {}).value || '';
    const email = read('email').trim(),
      password = read('password'),
      secret = read('teacher_secret'),
      teacherName = read('teacher_name').trim();
    const role = ui.loginRole || 'student',
      asTeacher = role === 'teacher',
      extra = role === 'parent' || role === 'staff';
    ui.loginDraft = {
      email,
      teacher_name: teacherName,
      person_name: read('person_name'),
      child_name: read('child_name'),
      person_note: read('person_note'),
      group_code: read('group_code'),
      consent: !!(f.querySelector('[name=consent]') || {}).checked
    };
    if (!email || !password) return toast('Введите почту и пароль');
    if (asTeacher && !secret.trim()) return toast('Введите пароль преподавателя');
    if (extra) {
      const problem = Roles.checkExtra(role, f);
      if (problem) return toast(problem);
    }
    if ((role === 'student' || role === 'parent') && read('group_code').trim()) {
      ui.groupCode = read('group_code').trim();
      try {
        window.localStorage.setItem('politeshik:gc', ui.groupCode);
      } catch (error) {}
    }
    el.disabled = true;
    el.textContent = 'Входим…';
    ui.activating = asTeacher || extra;
    try {
      const result = await Cloud.login(email, password);
      if (result.unconfirmed) {
        ui.confirmEmail = {
          email
        };
        return;
      }
      if (!result.ok) return toast('Ошибка: ' + result.msg);
      if (asTeacher && !Cloud.realTeacher) {
        const activation = await Teacher.activate(secret, teacherName);
        if (!activation.ok) {
          toast(activation.msg);
          await Roles.dropSession();
          return;
        }
      }
      if (extra && !Cloud.member) {
        const reg = await Roles.registerExtra(role, f);
        if (!reg.ok) {
          toast(reg.msg);
          await Roles.dropSession();
          return;
        }
        await Cloud.init();
      }
      ui.loginDraft = null;
    } catch (error) {
      toast('Не удалось войти: ' + (error && error.message ? error.message : 'проверьте связь'));
    } finally {
      ui.activating = false;
      if (el.isConnected) {
        el.disabled = false;
        el.textContent = 'Войти';
      }
      $('#gate').dataset.mode = '';
      App.render(true);
    }
  },
  /**
   * Регистрация нового аккаунта по email и паролю.
   * @param {HTMLElement} el Элемент, по которому кликнули; параметры передаются через его data-атрибуты.
   */
  async 'signup-do'(el) {
    const f = el.closest('[data-form="login"]') || $('#gate');
    const read = name => (f.querySelector('[name=' + name + ']') || {}).value || '';
    const email = read('email').trim(),
      password = read('password'),
      secret = read('teacher_secret'),
      teacherName = read('teacher_name').trim();
    const role = ui.loginRole || 'student',
      asTeacher = role === 'teacher',
      extra = role === 'parent' || role === 'staff';
    ui.loginDraft = {
      email,
      teacher_name: teacherName,
      person_name: read('person_name'),
      child_name: read('child_name'),
      person_note: read('person_note'),
      group_code: read('group_code'),
      consent: !!(f.querySelector('[name=consent]') || {}).checked
    };
    if (!email || !password) return toast('Введите почту и пароль');
    if (password.length < 6) return toast('Пароль должен быть не короче 6 символов');
    if (!(f.querySelector('[name=consent]') || {}).checked)
      return toast('Нужно согласие на обработку персональных данных');
    if (role === 'student' || role === 'parent') {
      const code = read('group_code').trim();
      const check = await supa.rpc('check_group_code', {
        p_code: code
      });
      if (check.error) return toast(check.error.message);
      if (check.data !== true) return toast(code ? 'Неверный код группы' : 'Введите код группы: его выдаёт староста');
      ui.groupCode = code;
      try {
        window.localStorage.setItem('politeshik:gc', code);
      } catch (error) {}
    }
    if (asTeacher && !secret.trim()) return toast('Введите пароль преподавателя');
    if (extra) {
      const problem = Roles.checkExtra(role, f);
      if (problem) return toast(problem);
    }
    el.disabled = true;
    el.textContent = 'Создаём…';
    ui.activating = asTeacher || extra;
    try {
      const meta = {
        consent: true,
        consent_date: new Date().toISOString(),
        signup_role: role,
        person_name: read('person_name').trim(),
        child_name: read('child_name').trim(),
        person_note: read('person_note').trim(),
        teacher_name: teacherName
      };
      const result = await Cloud.signup(email, password, meta);
      if (result.confirm) {
        ui.confirmEmail = {
          email
        };
        return;
      }
      if (!result.ok) return toast('Ошибка: ' + result.msg);
      if (asTeacher) {
        const activation = await Teacher.activate(secret, teacherName);
        if (!activation.ok) {
          toast(activation.msg);
          await Roles.dropSession();
          return;
        }
      }
      if (extra) {
        const reg = await Roles.registerExtra(role, f);
        if (!reg.ok) {
          toast(reg.msg);
          await Roles.dropSession();
          return;
        }
        await Cloud.init();
      }
      ui.loginDraft = null;
    } catch (error) {
      toast('Не удалось создать аккаунт: ' + (error && error.message ? error.message : 'проверьте связь'));
    } finally {
      ui.activating = false;
      if (el.isConnected) {
        el.disabled = false;
        el.textContent = 'Зарегистрироваться';
      }
      $('#gate').dataset.mode = '';
      App.render(true);
    }
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
