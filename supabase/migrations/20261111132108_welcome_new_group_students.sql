-- Future completed registrations only: no backfill or messages to group_1.
create table politeshik_private.registration_welcomes (
  uid uuid primary key references auth.users(id) on delete cascade,
  tenant_id text not null references public.tenants(id) check(tenant_id='group_2'),
  message_id bigint not null unique,
  sender uuid not null references auth.users(id),
  body text not null,
  created_at timestamptz not null default now()
);
alter table politeshik_private.registration_welcomes enable row level security;
revoke all on politeshik_private.registration_welcomes from public,anon,authenticated;
create policy deny_direct_access on politeshik_private.registration_welcomes
  for all using(false) with check(false);

create or replace function public.chat_guard() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if tg_op='INSERT' then
    -- Only a nested server trigger with a private delivery record may author
    -- this exact welcome on Arina's behalf, including for a pending student.
    if pg_trigger_depth()>1 and new.tenant_id='group_2' and new.recipient_role='superadmin'
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

create function politeshik_private.welcome_registered_student() returns trigger
language plpgsql security definer set search_path='' as $$
declare student_uid uuid; arina_uid uuid; message_id bigint;
  welcome_body text:=$welcome$Привеет! Добро пожаловать в «Политешик» 🥑💚

Я Арина, создательница этого приложения. Надеюсь, оно сделает твою учебную жизнь чуточку проще ✨

Этот чат — связь со мной: задавай вопросы, рассказывай об ошибках и делись идеями. Не стесняйся писать, я помогу, как смогу 🫶$welcome$;
begin
  if new.tenant_id<>'group_2' then return new; end if;
  select m.uid into student_uid from public.members m
    join public.roster r on r.tenant_id=m.tenant_id and r.rid=new.data->>'rid' and r.flag=''
    where m.tenant_id='group_2' and m.uid::text=substr(new.path,10)
      and m.requested_role='student' and m.role in ('student','admin','developer')
      and m.status in ('pending','approved');
  if student_uid is null then return new; end if;
  select s.uid into arina_uid from politeshik_private.super_admins s order by s.uid limit 1;
  if arina_uid is null then raise exception 'Не настроен аккаунт Админа Арины'; end if;
  message_id:=nextval('public.chat_id_seq'::regclass);
  insert into politeshik_private.registration_welcomes(uid,tenant_id,message_id,sender,body)
    values(student_uid,'group_2',message_id,arina_uid,welcome_body)
    on conflict(uid) do nothing;
  if not found then return new; end if;
  insert into public.chat(id,tenant_id,thread_uid,sender,kind,body,recipient_role,sender_label,read_by_admin,read_by_student)
    values(message_id,'group_2',student_uid,arina_uid,'text',welcome_body,'superadmin','Админ Арина',true,false);
  return new;
end $$;
revoke all on function politeshik_private.welcome_registered_student() from public,anon,authenticated;
create trigger trg_welcome_registered_student after insert on public.docs
  for each row when(new.tenant_id='group_2' and new.path like 'profiles/%')
  execute function politeshik_private.welcome_registered_student();
