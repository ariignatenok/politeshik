'use strict';

document.addEventListener('click', e => {
  const el = e.target.closest('[data-action]');
  if (!e.target.closest('#theme-pop,[data-action="theme"]')) {
    const tp = $('#theme-pop');
    if (tp) tp.hidden = true;
  }
  if (el) {
    const fn = A[el.dataset.action];
    if (fn) {
      if (el.tagName === 'LABEL') return;
      if (roBlocked(el)) {
        toast('Это может делать только админ группы');
        return;
      }
      fn(el, e);
    }
    return;
  }
  if (
    e.target.classList &&
    e.target.classList.contains('overlay') &&
    e.target.parentNode.id === 'modal-root' &&
    !UI.locked
  )
    UI.close();
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && $('#modal-root').firstChild && !$('#confirm-root').firstChild && !UI.locked) UI.close();

  if (
    ui.study &&
    ui.tab === 'subjects' &&
    !$('#modal-root').firstChild &&
    !$('#confirm-root').firstChild &&
    !/^(INPUT|TEXTAREA|SELECT|BUTTON)$/.test(e.target.tagName || '')
  ) {
    const st = ui.study;
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      A['study-flip']();
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      if (st.flip) A['study-yes']();
      else A['study-flip']();
    } else if (e.key === 'ArrowLeft' && st.flip) {
      e.preventDefault();
      A['study-no']();
    }
  }

  if (
    e.key === 'Enter' &&
    !e.shiftKey &&
    e.target.matches &&
    e.target.matches('input:not([type=checkbox]):not([type=radio])')
  ) {
    const f = e.target.closest('[data-form]');
    const b = f && f.querySelector('[data-action="save-form"]');
    if (b) {
      e.preventDefault();
      b.click();
    }
  }
});

document.addEventListener('input', e => {
  const k = e.target.dataset && e.target.dataset.input;
  if (!k) return;
  if (k === 'subj-search') {
    ui.subjQuery = e.target.value;
    $('#subj-list').innerHTML = subjectCards();
  }
  if (k === 'note-search') {
    ui.noteQuery = e.target.value;
    $('#note-list').innerHTML = noteList(subj(ui.subjectId));
  }
  if (k === 'teacher-search') {
    ui.teacherQuery = e.target.value;
    $('#t-list').innerHTML = teacherCards();
  }
  if (k === 'card-search') {
    ui.cardQuery = e.target.value;
    $('#card-list').innerHTML = cardList(subj(ui.subjectId));
  }
  if (k === 'formula-search') {
    ui.fQuery = e.target.value;
    $('#formula-list').innerHTML = formulaList(subj(ui.subjectId));
  }
  if (k === 'fm-preview') {
    const p = $('#fm-preview');
    if (p) p.innerHTML = Fm.render(e.target.value);
  }
});
document.addEventListener('change', e => {
  const k = e.target.dataset && e.target.dataset.change;
  if (!k) return;
  if (k === 'teacher-filter') {
    ui.teacherSubject = e.target.value;
    $('#t-list').innerHTML = teacherCards();
  }
  if (k === 'lesson-subject') {
    const n = e.target.closest('[data-form]').querySelector('.new-subj');
    n.hidden = e.target.value !== '__new';
    if (!n.hidden) n.querySelector('input').focus();
  }
  if (k === 'import-file') Backup.file(e.target);
  if (k === 'card-shuffle') ui.cardShuffle = e.target.checked;
  if (k === 'rid-pick') {
    const f = e.target.closest('[data-form]'),
      ro = ROSTER_BY_ID[e.target.value],
      sgSel = f && f.querySelector('[name=subgroup]');
    if (ro && sgSel && !sgSel.value) sgSel.value = ro.sub;
  }
  if (k === 'notif-toggle') {
    const n = Object.assign({}, Store.s.settings.notif || {});
    n[e.target.dataset.k] = e.target.checked;
    Store.s.settings.notif = n;
    Store.save();
  }
  if (k === 'notif-mute') {
    const n = Object.assign({}, Store.s.settings.notif || {});
    n.mute = Object.assign({}, n.mute || {});
    if (e.target.checked) n.mute[e.target.dataset.id] = true;
    else delete n.mute[e.target.dataset.id];
    Store.s.settings.notif = n;
    Store.save();
  }
  if (k === 'avatar-file') {
    const f = e.target.files && e.target.files[0];
    if (f)
      compressAvatar(f).then(
        d => {
          const m = Store.s.meta;
          m.photos = (m.photos || 0) + 1;
          Store.s.settings.avatar = {k: 'p', d};
          Store.save();
          Profile.push();
          Ach.check();
          UI.close();
          App.render();
          toast('Фото обновлено');
        },
        () => toast('Не удалось обработать фото')
      );
  }
  if (k === 'cert-file') handleDraftFile(e.target, true);
  if (k === 'work-file') handleDraftFile(e.target, false);
  if (k === 'att-edit-date') {
    const f = e.target.closest('[data-form]');
    if (f && e.target.value >= ATT_START && e.target.value <= U.iso(U.today()))
      openAttendanceEditor(f.dataset.uid, e.target.value);
  }
  if (k === 'stud-date' && ui.stud) {
    ui.stud.date = e.target.value;
    const r = studentRows().find(x => x.id === ui.stud.uid),
      m = $('#stud-day');
    if (r && m && e.target.value >= ATT_START)
      m.innerHTML = attDayHtml(e.target.value, r.marks, r.certs, r.p.subgroup, ui.stud.uid, false);
  }
});
