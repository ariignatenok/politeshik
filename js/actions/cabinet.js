'use strict';

Object.assign(A, {
  /**
   * Переключает период рейтинга.
   * @param {HTMLElement} el Элемент, по которому кликнули; параметры передаются через его data-атрибуты.
   */
  'rate-period'(el) {
    ui.ratePeriod = el.dataset.p;
    App.render();
  },
  /**
   * Убирает приз за 1 место.
   */
  'prize-del'() {
    Rating.setPrize(Rating.periods()[ui.ratePeriod || 'month'].key, '');
    App.render();
  },
  /**
   * Переключает вкладку кабинета.
   * @param {HTMLElement} el Элемент, по которому кликнули; параметры передаются через его data-атрибуты.
   */
  'cab-tab'(el) {
    ui.cabTab = el.dataset.t;
    App.render();
  },
  /**
   * Сохраняет текст «О себе».
   */
  'about-save'() {
    const t = ($('#about-text') || {}).value || '';
    Store.s.settings.about = t.slice(0, 500);
    Store.save();
    Profile.push();
    toast('Сохранено');
  },
  /**
   * Открывает выбор аватара.
   */
  'avatar-open'() {
    const cur = myAvatar();
    UI.open(
      'Аватар',
      '<p class="md-help" style="margin:0 0 10px">Выбери смешную картинку или загрузи своё фото — оно сожмётся до маленького квадрата.</p>' +
        '<div class="av-grid">' +
        AVATARS.map(
          a =>
            '<button class="av-pick' +
            (cur === a[0] ? ' on' : '') +
            '" data-action="avatar-pick" data-id="' +
            a[0] +
            '" aria-label="Аватар ' +
            a[1] +
            '"><span class="av-em" style="width:56px;height:56px;font-size:30px;background:' +
            a[2] +
            '">' +
            a[1] +
            '</span></button>'
        ).join('') +
        '</div>' +
        '<div class="field" style="margin-top:14px"><span class="lbl">Своё фото</span><input class="input" type="file" accept="image/*" data-change="avatar-file"></div>' +
        '<div class="modal-foot"><button class="btn left" data-action="avatar-pick" data-id="">Вернуть Политешика</button><button class="btn" data-action="modal-close">Закрыть</button></div>'
    );
  },
  /**
   * Применяет выбранный аватар.
   * @param {HTMLElement} el Элемент, по которому кликнули; параметры передаются через его data-атрибуты.
   */
  'avatar-pick'(el) {
    Store.s.settings.avatar = el.dataset.id ? {k: 'm', id: el.dataset.id} : null;
    Store.save();
    Profile.push();
    UI.close();
    App.render();
  },
  /**
   * Открывает правку профиля.
   */
  'profile-edit'() {
    openProfileForm(false);
  },
  /**
   * Открывает форму справки.
   */
  'cert-add'() {
    openCertForm();
  },
  /**
   * Показывает фото справки.
   * @param {HTMLElement} el Элемент, по которому кликнули; параметры передаются через его data-атрибуты.
   */
  'cert-view'(el) {
    if (Cloud.status !== 'online') return;
    showImage('Справка', Cloud.getCertImg(el.dataset.uid, el.dataset.id));
  },
  /**
   * Удаляет справку.
   * @param {HTMLElement} el Элемент, по которому кликнули; параметры передаются через его data-атрибуты.
   */
  async 'cert-del'(el) {
    if (await UI.confirm('Удалить справку? Админ группы перестанет её видеть.')) {
      Cloud.delCert(el.dataset.id);
      App.render();
    }
  },
  /**
   * Открывает форму личного файла.
   */
  'file-add'() {
    if (Cloud.status !== 'online') return toast('Файлы хранятся в облаке — откройте приложение по приглашению');
    openFileForm();
  },
  /**
   * Открывает личный файл.
   * @param {HTMLElement} el Элемент, по которому кликнули; параметры передаются через его data-атрибуты.
   */
  'file-open'(el) {
    const f = Cloud.my.files.find(x => x.id === el.dataset.id);
    if (!f) return;
    if (/^image\//.test(f.type || '')) return showImage(f.title, Cloud.getFile(f.id));
    Cloud.getFile(f.id).then(
      async data => {
        if (!data) return toast('Файл не найден');
        const blob = await (await fetch(data)).blob();
        downloadBlob(blob, f.name || f.title);
      },
      () => toast('Не удалось открыть файл')
    );
  },
  /**
   * Удаляет личный файл.
   * @param {HTMLElement} el Элемент, по которому кликнули; параметры передаются через его data-атрибуты.
   */
  async 'file-del'(el) {
    if (await UI.confirm('Удалить файл?')) {
      Cloud.delFile(el.dataset.id);
      App.render();
    }
  },
  /**
   * Открывает форму личной заметки.
   */
  'cab-note-add'() {
    openNoteEditor(null, '');
  }
});
