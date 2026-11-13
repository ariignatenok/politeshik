'use strict';

const Social = {
  owner: null,
  people: [],
  cards: {},
  inbox: [],
  threads: {},
  query: '',
  offset: 0,
  more: false,
  loading: false,
  error: '',
  inboxError: '',
  loaded: false,
  timer: null,
  profileId: null,
  profileToken: 0,
  sending: false,
  allowed() {
    return Cloud.status === 'online' && Cloud.hasCabinet() && !Cloud.isStaff;
  },
  reset() {
    if (Social.owner === Cloud.uid) return;
    Social.owner = Cloud.uid;
    Social.people = [];
    Social.cards = {};
    Social.inbox = [];
    Social.threads = {};
    Social.loaded = false;
    Social.error = '';
    Social.profileId = null;
    Social.profileToken++;
    Social.pending = null;
    Social.loadingThreads = new Set();
    Social.query = '';
    Social.offset = 0;
    Social.sending = false;
    if (typeof MapRoutes !== 'undefined') {
      MapRoutes.route = null;
      MapRoutes.pending = null;
    }
    Club.walkAnimation?.cancel();
    Club.drag = null;
    Club.walking = false;
    Club.moving = false;
    Club.ignorePollUntil = 0;
    Club.ignoreTapUntil = 0;
    Club.jumpsSeen = {};
    Club.roomVersion = (Club.roomVersion || 0) + 1;
    Club.visitors = [];
    Club.dancing = true;
    Club.dance = 'bounce';
    Club.drink = 'none';
    Club.thought = '';
    Club.thoughtDraft = undefined;
    Club.joined = false;
    Club.loaded = false;
  },
  async call(name, args = {}) {
    const {data, error} = await supa.rpc(name, args);
    if (error) throw new Error(error.message);
    return data;
  },
  keep(card) {
    if (card && card.uid) {
      Social.cards[card.uid] = card;
      if (typeof Presence !== 'undefined') Presence.observe(card);
    }
    return card;
  },
  avatar(card, size = 48, photo = true) {
    card = card || {};
    const look = Wardrobe.normalize(card.uid === Cloud.uid ? Mascot.chosen() : card.mascot);
    return (
      '<span class="av-personal" data-photo-owner="'+U.esc(card.uid||'')+'">' +
      (photo && card.avatar ? avatarOf(card.avatar, size, card.uid, card.role) : '') +
      Mascot.svg(look.mood || 'happy', photo && card.avatar ? Math.max(28, size * 0.75) : size, '', {
        look,
        season: '',
      }) +
      '</span>'
    );
  },
  async loadPeople(append = false) {
    if (!Social.allowed() || Social.loading) return;
    Social.reset();
    Social.loading = true;
    Social.error = '';
    const uid = Cloud.uid,
      query = Social.query,
      offset = append ? Social.offset + 24 : 0;
    try {
      const rows = await Social.call('social_people', {p_query: query, p_offset: offset});
      if (uid !== Cloud.uid || query !== Social.query) return;
      (rows || []).forEach(Social.keep);
      Social.people = append ? Social.people.concat(rows || []) : rows || [];
      Social.offset = offset;
      Social.more = (rows || []).length === 24;
      Social.loaded = true;
    } catch (error) {
      if (uid === Cloud.uid) Social.error = error.message;
    } finally {
      Social.loading = false;
      App.renderSoft();
    }
  },
  async loadInbox() {
    if (!Social.allowed() || Social.inboxLoading) return;
    Social.reset();
    Social.inboxLoading = true;
    const uid = Cloud.uid;
    try {
      const rows = await Social.call('peer_inbox');
      if (uid !== Cloud.uid) return;
      (rows || []).forEach(Social.keep);
      Social.inbox = rows || [];
      Social.inboxError = '';
    } catch (error) {
      if (uid === Cloud.uid) Social.inboxError = error.message;
    } finally {
      Social.inboxLoading = false;
    }
  },
  unread() {
    if (Social.owner !== Cloud.uid || !Social.allowed()) return 0;
    return Social.inbox.reduce((n, row) => n + (Number(row.unread) || 0), 0);
  },
  async profile(uid) {
    if (!Social.allowed()) return toast('Профили доступны после регистрации');
    Social.reset();
    Social.profileId = uid;
    const token = ++Social.profileToken,
      owner = Cloud.uid;
    UI.open(
      'Профиль студента',
      '<p class="hint" id="social-profile-loading" data-token="' + token + '">Загружаем профиль…</p>',
      {wide: true, noFocus: true},
    );
    try {
      const card = await Social.call('social_profile', {p_uid: uid});
      if (
        token !== Social.profileToken ||
        owner !== Cloud.uid ||
        !document.querySelector('#social-profile-loading[data-token="' + token + '"]')
      )
        return;
      if (!card) throw new Error('Этот профиль сейчас недоступен');
      Social.keep(card);
      UI.open(card.name, socialProfileHtml(card), {wide: true, noFocus: true});
    } catch (error) {
      if (
        token === Social.profileToken &&
        document.querySelector('#social-profile-loading[data-token="' + token + '"]')
      )
        UI.open('Профиль', '<p class="warn">' + U.esc(error.message) + '</p>');
    }
  },
  async like(uid, kind) {
    const key = uid + kind;
    if (Social.likeBusy) return;
    Social.likeBusy = key;
    const card = Social.cards[uid],
      owner = Cloud.uid;
    if (!card) {
      Social.likeBusy = null;
      return;
    }
    const buttons = Array.from(document.querySelectorAll('.social-like')).map((button) => ({
      button,
      disabled: button.disabled,
    }));
    buttons.forEach((x) => (x.button.disabled = true));
    try {
      const updated = await Social.call('social_like', {
        p_uid: uid,
        p_kind: kind,
        p_on: !card['liked_' + kind],
      });
      if (owner !== Cloud.uid) return;
      Social.keep(updated);
      if(typeof Wall!=='undefined' && Wall.data?.card?.uid===uid)Wall.data.card=updated;
      if (Social.profileId === uid && document.querySelector('#modal-root .social-profile'))
        UI.open(updated.name, socialProfileHtml(updated), {wide: true, noFocus: true});
      App.renderSoft();
    } catch (error) {
      toast(error.message);
    } finally {
      Social.likeBusy = null;
      buttons.forEach((x) => {
        if (x.button.isConnected) x.button.disabled = x.disabled;
      });
    }
  },
  async openPeer(uid) {
    if (!Social.allowed() || uid === Cloud.uid) return;
    Social.reset();
    UI.close();
    Social.profileToken++;
    ui.tab = 'chat';
    ui.chatWith = 'peer:' + uid;
    Social.threadError = '';
    Social.historyMore = true;
    Social.threads[uid] = [];
    App.render(true);
    await Social.loadThread(uid);
    const pane = document.querySelector('.peer-scroll');
    if (pane) pane.scrollTop = pane.scrollHeight;
    window.scrollTo(0, 0);
  },
  async loadThread(uid, older = false) {
    Social.loadingThreads = Social.loadingThreads || new Set();
    const locks = Social.loadingThreads;
    if (locks.has(uid)) return;
    locks.add(uid);
    const owner = Cloud.uid;
    try {
      const current = Social.threads[uid] || [],
        before = older && current.length ? current[0].created_at : null;
      const [card, rows] = await Promise.all([
        Social.call('social_profile', {p_uid: uid}),
        Social.call('peer_messages', {p_peer: uid, p_before: before}),
      ]);
      if (owner !== Cloud.uid) return;
      if (!card) throw new Error('Собеседник недоступен');
      Social.keep(card);
      const all = (Social.threads[uid] || []).concat(rows || []);
      Social.threads[uid] = [...new Map(all.map((x) => [x.id, x])).values()].sort(
        (a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id),
      );
      Social.historyMore = (rows || []).length === 80;
      Social.threadError = '';
      if (
        ui.chatWith === 'peer:' + uid &&
        !document.hidden &&
        !document.querySelector('#modal-root')?.firstChild
      ) {
        await Social.call('peer_read', {p_peer: uid});
        const row = Social.inbox.find((x) => x.uid === uid);
        if (row) row.unread = 0;
      }
    } catch (error) {
      if (owner === Cloud.uid) Social.threadError = error.message;
    } finally {
      locks.delete(uid);
      if (owner === Cloud.uid && ui.tab === 'chat' && ui.chatWith === 'peer:' + uid) renderChatUpdates();
    }
  },
  async send(form) {
    if (Social.sending) return;
    const input = form.querySelector('[name=t]'),
      body = input.value,
      peer = form.dataset.peer;
    if (!body.trim()) return;
    Social.sending = true;
    Social.pending =
      Social.pending && Social.pending.peer === peer && Social.pending.body === body
        ? Social.pending
        : {peer, body, nonce: crypto.randomUUID()};
    const owner = Cloud.uid,
      button = form.querySelector('[data-action="save-form"]');
    button.disabled = true;
    try {
      const sent = await Social.call('peer_send', {
        p_peer: peer,
        p_body: body,
        p_nonce: Social.pending.nonce,
      });
      if (owner !== Cloud.uid) return;
      Social.pending = null;
      Social.threads[peer] = (Social.threads[peer] || []).concat(sent);
      if ((ui.chatDrafts || {})[input.dataset.chatDraft] === body)
        delete ui.chatDrafts[input.dataset.chatDraft];
      input.value = '';
      await Social.loadThread(peer);
      await Social.loadInbox();
      App.renderSoft();
      const pane = document.querySelector('.peer-scroll');
      if (pane) pane.scrollTop = pane.scrollHeight;
      const focus = document.getElementById('peerIn');
      if (focus) focus.focus();
    } catch (error) {
      toast('Не удалось отправить: ' + error.message);
    } finally {
      if (owner === Cloud.uid) Social.sending = false;
      if (button.isConnected) button.disabled = false;
    }
  },
  start() {
    if (Social.timer) return;
    const tick = async () => {
      Social.reset();
      if (!Social.allowed() || document.hidden) return;
      await Social.loadInbox();
      if (ui.tab === 'chat' && (ui.chatWith || '').startsWith('peer:'))
        await Social.loadThread(ui.chatWith.slice(5));
      if (!Club.loaded) await Club.refresh('state');
      App.renderSoft();
    };
    Social.timer = setInterval(tick, 10000);
    tick();
  },
};
const Club = {
  visitors: [],
  joined: false,
  dancing: true,
  loaded: false,
  loading: false,
  error: '',
  calm: false,
  dance: 'bounce',
  drink: 'none',
  thought: '',
  apply(data) {
    Club.visitors = data.visitors || [];
    if (typeof Presence !== 'undefined') Club.visitors.forEach((card) => Presence.observe(card));
    Club.joined = !!data.joined;
    const own = Club.visitors.find((v) => v.uid === Cloud.uid);
    if (own) {
      Club.dance = own.dance || (own.dancing ? 'bounce' : 'still');
      Club.dancing = Club.dance !== 'still';
      Club.drink = own.drink || 'none';
      Club.thought = own.thought || '';
    }
  },
  async open() {
    if (!Social.allowed()) return toast('Клуб доступен после регистрации');
    Social.reset();
    ui.tab = 'club';
    App.render(true);
    await Club.refresh('state');
    window.scrollTo(0, 0);
  },
  async refresh(action = 'state') {
    if (!Social.allowed() || (Club.loading && action==='state')) return;
    if(action==='join'||action==='leave')Club.roomVersion=(Club.roomVersion||0)+1;
    const version=Club.roomVersion||0,previousError=Club.error;
    Club.loading = true;
    const owner = Cloud.uid;
    try {
      const data = await Social.call('club_visit', {p_action: action, p_dancing: Club.dancing});
      if (owner !== Cloud.uid || version!==(Club.roomVersion||0)) return;
      Club.apply(data);
      Club.loaded = true;
      Club.error = '';
    } catch (error) {
      Club.error = error.message;
    } finally {
      Club.loading = false;
      if (ui.tab === 'club' && (Club.renderChanged !== false || previousError !== Club.error)) {
        if(document.querySelector('.club-game-panel'))App.render();else App.renderSoft();
      }
    }
  },
};
