'use strict';

/**
 * Значок GitHub для кнопки входа (SVG, цвет берётся из текста кнопки).
 * @type {string}
 */
const GITHUB_MARK =
  '<svg viewBox="0 0 16 16" width="18" height="18" aria-hidden="true" fill="currentColor"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/></svg>';

const Signup = {
  /**
   * Возвращает текст пояснения к согласию на обработку персональных данных.
   * @returns {string} HTML.
   */
  consentText() {
    return (
      '<div class="consent-text"><p>Нажимая «Зарегистрироваться», вы соглашаетесь на обработку ваших персональных данных в учебном приложении «Политешик» в соответствии с Федеральным законом № 152-ФЗ «О персональных данных».</p>' +
      '<h3>Какие данные обрабатываются</h3><ul><li>фамилия, имя, адрес электронной почты;</li><li>группа, подгруппа, роль в приложении;</li><li>отметки посещаемости, справки и записки (включая фотографии);</li><li>фото профиля, если вы его загрузите;</li><li>сообщения в чатах приложения.</li></ul>' +
      '<h3>Зачем</h3><p>Для ведения учёта посещаемости, расписания, связи со старостой и преподавателями и входа в приложение.</p>' +
      '<h3>Как долго и как отозвать</h3><p>Данные хранятся, пока вы пользуетесь приложением. Чтобы отозвать согласие и удалить аккаунт, обратитесь к старосте группы: она может удалить ваш аккаунт вместе с данными.</p></div>'
    );
  },
  /**
   * Строит экран «Завершите регистрацию» для человека, вошедшего через GitHub: роль, код группы или данные, согласие.
   * @returns {string} HTML.
   */
  oauthHtml() {
    let saved = '';
    try {
      saved = window.localStorage.getItem('politeshik:oauthrole') || '';
    } catch (error) {}
    const role = ui.oauthRole || (['student', 'parent', 'staff', 'teacher'].indexOf(saved) >= 0 ? saved : 'student'),
      draft = ui.oauthDraft || {},
      meta = Cloud.meta || {},
      who = meta.user_name || meta.preferred_username || Cloud.oauthEmail || 'GitHub';
    if (!Cloud.oauthEmail)
      return (
        '<div class="gate-card"><div class="gate-mascot">' +
        Mascot.svg('worried', 110) +
        '</div><h1>Политешик</h1><p class="gate-sub">GitHub не передал почту</p><p class="gate-text">Для регистрации нужна подтверждённая почта. В GitHub откройте Settings → Emails, добавьте и подтвердите основную почту (Primary), затем войдите снова. Либо зарегистрируйтесь по почте и паролю.</p>' +
        '<button class="btn primary big" data-action="logout-now">Выйти и вернуться ко входу</button></div>'
      );
    const field = (label, name, value, extra) =>
        '<label class="field"><span>' + label + '</span><input class="input" name="' + name + '" value="' + U.esc(value || '') + '" ' + (extra || '') + '></label>',
      roleBtn = (id, label) => '<button class="' + (role === id ? 'on' : '') + '" data-action="oauth-role" data-role="' + id + '">' + label + '</button>',
      codeField = Groups.selector(false) + field('Код группы (его выдаёт староста)', 'group_code', draft.group_code || '', 'autocomplete="off" placeholder="' + Groups.get(Groups.selected).number.replace('/', '-') + '-XXXXX"'),
      body =
        role === 'student'
          ? codeField
          : role === 'parent'
            ? field('Ваше ФИО', 'person_name', draft.person_name || '', 'placeholder="Иванова Мария Петровна"') +
              Groups.childSelector(draft.child_name || '') +
              codeField
            : role === 'staff'
              ? field('Ваше ФИО', 'person_name', draft.person_name || '', 'placeholder="Петрова Анна Сергеевна"') +
                field('Должность и группа', 'person_note', draft.person_note || '', 'placeholder="Куратор группы 3091"')
              : Faculty.fields(draft.teacher_name || ''),
      intro = {
        student: 'Следующий шаг: выберете свою фамилию из списка группы. Доступ откроется после одобрения старостой.',
        parent: 'Родитель видит успеваемость и пропуски своего ребёнка. Доступ откроется после одобрения старостой.',
        staff: 'Куратор или отделение: укажите ФИО и должность, староста назначит роль.',
        teacher: 'Доступ к кабинету подтверждает Админ Арина.'
      }[role];
    return (
      '<div class="gate-card"><div class="gate-mascot">' +
      Mascot.svg('wink', 110) +
      '</div><h1>Политешик</h1><p class="gate-sub">Завершите регистрацию</p><p class="gate-text">Вы вошли через GitHub (' +
      U.esc(who) +
      '). Выберите, кто вы, и заполните данные.</p>' +
      '<div class="role-seg role-seg4">' +
      roleBtn('student', 'Студент') +
      roleBtn('parent', 'Родитель') +
      roleBtn('staff', 'Куратор / отделение') +
      roleBtn('teacher', 'Преподаватель') +
      '</div><p class="gate-text">' +
      intro +
      '</p><div data-form="oauth">' +
      body +
      '<label class="consent"><span class="consent-ico">' +
      ICONS.shield +
      '</span><input type="checkbox" name="consent"' +
      (draft.consent ? ' checked' : '') +
      '><span>Я даю согласие на обработку моих персональных данных. <a href="#" data-action="consent-info">Подробнее</a></span></label>' +
      '<button class="btn primary big" data-action="oauth-send">Продолжить</button></div>' +
      '<button class="btn ghost" style="margin-top:10px;width:100%" data-action="logout-now">Выйти из аккаунта</button></div>'
    );
  },
  /**
   * Строит экран «Подтвердите почту» или «Завершите регистрацию».
   * @param {string} mode Confirm или complete.
   * @returns {string} HTML.
   */
  gateHtml(mode) {
    if (mode === 'oauth') return Signup.oauthHtml();
    if (mode === 'confirm') {
      const email = (ui.confirmEmail && ui.confirmEmail.email) || '';
      return (
        '<div class="gate-card"><div class="gate-mascot">' +
        Mascot.svg('thinking', 110) +
        '</div><h1>Политешик</h1><p class="gate-sub">Подтвердите почту</p>' +
        '<p class="gate-text">Мы отправили письмо на <b>' +
        U.esc(email) +
        '</b>. Откройте его и перейдите по ссылке (загляните в «Спам»). После этого вернитесь сюда и войдите.</p>' +
        '<button class="btn primary big" data-action="confirm-back">Я подтвердил(а) почту: войти</button><button class="btn ghost" style="margin-top:10px;width:100%" data-action="confirm-resend">Отправить письмо ещё раз</button></div>'
      );
    }
    const meta = Cloud.meta || {},
      role = meta.signup_role,
      field = (label, name, value, extra) =>
        '<label class="field"><span>' +
        label +
        '</span><input class="input" name="' +
        name +
        '" value="' +
        U.esc(value || '') +
        '" ' +
        (extra || '') +
        '></label>';
    const body =
      role === 'parent'
        ? Groups.selector(false) + field('Ваше ФИО', 'person_name', meta.person_name) +
          Groups.childSelector(meta.child_name || '') +
          field(
            'Код группы (его выдаёт староста)',
            'group_code',
            '',
            'autocomplete="off" placeholder="' + Groups.get(Groups.selected).number.replace('/', '-') + '-XXXXX"'
          )
        : role === 'staff'
          ? Groups.selector(false) + field('Ваше ФИО', 'person_name', meta.person_name) +
            field('Должность и группа', 'person_note', meta.person_note)
          : Faculty.fields(meta.teacher_name || '');
    return (
      '<div class="gate-card"><div class="gate-mascot">' +
      Mascot.svg('wink', 110) +
      '</div><h1>Политешик</h1><p class="gate-sub">Завершите регистрацию</p><p class="gate-text">'+(role==='teacher'?'Выберите своё ФИО. Доступ к кабинету подтвердит Админ Арина.':'Заполните данные, и заявка уйдёт старосте на одобрение.')+'</p>' +
      '<div data-form="complete" data-role="' +
      U.esc(role) +
      '">' +
      body +
      '<button class="btn primary big" data-action="complete-send">Отправить заявку</button></div>' +
      '<button class="btn ghost" style="margin-top:10px;width:100%" data-action="logout-now">Выйти из аккаунта</button></div>'
    );
  }
};
