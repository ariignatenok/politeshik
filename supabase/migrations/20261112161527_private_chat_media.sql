-- Every attachment belongs to exactly one authorized conversation. No public bucket URLs.
create table politeshik_private.message_uploads(
 id uuid primary key default gen_random_uuid(),owner_uid uuid not null references auth.users(id) on delete cascade,
 peer uuid references auth.users(id) on delete cascade,tenant_id text,thread_uid uuid,recipient_role text,
 name text not null check(char_length(name) between 1 and 200),mime text not null check(char_length(mime) between 1 and 120),
 size integer not null check(size between 1 and 26214400),kind text not null check(kind in('file','photo','video','voice')),
 created_at timestamptz not null default now(),used_at timestamptz,
 check((peer is not null and tenant_id is null and thread_uid is null and recipient_role is null)
  or(peer is null and tenant_id is not null and thread_uid is not null and recipient_role in('admin','developer','superadmin'))));
alter table politeshik_private.message_uploads enable row level security;
revoke all on politeshik_private.message_uploads from public,anon,authenticated;
create policy message_uploads_rpc_only on politeshik_private.message_uploads as restrictive for all to authenticated using(false) with check(false);
create index message_uploads_owner_created on politeshik_private.message_uploads(owner_uid,created_at);
alter table politeshik_private.peer_messages add column attachment jsonb;

