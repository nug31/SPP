import React, { useState } from 'react';
import { supabase } from '../services/supabaseClient';
import { setCurrentUser } from '../services/dataService';

export default function LoginView({ onLogin, onShowToast }) {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);

        try {
            // Query user dari tabel users di Supabase
            const { data: user, error } = await supabase
                .from('users')
                .select('*')
                .eq('email', email.trim().toLowerCase())
                .single();

            if (error || !user) {
                onShowToast('❌ Email atau password salah.', 'danger');
                setLoading(false);
                return;
            }

            // Cek password menggunakan bcrypt (via Supabase function atau compare langsung)
            // Karena di browser kita tidak bisa akses bcrypt, kita pakai endpoint check sederhana
            // Untuk sekarang, bandingkan dengan hash yang tersimpan menggunakan Web Crypto
            // Alternatif: gunakan Supabase Auth atau server-side check
            
            // Solusi sementara: gunakan endpoint verifikasi dari server Express
            const resp = await fetch('/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: email.trim().toLowerCase(), password })
            });
            
            if (!resp.ok) {
                // Coba parse error dari server
                try {
                    const data = await resp.json();
                    onShowToast(data.error || '❌ Email atau password salah.', 'danger');
                } catch {
                    onShowToast('❌ Email atau password salah.', 'danger');
                }
                setLoading(false);
                return;
            }

            const userData = await resp.json();
            const sessionUser = {
                id: userData.id,
                name: userData.name,
                email: userData.email,
                role: userData.role,
                kelas: userData.kelas,
                student_id: userData.student_id
            };

            setCurrentUser(sessionUser);
            onLogin(sessionUser);
            onShowToast(`✅ Login berhasil sebagai ${userData.name}`, 'success');
        } catch (err) {
            console.error(err);
            onShowToast('❌ Terjadi kesalahan. Coba lagi.', 'danger');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', padding: '20px' }}>
            <div className="card glass" style={{ width: '100%', maxWidth: '420px', padding: '36px 28px' }}>
                <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                    <div style={{ fontSize: '36px', marginBottom: '8px' }}>🏫</div>
                    <h1 style={{ fontSize: '24px', fontWeight: 800, background: 'linear-gradient(135deg, #818cf8, #c084fc)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                        SatuSPP
                    </h1>
                    <p style={{ fontSize: '13px', color: '#94a3b8' }}>Login Portal Admin</p>
                </div>

                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label>Email</label>
                        <input
                            type="email"
                            placeholder="admin@spp.sch.id"
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            required
                            disabled={loading}
                        />
                    </div>
                    <div className="form-group">
                        <label>Password</label>
                        <input
                            type="password"
                            placeholder="••••••••"
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            required
                            disabled={loading}
                        />
                    </div>
                    <button type="submit" className="btn btn-primary btn-full" style={{ marginTop: '8px' }} disabled={loading}>
                        {loading ? '⏳ Sedang Login...' : 'Masuk Portal Admin'}
                    </button>
                </form>
            </div>
        </div>
    );
}
