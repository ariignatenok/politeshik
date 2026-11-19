-- Media belongs to an already-authorized work conversation. No academic or general staff privileges change.
alter table politeshik_private.leader_chat_messages add column attachment jsonb;
alter table politeshik_private.development_chat_messages add column attachment jsonb;
alter table politeshik_private.group_room_messages add column attachment jsonb;
alter table politeshik_private.curator_messages add column attachment jsonb;
create function politeshik_private.work_chat_allowed(p_kind text,p_tenant text default null,p_peer uuid default null)returns boolean language sql stable security definer set search_path=''as $$
 select auth.uid()is not null and case p_kind
 when'leaders'then p_tenant is null and p_peer is null and exists(select 1 from politeshik_private.leader_chat_members()m where m.uid=auth.uid())
 when'development'then p_tenant is null and p_peer is null and exists(select 1 from politeshik_private.development_chat_members()m where m.uid=auth.uid())
 when'group'then p_peer is null and politeshik_private.group_room_allowed(p_tenant)
 when'curator'then exists(select 1 from politeshik_private.curator_chat_pairs()p where p.tenant_id=p_tenant and((p.curator_uid=auth.uid()and p.leader_uid=p_peer)or(p.leader_uid=auth.uid()and p.curator_uid=p_peer)))
 else false end
$$;
revoke all on function politeshik_private.work_chat_allowed(text,text,uuid)from public,anon,authenticated;
create table politeshik_private.work_chat_uploads(
 id uuid primary key default gen_random_uuid(),owner_uid uuid not null references auth.users(id)on delete cascade,
 kind text not null check(kind in('leaders','development','group','curator')),tenant_id text,peer uuid references auth.users(id)on delete cascade,
 name text not null check(char_length(name)between 1 and 200),mime text not null check(char_length(mime)between 1 and 120),
 size integer not null check(size between 1 and 26214400),media_kind text not null check(media_kind in('photo','video','voice','file')),
 created_at timestamptz not null default now(),used_at timestamptz,
 check((kind in('leaders','development')and tenant_id is null and peer is null)or(kind='group'and tenant_id is not null and peer is null)or(kind='curator'and tenant_id is not null and peer is not null)));
create index work_chat_uploads_owner_created on politeshik_private.work_chat_uploads(owner_uid,created_at);
create index work_chat_uploads_peer on politeshik_private.work_chat_uploads(peer)where peer is not null;
alter table politeshik_private.work_chat_uploads enable row level security;
revoke all on politeshik_private.work_chat_uploads from public,anon,authenticated;
create policy work_chat_uploads_private on politeshik_private.work_chat_uploads for all to public using(false)with check(false);
create function politeshik_private.work_chat_object_access(p_path text,p_write boolean default false)returns boolean language sql stable security definer set search_path=''as $$
 select auth.uid()is not null and exists(select 1 from politeshik_private.work_chat_uploads u
 where u.owner_uid::text||'/'||u.id::text=p_path
 and case when u.kind='curator'then
  -- For the recipient, the other participant is the upload owner, not u.peer (the recipient itself).
  (auth.uid()=u.owner_uid and politeshik_private.work_chat_allowed(u.kind,u.tenant_id,u.peer))or(auth.uid()=u.peer and politeshik_private.work_chat_allowed(u.kind,u.tenant_id,u.owner_uid))
 else politeshik_private.work_chat_allowed(u.kind,u.tenant_id,u.peer)end
 and case when p_write then u.owner_uid=auth.uid()and u.used_at is null and u.created_at>now()-interval'1 hour'
 else u.used_at is not null or u.owner_uid=auth.uid()and u.created_at>now()-interval'1 hour'end)
$$;
revoke all on function politeshik_private.work_chat_object_access(text,boolean)from public,anon;
grant execute on function politeshik_private.work_chat_object_access(text,boolean)to authenticated;
create policy work_chat_object_upload on storage.objects for insert to authenticated with check(bucket_id='private-messages'and politeshik_private.work_chat_object_access(name,true));
create policy work_chat_object_read on storage.objects for select to authenticated using(bucket_id='private-messages'and politeshik_private.work_chat_object_access(name,false));
create policy work_chat_object_cleanup on storage.objects for delete to authenticated using(bucket_id='private-messages'and politeshik_private.work_chat_object_access(name,true));

