'use strict';
Object.assign(A, {
  'social-people'() {
    UI.close();
    Social.reset();
    ui.tab = 'people';
    App.render(true);
    window.scrollTo(0, 0);
  },
  'social-profile'(el) {
    return Social.profile(el.dataset.uid);
  },
  'social-like'(el) {
    return Social.like(el.dataset.uid, el.dataset.kind);
  },
  'social-my-profile'() {
    UI.close();
    ui.tab = 'cabinet';
    App.render(true);
  },
  'social-more'() {
    return Social.loadPeople(true);
  },
  'social-retry'() {
    Social.loadPeople();
    Social.loadInbox().then(() => App.renderSoft());
  },
  'peer-open'(el) {
    return Social.openPeer(el.dataset.uid);
  },
  'peer-older'(el) {
    return Social.loadThread(el.dataset.uid, true);
  },
  'peer-retry'(el) {
    return Social.loadThread(el.dataset.uid);
  },
  'club-open'() {
    return Club.open();
  },
  'club-join'() {
    return Club.refresh('join');
  },
  'club-leave'() {
    return Club.refresh('leave');
  },
  'club-dance'() {
    Club.dancing = !Club.dancing;
    return Club.refresh('beat');
  },
  'club-calm'() {
    Club.calm = !Club.calm;
    App.render();
  },
  'club-retry'() {
    return Club.refresh('state');
  },
  'club-map'() {
    Club.refresh('leave');
    ui.tab = 'map';
    ui.mapFloor = 5;
    App.render(true);
  },
});
Forms.peer = (form) => Social.send(form);
Forms['social-search'] = (form) => {
  if (Social.loading) return;
  Social.query = val(form, 'q').trim().slice(0, 100);
  Social.loaded = false;
  Social.people = [];
  Social.loadPeople();
};
