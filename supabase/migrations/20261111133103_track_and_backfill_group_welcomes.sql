-- One private sender used by both future registrations and this one-time backfill.
create or replace function public.chat_guard() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if tg_op='INSERT' then
    -- Only an exact private delivery record may authorize
    -- this exact welcome on Arina's behalf, including for a pending student.
    if new.tenant_id='group_2' and new.recipient_role='superadmin'
      and new.kind='text' and new.file_path is null and exists(
        select 1 from politeshik_private.registration_welcomes w
        where w.uid=new.thread_uid and w.tenant_id=new.tenant_id and w.message_id=new.id
          and w.sender=new.sender and w.body=new.body) then
      new.sender_label:='Админ Арина';
      return new;
    end if;
    new.sender_label:=case when politeshik_private.is_super_admin() then 'Админ Арина'
      else coalesce((select m.full_name from public.members m where m.uid=auth.uid() and m.tenant_id=new.tenant_id),'Поддержка') end;
    if not exists(select 1 from public.members m where m.uid=new.thread_uid and m.tenant_id=new.tenant_id and m.status='approved') then
      raise exception 'Собеседник не принадлежит группе'; end if;
  else
    if row(new.id,new.tenant_id,new.thread_uid,new.sender,new.kind,new.body,new.created_at,new.recipient_role,new.sender_label)
      is distinct from row(old.id,old.tenant_id,old.thread_uid,old.sender,old.kind,old.body,old.created_at,old.recipient_role,old.sender_label) then
      raise exception 'Содержимое сообщения менять нельзя'; end if;
    if auth.uid()=old.thread_uid then
      if new.read_by_admin<>old.read_by_admin then raise exception 'Нет прав на отметку прочтения'; end if;
    elsif new.read_by_student<>old.read_by_student then raise exception 'Нет прав на отметку прочтения'; end if;
  end if;
  return new;
end $$;

create function politeshik_private.send_student_welcome(p_uid uuid) returns void
language plpgsql security definer set search_path='' as $$
declare arina_uid uuid; message_id bigint;
  welcome_body text:=$welcome$Привеет! Добро пожаловать в «Политешик» 🥑💚

Я Арина, создательница этого приложения. Надеюсь, оно сделает твою учебную жизнь чуточку проще ✨

Этот чат — связь со мной: задавай вопросы, рассказывай об ошибках и делись идеями. Не стесняйся писать, я помогу, как смогу 🫶$welcome$;
begin
  if not exists(select 1 from public.members m
    join public.docs d on d.tenant_id=m.tenant_id and d.path='profiles/'||m.uid::text
    join public.roster r on r.tenant_id=m.tenant_id and r.rid=d.data->>'rid' and r.flag=''
    where m.uid=p_uid and m.tenant_id='group_2' and m.role='student' and m.requested_role='student'
      and m.status in('pending','approved') and r.rid not in('g2_r12','g2_r13')) then return; end if;
  select uid into arina_uid from politeshik_private.super_admins order by uid limit 1;
  if arina_uid is null then raise exception 'Не настроен аккаунт Админа Арины'; end if;
  message_id:=nextval('public.chat_id_seq'::regclass);
  insert into politeshik_private.registration_welcomes(uid,tenant_id,message_id,sender,body)
    values(p_uid,'group_2',message_id,arina_uid,welcome_body) on conflict(uid) do nothing;
  if not found then return; end if;
  insert into public.chat(id,tenant_id,thread_uid,sender,kind,body,recipient_role,sender_label,read_by_admin,read_by_student)
    values(message_id,'group_2',p_uid,arina_uid,'text',welcome_body,'superadmin','Админ Арина',true,false);
end $$;
revoke all on function politeshik_private.send_student_welcome(uuid) from public,anon,authenticated;

create or replace function politeshik_private.welcome_registered_student() returns trigger
language plpgsql security definer set search_path='' as $$
declare target uuid;
begin
  if new.tenant_id='group_2' then
    select m.uid into target from public.members m where m.uid::text=substr(new.path,10) and m.tenant_id='group_2';
    if target is not null then perform politeshik_private.send_student_welcome(target); end if;
  end if;
  return new;
end $$;

create function politeshik_private.welcome_recipients() returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
  if auth.uid() is null or not politeshik_private.is_super_admin() then
    raise exception 'Список рассылки доступен только Админу Арине' using errcode='42501'; end if;
  if public.current_tenant()<>'group_2' then return '[]'::jsonb; end if;
  return coalesce((select jsonb_agg(jsonb_build_object(
    'uid',m.uid,'name',coalesce(nullif(d.data->>'name',''),m.full_name),'registered_at',m.created_at,
    'sent_at',w.created_at,'read_by_student',coalesce(c.read_by_student,false),
    'status',case when w.uid is null then 'not_sent' when c.read_by_student then 'read' else 'sent' end
  ) order by r.n,m.uid)
    from public.members m
    join public.docs d on d.tenant_id=m.tenant_id and d.path='profiles/'||m.uid::text
    join public.roster r on r.tenant_id=m.tenant_id and r.rid=d.data->>'rid' and r.flag=''
    left join politeshik_private.registration_welcomes w on w.uid=m.uid and w.tenant_id=m.tenant_id
    left join public.chat c on c.id=w.message_id and c.tenant_id=m.tenant_id
    where m.tenant_id='group_2' and m.role='student' and m.requested_role='student'
      and m.status in('pending','approved') and r.rid not in('g2_r12','g2_r13')),'[]'::jsonb);
end $$;
revoke all on function politeshik_private.welcome_recipients() from public,anon,authenticated;
grant execute on function politeshik_private.welcome_recipients() to authenticated;
create function public.welcome_recipients() returns jsonb language sql security invoker set search_path=''
  as $$ select politeshik_private.welcome_recipients() $$;
revoke all on function public.welcome_recipients() from public,anon;
grant execute on function public.welcome_recipients() to authenticated;

-- Existing ordinary students are included; the delivery marker prevents duplicates.
do $$ declare student record; begin
  for student in select uid from public.members where tenant_id='group_2' and role='student'
    and requested_role='student' and status in('pending','approved') loop
    perform politeshik_private.send_student_welcome(student.uid);
  end loop;
end $$;
