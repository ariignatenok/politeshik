'use strict';

const CACHE_VERSION = 'bf8b12b2f40';
const CACHE_NAME = 'politeshik-' + CACHE_VERSION;
const NETWORK_TIMEOUT_MS = 5000;
const SHELL = [
  './',
  'index.html',
  'manifest.json',
  'assets/apple-touch-icon.png',
  'assets/favicon.svg',
  'assets/icon-192.png',
  'assets/icon-512.png',
  'assets/icon-maskable-512.png',
  'assets/map-1.jpg',
  'assets/map-2.jpg',
  'assets/map-3.jpg',
  'assets/map-4.jpg',
  'assets/map-5.jpg',
  'css/admin.css',
  'css/attendance-edit.css',
  'css/base.css',
  'css/celebrate.css',
  'css/chats.css',
  'css/components.css',
  'css/features.css',
  'css/fintech.css',
  'css/gate.css',
  'css/glass.css',
  'css/health.css',
  'css/layout.css',
  'css/mascot.css',
  'css/modal.css',
  'css/motion.css',
  'css/news.css',
  'css/profile.css',
  'css/responsive.css',
  'css/schedule.css',
  'css/screens.css',
  'css/seasonal.css',
  'css/shell.css',
  'css/study.css',
  'css/style.css',
  'css/subjects.css',
  'css/themes.css',
  'css/widgets.css',
  'js/achievements.js',
  'js/actions.js',
  'js/actions/attendance.js',
  'js/actions/auth.js',
  'js/actions/cabinet.js',
  'js/actions/chats.js',
  'js/actions/features.js',
  'js/actions/group.js',
  'js/actions/schedule.js',
  'js/actions/settings.js',
  'js/actions/subjects.js',
  'js/actions/works.js',
  'js/app.js',
  'js/attendance.js',
  'js/avatars.js',
  'js/backup.js',
  'js/birthday.js',
  'js/campusmap.js',
  'js/changes.js',
  'js/chat.js',
  'js/confetti.js',
  'js/content.js',
  'js/data/cards.js',
  'js/data/formulas.js',
  'js/data/notes.js',
  'js/db.js',
  'js/dialogs.js',
  'js/dm.js',
  'js/events.js',
  'js/faq.js',
  'js/focus.js',
  'js/forms.js',
  'js/gestures.js',
  'js/icons.js',
  'js/ics.js',
  'js/images.js',
  'js/markdown.js',
  'js/mascot.js',
  'js/navigation.js',
  'js/news.js',
  'js/newschedule.js',
  'js/notifications.js',
  'js/permissions.js',
  'js/profile.js',
  'js/pwa.js',
  'js/quickadd.js',
  'js/quickatt.js',
  'js/rating.js',
  'js/relax.js',
  'js/roles.js',
  'js/rolesviews.js',
  'js/roster.js',
  'js/safe.js',
  'js/schedimport.js',
  'js/scrolllock.js',
  'js/search.js',
  'js/security.js',
  'js/seed.js',
  'js/selectors.js',
  'js/sick.js',
  'js/signup.js',
  'js/skeleton.js',
  'js/solutions.js',
  'js/store.js',
  'js/supabase.js',
  'js/support.js',
  'js/teacher.js',
  'js/theme-boot.js',
  'js/themes.js',
  'js/ui.js',
  'js/utils.js',
  'js/version.js',
  'js/views.js',
  'js/views/attendance.js',
  'js/views/cabinet.js',
  'js/views/chat.js',
  'js/views/dashboard.js',
  'js/views/group.js',
  'js/views/homework.js',
  'js/views/journal.js',
  'js/views/more.js',
  'js/views/news.js',
  'js/views/rating.js',
  'js/views/schedule.js',
  'js/views/settings.js',
  'js/views/subjects.js',
  'js/views/teachers.js',
  'js/weeks.js',
  'js/works.js'
];
const EXTERNAL_SCRIPTS = ['https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2'];
const RUNTIME_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com', 'cdn.jsdelivr.net'];

/**
 * Кладёт в кэш все файлы приложения; один недоступный файл установку не ломает.
 * @returns {Promise<void>} Результат выполнения.
 */
