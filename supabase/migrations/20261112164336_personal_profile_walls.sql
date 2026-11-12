-- Student-owned social pages. Educational and private-message tenant policies are unchanged.
-- Contact values are entered for publication explicitly; auth email/phone are never projected.
create table politeshik_private.wall_media(
 id uuid primary key default gen_random_uuid(),owner_uid uuid not null references auth.users(id) on delete cascade,
 purpose text not null check(purpose in('post','cover')),name text not null check(char_length(name) between 1 and 200),
 mime text not null check(mime in('image/jpeg','image/png','image/webp')),size integer not null check(size between 1 and 5242880),created_at timestamptz not null default now());
create index wall_media_owner_created on politeshik_private.wall_media(owner_uid,created_at);
create table politeshik_private.profile_pages(
 uid uuid primary key references auth.users(id) on delete cascade,
 tagline text not null default '' check(char_length(tagline)<=120),bio text not null default '' check(char_length(bio)<=500),
 info text not null default '' check(char_length(info)<=2000),phone text not null default '' check(char_length(phone)<=32),
 contact_email text not null default '' check(char_length(contact_email)<=160),show_phone boolean not null default false,show_email boolean not null default false,
 theme text not null default 'lilac' check(theme in('lilac','rose','ocean','mint','amber','night')),
 cover_id uuid references politeshik_private.wall_media(id),updated_at timestamptz not null default now());
create index profile_pages_cover on politeshik_private.profile_pages(cover_id);
create table politeshik_private.wall_posts(
 id uuid primary key,owner_uid uuid not null references auth.users(id) on delete cascade,
 body text not null default '' check(char_length(body)<=5000),photos uuid[] not null default '{}' check(cardinality(photos)<=4),
 pinned boolean not null default false,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 check(btrim(body)<>'' or cardinality(photos)>0));
create index wall_posts_owner_created on politeshik_private.wall_posts(owner_uid,created_at desc,id desc);
create index wall_posts_photos on politeshik_private.wall_posts using gin(photos);
create unique index wall_one_pin on politeshik_private.wall_posts(owner_uid) where pinned;
create table politeshik_private.wall_likes(post_id uuid not null references politeshik_private.wall_posts(id) on delete cascade,sender uuid not null references auth.users(id) on delete cascade,primary key(post_id,sender));
DO $$declare t text;begin
 foreach t in array array['wall_media','profile_pages','wall_posts','wall_likes'] loop
 execute format('alter table politeshik_private.%I enable row level security',t);
 execute format('revoke all on politeshik_private.%I from public,anon,authenticated',t);
 execute format('create policy wall_rpc_only on politeshik_private.%I as restrictive for all to authenticated using(false) with check(false)',t);
 end loop;
end $$;

create function politeshik_private.wall_image(p_id uuid) returns jsonb language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('id',id,'path',owner_uid::text||'/'||id::text,'name',name,'size',size,'mime',mime) from politeshik_private.wall_media where id=p_id
$$;
revoke all on function politeshik_private.wall_image(uuid) from public,anon,authenticated;

