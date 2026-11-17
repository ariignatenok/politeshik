'use strict';

// A separate capability: deputies stay students and never inherit admin privileges.
const Deputies = {
  rows: [], candidates: [], owner: '', pending: null, error: '',
  canMark() { return Cloud.status === 'online' && Cloud.role === 'student' && Cloud.isDeputy === true; },
  has(uid) { return Deputies.rows.some(x => x.uid === uid); },
  manageButton() {
    return Cloud.isAdmin ? '<button class="btn" data-action="deputy-manage">Добавить зама</button>' : '';
  },
  async refresh() {
    const owner = Cloud.uid + ':' + Cloud.tenantId;
    if (Deputies.owner !== owner) {
      Deputies.clearJournal();
      Deputies.owner = owner; Deputies.rows = []; Deputies.candidates = []; Cloud.isDeputy = false;
      Deputies.pending = null; Deputies.error = '';
    }
    if (Cloud.status !== 'online' || !Cloud.hasCabinet() || !['student','admin','developer'].includes(Cloud.role)) {
      Deputies.clearJournal(); Cloud.isDeputy = false; return false;
    }
    if (Deputies.pending) return Deputies.pending;
    const request = (async () => {
      try {
        const {data, error} = await supa.rpc('deputy_context');
        if (owner !== Cloud.uid + ':' + Cloud.tenantId) return false;
        if (error || !data) throw new Error(error?.message || 'Не удалось проверить полномочия зама');
        Deputies.apply(data); Deputies.error = ''; return true;
      } catch (error) {
        if (owner === Cloud.uid + ':' + Cloud.tenantId) {
          Deputies.error = error.message;
          // Hide privileged controls on an unverified session; server also checks every write.
          Deputies.clearJournal(); Cloud.isDeputy = false;
        }
        return false;
      }
    })();
    Deputies.pending = request;
    try { return await request; } finally { if (Deputies.pending === request) Deputies.pending = null; }
  },
  clearJournal() {
    if (Cloud.isDeputy && !Cloud.realAdmin && !Cloud.isDeveloper) {
      Cloud.adm.profiles = {}; Cloud.adm.att = {}; Cloud.adm.certs = {}; Cloud.admReady = false;
    }
  },
  apply(data) {
    if (!data.is_deputy) Deputies.clearJournal();
    Cloud.isDeputy = data.is_deputy === true;
    Deputies.rows = data.deputies || []; Deputies.candidates = data.candidates || [];
    if (Cloud.isDeputy) {
      const profiles = {}, att = {}, certs = {};
      (data.journal || []).forEach(x => {
        profiles[x.uid] = x.profile; att[x.uid] = x.attendance; certs[x.uid] = {items: x.certs || []};
      });
      Cloud.adm.profiles = profiles; Cloud.adm.att = att; Cloud.adm.certs = certs; Cloud.admReady = true;
    }
  },
  async open() {
    if (!Cloud.isAdmin) return;
    UI.open('Заместители старосты', '<p role="status">Загружаю список группы…</p>');
    if (!await Deputies.refresh()) {
      UI.open('Заместители старосты', '<p>' + U.esc(Deputies.error || 'Не удалось загрузить список') + '</p><button class="btn" data-action="deputy-manage">Повторить</button>');
      return;
    }
    Deputies.show();
  },
  show() {
    const row = x => {
      const active = Deputies.has(x.uid);
      return '<div class="deputy-row"><div><b>' + U.esc(x.name || 'Студент') + '</b>' +
        (active ? '<small>Зам старосты</small>' : !x.eligible ? '<small>Недоступен для назначения · нужен одобренный аккаунт студента</small>' : '') +
        '</div>' + (x.uid && (x.eligible || active) ? '<button class="btn sm' + (active ? '' : ' primary') + '" data-action="deputy-set" data-uid="' + x.uid + '" data-enabled="' + (active ? '0' : '1') + '">' + (active ? 'Снять полномочия' : 'Назначить замом') + '</button>' : '') + '</div>';
    };
    const candidates = Deputies.candidates.slice(), seen = new Set(candidates.map(x => x.uid));
    Deputies.rows.filter(x => !seen.has(x.uid)).forEach(x => candidates.push({...x, eligible: false}));
    UI.open('Заместители старосты', '<p>Группа ' + U.esc(Groups.get(Groups.current).number) +
      '. Зам ставит П и Н в журнале и публикует новости. Заявки, справки, настройки и управление группой доступны старосте.</p>' +
      '<div class="deputy-list">' + candidates.map(row).join('') + '</div><div class="modal-foot"><button class="btn" data-action="modal-close">Готово</button></div>');
  },
  async assign(el) {
    if (!Cloud.isAdmin) return;
    const owner = Cloud.uid + ':' + Cloud.tenantId;
    el.disabled = true;
    try {
      const {data, error} = await supa.rpc('set_group_deputy', {p_uid: el.dataset.uid, p_enabled: el.dataset.enabled === '1'});
      if (error) throw error;
      if (owner !== Cloud.uid + ':' + Cloud.tenantId) return;
      Deputies.apply(data); Deputies.show(); App.renderSoft();
      toast(el.dataset.enabled === '1' ? 'Зам старосты назначен' : 'Полномочия зама сняты');
    } catch (error) { toast(error.message); el.disabled = false; }
  },
  async saveMarks(uid, changes) {
    const owner = Cloud.uid + ':' + Cloud.tenantId;
    const current = (Cloud.adm.att[uid] || {}).marks || {}, delta = {};
    Object.keys(changes).forEach(k => { if ((current[k] || '') !== changes[k]) delta[k] = changes[k]; });
    if (!Object.keys(delta).length) return {ok: true};
    const {data, error} = await supa.rpc('deputy_marks', {p_uid: uid, p_changes: delta});
    if (error) return {ok: false, error: error.message};
    if (owner !== Cloud.uid + ':' + Cloud.tenantId) return {ok: false, error: 'Аккаунт или группа изменились'};
    Cloud.adm.att[uid] = data;
    if (uid === Cloud.uid) {
      Store.s.attendance.marks = data.marks || {}; Store.save();
    }
    return {ok: true};
  }
};
setInterval(async () => {
  if (Cloud.status !== 'online' || document.hidden) return;
  await Deputies.refresh();
  if (ui.tab === 'journal' || ui.tab === 'news' || ui.tab === 'cabinet' || ui.tab === 'group') App.renderSoft();
}, 30000);
