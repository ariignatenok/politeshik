-- Large portraits live in private Storage; lists retain small thumbnails.
create table politeshik_private.profile_photo_files(
 id uuid primary key default gen_random_uuid(),uid uuid not null references auth.users(id)on delete cascade,
 bytes integer not null check(bytes between 1 and 3145728),thumbnail_hash text,active boolean not null default false,created_at timestamptz not null default now()
);
create index profile_photo_files_owner on politeshik_private.profile_photo_files(uid,created_at);
create unique index profile_photo_one_active on politeshik_private.profile_photo_files(uid)where active;
alter table politeshik_private.profile_photo_files enable row level security;
revoke all on politeshik_private.profile_photo_files from public,anon,authenticated;
create policy photo_files_rpc_only on politeshik_private.profile_photo_files as restrictive for all to authenticated using(false)with check(false);
create function politeshik_private.portrait_actor()returns uuid language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid()is null or not exists(select 1 from public.members m join auth.users u on u.id=m.uid where m.uid=auth.uid()and m.status='approved'and m.role in('student','admin','developer','teacher','curator')and coalesce(m.requested_role,'student')<>'parent'and u.email_confirmed_at is not null)then raise exception 'Фото доступно после подтверждения регистрации'using errcode='42501';end if;return auth.uid();
end $$;
revoke all on function politeshik_private.portrait_actor()from public,anon,authenticated;
create function politeshik_private.portrait_access(p_path text,p_write boolean default false)returns boolean language plpgsql stable security definer set search_path='' as $$
declare actor uuid;begin
 actor:=politeshik_private.portrait_actor();
 return exists(select 1 from politeshik_private.profile_photo_files f join public.members m on m.uid=f.uid and m.status='approved'
 join auth.users u on u.id=m.uid and u.email_confirmed_at is not null
 left join public.docs a on a.tenant_id=m.tenant_id and a.path='avatars/'||f.uid::text
 where f.uid::text||'/'||f.id::text=p_path and case when p_write then f.uid=actor and not f.active else f.uid=actor or f.active and f.thumbnail_hash=md5(coalesce(a.data->>'v',''))and m.role in('student','admin','developer','teacher','curator')and coalesce(m.requested_role,'student')<>'parent'end);
end $$;
revoke all on function politeshik_private.portrait_access(text,boolean)from public,anon;grant execute on function politeshik_private.portrait_access(text,boolean)to authenticated;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)values('profile-portraits','profile-portraits',false,3145728,array['image/jpeg']);
create policy portrait_upload on storage.objects for insert to authenticated with check(bucket_id='profile-portraits'and politeshik_private.portrait_access(name,true));
create policy portrait_read on storage.objects for select to authenticated using(bucket_id='profile-portraits'and politeshik_private.portrait_access(name,false));
create policy portrait_remove_draft on storage.objects for delete to authenticated using(bucket_id='profile-portraits'and politeshik_private.portrait_access(name,true));
create function politeshik_private.profile_photo_prepare(p_bytes integer)returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=politeshik_private.portrait_actor();id uuid;begin
 if p_bytes is null or p_bytes not between 1 and 3145728 then raise exception 'Фотография должна быть до 3 МБ';end if;
 if(select count(*)from politeshik_private.profile_photo_files where uid=actor and created_at>now()-interval '1 hour')>=20 then raise exception 'Слишком много загрузок. Попробуйте через час';end if;
 insert into politeshik_private.profile_photo_files(uid,bytes)values(actor,p_bytes)returning profile_photo_files.id into id;
 return jsonb_build_object('id',id,'path',actor::text||'/'||id::text);
