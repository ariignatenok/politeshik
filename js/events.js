'use strict';

document.addEventListener('click', event => {
  const el = event.target.closest('[data-action]');
  if (!event.target.closest('#theme-pop,[data-action="theme"]')) {
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
      fn(el, event);
    }
    return;
  }
  if (
    event.target.classList &&
    event.target.classList.contains('overlay') &&
    event.target.parentNode.id === 'modal-root' &&
    !UI.locked
  )
    UI.close();
});
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && $('#modal-root').firstChild && !$('#confirm-root').firstChild && !UI.locked) UI.close();
  if (
    ui.study &&
    ui.tab === 'subjects' &&
    !$('#modal-root').firstChild &&
    !$('#confirm-root').firstChild &&
    !/^(INPUT|TEXTAREA|SELECT|BUTTON)$/.test(event.target.tagName || '')
  ) {
    const st = ui.study;
    if (event.key === ' ' || event.key === 'Enter') {
      event.preventDefault();
      A['study-flip']();
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      if (st.flip) A['study-yes']();
      else A['study-flip']();
    } else if (event.key === 'ArrowLeft' && st.flip) {
      event.preventDefault();
      A['study-no']();
    }
  }
  if (
    event.key === 'Enter' &&
    !event.shiftKey &&
    event.target.matches &&
    event.target.matches('input:not([type=checkbox]):not([type=radio])')
  ) {
    const f = event.target.closest('[data-form]');
    const b = f && f.querySelector('[data-action="save-form"]');
    if (b) {
      event.preventDefault();
      b.click();
    }
  }
});
document.addEventListener('input', event => {
  const k = event.target.dataset && event.target.dataset.input;
  if (!k) return;
  if (k === 'subj-search') {
    ui.subjQuery = event.target.value;
    $('#subj-list').innerHTML = subjectCards();
  }
  if (k === 'note-search') {
    ui.noteQuery = event.target.value;
    $('#note-list').innerHTML = noteList(subj(ui.subjectId));
  }
  if (k === 'teacher-search') {
    ui.teacherQuery = event.target.value;
    $('#t-list').innerHTML = teacherCards();
  }
  if (k === 'card-search') {
    ui.cardQuery = event.target.value;
    $('#card-list').innerHTML = cardList(subj(ui.subjectId));
  }
  if (k === 'formula-search') {
    ui.fQuery = event.target.value;
    $('#formula-list').innerHTML = formulaList(subj(ui.subjectId));
  }
  if (k === 'fm-preview') {
    const p = $('#fm-preview');
    if (p) p.innerHTML = Fm.render(event.target.value);
  }
});
document.addEventListener('change', event => {
  const k = event.target.dataset && event.target.dataset.change;
  if (!k) return;
  if (k === 'teacher-filter') {
    ui.teacherSubject = event.target.value;
    $('#t-list').innerHTML = teacherCards();
  }
  if (k === 'lesson-subject') {
    const n = event.target.closest('[data-form]').querySelector('.new-subj');
    n.hidden = event.target.value !== '__new';
    if (!n.hidden) n.querySelector('input').focus();
  }
  if (k === 'import-file') Backup.file(event.target);
  if (k === 'card-shuffle') ui.cardShuffle = event.target.checked;
  if (k === 'rid-pick') {
    const f = event.target.closest('[data-form]'),
      ro = ROSTER_BY_ID[event.target.value],
      sgSel = f && f.querySelector('[name=subgroup]');
    if (ro && sgSel && !sgSel.value) sgSel.value = ro.sub;
  }
  if (k === 'notif-toggle') {
    const n = Object.assign({}, Store.s.settings.notif || {});
    n[event.target.dataset.k] = event.target.checked;
    Store.s.settings.notif = n;
    Store.save();
  }
  if (k === 'notif-mute') {
    const n = Object.assign({}, Store.s.settings.notif || {});
    n.mute = Object.assign({}, n.mute || {});
    if (event.target.checked) n.mute[event.target.dataset.id] = true;
    else delete n.mute[event.target.dataset.id];
    Store.s.settings.notif = n;
    Store.save();
  }
  if (k === 'avatar-file') {
    const f = event.target.files && event.target.files[0];
    if (f)
      compressAvatar(f).then(
        d => {
          const m = Store.s.meta;
          m.photos = (m.photos || 0) + 1;
          Store.s.settings.avatar = {
            k: 'p',
            d
          };
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
  if (k === 'cert-file') handleDraftFile(event.target, true);
  if (k === 'work-file') handleDraftFile(event.target, false);
  if (k === 'note-file') handleNoteFile(event.target);
  if (k === 'att-edit-date') {
    const f = event.target.closest('[data-form]');
    if (f && event.target.value >= ATT_START && event.target.value <= U.iso(U.today()))
      openAttendanceEditor(f.dataset.uid, event.target.value);
  }
  if (k === 'stud-date' && ui.stud) {
    ui.stud.date = event.target.value;
    const r = studentRows().find(x => x.id === ui.stud.uid),
      m = $('#stud-day');
    if (r && m && event.target.value >= ATT_START)
      m.innerHTML = attDayHtml(event.target.value, r.marks, r.certs, r.p.subgroup, ui.stud.uid, false);
  }
});
