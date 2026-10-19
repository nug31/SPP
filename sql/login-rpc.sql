-- Login langsung via Supabase (tanpa server Express).
-- Jalankan sekali di Supabase SQL Editor.
create extension if not exists pgcrypto;

create or replace function public.login_user(p_email text, p_password text)
returns table (id bigint, name text, email text, role text, kelas text, student_id bigint)
language sql
security definer
set search_path = public, extensions
as $$
    select u.id, u.name, u.email, u.role, u.kelas, u.student_id
    from users u
    where u.email = lower(trim(p_email))
      and u.password_hash = crypt(p_password, u.password_hash);
$$;

grant execute on function public.login_user(text, text) to anon, authenticated;
