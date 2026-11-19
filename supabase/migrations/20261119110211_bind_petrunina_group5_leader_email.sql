-- Bind the already reserved group-5 leader slot to the owner's supplied email.
do $$begin
 if exists(select 1 from politeshik_private.staff_identities where tenant_id='group_5'and rid='g5_r12'and(email<>'petrunina.2002@list.ru'or role<>'admin'))then raise exception 'The leader identity is already bound to another email';end if;
 if exists(select 1 from public.docs p join auth.users u on u.id=(p.data->>'uid')::uuid where p.tenant_id='group_5'and p.path='claims/g5_r12'and lower(u.email)<>'petrunina.2002@list.ru')then raise exception 'Leader slot already claimed by another account';end if;
end $$;
insert into politeshik_private.staff_identities(tenant_id,rid,role,email)values('group_5','g5_r12','admin','petrunina.2002@list.ru')on conflict do nothing;
