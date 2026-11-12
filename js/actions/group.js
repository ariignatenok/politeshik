'use strict';

Object.assign(A, {
  'subgroup-edit'(el){
    if(!Cloud.isAdmin)return;
    const r=ROSTER_BY_ID[el.dataset.rid];if(!r||r.flag)return;
    UI.open('Подгруппа студента','<p>'+U.esc(r.name)+'</p><label class="field"><span>Подгруппа</span><select class="input" id="student-subgroup"><option value="1"'+(r.sub==='1'?' selected':'')+'>1 подгруппа</option><option value="2"'+(r.sub==='2'?' selected':'')+'>2 подгруппа</option></select></label><div class="modal-foot"><button class="btn" data-action="modal-close">Отмена</button><button class="btn primary" data-action="subgroup-save" data-rid="'+r.id+'">Сохранить</button></div>');
  },
  async 'subgroup-save'(el){
    if(!Cloud.isAdmin)return;const subgroup=document.getElementById('student-subgroup')?.value,tenant=Cloud.tenantId,uid=Cloud.uid;
    el.disabled=true;try{const {error}=await supa.rpc('set_subgroup',{p_rid:el.dataset.rid,p_subgroup:subgroup});if(error)throw error;
      if(tenant!==Cloud.tenantId||uid!==Cloud.uid)return;await Cloud.loadSubgroups();UI.close();App.render();toast('Подгруппа сохранена');
    }catch(error){toast(error.message)}finally{el.disabled=false;}
  },
  /**
   * Переключает фильтр на вкладке «Больничные».
   * @param {HTMLElement} el Элемент, по которому кликнули; параметры передаются через его data-атрибуты.
   */
  'sick-filter'(el) {
    ui.sickFilter = el.dataset.f;
    App.render();
  },
  /**
   * Подтверждает справку или снимает подтверждение.
   * @param {HTMLElement} el Элемент, по которому кликнули; параметры передаются через его data-атрибуты.
   */
  'cert-ok'(el) {
    Cloud.setCertStatus(el.dataset.uid, el.dataset.id, el.dataset.ok === '1');
    toast(el.dataset.ok === '1' ? 'Справка подтверждена' : 'Подтверждение снято');
    App.render();
  },
  /**
   * Удаляет справку студента после подтверждения.
   * @param {HTMLElement} el Элемент, по которому кликнули; параметры передаются через его data-атрибуты.
   */
  async 'cert-adm-del'(el) {
    if (!(await UI.confirm('Удалить справку? Дни снова станут обычными пропусками.', 'Удалить'))) return;
    await Cloud.admDelCert(el.dataset.uid, el.dataset.id);
    App.render();
  },
  /**
   * Открывает карточку студента.
   * @param {HTMLElement} el Элемент, по которому кликнули; параметры передаются через его data-атрибуты.
   */
  'stud-open'(el) {
    openStudent(el.dataset.id, el.dataset.date);
  },
  /**
   * Освобождает фамилию студента после подтверждения.
   * @param {HTMLElement} el Элемент, по которому кликнули; параметры передаются через его data-атрибуты.
   */
  async 'grp-release'(el) {
    const r = ROSTER_BY_ID[el.dataset.rid];
    if (
      !(await UI.confirm(
        'Освободить фамилию «' + (r ? r.name : '') + '»? Этот студент сможет войти заново и выбрать фамилию из списка.',
        'Освободить'
      ))
    )
      return;
    await Cloud.release(el.dataset.rid, el.dataset.uid);
    App.render();
    toast('Фамилия освобождена');
  },
  /**
   * Проставляет «н» за неотмеченные пары прошедшего дня.
   */
  async 'grp-closeday'() {
    const date = ui.grpDate || U.iso(U.today());
    if (date >= U.iso(U.today()) || date < ATT_START) return toast('Закрыть можно только прошедший учебный день');
    if (
      !(await UI.confirm(
        'Поставить «н» всем вошедшим студентам за пары, которые они не отметили (' +
          U.fmtShort(U.fromISO(date)) +
          ')? Дни по справке не затрагиваются. Исправить можно вручную.',
        'Проставить'
      ))
    )
      return;
    let n = 0;
    rosterRows()
      .filter(x => x.e && !x.r.flag && !x.r.admin)
      .forEach(x => {
        let cur = null;
        Att.pairs(date, x.e.p.subgroup).forEach(pr => {
          if (!x.e.marks[date + '|' + pr.pair] && !Att.covered(x.e.certs, date)) {
            if (!cur) cur = Object.assign({}, x.e.marks);
            cur[date + '|' + pr.pair] = 'н';
            n++;
          }
        });
        if (cur) {
          const id = x.e.id;
          Cloud.adm.att[id] = {
            marks: cur,
            updated: new Date().toISOString()
          };
          Cloud.put('attendance/' + id, () => Cloud.adm.att[id]);
        }
      });
    App.render();
    toast(n ? 'Проставлено «н»: ' + n : 'Неотмеченных пар нет');
  },
  /**
   * Переключает вкладку раздела «Группа».
   * @param {HTMLElement} el Элемент, по которому кликнули; параметры передаются через его data-атрибуты.
   */
  'grp-tab'(el) {
    ui.grpTab = el.dataset.tab;
    App.render();
  },
  /**
   * Листает день на вкладке «Сегодня».
   * @param {HTMLElement} el Элемент, по которому кликнули; параметры передаются через его data-атрибуты.
   */
  'grp-day'(el) {
    const d = U.fromISO(ui.grpDate || U.iso(U.today()));
    ui.grpDate = U.iso(U.addDays(d, +el.dataset.d));
    App.render();
  },
  /**
   * Открывает форму работы для всей группы.
   */
  'gwork-add'() {
    openGWorkForm();
  },
  /**
   * Открывает правку работы группы.
   * @param {HTMLElement} el Элемент, по которому кликнули; параметры передаются через его data-атрибуты.
   */
  'gwork-edit'(el) {
    openGWorkForm(el.dataset.id);
  },
  /**
   * Удаляет работу группы.
   * @param {HTMLElement} el Элемент, по которому кликнули; параметры передаются через его data-атрибуты.
   */
  async 'gwork-del'(el) {
    if (await UI.confirm('Удалить работу у всей группы?')) {
      Cloud.gworks = Cloud.gworks.filter(w => w.id !== el.dataset.id);
      Cloud.saveGworks();
      App.render();
    }
  },
  /**
   * Скачивает журнал посещаемости в формате CSV.
   */
  async 'grp-csv'() {
    toast('Готовлю журнал…');
    await AttReport.load(true);
    const items = AttReport.items(ATT_START, U.iso(U.today()));
    if (!items.length) return toast('Пока нет отметок для выгрузки');
    try {
      await Cloud.dl.save({
        filename: 'politeshik-zhurnal-' + U.iso(new Date()) + '.csv',
        data: AttReport.csv(items)
      });
    } catch (error) {
      toast('Не удалось сохранить файл');
    }
  },
  /**
   * Скачивает журнал месяца в Excel в виде матрицы: строки — студенты, столбцы — дни и пары.
   */
  async 'grp-xlsx'() {
    const ym = Att.limitMonth();
    toast('Готовлю таблицу…');
    await AttReport.load(true);
    const m = AttReport.matrix(ym, GROUP_NAME);
    if (!m.columns) return toast('За ' + AttReport.monthTitle(ym) + ' пар по расписанию ещё не было');
    try {
      await Cloud.dl.save({
        filename: 'politeshik-zhurnal-' + GROUP_NAME.replace(/[^0-9]+/g, '-') + '-' + ym + '.xlsx',
        data: Xlsx.build(m.spec)
      });
      toast('Таблица за ' + AttReport.monthTitle(ym) + ' сохранена');
    } catch (error) {
      toast('Не удалось сохранить файл');
    }
  },
  /**
   * Открывает форму преподавателя.
   */
  't-add'() {
    openTeacherForm();
  },
  /**
   * Открывает правку преподавателя.
   * @param {HTMLElement} el Элемент, по которому кликнули; параметры передаются через его data-атрибуты.
   */
  't-edit'(el) {
    openTeacherForm(el.dataset.id);
  },
  /**
   * Удаляет преподавателя.
   * @param {HTMLElement} el Элемент, по которому кликнули; параметры передаются через его data-атрибуты.
   */
  async 't-del'(el) {
    if (!(await UI.confirm('Удалить карточку преподавателя?'))) return;
    Store.s.teachers = Store.s.teachers.filter(t => t.id !== el.dataset.id);
    Store.commit();
  }
});