create or replace function politeshik_private.social_profile(p_uid uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare actor uuid:=politeshik_private.social_actor(); result jsonb;
begin
 select jsonb_build_object('uid',m.uid,'name',case when sa.uid is not null then 'Админ Арина' else coalesce(nullif(m.full_name,''),nullif(p.data->>'name',''),'Студент') end,
  'group_name',coalesce(g.name,m.tenant_id),'role',case when sa.uid is not null then 'superadmin' else m.role end,
  'avatar',coalesce(a.data->>'v',''),'mascot',coalesce(a.data->'mascot',p.data->'mascot','{}'),
  'about',left(coalesce(pg.bio,p.data->>'about',''),500),
  'tagline',coalesce(pg.tagline,''),'phone',case when pg.show_phone then pg.phone else '' end,
  'contact_email',case when pg.show_email then pg.contact_email else '' end,'page_theme',coalesce(pg.theme,'lilac'),
  'cover',politeshik_private.wall_image(pg.cover_id),
  'mascot_likes',(select count(*) from politeshik_private.profile_likes where target=m.uid and kind='mascot'),
  'photo_likes',(select count(*) from politeshik_private.profile_likes where target=m.uid and kind='photo'),
  'liked_mascot',exists(select 1 from politeshik_private.profile_likes where target=m.uid and sender=actor and kind='mascot'),
  'liked_photo',exists(select 1 from politeshik_private.profile_likes where target=m.uid and sender=actor and kind='photo')) into result
 from public.members m join auth.users u on u.id=m.uid
 left join public.groups g on g.tenant_id=m.tenant_id and g.id=m.group_id
 left join public.docs p on p.tenant_id=m.tenant_id and p.path='profiles/'||m.uid::text
 left join public.docs a on a.tenant_id=m.tenant_id and a.path='avatars/'||m.uid::text
 left join politeshik_private.super_admins sa on sa.uid=m.uid
 left join politeshik_private.profile_pages pg on pg.uid=m.uid
 where m.uid=p_uid and m.status='approved' and m.role in('student','admin','developer') and coalesce(m.requested_role,'student')<>'parent' and u.email_confirmed_at is not null;
 return case when result is null then null else result||politeshik_private.presence_status(p_uid) end;
end $$;

create function politeshik_private.wall_media_access(p_path text,p_write boolean default false) returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(select 1 from public.members m join auth.users u on u.id=m.uid where m.uid=auth.uid() and m.status='approved' and m.role in('student','admin','developer') and coalesce(m.requested_role,'student')<>'parent' and u.email_confirmed_at is not null)
 and exists(select 1 from politeshik_private.wall_media x where x.owner_uid::text||'/'||x.id::text=p_path
 and case when p_write then x.owner_uid=auth.uid()
  and not exists(select 1 from politeshik_private.profile_pages where cover_id=x.id)
  and not exists(select 1 from politeshik_private.wall_posts where photos @> array[x.id])
 else x.owner_uid=auth.uid() or(
  exists(select 1 from public.members m join auth.users u on u.id=m.uid where m.uid=x.owner_uid and m.status='approved' and m.role in('student','admin','developer') and coalesce(m.requested_role,'student')<>'parent' and u.email_confirmed_at is not null)
  and (exists(select 1 from politeshik_private.profile_pages where uid=x.owner_uid and cover_id=x.id)
   or exists(select 1 from politeshik_private.wall_posts where owner_uid=x.owner_uid and photos @> array[x.id]))) end)
$$;
revoke all on function politeshik_private.wall_media_access(text,boolean) from public,anon;grant execute on function politeshik_private.wall_media_access(text,boolean) to authenticated;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('profile-wall','profile-wall',false,5242880,array['image/jpeg','image/png','image/webp']);
create policy wall_photo_upload on storage.objects for insert to authenticated with check(bucket_id='profile-wall' and politeshik_private.wall_media_access(name,true));
create policy wall_photo_read on storage.objects for select to authenticated using(bucket_id='profile-wall' and politeshik_private.wall_media_access(name,false));
create policy wall_photo_remove_draft on storage.objects for delete to authenticated using(bucket_id='profile-wall' and politeshik_private.wall_media_access(name,true));

create function politeshik_private.wall_upload_prepare(p_name text,p_mime text,p_size integer,p_purpose text) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=politeshik_private.social_actor();r politeshik_private.wall_media;begin
 if p_name is null or char_length(p_name) not between 1 and 200 or p_mime is null or p_mime not in('image/jpeg','image/png','image/webp') or p_size is null or p_size not between 1 and 5242880 or p_purpose is null or p_purpose not in('post','cover') then raise exception 'Неверное фото. Поддерживаются JPEG, PNG и WebP до 5 МБ';end if;
 if (select count(*) from politeshik_private.wall_media where owner_uid=actor and created_at>now()-interval '1 hour')>=40 then raise exception 'Можно загрузить до 40 фото в час';end if;
 insert into politeshik_private.wall_media(owner_uid,purpose,name,mime,size) values(actor,p_purpose,p_name,p_mime,p_size) returning * into r;
 return politeshik_private.wall_image(r.id);
end $$;

create function politeshik_private.wall_profile_save(p_page jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=politeshik_private.social_actor();k text;r politeshik_private.profile_pages;image politeshik_private.wall_media;begin
 if p_page is null or jsonb_typeof(p_page)<>'object' or pg_column_size(p_page)>16000 then raise exception 'Неверная страница';end if;
 if exists(select 1 from jsonb_object_keys(p_page) x where x not in('tagline','bio','info','phone','contact_email','show_phone','show_email','theme','cover_id')) then raise exception 'Неизвестное поле';end if;
 select * into r from politeshik_private.profile_pages where uid=actor;
 if not found then r.uid:=actor;r.tagline:='';r.bio:=left(coalesce((select d.data->>'about' from public.docs d join public.members m on m.tenant_id=d.tenant_id and m.uid=actor where d.path='profiles/'||actor::text),''),500);r.info:='';r.phone:='';r.contact_email:='';r.show_phone:=false;r.show_email:=false;r.theme:='lilac';end if;
 foreach k in array array['tagline','bio','info','phone','contact_email','theme'] loop
  if p_page ? k and jsonb_typeof(p_page->k)<>'string' then raise exception 'Ожидается текст: %',k;end if;
 end loop;
 foreach k in array array['show_phone','show_email'] loop
  if p_page ? k and jsonb_typeof(p_page->k)<>'boolean' then raise exception 'Ожидается переключатель: %',k;end if;
 end loop;
 r.tagline:=btrim(coalesce(p_page->>'tagline',r.tagline));r.bio:=btrim(coalesce(p_page->>'bio',r.bio));r.info:=btrim(coalesce(p_page->>'info',r.info));
 r.phone:=btrim(coalesce(p_page->>'phone',r.phone));r.contact_email:=btrim(coalesce(p_page->>'contact_email',r.contact_email));
 r.show_phone:=coalesce((p_page->>'show_phone')::boolean,r.show_phone);r.show_email:=coalesce((p_page->>'show_email')::boolean,r.show_email);r.theme:=coalesce(p_page->>'theme',r.theme);
 if char_length(r.tagline)>120 or char_length(r.bio)>500 or char_length(r.info)>2000 or char_length(r.phone)>32 or char_length(r.contact_email)>160 then raise exception 'Слишком длинное поле';end if;
 if r.phone<>'' and r.phone !~ '^[+0-9() .-]{5,32}$' then raise exception 'Проверьте номер телефона';end if;
 if r.contact_email<>'' and r.contact_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'Проверьте почту для связи';end if;
 if r.theme not in('lilac','rose','ocean','mint','amber','night') then raise exception 'Неизвестная тема';end if;
 if p_page ? 'cover_id' then r.cover_id:=(p_page->>'cover_id')::uuid;end if;
 if r.cover_id is not null then
  select * into image from politeshik_private.wall_media where id=r.cover_id and owner_uid=actor and purpose='cover';
  if not found or not exists(select 1 from storage.objects where bucket_id='profile-wall' and name=actor::text||'/'||image.id::text and (metadata->>'size')::bigint=image.size and metadata->>'mimetype'=image.mime) then raise exception 'Обложка не загружена или принадлежит другому профилю';end if;
 end if;
 insert into politeshik_private.profile_pages values(actor,r.tagline,r.bio,r.info,r.phone,r.contact_email,r.show_phone,r.show_email,r.theme,r.cover_id,now())
 on conflict(uid) do update set tagline=excluded.tagline,bio=excluded.bio,info=excluded.info,phone=excluded.phone,contact_email=excluded.contact_email,show_phone=excluded.show_phone,show_email=excluded.show_email,theme=excluded.theme,cover_id=excluded.cover_id,updated_at=excluded.updated_at;
 return politeshik_private.social_profile(actor);
end $$;

create function politeshik_private.wall_post_save(p_id uuid,p_body text,p_photos uuid[] default '{}') returns boolean language plpgsql security definer set search_path='' as $$
declare actor uuid:=politeshik_private.social_actor();existing uuid;begin
 if p_id is null or p_body is null or p_photos is null or char_length(p_body)>5000 or cardinality(p_photos)>4 or (btrim(p_body)='' and cardinality(p_photos)=0) then raise exception 'Напишите мысль или добавьте фото (до 4 на запись)';end if;
 perform pg_advisory_xact_lock(hashtextextended(actor::text,1));
 select owner_uid into existing from politeshik_private.wall_posts where id=p_id for update;
 if found and existing<>actor then raise exception 'Редактировать запись может только автор' using errcode='42501';end if;
 if existing is null and (select count(*) from politeshik_private.wall_posts where owner_uid=actor and created_at>now()-interval '1 day')>=40 then raise exception 'Можно опубликовать до 40 записей в день';end if;
 if (select count(*) from politeshik_private.wall_media m where m.id=any(p_photos) and m.owner_uid=actor and m.purpose='post'
  and exists(select 1 from storage.objects o where o.bucket_id='profile-wall' and o.name=actor::text||'/'||m.id::text and (o.metadata->>'size')::bigint=m.size and o.metadata->>'mimetype'=m.mime))<>cardinality(p_photos) then raise exception 'Дождитесь загрузки собственных фотографий';end if;
 insert into politeshik_private.wall_posts(id,owner_uid,body,photos) values(p_id,actor,btrim(p_body),p_photos)
 on conflict(id) do update set body=excluded.body,photos=excluded.photos,updated_at=now() where politeshik_private.wall_posts.owner_uid=actor;
 return true;
end $$;
create function politeshik_private.wall_post_action(p_id uuid,p_action text) returns boolean language plpgsql security definer set search_path='' as $$
declare actor uuid:=politeshik_private.social_actor();r politeshik_private.wall_posts;begin
 perform pg_advisory_xact_lock(hashtextextended(actor::text,1));
 select * into r from politeshik_private.wall_posts where id=p_id and owner_uid=actor for update;
 if not found then raise exception 'Управлять записью может только её автор' using errcode='42501';end if;
 if p_action='delete' then delete from politeshik_private.wall_posts where id=r.id;
 elsif p_action='pin' then update politeshik_private.wall_posts set pinned=false where owner_uid=actor and pinned;update politeshik_private.wall_posts set pinned=true where id=r.id;
 elsif p_action='unpin' then update politeshik_private.wall_posts set pinned=false where id=r.id;
 else raise exception 'Неверное действие';end if;return true;
end $$;
create function politeshik_private.wall_post_like(p_id uuid,p_on boolean) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=politeshik_private.social_actor();author uuid;begin
 select owner_uid into author from politeshik_private.wall_posts where id=p_id;
 if author is null or politeshik_private.social_profile(author) is null then raise exception 'Запись недоступна' using errcode='42501';end if;
 if p_on is null then raise exception 'Неверный лайк';end if;
 if p_on then insert into politeshik_private.wall_likes(post_id,sender) values(p_id,actor) on conflict do nothing;else delete from politeshik_private.wall_likes where post_id=p_id and sender=actor;end if;
 return jsonb_build_object('liked',p_on,'likes',(select count(*) from politeshik_private.wall_likes where post_id=p_id));
end $$;

create function politeshik_private.wall_page(p_uid uuid,p_before timestamptz default null,p_before_id uuid default null) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare actor uuid:=politeshik_private.social_actor();card jsonb;posts jsonb;pg politeshik_private.profile_pages;begin
 card:=politeshik_private.social_profile(p_uid);if card is null then raise exception 'Профиль недоступен' using errcode='42501';end if;
 select * into pg from politeshik_private.profile_pages where uid=p_uid;
 select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'body',p.body,'created_at',p.created_at,'updated_at',p.updated_at,'pinned',p.pinned,
  'photos',coalesce((select jsonb_agg(politeshik_private.wall_image(photo) order by n) from unnest(p.photos) with ordinality x(photo,n)),'[]'),
  'likes',(select count(*) from politeshik_private.wall_likes where post_id=p.id),
  'liked',exists(select 1 from politeshik_private.wall_likes where post_id=p.id and sender=actor)) order by p.pinned desc,p.created_at desc,p.id desc),'[]') into posts
 from (select * from politeshik_private.wall_posts where owner_uid=p_uid and(p_before is null or(not pinned and (created_at,id)<(p_before,coalesce(p_before_id,'00000000-0000-0000-0000-000000000000'::uuid)))) order by pinned desc,created_at desc,id desc limit 21) p;
 return jsonb_build_object('card',card,'info',coalesce(pg.info,''),'editable',p_uid=actor,'settings',case when p_uid=actor then coalesce(to_jsonb(pg),'{}')-'uid'-'updated_at' else '{}' end,'posts',posts,'total',(select count(*) from politeshik_private.wall_posts where owner_uid=p_uid));
