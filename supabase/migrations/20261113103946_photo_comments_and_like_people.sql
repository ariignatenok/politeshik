-- Reactions expose only existing public social identities. Academic and chat access is unchanged.
create function politeshik_private.reaction_person(p_uid uuid) returns jsonb language sql stable security invoker set search_path='' as $$
 select case when card is null then null else jsonb_build_object('uid',card->'uid','name',card->'name','avatar',card->'avatar','mascot',card->'mascot','group_name',card->'group_name','role',card->'role')end from(select politeshik_private.social_profile(p_uid)card)s
$$;
revoke all on function politeshik_private.reaction_person(uuid) from public,anon,authenticated;

create function politeshik_private.profile_like_people(p_uid uuid,p_kind text,p_after uuid default null) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare actor uuid:=politeshik_private.social_actor();result jsonb;begin
 if p_kind is null or p_kind not in('photo','mascot')then raise exception 'Неверный тип лайка';end if;
 if politeshik_private.social_profile(p_uid) is null then raise exception 'Профиль недоступен' using errcode='42501';end if;
 select coalesce(jsonb_agg(person order by sender),'[]')into result from(
 select l.sender,politeshik_private.reaction_person(l.sender)person from politeshik_private.profile_likes l
 join public.members m on m.uid=l.sender and m.status='approved' and m.role in('student','admin','developer') and coalesce(m.requested_role,'student')<>'parent'
 join auth.users u on u.id=m.uid and u.email_confirmed_at is not null
 where l.target=p_uid and l.kind=p_kind and(p_after is null or l.sender>p_after)order by l.sender limit 51)s;
 return result;
end $$;
revoke all on function politeshik_private.profile_like_people(uuid,text,uuid) from public,anon;grant execute on function politeshik_private.profile_like_people(uuid,text,uuid)to authenticated;
create function public.profile_like_people(p_uid uuid,p_kind text,p_after uuid default null)returns jsonb language sql stable security invoker set search_path='' as $$select politeshik_private.profile_like_people(p_uid,p_kind,p_after)$$;
revoke all on function public.profile_like_people(uuid,text,uuid)from public,anon;grant execute on function public.profile_like_people(uuid,text,uuid)to authenticated;

-- A profile photo changes its discussion when the picture changes; wall photo IDs are immutable.
create function politeshik_private.photo_discussion_target(p_kind text,p_id uuid)returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare owner_id uuid;card jsonb;version text;begin
 if p_kind='profile' then owner_id:=p_id;card:=politeshik_private.social_profile(owner_id);
  if card is null or coalesce(card->>'avatar','')='' then raise exception 'Фотография недоступна'using errcode='42501';end if;
  version:=md5(card->>'avatar');
 elsif p_kind='wall' then
  select w.owner_uid into owner_id from politeshik_private.wall_media w where w.id=p_id and w.purpose='post'
   and exists(select 1 from politeshik_private.wall_posts p where p.owner_uid=w.owner_uid and w.id=any(p.photos));
  if owner_id is null or politeshik_private.social_profile(owner_id)is null then raise exception 'Фотография недоступна'using errcode='42501';end if;
  version:=p_id::text;
 else raise exception 'Неверная фотография';end if;
 return jsonb_build_object('owner',owner_id,'version',version);
end $$;
revoke all on function politeshik_private.photo_discussion_target(text,uuid)from public,anon,authenticated;

create table politeshik_private.photo_comments(
 id uuid primary key,kind text not null check(kind in('profile','wall')),target uuid not null,photo_version text not null,
 owner_uid uuid not null references auth.users(id)on delete cascade,sender uuid not null references auth.users(id)on delete cascade,
 body text not null check(char_length(btrim(body))between 1 and 2000),created_at timestamptz not null default now()
);
create index photo_comments_target_page on politeshik_private.photo_comments(kind,target,photo_version,created_at,id);
create index photo_comments_sender on politeshik_private.photo_comments(sender);
create index photo_comments_owner on politeshik_private.photo_comments(owner_uid);
alter table politeshik_private.photo_comments enable row level security;
revoke all on politeshik_private.photo_comments from public,anon,authenticated;
create policy photo_comments_rpc_only on politeshik_private.photo_comments as restrictive for all to authenticated using(false)with check(false);