create function politeshik_private.prepare_work_chat_upload(p_kind text,p_tenant text,p_peer uuid,p_name text,p_mime text,p_size integer,p_media_kind text)returns jsonb language plpgsql security definer set search_path=''as $$
declare r politeshik_private.work_chat_uploads;begin
 if not coalesce(politeshik_private.work_chat_allowed(p_kind,p_tenant,p_peer),false)then raise exception 'Нет доступа к этому чату'using errcode='42501';end if;
 if p_size is null or p_size not between 1 and 26214400 or p_media_kind is null or p_media_kind not in('file','photo','video','voice')or char_length(coalesce(p_name,''))not between 1 and 200 or char_length(coalesce(p_mime,''))not between 1 and 120 then raise exception 'Файл: до 25 МБ';end if;
 if p_media_kind='photo'and p_mime not in('image/jpeg','image/png','image/webp','image/gif')or p_media_kind='video'and p_mime not in('video/mp4','video/webm','video/quicktime')or p_media_kind='voice'and p_mime not in('audio/webm','audio/ogg','audio/mp4','audio/mpeg','audio/wav')then raise exception 'Неподдерживаемый формат';end if;
 if(select count(*)from politeshik_private.work_chat_uploads where owner_uid=auth.uid()and created_at>now()-interval'1 hour')>=60 then raise exception 'За час можно прикрепить до 60 файлов';end if;
 insert into politeshik_private.work_chat_uploads(owner_uid,kind,tenant_id,peer,name,mime,size,media_kind)values(auth.uid(),p_kind,p_tenant,p_peer,p_name,p_mime,p_size,p_media_kind)returning * into r;
 return jsonb_build_object('id',r.id,'path',r.owner_uid::text||'/'||r.id::text);
end $$;
create function public.prepare_work_chat_upload(p_kind text,p_tenant text,p_peer uuid,p_name text,p_mime text,p_size integer,p_media_kind text)returns jsonb language sql security invoker set search_path=''as $$select politeshik_private.prepare_work_chat_upload(p_kind,p_tenant,p_peer,p_name,p_mime,p_size,p_media_kind)$$;
create function politeshik_private.send_work_chat_upload(p_id uuid,p_body text default '')returns jsonb language plpgsql security definer set search_path=''as $$
declare r politeshik_private.work_chat_uploads;obj storage.objects;a jsonb;body text;result jsonb;begin
 select * into r from politeshik_private.work_chat_uploads where id=p_id and owner_uid=auth.uid()for update;
 if not found or not coalesce(politeshik_private.work_chat_allowed(r.kind,r.tenant_id,r.peer),false)then raise exception 'Нет доступа к вложению'using errcode='42501';end if;
 if r.used_at is not null then return jsonb_build_object('sent',true,'id',r.id);end if;
 if r.created_at<now()-interval'1 hour'then raise exception 'Время загрузки истекло. Выберите файл заново';end if;
 if char_length(coalesce(p_body,''))>4000 then raise exception 'Подпись: до 4000 символов';end if;
 select * into obj from storage.objects where bucket_id='private-messages'and name=r.owner_uid::text||'/'||r.id::text;
 if not found or coalesce((obj.metadata->>'size')::bigint,0)<>r.size or coalesce(obj.metadata->>'mimetype','')<>r.mime then raise exception 'Дождитесь загрузки файла';end if;
 a:=jsonb_build_object('path',obj.name,'name',r.name,'mime',r.mime,'size',r.size,'kind',r.media_kind);
 body:=coalesce(nullif(trim(p_body),''),case r.media_kind when'photo'then'Фото'when'video'then'Видео'when'voice'then'Голосовое сообщение'else r.name end);
 case r.kind
 when'leaders'then perform politeshik_private.leader_chat_send(body,r.id);update politeshik_private.leader_chat_messages set attachment=a where id=r.id and sender=auth.uid();
 when'development'then perform politeshik_private.development_chat_send(body,r.id);update politeshik_private.development_chat_messages set attachment=a where id=r.id and sender=auth.uid();
 when'group'then perform politeshik_private.group_room_send(r.tenant_id,body,r.id);update politeshik_private.group_room_messages set attachment=a where id=r.id and sender=auth.uid()and tenant_id=r.tenant_id;
 when'curator'then perform politeshik_private.curator_chat_send(r.tenant_id,r.peer,body,r.id);update politeshik_private.curator_messages set attachment=a where id=r.id and sender=auth.uid()and recipient=r.peer and tenant_id=r.tenant_id;
 end case;
 update politeshik_private.work_chat_uploads set used_at=now()where id=r.id;return jsonb_build_object('sent',true,'id',r.id);
