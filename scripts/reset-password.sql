-- Reset password user lewat Supabase SQL Editor.
-- Ganti email & password baru di bawah, lalu Run.
-- Hash bcrypt dari pgcrypto kompatibel dengan bcryptjs yang dipakai routes/auth.js.
create extension if not exists pgcrypto;

update users
set password_hash = crypt('PASSWORD_BARU', gen_salt('bf', 10))
where email = 'admin@spp.sch.id';
