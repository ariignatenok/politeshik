'use strict';
const Wall = {
  owner: null,
  uid: null,
  data: null,
  posts: [],
  loading: false,
  error: '',
  more: false,
  token: 0,
  returnTab: 'people',
  draft: null,
  busy: false,
  urls: new Map(),
  themes: {
    lilac: 'Сирень',
    rose: 'Розовый',
    ocean: 'Океан',
    mint: 'Мята',
    amber: 'Тёплый',
    night: 'Ночной',
  },
  reset() {
    if (Wall.owner === Cloud.uid) return;
    if(typeof CoverCrop!=='undefined')CoverCrop.cancel();
    Wall.owner = Cloud.uid;
    Wall.uid = null;
    Wall.data = null;
    Wall.posts = [];
    Wall.error = '';
    Wall.loading = false;
    Wall.token++;
    Wall.urls.clear();
    Wall.cleanDraft();
  },
  async open(uid = Cloud.uid) {
    if (!Social.allowed()) return toast('Страница доступна после одобрения регистрации');
    Wall.reset();
    Wall.returnTab = ui.tab === 'profile' ? Wall.returnTab : ui.tab;
    Wall.token++;
    Wall.loading = false;
    Wall.uid = uid;
    Wall.data = null;
    Wall.posts = [];
    Wall.error = '';
    Wall.more = false;
    UI.close();
    Social.profileToken++;
    ui.tab = 'profile';
    App.render(true);
    window.scrollTo(0, 0);
    await Wall.load();
  },
  async load(append = false) {
    if (Wall.loading) return;
    Wall.reset();
    if (!Wall.uid) return;
    Wall.loading = true;
    Wall.error = '';
    const owner = Cloud.uid,
      uid = Wall.uid,
      token = ++Wall.token,
      last = append ? Wall.posts.filter((p) => !p.pinned).at(-1) : null;
    try {
      const data = await Social.call('wall_page', {
        p_uid: uid,
        p_before: last?.created_at || null,
        p_before_id: last?.id || null,
      });
      if (owner !== Cloud.uid || token !== Wall.token || uid !== Wall.uid) return;
      Social.keep(data.card);
      Wall.data = data;
      Wall.more = data.posts.length > 20;
      const rows = data.posts.slice(0, 20);
      Wall.posts = append
        ? [...Wall.posts, ...rows.filter((p) => !Wall.posts.some((old) => old.id === p.id))]
        : rows;
    } catch (error) {
      if (owner === Cloud.uid && token === Wall.token) Wall.error = error.message;
    } finally {
      if (token === Wall.token) {
        Wall.loading = false;
        if (ui.tab === 'profile') App.renderSoft();
      }
    }
  },
  async editProfile() {
    if (Wall.uid !== Cloud.uid || !Wall.data) return;
    const s = Wall.data.settings || {},
      c = Wall.data.card;
    UI.open(
      'Оформление моей страницы',
      '<div class="wall-settings" data-form="wall-profile"><label class="field">Статус<input class="input" name="tagline" maxlength="120" value="' +
        U.esc(s.tagline || '') +
        '" placeholder="Что у вас нового?"></label><label class="field">О себе<textarea class="input" name="bio" maxlength="500" rows="3">' +
        U.esc(s.bio ?? c.about ?? '') +
        '</textarea></label><label class="field">Полезная информация<textarea class="input" name="info" maxlength="2000" rows="5" placeholder="Увлечения, проекты, чем можете помочь…">' +
        U.esc(s.info || '') +
        '</textarea></label><div class="row2"><label class="field">Телефон для связи<input class="input" name="phone" type="tel" maxlength="32" value="' +
        U.esc(s.phone || '') +
        '"></label><label class="field">Почта для связи<input class="input" name="contact_email" type="email" maxlength="160" value="' +
        U.esc(s.contact_email || '') +
        '"></label></div><label class="wall-check"><input type="checkbox" name="show_phone"' +
        (s.show_phone ? ' checked' : '') +
        '> Показывать телефон студентам приложения</label><label class="wall-check"><input type="checkbox" name="show_email"' +
        (s.show_email ? ' checked' : '') +
        '> Показывать почту студентам приложения</label><p class="hint">Это контакты для публикации на странице. Почта для входа автоматически сюда не попадает.</p><label class="field">Цвет страницы<select class="input" name="theme">' +
        Object.entries(Wall.themes)
          .map(
            ([k, v]) =>
              '<option value="' +
              k +
              '"' +
              ((s.theme || 'lilac') === k ? ' selected' : '') +
              '>' +
              v +
              '</option>',
          )
          .join('') +
        '</select></label><button class="btn primary" data-action="save-form">Сохранить страницу</button></div>',
      {wide: true, noFocus: true},
    );
    document.querySelector('.wall-settings [name="tagline"]')?.focus({preventScroll: true});
  },
  async saveProfile(form) {
    if (Wall.busy) return;
    Wall.busy = true;
    const owner = Cloud.uid,
      page = Object.fromEntries(
        ['tagline', 'bio', 'info', 'phone', 'contact_email', 'theme'].map((k) => [k, val(form, k)]),
      );
    page.show_phone = form.querySelector('[name="show_phone"]').checked;
    page.show_email = form.querySelector('[name="show_email"]').checked;
    try {
      const card = await Social.call('wall_profile_save', {p_page: page});
      if (owner !== Cloud.uid) return;
      Social.keep(card);
      UI.close();
      await Wall.load();
      toast('Страница сохранена');
    } catch (error) {
      toast(error.message);
    } finally {
      Wall.busy = false;
    }
  },
  async photo(file, purpose) {
    if (file.size > 20 * 1024 * 1024) throw Error('Выберите фотографию до 20 МБ');
    const compressed = await compressImage(file, 1000000),
      blob = await (await fetch(compressed)).blob();
    return {
      file: new File([blob], file.name.replace(/\.[^.]*$/, '') + '.jpg', {type: 'image/jpeg'}),
      url: URL.createObjectURL(blob),
      purpose,
    };
  },
  async upload(photo) {
    if (photo.uploaded) return photo.media;
    photo.media ||= await Social.call('wall_upload_prepare', {
      p_name: photo.file.name.slice(0, 200),
      p_mime: photo.file.type,
      p_size: photo.file.size,
      p_purpose: photo.purpose,
    });
    const {error} = await supa.storage
      .from('profile-wall')
      .upload(photo.media.path, photo.file, {contentType: photo.file.type, upsert: false});
    if (error) throw error;
    photo.uploaded = true;
    return photo.media;
  },
  pickCover(file) {
    if (Wall.busy || Wall.uid !== Cloud.uid) return;
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    const owner = Cloud.uid;
    const process = async file => {
      if (!file) return;
      Wall.busy = true;
      let photo;
      try {
        const cropped=await CoverCrop.edit(file);
        if(!cropped||owner!==Cloud.uid||Wall.uid!==owner)return;
        photo = await Wall.photo(cropped, 'cover');
        if (owner !== Cloud.uid) return;
        const image = await Wall.upload(photo);
        if (owner !== Cloud.uid) return;
        const card = await Social.call('wall_profile_save', {p_page: {cover_id: image.id}});
        photo.published = true;
        Social.keep(card);
        await Wall.load();
        toast('Обложка обновлена');
      } catch (error) {
        toast('Не удалось обновить обложку: ' + error.message);
      } finally {
        if (photo?.url) URL.revokeObjectURL(photo.url);
        Wall.busy = false;
      }
    };
    input.onchange=()=>process(input.files?.[0]);
    if(file)return process(file);else input.click();
  },
  async editCover(){
    if(Wall.busy||Wall.uid!==Cloud.uid||!Wall.data?.card.cover)return;
    const owner=Cloud.uid;Wall.busy=true;
    try{const url=await Wall.imageUrl(Wall.data.card.cover.path),response=await fetch(url,{signal:AbortSignal.timeout(15000)});if(!response.ok)throw Error('Не удалось загрузить обложку');const blob=await response.blob();if(owner!==Cloud.uid||Wall.uid!==owner)return;Wall.busy=false;await Wall.pickCover(new File([blob],'cover.jpg',{type:blob.type}));}
    catch(error){toast(error.message);}
    finally{Wall.busy=false;}
  },
  async removeCover() {
    if (Wall.busy || Wall.uid !== Cloud.uid) return;
    Wall.busy = true;
    try {
      await Social.call('wall_profile_save', {p_page: {cover_id: null}});
      await Wall.load();
    } catch (error) {
      toast(error.message);
    } finally {
      Wall.busy = false;
    }
  },
  editPost(id) {
    if (Wall.uid !== Cloud.uid || !Wall.data?.editable) return;
    Wall.cleanDraft();
    const post = Wall.posts.find((p) => p.id === id);
    Wall.draft = {
      owner: Cloud.uid,
      id: post?.id || crypto.randomUUID(),
      body: post?.body || '',
      photos: (post?.photos || []).map((media) => ({media, uploaded: true, existing: true})),
      published: false,
    };
    Wall.postDialog();
  },
  postDialog() {
    const d = Wall.draft;
    if (!d) return;
    UI.open(
      'Запись на моей стене',
      '<div class="wall-post-editor" data-form="wall-post"><textarea class="input wall-write" name="body" maxlength="5000" rows="6" placeholder="Поделитесь мыслью, событием или полезной находкой…">' +
        U.esc(d.body) +
        '</textarea><div class="wall-draft-photos">' +
        d.photos
          .map(
            (p, i) =>
              '<div>' +
              (p.url
                ? '<img src="' + p.url + '" alt="Выбранное фото">'
                : '<img data-wall-image="' + p.media.path + '" alt="Фото записи">') +
              '<button class="btn sm" data-action="wall-photo-remove" data-index="' +
              i +
              '" aria-label="Убрать фото">✕</button></div>',
          )
          .join('') +
        '</div><p class="hint">До 4 фотографий. Запись увидят одобренные студенты приложения.</p><div class="head-actions"><button class="btn" data-action="wall-post-photos"' +
        (d.photos.length >= 4 ? ' disabled' : '') +
        '>＋ Фото</button><button class="btn primary" data-action="save-form">Опубликовать</button></div><p id="wall-post-status" role="status"></p></div>',
      {wide: true, noFocus: true},
    );
    document.querySelector('.wall-post-editor textarea')?.focus({preventScroll: true});
  },
  captureDraft() {
    if (Wall.draft) {
      const input = document.querySelector('.wall-post-editor [name="body"]');
      if (input) Wall.draft.body = input.value;
    }
  },
  pickPhotos() {
    const d = Wall.draft;
    if (!d || Wall.busy) return;
    Wall.captureDraft();
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.multiple = true;
    input.onchange = async () => {
      const files = [...(input.files || [])];
      if (!files.length) return;
      Wall.busy = true;
      try {
        if (files.length + d.photos.length > 4) throw Error('В одной записи может быть до 4 фото');
        for (const file of files) {
          const photo = await Wall.photo(file, 'post');
          if (d !== Wall.draft || d.owner !== Cloud.uid) {
            URL.revokeObjectURL(photo.url);
            return;
          }
          d.photos.push(photo);
        }
        Wall.captureDraft();
        Wall.postDialog();
      } catch (error) {
        toast(error.message);
      } finally {
        Wall.busy = false;
      }
    };
    input.click();
  },
  async publish(form) {
    const d = Wall.draft;
    if (!d || Wall.busy || d.owner !== Cloud.uid) return;
    Wall.captureDraft();
    if (!d.body.trim() && !d.photos.length) return toast('Напишите мысль или добавьте фото');
    Wall.busy = true;
    const status = document.getElementById('wall-post-status');
    try {
      const ids = [];
      for (const [i, photo] of d.photos.entries()) {
        if (status)
          status.textContent = 'Загружаю фото ' + (i + 1) + ' из ' + d.photos.length + '…';
        ids.push((await Wall.upload(photo)).id);
      }
      if (d.owner !== Cloud.uid) return;
      if (status) status.textContent = 'Публикую…';
      await Social.call('wall_post_save', {p_id: d.id, p_body: d.body, p_photos: ids});
      d.published = true;
      UI.close();
      Wall.cleanDraft();
      await Wall.load();
      toast('Запись опубликована');
    } catch (error) {
      if (status) status.textContent = 'Не опубликовано: ' + error.message + '. Можно повторить.';
    } finally {
      Wall.busy = false;
    }
  },
  async action(id, action) {
    if (Wall.busy) return;
    if (action === 'delete' && !(await UI.confirm('Удалить запись со стены?'))) return;
    Wall.busy = true;
    try {
      await Social.call('wall_post_action', {p_id: id, p_action: action});
      await Wall.load();
    } catch (error) {
      toast(error.message);
    } finally {
      Wall.busy = false;
    }
  },
  async likePost(id) {
    const p = Wall.posts.find((p) => p.id === id);
    if (!p || Wall.likeBusy) return;
    const owner = Cloud.uid;
    Wall.likeBusy = true;
    try {
      const result = await Social.call('wall_post_like', {p_id: id, p_on: !p.liked});
      if (owner !== Cloud.uid) return;
      Object.assign(p, result);
      App.renderSoft();
    } catch (error) {
      toast(error.message);
    } finally {
      Wall.likeBusy = false;
    }
  },
  cleanDraft() {
    const d = Wall.draft;
    Wall.draft = null;
    if (!d) return;
    for (const photo of d.photos) {
      if (photo.url) URL.revokeObjectURL(photo.url);
      if (photo.uploaded && !photo.existing && !d.published && d.owner === Cloud.uid)
        supa.storage
          .from('profile-wall')
          .remove([photo.media.path])
          .catch(() => {});
    }
  },
  async imageUrl(path) {
    Wall.reset();
    if (!/^[0-9a-f-]{36}\/[0-9a-f-]{36}$/.test(path || '')) throw Error('Неверное фото');
    const cached = Wall.urls.get(path);
    if (cached?.until > Date.now()) return cached.url;
    const owner = Cloud.uid;
    const {data, error} = await supa.storage.from('profile-wall').createSignedUrl(path, 300);
    if (error) throw error;
    if (owner !== Cloud.uid) throw Error('Аккаунт изменился');
    if (Wall.urls.size >= 120) Wall.urls.delete(Wall.urls.keys().next().value);
    Wall.urls.set(path, {url: data.signedUrl, until: Date.now() + 240000});
    return data.signedUrl;
  },
  async imageOpen(el) {
    try {
      const url = await Wall.imageUrl(el.dataset.path);
      UI.open(
        'Фотография',
        '<img class="wall-photo-full" alt="Фотография со страницы" src="' + U.esc(url) + '">',
        {wide: true},
      );
    } catch (error) {
      toast(error.message);
    }
  },
  hydrate() {
    document.querySelectorAll('[data-wall-image]:not([data-wall-observed])').forEach((img) => {
      img.dataset.wallObserved = '1';
      Wall.observer.observe(img);
    });
  },
};
Wall.observer = new IntersectionObserver(
  (entries) => {
    for (const {target, isIntersecting} of entries)
      if (isIntersecting) {
        Wall.observer.unobserve(target);
        Wall.imageUrl(target.dataset.wallImage)
          .then((url) => {
            if (target.isConnected) target.src = url;
          })
          .catch(() => {
            target.alt = 'Фото недоступно. Откройте профиль заново.';
          });
      }
  },
  {rootMargin: '200px'},
);
new MutationObserver(() => {
  Wall.hydrate();
  if (Wall.draft && !Wall.busy && !document.querySelector('.wall-post-editor')) Wall.cleanDraft();
}).observe(document.body, {childList: true, subtree: true});
Object.assign(A, {
  'wall-open': (el) => Wall.open(el.dataset.uid || Cloud.uid),
  'wall-back': () => {
    ui.tab = Wall.returnTab === 'profile' ? 'people' : Wall.returnTab;
    App.render(true);
  },
  'wall-refresh': () => Wall.load(),
  'wall-more': () => Wall.load(true),
  'wall-edit-profile': () => Wall.editProfile(),
  'wall-cover': () => Wall.pickCover(),
  'wall-cover-crop':()=>Wall.editCover(),
  'wall-cover-remove': () => Wall.removeCover(),
  'wall-new-post': () => Wall.editPost(),
  'wall-edit-post': (el) => Wall.editPost(el.dataset.id),
  'wall-post-photos': () => Wall.pickPhotos(),
  'wall-photo-remove': (el) => {
    if (Wall.busy || !Wall.draft) return;
    Wall.captureDraft();
    const p = Wall.draft.photos.splice(Number(el.dataset.index), 1)[0];
    if (p?.url) URL.revokeObjectURL(p.url);
    Wall.postDialog();
  },
  'wall-post-action': (el) => Wall.action(el.dataset.id, el.dataset.operation),
  'wall-like-post': (el) => Wall.likePost(el.dataset.id),
  'wall-image': (el) => Wall.imageOpen(el),
});
Forms['wall-profile'] = (form) => Wall.saveProfile(form);
Forms['wall-post'] = (form) => Wall.publish(form);
