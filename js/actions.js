'use strict';

/**
 * Сообщает, что расписание закрыто для правки студенту.
 * @returns {boolean} true, если правка запрещена.
 */
const lockSched = () => {
  if (Cloud.locked()) {
    toast('Расписание ведёт админ группы');
    return true;
  }
  return false;
};
let installEvt = null;
window.addEventListener('beforeinstallprompt', event => {
  event.preventDefault();
  installEvt = event;
  if (ui.tab === 'settings') App.render();
});
const A = {};