end $$;
create function public.send_work_chat_upload(p_id uuid,p_body text default '')returns jsonb language sql security invoker set search_path=''as $$select politeshik_private.send_work_chat_upload(p_id,p_body)$$;

-- A normalized read projection used only after the conversation authorization check.
create function politeshik_private.work_chat_projection(p_kind text,p_tenant text,p_peer uuid)returns table(id uuid,sender uuid,body text,created_at timestamptz,attachment jsonb)language sql stable security definer set search_path=''as $$
 select id,sender,body,created_at,attachment from politeshik_private.leader_chat_messages where p_kind='leaders'
 union all select id,sender,body,created_at,attachment from politeshik_private.development_chat_messages where p_kind='development'
 union all select id,sender,body,created_at,attachment from politeshik_private.group_room_messages where p_kind='group'and tenant_id=p_tenant
 union all select id,sender,body,created_at,attachment from politeshik_private.curator_messages where p_kind='curator'and tenant_id=p_tenant and((sender=auth.uid()and recipient=p_peer)or(sender=p_peer and recipient=auth.uid()))
$$;
revoke all on function politeshik_private.work_chat_projection(text,text,uuid)from public,anon,authenticated;
create function politeshik_private.work_chat_info(p_kind text,p_tenant text default null,p_peer uuid default null)returns jsonb language plpgsql stable security definer set search_path=''as $$
declare result jsonb;members jsonb;title text;begin
 if not coalesce(politeshik_private.work_chat_allowed(p_kind,p_tenant,p_peer),false)then raise exception 'Нет доступа к этому чату'using errcode='42501';end if;
 if p_kind in('leaders','development')then
  if p_kind='leaders'then
   select coalesce(jsonb_agg(jsonb_build_object('uid',x.uid,'name',x.name,'role',x.role,'group_name',x.group_name,'avatar',coalesce(a.data->>'v',''),'mascot',coalesce(a.data->'mascot',p.data->'mascot','{}'))order by x.role='superadmin'desc,x.role='admin'desc,x.name),'[]')into members
   from politeshik_private.leader_chat_members()x left join public.members m on m.uid=x.uid left join public.docs a on a.tenant_id=m.tenant_id and a.path='avatars/'||x.uid::text left join public.docs p on p.tenant_id=m.tenant_id and p.path='profiles/'||x.uid::text;
   title:='Старосты и замы';
  else
   select coalesce(jsonb_agg(jsonb_build_object('uid',x.uid,'name',x.name,'role',x.role,'group_name',x.group_name,'avatar',coalesce(a.data->>'v',pd.profile->>'avatar',''),'mascot',coalesce(a.data->'mascot',p.data->'mascot',pd.profile->'mascot','{}'))order by x.role='superadmin'desc,x.name),'[]')into members
   from politeshik_private.development_chat_members()x left join public.members m on m.uid=x.uid left join politeshik_private.platform_developers pd on pd.uid=x.uid left join public.docs a on a.tenant_id=m.tenant_id and a.path='avatars/'||x.uid::text left join public.docs p on p.tenant_id=m.tenant_id and p.path='profiles/'||x.uid::text;
   title:='Разработка';
  end if;
 else
  select coalesce(jsonb_agg(jsonb_build_object('uid',m.uid,'name',case when sa.uid is not null then'Админ Арина'else m.full_name end,'role',case when sa.uid is not null then'superadmin'when politeshik_private.is_deputy(m.uid)then'deputy'else m.role end,
  'group_name',coalesce(g.name,m.tenant_id),'avatar',coalesce(a.data->>'v',''),'mascot',coalesce(a.data->'mascot',p.data->'mascot','{}'))order by sa.uid is not null desc,m.role='curator'desc,m.role='admin'desc,m.full_name),'[]')into members
  from public.members m join auth.users u on u.id=m.uid and u.email_confirmed_at is not null
  left join politeshik_private.super_admins sa on sa.uid=m.uid left join public.groups g on g.id=m.group_id and g.tenant_id=m.tenant_id
  left join public.docs a on a.tenant_id=m.tenant_id and a.path='avatars/'||m.uid::text left join public.docs p on p.tenant_id=m.tenant_id and p.path='profiles/'||m.uid::text
  where m.status='approved'and case when p_kind='curator'then m.uid in(auth.uid(),p_peer)else
   sa.uid is not null or(m.tenant_id=p_tenant and m.role in('student','admin','developer')and coalesce(m.requested_role,'student')<>'parent')or(m.role='curator'and exists(select 1 from politeshik_private.curator_accounts c join politeshik_private.curator_group_scopes s on s.curator_id=c.id where c.claimed_uid=m.uid and c.active and s.tenant_id=p_tenant))end;
  title:=case when p_kind='group'then coalesce((select name from public.groups where tenant_id=p_tenant limit 1),'Чат группы')else'Чат с куратором'end;
 end if;
 return jsonb_build_object('title',title,'participants',members,'counts',jsonb_build_object('media',(select count(*)from politeshik_private.work_chat_projection(p_kind,p_tenant,p_peer)where attachment->>'kind'in('photo','video')),
 'voice',(select count(*)from politeshik_private.work_chat_projection(p_kind,p_tenant,p_peer)where attachment->>'kind'='voice'),
 'files',(select count(*)from politeshik_private.work_chat_projection(p_kind,p_tenant,p_peer)where attachment->>'kind'='file'),
 'links',(select count(*)from politeshik_private.work_chat_projection(p_kind,p_tenant,p_peer)where body~*'https?://')));
