create or replace function public.engefex_birthdays_today()
returns table(employee_name text)
language sql stable security definer set search_path=''
as $$
 select distinct e->>'name'
 from public.engefex_state s
 join public.engefex_members m on m.workspace_id=s.workspace_id and m.user_id=(select auth.uid())
 cross join lateral jsonb_array_elements(coalesce(s.payload->'hrEmployees','[]'::jsonb)) e
 where coalesce(e->>'name','') <> ''
   and coalesce(e->>'birthDate','') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
   and right(e->>'birthDate',5)=to_char((now() at time zone 'America/Sao_Paulo')::date,'MM-DD')
   and coalesce(e->>'employmentStatus','ativo') <> 'inativo'
   and e->>'active' is distinct from 'false'
 order by 1;
$$;
revoke all on function public.engefex_birthdays_today() from public,anon;
grant execute on function public.engefex_birthdays_today() to authenticated;
