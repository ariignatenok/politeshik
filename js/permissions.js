'use strict';

/**
 * Проверяет, может ли пользователь править общие данные.
 * @returns {boolean} true, если условие выполнено.
 */
const canEdit = () => Cloud.status !== 'online' || Cloud.isAdmin;
const RO_ACTIONS = new Set([
  'qa-open',
  'qa-weeks',
  'qa-fill',
  'qa-apply',
  'qa-undo',
  'user-ban',
  'user-unban',
  'user-delete',
  'users-refresh',
  'gcode-new',
  'gcode-off',
  'gcode-require',
  'sched-two-weeks',
  'sched-import-bundled',
  'sched-import',
  'sched-import-check',
  'sched-import-apply',
  'sched-copy-next',
  'sched-reset',
  'lesson-del-all',
  'add-work',
  'hw-add',
  'cert-ok',
  'cert-adm-del',
  'note-file-rm',
  'news-add',
  'news-del',
  'att-edit',
  'edit-item',
  'del-item',
  'subj-add',
  'subj-edit',
  'subj-del',
  'note-add',
  'card-add',
  'card-edit',
  'card-del',
  'formula-add',
  'formula-edit',
  'formula-del',
  'link-del',
  't-add',
  't-edit',
  't-del',
  'reset',
  'clear',
  'restore-content',
  'times',
  'cell-add',
  'cell-edit',
  'pair-add',
  'pair-del',
  'chg-cancel',
  'chg-replace',
  'chg-del'
]);
const RO_FORMS = new Set([
  'news',
  'att-edit',
  'hwg',
  'work',
  'hw',
  'hw-new',
  'card',
  'formula',
  'subject',
  'teacher',
  'link-new',
  'times',
  'lesson',
  'change'
]);
/**
 * Проверяет, запрещено ли студенту действие кнопки.
 * @param {HTMLElement} el Кнопка с data-action.
 * @returns {boolean} true, если условие выполнено.
 */
function roBlocked(el) {
  if (canEdit()) return false;
  const a = el.dataset.action;
  if (Cloud.isCurator && a === 'att-edit') return false;
  if (a === 'note-edit' || a === 'note-del') {
    const n = Store.s.notes.find(x => x.id === el.dataset.id);
    return !!(n && n.subjectId);
  }
  return RO_ACTIONS.has(a);
}