end $$;
create function public.work_chat_info(p_kind text,p_tenant text default null,p_peer uuid default null)returns jsonb language sql stable security invoker set search_path=''as $$select politeshik_private.work_chat_info(p_kind,p_tenant,p_peer)$$;
create function politeshik_private.work_chat_gallery(p_kind text,p_tenant text,p_peer uuid,p_tab text,p_before jsonb default null)returns jsonb language plpgsql stable security definer set search_path=''as $$
declare result jsonb;begin
 if not coalesce(politeshik_private.work_chat_allowed(p_kind,p_tenant,p_peer),false)then raise exception 'Нет доступа к этому чату'using errcode='42501';end if;
 if p_tab is null or p_tab not in('media','voice','files','links')then raise exception 'Неизвестный раздел';end if;
 select coalesce(jsonb_agg(to_jsonb(q)order by created_at desc,id desc),'[]')into result from(
 select * from politeshik_private.work_chat_projection(p_kind,p_tenant,p_peer)
 where(p_before is null or(created_at,id)<((p_before->>'at')::timestamptz,(p_before->>'id')::uuid))
 and case p_tab when'media'then attachment->>'kind'in('photo','video')when'voice'then attachment->>'kind'='voice'when'files'then attachment->>'kind'='file'else body~*'https?://'end
 order by created_at desc,id desc limit 50)q;return result;
end $$;
create function public.work_chat_gallery(p_kind text,p_tenant text,p_peer uuid,p_tab text,p_before jsonb default null)returns jsonb language sql stable security invoker set search_path=''as $$select politeshik_private.work_chat_gallery(p_kind,p_tenant,p_peer,p_tab,p_before)$$;
revoke all on function politeshik_private.prepare_work_chat_upload(text,text,uuid,text,text,integer,text),public.prepare_work_chat_upload(text,text,uuid,text,text,integer,text),politeshik_private.send_work_chat_upload(uuid,text),public.send_work_chat_upload(uuid,text),politeshik_private.work_chat_info(text,text,uuid),public.work_chat_info(text,text,uuid),politeshik_private.work_chat_gallery(text,text,uuid,text,jsonb),public.work_chat_gallery(text,text,uuid,text,jsonb)from public,anon;
grant execute on function politeshik_private.prepare_work_chat_upload(text,text,uuid,text,text,integer,text),public.prepare_work_chat_upload(text,text,uuid,text,text,integer,text),politeshik_private.send_work_chat_upload(uuid,text),public.send_work_chat_upload(uuid,text),politeshik_private.work_chat_info(text,text,uuid),public.work_chat_info(text,text,uuid),politeshik_private.work_chat_gallery(text,text,uuid,text,jsonb),public.work_chat_gallery(text,text,uuid,text,jsonb)to authenticated;
-- Existing text/read receipts and authorization remain intact; add only the persisted attachment to their output.
do $outer$declare signature text;definition text;needle text:='''body'',q.body,';begin
 foreach signature in array array['leader_chat_messages(bigint)','development_chat_messages(bigint)','group_room_messages(text,timestamp with time zone)']loop
 select pg_get_functiondef(('politeshik_private.'||signature)::regprocedure)into definition;
 if position(needle in definition)=0 then raise exception 'Unexpected message projection: %',signature;end if;
 execute replace(definition,needle,needle||'''attachment'',q.attachment,');
 end loop;
end $outer$;