end $$;
revoke all on function politeshik_private.profile_photo_prepare(integer)from public,anon;grant execute on function politeshik_private.profile_photo_prepare(integer)to authenticated;
create function public.profile_photo_prepare(p_bytes integer)returns jsonb language sql security invoker set search_path='' as $$select politeshik_private.profile_photo_prepare(p_bytes)$$;
revoke all on function public.profile_photo_prepare(integer)from public,anon;grant execute on function public.profile_photo_prepare(integer)to authenticated;
create function politeshik_private.profile_photo_publish(p_id uuid,p_thumbnail text)returns boolean language plpgsql security definer set search_path='' as $$
declare actor uuid:=politeshik_private.portrait_actor();item politeshik_private.profile_photo_files;begin
 perform pg_advisory_xact_lock(hashtextextended('portrait:'||actor::text,0));
 select * into item from politeshik_private.profile_photo_files where id=p_id and uid=actor for update;
 if not found or not exists(select 1 from storage.objects where bucket_id='profile-portraits'and name=actor::text||'/'||p_id::text and(metadata->>'size')::bigint=item.bytes and metadata->>'mimetype'='image/jpeg')then raise exception 'Дождитесь загрузки своей фотографии';end if;
 if p_thumbnail is null or p_thumbnail not like 'data:image/jpeg;base64,%'then raise exception 'Неверное превью';end if;
 perform politeshik_private.save_my_avatar(p_thumbnail);
 update politeshik_private.profile_photo_files set active=false where uid=actor and active and id<>p_id;
 update politeshik_private.profile_photo_files set active=true,thumbnail_hash=md5(p_thumbnail)where id=p_id;
 return true;
end $$;
revoke all on function politeshik_private.profile_photo_publish(uuid,text)from public,anon;grant execute on function politeshik_private.profile_photo_publish(uuid,text)to authenticated;
create function public.profile_photo_publish(p_id uuid,p_thumbnail text)returns boolean language sql security invoker set search_path='' as $$select politeshik_private.profile_photo_publish(p_id,p_thumbnail)$$;
revoke all on function public.profile_photo_publish(uuid,text)from public,anon;grant execute on function public.profile_photo_publish(uuid,text)to authenticated;
create function politeshik_private.profile_photo(p_uid uuid)returns jsonb language plpgsql stable security definer set search_path='' as $$
declare actor uuid:=politeshik_private.portrait_actor();result jsonb;begin
 select jsonb_build_object('id',f.id,'path',f.uid::text||'/'||f.id::text,'bytes',f.bytes)into result
 from politeshik_private.profile_photo_files f join public.members m on m.uid=f.uid and m.status='approved'and m.role in('student','admin','developer','teacher','curator')and coalesce(m.requested_role,'student')<>'parent'
 join auth.users u on u.id=m.uid and u.email_confirmed_at is not null
 join public.docs a on a.tenant_id=m.tenant_id and a.path='avatars/'||m.uid::text and md5(coalesce(a.data->>'v',''))=f.thumbnail_hash
 where f.uid=p_uid and f.active;return result;
end $$;
revoke all on function politeshik_private.profile_photo(uuid)from public,anon;grant execute on function politeshik_private.profile_photo(uuid)to authenticated;
create function public.profile_photo(p_uid uuid)returns jsonb language sql stable security invoker set search_path='' as $$select politeshik_private.profile_photo(p_uid)$$;
revoke all on function public.profile_photo(uuid)from public,anon;grant execute on function public.profile_photo(uuid)to authenticated;

-- Registration status and appearance only. Never Auth email, student records or faculty claims.
create function politeshik_private.faculty_public_profiles()returns jsonb language plpgsql stable security definer set search_path='' as $$
declare actor uuid:=politeshik_private.portrait_actor();result jsonb;begin
 select coalesce(jsonb_agg(jsonb_build_object('uid',m.uid,'name',m.full_name,'role',m.role,'avatar',coalesce(a.data->>'v',''),'mascot',coalesce(a.data->'mascot',p.data->'mascot','{}'))order by m.full_name,m.uid),'[]')into result
 from public.members m join auth.users u on u.id=m.uid and u.email_confirmed_at is not null
 left join public.docs a on a.tenant_id=m.tenant_id and a.path='avatars/'||m.uid::text
 left join public.docs p on p.tenant_id=m.tenant_id and p.path='profiles/'||m.uid::text
 where m.status='approved'and coalesce(m.requested_role,'student')<>'parent'and(
 m.role='teacher'and exists(select 1 from politeshik_private.faculty_claims c where c.uid=m.uid and c.status='approved')
 or m.role='curator'and exists(select 1 from politeshik_private.curator_accounts c where c.claimed_uid=m.uid and c.active));
 return result;
end $$;
revoke all on function politeshik_private.faculty_public_profiles()from public,anon;grant execute on function politeshik_private.faculty_public_profiles()to authenticated;
create function public.faculty_public_profiles()returns jsonb language sql stable security invoker set search_path='' as $$select politeshik_private.faculty_public_profiles()$$;
revoke all on function public.faculty_public_profiles()from public,anon;grant execute on function public.faculty_public_profiles()to authenticated;
