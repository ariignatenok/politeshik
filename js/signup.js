'use strict';

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
   * Строит экран «Подтвердите почту» или «Завершите регистрацию».
   * @param {string} mode Confirm или complete.
   * @returns {string} HTML.
   */
  gateHtml(mode) {
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
        ? field('Ваше ФИО', 'person_name', meta.person_name) +
          field('ФИО ребёнка (как в списке группы)', 'child_name', meta.child_name) +
          field(
            'Код группы (его выдаёт староста)',
            'group_code',
            '',
            'autocomplete="off" placeholder="25290909-3091-XXXXX"'
          )
        : role === 'staff'
          ? field('Ваше ФИО', 'person_name', meta.person_name) +
            field('Должность и группа', 'person_note', meta.person_note)
          : field('Как к вам обращаться', 'teacher_name', meta.teacher_name) +
            '<label class="field"><span>Пароль преподавателя</span><input class="input" name="teacher_secret" type="password" autocomplete="off"></label>';
    return (
      '<div class="gate-card"><div class="gate-mascot">' +
      Mascot.svg('wink', 110) +
      '</div><h1>Политешик</h1><p class="gate-sub">Завершите регистрацию</p><p class="gate-text">Почта подтверждена. Заполните данные, и заявка уйдёт старосте на одобрение.</p>' +
      '<div data-form="complete" data-role="' +
      U.esc(role) +
      '">' +
      body +
      '<button class="btn primary big" data-action="complete-send">Отправить заявку</button></div>' +
      '<button class="btn ghost" style="margin-top:10px;width:100%" data-action="logout-now">Выйти из аккаунта</button></div>'
    );
  }
};