end $$;

revoke all on function politeshik_private.wall_upload_prepare(text,text,integer,text) from public,anon;grant execute on function politeshik_private.wall_upload_prepare(text,text,integer,text) to authenticated;
create function public.wall_upload_prepare(p_name text,p_mime text,p_size integer,p_purpose text) returns jsonb language sql security invoker set search_path='' as $$select politeshik_private.wall_upload_prepare(p_name,p_mime,p_size,p_purpose)$$;
revoke all on function public.wall_upload_prepare(text,text,integer,text) from public,anon;grant execute on function public.wall_upload_prepare(text,text,integer,text) to authenticated;

revoke all on function politeshik_private.wall_profile_save(jsonb) from public,anon;grant execute on function politeshik_private.wall_profile_save(jsonb) to authenticated;
create function public.wall_profile_save(p_page jsonb) returns jsonb language sql security invoker set search_path='' as $$select politeshik_private.wall_profile_save(p_page)$$;
revoke all on function public.wall_profile_save(jsonb) from public,anon;grant execute on function public.wall_profile_save(jsonb) to authenticated;

revoke all on function politeshik_private.wall_post_save(uuid,text,uuid[]) from public,anon;grant execute on function politeshik_private.wall_post_save(uuid,text,uuid[]) to authenticated;
create function public.wall_post_save(p_id uuid,p_body text,p_photos uuid[] default '{}') returns boolean language sql security invoker set search_path='' as $$select politeshik_private.wall_post_save(p_id,p_body,p_photos)$$;
revoke all on function public.wall_post_save(uuid,text,uuid[]) from public,anon;grant execute on function public.wall_post_save(uuid,text,uuid[]) to authenticated;

