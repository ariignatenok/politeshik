'use strict';

/**
 * Регистрирует service worker (кэш для работы без сети и уведомления) и сообщает, когда вышла новая версия.
 */
function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  const local = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
  if (location.protocol !== 'https:' && !local) return;
  const hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (hadController) toast('Вышла новая версия. Закройте и снова откройте приложение, чтобы обновиться.');
  });
  navigator.serviceWorker.register('service-worker.js').catch(() => {});
}
window.addEventListener('load', registerServiceWorker);
