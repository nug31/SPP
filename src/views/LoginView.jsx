import React, { useState } from 'react';

export default function LoginView({ onLogin, onShowToast }) {
    const [email, setEmail] = useState('admin@spp.sch.id');
    const [password, setPassword] = useState('admin123');

    const handleQuickLogin = (role, defaultEmail, defaultPass) => {
        let name = 'Administrator';
        let kelas = null;
        if (role === 'bendahara') name = 'Bendahara SPP';
        if (role === 'wali_kelas') { name = 'Wali Kelas X TKR 2'; kelas = 'X TKR 2'; }
        if (role === 'orang_tua') { name = 'Orang Tua / Wali Siswa'; }

        onLogin({ email: defaultEmail, name, role, kelas });
        onShowToast(`Login berhasil sebagai ${name}`, 'success');
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (email.includes('admin')) handleQuickLogin('admin', email, password);
        else if (email.includes('bendahara')) handleQuickLogin('bendahara', email, password);
        else if (email.includes('wali')) handleQuickLogin('wali_kelas', email, password);
        else handleQuickLogin('orang_tua', email, password);
    };

    return (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', padding: '20px' }}>
            <div className="card glass" style={{ width: '100%', maxWidth: '420px', padding: '36px 28px' }}>
                <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                    <div style={{ fontSize: '36px', marginBottom: '8px' }}>🏫</div>
                    <h1 style={{ fontSize: '24px', fontWeight: 800, background: 'linear-gradient(135deg, #818cf8, #c084fc)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                        SatuSPP
                    </h1>
                    <p style={{ fontSize: '13px', color: '#94a3b8' }}>Login Masuk Sistem SPP Sekolah</p>
                </div>

                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label>Email Staff / Pengguna</label>
                        <input
                            type="email"
                            placeholder="admin@spp.sch.id"
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            required
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
                        />
                    </div>
                    <button type="submit" className="btn btn-primary btn-full" style={{ marginTop: '8px' }}>Masuk Portal</button>
                </form>

                <div style={{ marginTop: '24px', paddingTop: '20px', borderTop: '1px solid var(--glass-border)', textAlign: 'center' }}>
                    <p style={{ fontSize: '12px', color: '#64748b', marginBottom: '12px' }}>Atau Login Langsung per Role:</p>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                        <button onClick={() => handleQuickLogin('admin', 'admin@spp.sch.id', 'admin123')} className="btn btn-ghost btn-sm">
                            🔑 Admin
                        </button>
                        <button onClick={() => handleQuickLogin('bendahara', 'bendahara@spp.sch.id', 'bendahara123')} className="btn btn-ghost btn-sm">
                            💰 Bendahara
                        </button>
                        <button onClick={() => handleQuickLogin('wali_kelas', 'walikelas@spp.sch.id', 'walikelas123')} className="btn btn-ghost btn-sm">
                            📋 Wali Kelas
                        </button>
                        <button onClick={() => handleQuickLogin('orang_tua', 'orangtua@spp.sch.id', 'parent123')} className="btn btn-ghost btn-sm">
                            👨‍👩‍👧 Orang Tua
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
