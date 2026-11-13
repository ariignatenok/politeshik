'use strict';
Object.assign(Club, {
  position(card) {
    let seed = 0;
    for (const c of String(card.uid || '')) seed = (seed * 31 + c.charCodeAt(0)) >>> 0;
    return {
      x: Number.isFinite(card.x) ? card.x : 18 + (seed % 65),
      y: Number.isFinite(card.y) ? card.y : 55 + ((seed >>> 8) % 32),
    };
  },
  clamp(point) {
    return {x: Math.max(12, Math.min(88, point.x)), y: Math.max(12, Math.min(94, point.y))};
  },
  actor(uid = Cloud.uid) {
    return document.querySelector('.club-floor .club-guest[data-uid="' + uid + '"]');
  },
  jump(uid = Cloud.uid, remote = false) {
    const actor = Club.actor(uid),
      figure = actor && actor.querySelector('.club-figure');
    if (!figure) return;
    Club.ignorePollUntil=Date.now()+650;
    figure.classList.remove('is-jumping');
    void figure.offsetWidth;
    figure.classList.add('is-jumping');
    clearTimeout(figure.jumpTimer);
    figure.jumpTimer = setTimeout(() => figure.classList.remove('is-jumping'), 600);
    if (remote || uid !== Cloud.uid || Club.jumpBusy || Club.moving || Club.walking || Club.leaving) return;
    Club.jumpBusy = true;
    const owner = Cloud.uid;
    Social.call('club_move', {p_x: null, p_y: null, p_jump: true})
      .then((data) => {
        if (owner === Cloud.uid) {
          const me = (data.visitors || []).find((v) => v.uid === owner);
          if (me) {
            Club.own().jumped_at = me.jumped_at;
            (Club.jumpsSeen ||= {})[owner] = me.jumped_at;
          }
        }
      })
      .catch((error) => toast(error.message))
      .finally(() => {
        Club.jumpBusy = false;
      });
  },
  tap(uid) {
    if (Date.now() < (Club.ignoreTapUntil || 0)) return;
    if (uid === Cloud.uid) Club.jump(uid);
    else Social.profile(uid);
  },
  async storePosition(point) {
    const p = Club.clamp(point),
      uid = Cloud.uid,
      own = Club.own(),
      old = {x: own.x, y: own.y};
    if (Club.leaving) return false;
    Club.roomVersion = (Club.roomVersion || 0) + 1;
    Club.moving = true;
    own.x = p.x;
    own.y = p.y;
    try {
      const data = await Social.call('club_move', {p_x: p.x, p_y: p.y, p_jump: false});
      if (uid !== Cloud.uid) return false;
      Club.apply(data);
      return true;
    } catch (error) {
      own.x = old.x;
      own.y = old.y;
      toast('Не удалось сохранить место: ' + error.message);
      return false;
    } finally {
      Club.moving = false;
      if (ui.tab === 'club') App.renderSoft();
    }
  },
  walkToBar() { return Club.walkTo({x:78,y:94},()=>Club.openBar()); },
  async walkTo(destination,after) {
    Club.captureThought();
    if (!Club.joined) return toast('Сначала зайдите в клуб');
    if(['poker','pool'].includes(Club.own().pose))return toast('Сначала завершите партию, чтобы отойти от стола');
    if (Club.drag || Club.walking || Club.moving || Club.saving || Club.leaving) return;
    UI.close();
    const actor = Club.actor(),
      floor = document.querySelector('.club-floor');
    if (!actor || !floor) return;
    const owner = Cloud.uid,
      from = Club.position(Club.own()),
      target = Club.clamp(destination);
    Club.roomVersion = (Club.roomVersion || 0) + 1;
    Club.walking = true;
    actor.classList.add('is-walking');
    floor.scrollIntoView({
      block: 'center',
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
    });
    let animation;
    try {
      const distance = Math.hypot(
        ((from.x - target.x) * floor.clientWidth) / 100,
        ((from.y - target.y) * floor.clientHeight) / 100,
      );
      const duration = window.matchMedia('(prefers-reduced-motion: reduce)').matches
        ? 50
        : Math.max(500, Math.min(1600, distance * 2));
      animation = actor.animate(
        [
          {left: from.x + '%', top: from.y + '%'},
          {left: target.x + '%', top: target.y + '%'},
        ],
        {duration, easing: 'ease-in-out', fill: 'forwards'},
      );
      Club.walkAnimation = animation;
      await animation.finished;
      if (owner !== Cloud.uid || ui.tab !== 'club' || !actor.isConnected || Club.leaving) return;
      actor.style.left = target.x + '%';
      actor.style.top = target.y + '%';
      animation.cancel();
      const saved = await Club.storePosition(target);
      if (saved && owner === Cloud.uid && ui.tab === 'club' && !Club.leaving && after) { Club.walking = false; await after(); }
    } catch (error) {
      if (error.name !== 'AbortError') toast('Попробуйте подойти ещё раз');
    } finally {
      if (animation) animation.cancel();
      actor.classList.remove('is-walking');
      Club.walking = false;
      Club.walkAnimation = null;
      if (ui.tab === 'club') App.renderSoft();
    }
  },
  ensurePolling() {
    if (Club.floorTimer) return;
    Club.floorTimer = setInterval(async () => {
      if (
        ui.tab !== 'club' ||
        document.hidden ||
        Club.drag ||
        Club.walking ||
        Club.moving ||
        Club.saving ||
        Club.leaving ||
        Date.now() < (Club.ignorePollUntil || 0)
      )
        return;
      await Club.refresh('state');
      if (ui.tab !== 'club') return;
      Club.jumpsSeen ||= {};
      for (const card of Club.visitors) {
        const stamp = card.jumped_at;
        if (stamp && Club.jumpsSeen[card.uid] !== stamp) {
          Club.jumpsSeen[card.uid] = stamp;
          if (card.uid !== Cloud.uid && Date.now() - Date.parse(stamp) < 12000) Club.jump(card.uid, true);
        }
      }
    }, 2000);
  },
});
Object.assign(A, {
  'club-guest'(el) {
    Club.tap(el.dataset.uid);
  },
  'club-bar-toggle'(){Club.barExpanded=!Club.barExpanded;App.render();},
  'club-bar'() {
    return Club.walkToBar();
  },
  async 'club-leave'() {
    ClubMusic.stop();
    if (Club.leaving) return;
    Club.leaving = true;
    Club.drag = null;
    Club.walkAnimation?.cancel();
    try {
      await Club.refresh('leave');
    } finally {
      Club.leaving = false;
    }
  },
});
document.addEventListener('pointerdown', (event) => {
  const actor = event.target.closest && event.target.closest('.club-floor .club-guest');
  if (
    !actor ||
    actor.dataset.uid !== Cloud.uid ||
    !Club.joined ||
    ['poker','pool'].includes(Club.own().pose) ||
    Club.walking ||
    Club.moving ||
    Club.saving ||
    Club.leaving ||
    (event.pointerType === 'mouse' && event.button !== 0)
  )
    return;
  Club.roomVersion = (Club.roomVersion || 0) + 1;
  const floor = actor.closest('.club-floor');
  Club.drag = {
    actor,
    floor,
    pointer: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
    origin: Club.position(Club.own()),
    moved: false,
  };
  actor.setPointerCapture(event.pointerId);
});
document.addEventListener(
  'pointermove',
  (event) => {
    const drag = Club.drag;
    if (!drag || event.pointerId !== drag.pointer) return;
    const dx = event.clientX - drag.startX,
      dy = event.clientY - drag.startY;
    if (!drag.moved && Math.hypot(dx, dy) < 6) return;
    drag.moved = true;
    drag.actor.classList.add('is-dragging');
    const point = Club.clamp({
      x: drag.origin.x + (dx / drag.floor.clientWidth) * 100,
      y: drag.origin.y + (dy / drag.floor.clientHeight) * 100,
    });
    drag.point = point;
    drag.actor.style.left = point.x + '%';
    drag.actor.style.top = point.y + '%';
    if (event.cancelable) event.preventDefault();
  },
  {passive: false},
);
const finishClubDrag = (event) => {
  const drag = Club.drag;
  if (!drag || drag.pointer !== event.pointerId) return;
  Club.drag = null;
  drag.actor.classList.remove('is-dragging');
  if (drag.actor.hasPointerCapture(event.pointerId)) drag.actor.releasePointerCapture(event.pointerId);
  if (!drag.moved) return;
  Club.ignoreTapUntil = Date.now() + 500;
  if (event.type === 'pointercancel') {
    drag.actor.style.left = drag.origin.x + '%';
    drag.actor.style.top = drag.origin.y + '%';
    return;
  }
  Club.storePosition(drag.point);
};
document.addEventListener('pointerup', finishClubDrag);
document.addEventListener('pointercancel', finishClubDrag);