create function politeshik_private.prepare_message_upload(p_peer uuid,p_thread uuid,p_role text,p_name text,p_mime text,p_size integer,p_kind text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid();t text:=public.current_tenant();r politeshik_private.message_uploads;begin
 if actor is null or not public.is_member() then raise exception 'Войдите в одобренный аккаунт' using errcode='42501';end if;
 if p_peer is not null then
  perform politeshik_private.social_actor();
  if p_peer=actor or politeshik_private.social_profile(p_peer) is null then raise exception 'Собеседник недоступен' using errcode='42501';end if;
 elsif p_thread is null or p_role is null or p_role not in('admin','developer','superadmin') or not exists(select 1 from public.members where tenant_id=t and uid=p_thread and status='approved')
  or not(p_thread=actor or politeshik_private.is_super_admin() or coalesce(p_role=politeshik_private.support_role(),false)) then
  raise exception 'Нет доступа к этой переписке' using errcode='42501';
 end if;
 if p_size is null or p_size not between 1 and 26214400 or p_kind is null or p_kind not in('file','photo','video','voice') or char_length(coalesce(p_name,'')) not between 1 and 200 or char_length(coalesce(p_mime,'')) not between 1 and 120 then raise exception 'Файл: до 25 МБ';end if;
 if p_kind='photo' and p_mime not in('image/jpeg','image/png','image/webp','image/gif') or p_kind='video' and p_mime not in('video/mp4','video/webm','video/quicktime') or p_kind='voice' and split_part(p_mime,';',1) not in('audio/webm','audio/ogg','audio/mp4','audio/mpeg','audio/wav') then raise exception 'Неподдерживаемый формат';end if;
 if (select count(*) from politeshik_private.message_uploads where owner_uid=actor and created_at>now()-interval '1 hour')>=60 then raise exception 'За час можно прикрепить до 60 файлов';end if;
 insert into politeshik_private.message_uploads(owner_uid,peer,tenant_id,thread_uid,recipient_role,name,mime,size,kind)
 values(actor,p_peer,case when p_peer is null then t end,case when p_peer is null then p_thread end,case when p_peer is null then p_role end,p_name,p_mime,p_size,p_kind) returning * into r;
 return jsonb_build_object('id',r.id,'path',actor::text||'/'||r.id::text);
end $$;

create function politeshik_private.message_object_access(p_path text,p_write boolean default false) returns boolean
language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(select 1 from politeshik_private.message_uploads u
 where u.owner_uid::text||'/'||u.id::text=p_path and exists(select 1 from public.members m where m.uid=auth.uid() and m.status='approved') and
 case when p_write then u.owner_uid=auth.uid() and u.used_at is null and u.created_at>now()-interval '1 hour'
 else u.owner_uid=auth.uid() or(u.used_at is not null and (u.peer=auth.uid() or(u.peer is null and u.tenant_id=public.current_tenant() and (u.thread_uid=auth.uid() or politeshik_private.is_super_admin() or u.recipient_role=politeshik_private.support_role())))) end)
$$;
revoke all on function politeshik_private.message_object_access(text,boolean) from public,anon;
grant execute on function politeshik_private.message_object_access(text,boolean) to authenticated;
insert into storage.buckets(id,name,public,file_size_limit) values('private-messages','private-messages',false,26214400);
create policy private_message_upload on storage.objects for insert to authenticated with check(bucket_id='private-messages' and politeshik_private.message_object_access(name,true));
create policy private_message_read on storage.objects for select to authenticated using(bucket_id='private-messages' and politeshik_private.message_object_access(name,false));
create policy private_message_cleanup on storage.objects for delete to authenticated using(bucket_id='private-messages' and politeshik_private.message_object_access(name,true));

create function politeshik_private.send_message_upload(p_id uuid,p_body text default '') returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid();r politeshik_private.message_uploads;obj storage.objects;attachment jsonb;result jsonb;begin
 if actor is null or not public.is_member() then raise exception 'Войдите в аккаунт' using errcode='42501';end if;
 select * into r from politeshik_private.message_uploads where id=p_id and owner_uid=actor for update;
 if not found then raise exception 'Вложение не найдено' using errcode='42501';end if;
 if r.peer is not null then
  perform politeshik_private.social_actor();if politeshik_private.social_profile(r.peer) is null then raise exception 'Собеседник недоступен';end if;
 elsif r.tenant_id<>public.current_tenant() or not(r.thread_uid=actor or politeshik_private.is_super_admin() or coalesce(r.recipient_role=politeshik_private.support_role(),false)) then raise exception 'Нет доступа к переписке' using errcode='42501';end if;
 if r.used_at is not null then return jsonb_build_object('sent',true);end if;
 if char_length(coalesce(p_body,''))>4000 then raise exception 'Подпись: до 4000 символов';end if;
 select * into obj from storage.objects where bucket_id='private-messages' and name=actor::text||'/'||r.id::text;
 if not found or coalesce((obj.metadata->>'size')::bigint,0)<>r.size or coalesce(obj.metadata->>'mimetype','')<>r.mime then raise exception 'Дождитесь загрузки файла';end if;
 attachment:=jsonb_build_object('path',obj.name,'name',r.name,'size',r.size,'mime',r.mime,'kind',r.kind);
 if r.peer is not null then
  insert into politeshik_private.peer_messages(id,sender,recipient,body,attachment) values(r.id,actor,r.peer,coalesce(nullif(btrim(p_body),''),case r.kind when 'photo' then 'Фото' when 'video' then 'Видео' when 'voice' then 'Голосовое сообщение' else r.name end),attachment);
 else
  insert into public.chat(tenant_id,thread_uid,sender,recipient_role,kind,body,file_path,file_name,file_size,meta)
   values(r.tenant_id,r.thread_uid,actor,r.recipient_role,'text',coalesce(nullif(btrim(p_body),''),case r.kind when 'photo' then 'Фото' when 'video' then 'Видео' when 'voice' then 'Голосовое сообщение' else r.name end),obj.name,r.name,r.size,jsonb_build_object('attachment',attachment));
 end if;
 update politeshik_private.message_uploads set used_at=now() where id=r.id;
 return jsonb_build_object('sent',true);
end $$;

create function politeshik_private.guard_chat_attachment() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if tg_op='UPDATE' and row(new.file_path,new.file_name,new.file_size,new.meta) is distinct from row(old.file_path,old.file_name,old.file_size,old.meta) then raise exception 'Вложение менять нельзя';end if;
 if tg_op='INSERT' and new.file_path is not null and not exists(select 1 from politeshik_private.message_uploads u
  where u.owner_uid=new.sender and u.owner_uid=auth.uid() and u.owner_uid::text||'/'||u.id::text=new.file_path and u.peer is null and u.thread_uid=new.thread_uid and u.tenant_id=new.tenant_id and u.recipient_role=new.recipient_role and u.used_at is null
  and exists(select 1 from storage.objects o where o.bucket_id='private-messages' and o.name=new.file_path)) then raise exception 'Неверное вложение';end if;
 return new;
end $$;
revoke all on function politeshik_private.guard_chat_attachment() from public,anon,authenticated;
create trigger guard_chat_attachment before insert or update on public.chat for each row execute function politeshik_private.guard_chat_attachment();

revoke all on function politeshik_private.prepare_message_upload(uuid,uuid,text,text,text,integer,text) from public,anon;grant execute on function politeshik_private.prepare_message_upload(uuid,uuid,text,text,text,integer,text) to authenticated;
create function public.prepare_message_upload(p_peer uuid,p_thread uuid,p_role text,p_name text,p_mime text,p_size integer,p_kind text) returns jsonb language sql security invoker set search_path='' as $$select politeshik_private.prepare_message_upload(p_peer,p_thread,p_role,p_name,p_mime,p_size,p_kind)$$;
revoke all on function public.prepare_message_upload(uuid,uuid,text,text,text,integer,text) from public,anon;grant execute on function public.prepare_message_upload(uuid,uuid,text,text,text,integer,text) to authenticated;

revoke all on function politeshik_private.send_message_upload(uuid,text) from public,anon;grant execute on function politeshik_private.send_message_upload(uuid,text) to authenticated;
create function public.send_message_upload(p_id uuid,p_body text default '') returns jsonb language sql security invoker set search_path='' as $$select politeshik_private.send_message_upload(p_id,p_body)$$;
revoke all on function public.send_message_upload(uuid,text) from public,anon;grant execute on function public.send_message_upload(uuid,text) to authenticated;