revoke all on function politeshik_private.wall_post_action(uuid,text) from public,anon;grant execute on function politeshik_private.wall_post_action(uuid,text) to authenticated;
create function public.wall_post_action(p_id uuid,p_action text) returns boolean language sql security invoker set search_path='' as $$select politeshik_private.wall_post_action(p_id,p_action)$$;
revoke all on function public.wall_post_action(uuid,text) from public,anon;grant execute on function public.wall_post_action(uuid,text) to authenticated;

revoke all on function politeshik_private.wall_post_like(uuid,boolean) from public,anon;grant execute on function politeshik_private.wall_post_like(uuid,boolean) to authenticated;
create function public.wall_post_like(p_id uuid,p_on boolean) returns jsonb language sql security invoker set search_path='' as $$select politeshik_private.wall_post_like(p_id,p_on)$$;
revoke all on function public.wall_post_like(uuid,boolean) from public,anon;grant execute on function public.wall_post_like(uuid,boolean) to authenticated;

revoke all on function politeshik_private.wall_page(uuid,timestamptz,uuid) from public,anon;grant execute on function politeshik_private.wall_page(uuid,timestamptz,uuid) to authenticated;
create function public.wall_page(p_uid uuid,p_before timestamptz default null,p_before_id uuid default null) returns jsonb language sql security invoker set search_path='' as $$select politeshik_private.wall_page(p_uid,p_before,p_before_id)$$;
revoke all on function public.wall_page(uuid,timestamptz,uuid) from public,anon;grant execute on function public.wall_page(uuid,timestamptz,uuid) to authenticated;