create function politeshik_private.photo_comment_list(p_kind text,p_id uuid,p_after timestamptz default null,p_after_id uuid default null)returns jsonb language plpgsql stable security definer set search_path='' as $$
declare actor uuid:=politeshik_private.social_actor();target_data jsonb;result jsonb;begin
 target_data:=politeshik_private.photo_discussion_target(p_kind,p_id);
 if(p_after is null)<>(p_after_id is null)then raise exception 'Неверная страница комментариев';end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',id,'body',body,'created_at',created_at,'person',person,'can_delete',sender=actor or owner_uid=actor or politeshik_private.is_super_admin())order by created_at,id),'[]')into result from(
 select c.*,politeshik_private.reaction_person(c.sender)person from politeshik_private.photo_comments c
 join public.members m on m.uid=c.sender and m.status='approved' and m.role in('student','admin','developer') and coalesce(m.requested_role,'student')<>'parent'
 join auth.users u on u.id=m.uid and u.email_confirmed_at is not null
 where c.kind=p_kind and c.target=p_id and c.photo_version=target_data->>'version'
 and(p_after is null or(c.created_at,c.id)>(p_after,p_after_id))order by c.created_at,c.id limit 51)s;
 return result;
end $$;
revoke all on function politeshik_private.photo_comment_list(text,uuid,timestamptz,uuid)from public,anon;grant execute on function politeshik_private.photo_comment_list(text,uuid,timestamptz,uuid)to authenticated;
create function public.photo_comment_list(p_kind text,p_id uuid,p_after timestamptz default null,p_after_id uuid default null)returns jsonb language sql stable security invoker set search_path='' as $$select politeshik_private.photo_comment_list(p_kind,p_id,p_after,p_after_id)$$;
revoke all on function public.photo_comment_list(text,uuid,timestamptz,uuid)from public,anon;grant execute on function public.photo_comment_list(text,uuid,timestamptz,uuid)to authenticated;

create function politeshik_private.photo_comment_send(p_kind text,p_id uuid,p_body text,p_nonce uuid)returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=politeshik_private.social_actor();target_data jsonb;item politeshik_private.photo_comments;begin
 target_data:=politeshik_private.photo_discussion_target(p_kind,p_id);
 if p_nonce is null or p_body is null or char_length(btrim(p_body))not between 1 and 2000 then raise exception 'Комментарий: от 1 до 2000 символов';end if;
 insert into politeshik_private.photo_comments(id,kind,target,photo_version,owner_uid,sender,body)values(p_nonce,p_kind,p_id,target_data->>'version',(target_data->>'owner')::uuid,actor,btrim(p_body))on conflict(id)do nothing returning * into item;
 if item.id is null then select * into item from politeshik_private.photo_comments where id=p_nonce and kind=p_kind and target=p_id and photo_version=target_data->>'version' and sender=actor and body=btrim(p_body);end if;
 if item.id is null then raise exception 'Неверный идентификатор комментария';end if;
 return jsonb_build_object('id',item.id,'body',item.body,'created_at',item.created_at,'person',politeshik_private.reaction_person(actor),'can_delete',true);
end $$;
revoke all on function politeshik_private.photo_comment_send(text,uuid,text,uuid)from public,anon;grant execute on function politeshik_private.photo_comment_send(text,uuid,text,uuid)to authenticated;
create function public.photo_comment_send(p_kind text,p_id uuid,p_body text,p_nonce uuid)returns jsonb language sql security invoker set search_path='' as $$select politeshik_private.photo_comment_send(p_kind,p_id,p_body,p_nonce)$$;
revoke all on function public.photo_comment_send(text,uuid,text,uuid)from public,anon;grant execute on function public.photo_comment_send(text,uuid,text,uuid)to authenticated;

create function politeshik_private.photo_comment_delete(p_id uuid)returns boolean language plpgsql security definer set search_path='' as $$
declare actor uuid:=politeshik_private.social_actor();item politeshik_private.photo_comments;begin
 select * into item from politeshik_private.photo_comments where id=p_id;
 if item.id is null then return true;end if;
 if actor<>item.sender and actor<>item.owner_uid and not politeshik_private.is_super_admin()then raise exception 'Можно удалить свой комментарий или комментарий под своим фото'using errcode='42501';end if;
 perform politeshik_private.photo_discussion_target(item.kind,item.target);
 delete from politeshik_private.photo_comments where id=p_id;return true;
end $$;
revoke all on function politeshik_private.photo_comment_delete(uuid)from public,anon;grant execute on function politeshik_private.photo_comment_delete(uuid)to authenticated;
create function public.photo_comment_delete(p_id uuid)returns boolean language sql security invoker set search_path='' as $$select politeshik_private.photo_comment_delete(p_id)$$;
revoke all on function public.photo_comment_delete(uuid)from public,anon;grant execute on function public.photo_comment_delete(uuid)to authenticated;
