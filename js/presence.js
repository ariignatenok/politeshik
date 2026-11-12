'use strict';

const Presence = {
  owner: null,
  session: null,
  map: {},
  offset: 0,
  busy: false,
  activeSent: false,
  timer: null,
  reset() {
    if (Presence.owner === Cloud.uid) return;
    Presence.owner = Cloud.uid;
    Presence.session = crypto.randomUUID();
    Presence.map = {};
    Presence.activeSent = false;
  },
  async beat(active = !document.hidden) {
    Presence.reset();
    if (!Social.allowed() || Presence.busy) return;
    if (!active && !Presence.activeSent) return;
    Presence.busy = true;
    const uid = Cloud.uid,
      session = Presence.session;
    try {
      const data = await Social.call('social_presence', {p_session: session, p_active: active});
      if (uid !== Cloud.uid) return;
      Presence.activeSent = active;
      Presence.offset = Date.parse(data.server_now) - Date.now();
      if (!Number.isFinite(Presence.offset)) Presence.offset = 0;
      if (data.person && data.person.uid === uid) Presence.observe(data.person);
      Presence.paint();
      if (active) await Presence.refreshVisible();
    } catch (error) {
      /* Existing timestamps expire naturally when the network is unavailable. */
    } finally {
      Presence.busy = false;
      if (active && document.hidden && Presence.activeSent) Presence.beat(false);
    }
  },
  observe(card) {
    if (!card || !card.uid || !Object.prototype.hasOwnProperty.call(card, 'last_seen')) return;
    Presence.reset();
    const previous = Presence.map[card.uid];
    if (
      previous?.last_seen &&
      (!card.last_seen || Date.parse(previous.last_seen) > Date.parse(card.last_seen))
    )
      return;
    Presence.map[card.uid] = {uid: card.uid, online: !!card.online, last_seen: card.last_seen};
  },
  async refreshVisible() {
    const owner = Cloud.uid,
      ids = new Set();
    if (document.querySelector('.social-profile') && Social.profileId) ids.add(Social.profileId);
    if (typeof ui !== 'undefined' && ui.tab === 'chat' && (ui.chatWith || '').startsWith('peer:'))
      ids.add(ui.chatWith.slice(5));
    if (typeof ui !== 'undefined' && ui.tab === 'people')
      document.querySelectorAll('.person-card[data-uid]').forEach((node) => {
        const r = node.getBoundingClientRect();
        if (r.bottom > 0 && r.top < window.innerHeight) ids.add(node.dataset.uid);
      });
    ids.delete(owner);
    const results = await Promise.allSettled(
      [...ids].slice(0, 24).map((id) => Social.call('social_profile', {p_uid: id})),
    );
    if (owner !== Cloud.uid) return;
    results.forEach((result) => {
      if (result.status === 'fulfilled' && result.value) Social.keep(result.value);
    });
    Presence.paint();
  },
  info(card) {
    const cached = Presence.owner === Cloud.uid && Presence.map[card && card.uid],
      provided = card || {};
    const data =
        cached && (!provided.last_seen || Date.parse(cached.last_seen) >= Date.parse(provided.last_seen))
          ? cached
          : provided,
      seen = Date.parse(data.last_seen),
      now = Date.now() + Presence.offset;
    const online = !!data.online && Number.isFinite(seen) && now - seen < 65000 && now - seen >= -5000;
    if (online) return {online: true, label: 'В сети'};
    if (!Number.isFinite(seen)) return {online: false, label: 'Нет данных о посещении'};
    const minutes = Math.max(0, Math.floor((now - seen) / 60000));
    if (minutes < 2) return {online: false, label: 'Был(а) только что'};
    if (minutes < 60) return {online: false, label: 'Был(а) ' + minutes + ' мин назад'};
    const options = {timeZone: 'Europe/Moscow'},
      time = new Date(seen).toLocaleTimeString('ru-RU', {...options, hour: '2-digit', minute: '2-digit'}),
      date = (d) => new Date(d).toLocaleDateString('ru-RU', options);
    return {
      online: false,
      label: date(now) === date(seen) ? 'Был(а) сегодня в ' + time : 'Был(а) ' + date(seen) + ' в ' + time,
    };
  },
  html(card) {
    if (!card || !card.uid) return '';
    const state = Presence.info(card);
    return (
      '<span class="social-presence' +
      (state.online ? ' is-online' : '') +
      '" data-presence-uid="' +
      U.esc(card.uid) +
      '"><i aria-hidden="true"></i><span class="presence-label">' +
      U.esc(state.label) +
      '</span></span>'
    );
  },
  paint() {
    document.querySelectorAll('[data-presence-uid]').forEach((node) => {
      const id = node.dataset.presenceUid,
        state = Presence.info(Presence.map[id] || Social.cards[id] || {uid: id});
      node.classList.toggle('is-online', state.online);
      const label = node.querySelector('.presence-label');
      if (label) label.textContent = state.label;
    });
  },
  start() {
    if (Presence.timer) return;
    Presence.beat();
    Presence.timer = setInterval(() => {
      if (!document.hidden) Presence.beat(true);
      Presence.paint();
    }, 20000);
    document.addEventListener('visibilitychange', () => {
      Presence.beat(!document.hidden);
    });
    window.addEventListener('pagehide', () => {
      Presence.beat(false);
    });
  },
};
