-- ============================================================
-- SPP Portal — Supabase Migration
-- Jalankan SQL ini di Supabase SQL Editor
-- ============================================================

-- 1. Tambah kolom kelas ke tabel students (jika belum ada)
ALTER TABLE students ADD COLUMN IF NOT EXISTS kelas TEXT DEFAULT 'X TKR 2';

-- 2. Tabel users untuk sistem role
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT CHECK (role IN ('admin', 'bendahara', 'wali_kelas', 'orang_tua')) NOT NULL,
    kelas TEXT,              -- untuk wali_kelas (kelas yang diampu)
    student_id INTEGER REFERENCES students(id) ON DELETE SET NULL,  -- untuk orang_tua
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Tabel notifications untuk real-time
CREATE TABLE IF NOT EXISTS notifications (
    id SERIAL PRIMARY KEY,
    type TEXT NOT NULL,      -- 'upload', 'approved', 'rejected'
    student_id INTEGER REFERENCES students(id) ON DELETE CASCADE,
    payment_id INTEGER,      -- referensi ke payments.id
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    target_role TEXT,        -- role mana yang harus menerima notifikasi ini
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Seed: Akun admin default (password: admin123)
-- Ganti password_hash dengan hash bcrypt yang benar setelah setup
INSERT INTO users (name, email, password_hash, role)
VALUES
    ('Administrator', 'admin@spp.sch.id', '$2b$10$placeholder_hash_admin', 'admin'),
    ('Bendahara', 'bendahara@spp.sch.id', '$2b$10$placeholder_hash_bend', 'bendahara')
ON CONFLICT (email) DO NOTHING;

-- Catatan: Jalankan node scripts/seed-admin.js untuk membuat hash password yang benar