async function precache() {
  const cache = await caches.open(CACHE_NAME);
  await Promise.all(SHELL.map(url => cache.add(url).catch(() => {})));
  await Promise.all(EXTERNAL_SCRIPTS.map(url => cache.add(url).catch(() => {})));
}

/**
 * Удаляет кэши прошлых версий приложения.
 * @returns {Promise<void>} Результат выполнения.
 */
async function dropOldCaches() {
  const names = await caches.keys();
  await Promise.all(names.filter(n => n.indexOf('politeshik-') === 0 && n !== CACHE_NAME).map(n => caches.delete(n)));
}

/**
 * Ждёт ответа сети не дольше заданного времени.
 * @param {Promise<Response>} network Запрос к сети.
 * @returns {Promise<Response>} Ответ сети или ошибка по таймауту.
 */
function withTimeout(network) {
  return Promise.race([
    network,
    new Promise((resolve, reject) => setTimeout(() => reject(new Error('timeout')), NETWORK_TIMEOUT_MS))
  ]);
}

/**
 * Отдаёт свежий файл из сети и обновляет кэш; без сети или при медленной сети берёт копию из кэша.
 * @param {Request} request Запрос страницы или файла приложения.
 * @returns {Promise<Response>} Ответ.
 */
async function networkFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  const network = fetch(
    request.mode === 'navigate'
      ? new Request(request.url, {cache: 'no-cache'})
      : new Request(request, {cache: 'no-cache'})
  );
  try {
    const response = await withTimeout(network);
    if (response && response.ok) cache.put(request, response.clone());
    return response;
  } catch (err) {
    const cached = await cache.match(request, {ignoreSearch: true});
    if (cached) return cached;
    if (request.mode === 'navigate') {
      const shell = await cache.match('index.html');
      if (shell) return shell;
    }
    try {
      return await network;
    } catch (offline) {
      return new Response('Нет сети', {status: 503, headers: {'Content-Type': 'text/plain; charset=utf-8'}});
    }
  }
}

/**
 * Отдаёт копию из кэша сразу, а в фоне обновляет её; подходит для шрифтов и внешних библиотек.
 * @param {Request} request Запрос внешнего файла.
 * @returns {Promise<Response>} Ответ.
 */
async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  const refresh = fetch(request)
    .then(response => {
      if (response && (response.ok || response.type === 'opaque')) cache.put(request, response.clone());
      return response;
    })
    .catch(() => null);
  return cached || (await refresh) || new Response('', {status: 504});
}

self.addEventListener('install', event => {
  event.waitUntil(precache().then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(dropOldCaches().then(() => self.clients.claim()));
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin === self.location.origin) event.respondWith(networkFirst(request));
  else if (RUNTIME_HOSTS.indexOf(url.hostname) >= 0) event.respondWith(staleWhileRevalidate(request));
});

/**
 * Разбирает данные push-сообщения: JSON вида {title, body, url, tag} или обычный текст.
 * @param {PushMessageData|null} data Данные сообщения.
 * @returns {Object} Заголовок, текст, адрес и метка уведомления.
 */
function parsePush(data) {
  let payload = {};
  try {
    payload = data ? data.json() : {};
  } catch (err) {
    payload = {body: data ? data.text() : ''};
  }
  return {
    title: payload.title || 'Политешик',
    body: payload.body || '',
    url: payload.url || './',
    tag: payload.tag || 'politeshik'
  };
}

self.addEventListener('push', event => {
  const msg = parsePush(event.data);
  event.waitUntil(
    self.registration.showNotification(msg.title, {
      body: msg.body,
      icon: 'assets/icon-192.png',
      badge: 'assets/icon-192.png',
      tag: msg.tag,
      data: {url: msg.url}
    })
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const target = new URL((event.notification.data && event.notification.data.url) || './', self.registration.scope)
    .href;
  event.waitUntil(
    self.clients.matchAll({type: 'window', includeUncontrolled: true}).then(list => {
      const open = list.find(c => c.url.indexOf(self.registration.scope) === 0);
      if (open) return open.focus();
      return self.clients.openWindow(target);
    })
  );
});
