/**
 * Seed Admin — Jalankan sekali untuk buat akun admin & bendahara di Supabase
 * Usage: node scripts/seed-admin.js
 */
require('dotenv').config();
const bcrypt = require('bcryptjs');
const supabase = require('../database');

const users = [
    { name: 'Administrator', email: 'admin@spp.sch.id', password: 'admin123', role: 'admin', kelas: null },
    { name: 'Bendahara', email: 'bendahara@spp.sch.id', password: 'bendahara123', role: 'bendahara', kelas: null },
    { name: 'Wali Kelas X TKR 2', email: 'walikelas@spp.sch.id', password: 'walikelas123', role: 'wali_kelas', kelas: 'X TKR 2' },
];

(async () => {
    for (const u of users) {
        const hash = await bcrypt.hash(u.password, 10);
        const { error } = await supabase
            .from('users')
            .upsert([{ name: u.name, email: u.email, password_hash: hash, role: u.role, kelas: u.kelas }], { onConflict: 'email' });

        if (error) {
            console.error(`Gagal seed ${u.email}:`, error.message);
        } else {
            console.log(`✅ User seeded: ${u.email} (${u.role}) — password: ${u.password}`);
        }
    }
    process.exit(0);
})();
