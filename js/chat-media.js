'use strict';
const ChatMedia = {
  max: 25 * 1024 * 1024,
  draft: null,
  stream: null,
  recorder: null,
  busy: false,
  token: 0,
  context(form) {
    return form.dataset.form === 'peer'
      ? {
          peer: form.dataset.peer,
          thread: null,
          role: null,
          tenant: Cloud.tenantId,
          owner: Cloud.uid,
        }
      : {
          peer: null,
          thread: form.dataset.with,
          role: Dm.recipient(),
          tenant: Cloud.tenantId,
          owner: Cloud.uid,
        };
  },
  controls() {
    return '<button class="icon-btn" data-action="media-pick" aria-label="Прикрепить фото, видео или файл" title="Фото, видео, файлы">📎</button><button class="icon-btn" data-action="media-record" aria-label="Записать голосовое" title="Голосовое сообщение">🎙</button>';
  },
  async pick(form) {
    if (ChatMedia.busy) return;
    const context = ChatMedia.context(form),
      input = document.createElement('input');
    input.type = 'file';
    input.onchange = () => {
      if (input.files?.[0]) ChatMedia.review(input.files[0], context);
    };
    input.click();
  },
  kind(file) {
    return ['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(file.type)
      ? 'photo'
      : ['video/mp4', 'video/webm', 'video/quicktime'].includes(file.type)
        ? 'video'
        : 'file';
  },
  review(file, context, kind) {
    if (!file.size || file.size > ChatMedia.max) return toast('Можно отправить файл до 25 МБ');
    ChatMedia.cancel();
    const url = URL.createObjectURL(file);
    ChatMedia.draft = {
      file,
      context,
      kind: kind || ChatMedia.kind(file),
      url,
    };
    UI.open(
      'Отправить вложение',
      '<div class="media-review">' +
        (ChatMedia.draft.kind === 'photo'
          ? '<img src="' + url + '" alt="Предпросмотр фото">'
          : ChatMedia.draft.kind === 'voice'
            ? '<audio controls src="' + url + '"></audio>'
            : ChatMedia.draft.kind === 'video'
              ? '<video controls playsinline src="' + url + '"></video>'
              : '') +
        '<b>' +
        U.esc(file.name) +
        '</b><p>' +
        Math.ceil(file.size / 1024) +
        ' КБ · только участникам переписки</p><textarea class="input" id="media-caption" maxlength="4000" placeholder="Подпись (необязательно)"></textarea><div class="head-actions"><button class="btn" data-action="media-cancel">Отмена</button><button class="btn primary" data-action="media-send">Отправить</button></div><p id="media-upload-status" role="status"></p></div>',
    );
  },
  async send() {
    const draft = ChatMedia.draft;
    if (!draft || ChatMedia.busy) return;
    if (draft.context.owner !== Cloud.uid || draft.context.tenant !== Cloud.tenantId)
      return toast('Аккаунт или группа изменились. Выберите файл заново.');
    const body = document.getElementById('media-caption')?.value || '';
    ChatMedia.busy = true;
    const status = document.getElementById('media-upload-status');
    status.textContent = 'Загружаю…';
    try {
      const {file, context, kind} = draft;
      if (!draft.upload) {
        draft.upload = await Social.call('prepare_message_upload', {
          p_peer: context.peer,
          p_thread: context.thread,
          p_role: context.role,
          p_name: file.name.slice(0, 200),
          p_mime: (file.type || 'application/octet-stream').split(';')[0],
          p_size: file.size,
          p_kind: kind,
        });
      }
      if (!draft.uploaded) {
        const {error} = await supa.storage
          .from('private-messages')
          .upload(draft.upload.path, file, {
            contentType: (file.type || 'application/octet-stream').split(';')[0],
            upsert: false,
          });
        if (error) throw error;
        draft.uploaded = true;
      }
      status.textContent = 'Отправляю…';
      await Social.call('send_message_upload', {
        p_id: draft.upload.id,
        p_body: body,
      });
      draft.sent = true;
      ChatMedia.busy = false;
      ChatMedia.cancel();
      UI.close();
      if (context.owner === Cloud.uid && context.tenant === Cloud.tenantId) {
        if (context.peer) {
          await Social.loadThread(context.peer);
          await Social.loadInbox();
        } else await Dm.refresh();
        App.render();
      }
    } catch (error) {
      status.textContent = 'Не отправлено: ' + error.message + '. Можно повторить.';
    } finally {
      ChatMedia.busy = false;
    }
  },
  async record(form) {
    if (ChatMedia.busy) return;
    ChatMedia.cancel();
    const token = ++ChatMedia.token,
      context = ChatMedia.context(form);
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined')
      return toast('Запись не поддерживается. Прикрепите аудиофайл через скрепку.');
    UI.open(
      'Голосовое сообщение',
      '<p id="voice-status" role="status">Разрешите доступ к микрофону…</p><div class="head-actions"><button class="btn" data-action="media-cancel">Отмена</button><button class="btn primary" data-action="media-record-stop" disabled>Закончить запись</button></div><p class="hint">До 2 минут. После записи можно прослушать и выбрать «Отправить».</p>',
    );
    try {
      const stream = await navigator.mediaDevices.getUserMedia({audio: true});
      if (token !== ChatMedia.token) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      ChatMedia.stream = stream;
      const mime = ['audio/webm', 'audio/mp4', 'audio/ogg'].find((t) =>
          MediaRecorder.isTypeSupported(t),
        ),
        recorder = new MediaRecorder(stream, mime ? {mimeType: mime} : {}),
        chunks = [];
      ChatMedia.recorder = recorder;
      recorder.ondataavailable = (e) => {
        if (e.data.size) chunks.push(e.data);
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        if (token !== ChatMedia.token) return;
        clearInterval(ChatMedia.recordTimer);
        ChatMedia.recorder = null;
        ChatMedia.stream = null;
        const type = (recorder.mimeType || mime || 'audio/webm').split(';')[0],
          blob = new Blob(chunks, {type});
        ChatMedia.review(
          new File(
            [blob],
            'Голосовое-' +
              Date.now() +
              '.' +
              (type.includes('mp4') ? 'm4a' : type.includes('ogg') ? 'ogg' : 'webm'),
            {type},
          ),
          context,
          'voice',
        );
      };
      recorder.start(1000);
      const started = Date.now();
      document.querySelector('[data-action="media-record-stop"]').disabled = false;
      ChatMedia.recordTimer = setInterval(() => {
        const sec = Math.floor((Date.now() - started) / 1000);
        const status = document.getElementById('voice-status');
        if (status) status.textContent = '● Запись · ' + sec + ' с';
        if (sec >= 120) ChatMedia.stopRecording();
      }, 250);
    } catch (error) {
      if (token === ChatMedia.token) {
        ChatMedia.cancel();
        UI.close();
        toast(
          'Микрофон недоступен. Разрешите его в настройках браузера или прикрепите готовую запись.',
        );
      }
    }
  },
  stopRecording() {
    if (ChatMedia.recorder?.state === 'recording') ChatMedia.recorder.stop();
  },
  cancel() {
    ChatMedia.token++;
    clearInterval(ChatMedia.recordTimer);
    if (ChatMedia.recorder?.state === 'recording') ChatMedia.recorder.stop();
    ChatMedia.stream?.getTracks().forEach((t) => t.stop());
    ChatMedia.stream = null;
    if (
      ChatMedia.draft?.uploaded &&
      !ChatMedia.draft.sent &&
      ChatMedia.draft.context.owner === Cloud.uid
    )
      supa.storage
        .from('private-messages')
        .remove([ChatMedia.draft.upload.path])
        .catch(() => {});
    if (ChatMedia.draft?.url) URL.revokeObjectURL(ChatMedia.draft.url);
    ChatMedia.draft = null;
  },
  attachment(m) {
    return m.attachment || m.meta?.attachment;
  },
  html(m) {
    const a = ChatMedia.attachment(m);
    if (!a || !ChatMedia.validPath(a.path)) return '';
    return (
      '<div class="message-attachment">' +
      (a.kind === 'photo'
        ? '<img class="chat-photo" data-media-image="' +
          U.esc(a.path) +
          '" alt="' +
          U.esc(a.name) +
          '" loading="lazy">'
        : '') +
      '<button class="btn sm" data-action="media-open" data-path="' +
      U.esc(a.path) +
      '" data-kind="' +
      U.esc(a.kind) +
      '" data-name="' +
      U.esc(a.name) +
      '">' +
      ({
        photo: '🖼 Фото',
        video: '▶ Видео',
        voice: '▶ Голосовое',
        file: '📄 Файл',
      }[a.kind] || 'Файл') +
      ' · ' +
      Math.ceil(Number(a.size || 0) / 1024) +
      ' КБ</button><small>' +
      U.esc(a.name) +
      '</small></div>'
    );
  },
  validPath(path) {
    return /^[0-9a-f-]{36}\/[0-9a-f-]{36}$/.test(path || '');
  },
  async url(path) {
    const owner=Cloud.uid;
    if(ChatMedia.urlOwner!==Cloud.uid){ChatMedia.urlOwner=Cloud.uid;ChatMedia.urls=new Map();}
    const cached=ChatMedia.urls?.get(path);if(cached&&cached.until>Date.now())return cached.url;
    if (!ChatMedia.validPath(path)) throw Error('Неверное вложение');
    const {data, error} = await supa.storage.from('private-messages').createSignedUrl(path, 300);
    if (error) throw error;
    if(owner!==Cloud.uid)throw Error('Аккаунт изменился');
    if(ChatMedia.urls.size>=100)ChatMedia.urls.delete(ChatMedia.urls.keys().next().value);
    ChatMedia.urls.set(path,{url:data.signedUrl,until:Date.now()+240000});
    return data.signedUrl;
  },
  async open(el) {
    try {
      const url = await ChatMedia.url(el.dataset.path),
        kind = el.dataset.kind,
        name = el.dataset.name || 'Файл';
      UI.open(
        name,
        '<div class="media-review">' +
          (kind === 'photo'
            ? '<img src="' + U.esc(url) + '" alt="' + U.esc(name) + '">'
            : kind === 'video'
              ? '<video controls autoplay playsinline src="' + U.esc(url) + '"></video>'
              : kind === 'voice'
                ? '<audio controls autoplay src="' + U.esc(url) + '"></audio>'
                : '') +
          '<a class="btn primary" href="' +
          U.esc(url) +
          '" target="_blank" rel="noopener noreferrer" download="' +
          U.esc(name) +
          '">Скачать файл</a></div>',
      );
    } catch (error) {
      toast('Не удалось открыть: ' + error.message);
    }
  },
  hydrate() {
    document.querySelectorAll('[data-media-image]:not([data-media-observed])').forEach((img) => {
      img.dataset.mediaObserved = '1';
      ChatMedia.observer.observe(img);
    });
  },
};
ChatMedia.observer = new IntersectionObserver(
  (entries) => {
    for (const {target, isIntersecting} of entries)
      if (isIntersecting) {
        ChatMedia.observer.unobserve(target);
        ChatMedia.url(target.dataset.mediaImage)
          .then((url) => {
            if (target.isConnected) target.src = url;
          })
          .catch(() => {
            target.alt = 'Фото не загружено. Нажмите «Фото», чтобы повторить.';
          });
      }
  },
  {rootMargin: '150px'},
);
new MutationObserver(() => {
  ChatMedia.hydrate();
  if (
    (ChatMedia.stream || ChatMedia.draft) &&
    !document.querySelector('.media-review,#voice-status') &&
    !ChatMedia.busy
  )
    ChatMedia.cancel();
}).observe(document.getElementById('modal-root')?.parentNode || document.body, {
  childList: true,
  subtree: true,
});
Object.assign(A, {
  'media-pick': (el) => ChatMedia.pick(el.closest('[data-form]')),
  'media-record': (el) => ChatMedia.record(el.closest('[data-form]')),
  'media-record-stop': () => ChatMedia.stopRecording(),
  'media-send': () => ChatMedia.send(),
  'media-cancel': () => {
    if (ChatMedia.busy) return;
    ChatMedia.cancel();
    UI.close();
  },
  'media-open': (el) => ChatMedia.open(el),
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden && ChatMedia.stream) {
    ChatMedia.cancel();
    UI.close();
  }
});
window.addEventListener('pagehide', () => ChatMedia.cancel());
