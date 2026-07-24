import React, { useState } from 'react';

export default function LoginView({ onLogin, onShowToast }) {
    const [email, setEmail] = useState('admin@spp.sch.id');
    const [password, setPassword] = useState('admin123');

    const handleQuickLogin = (role, defaultEmail, defaultPass) => {
        const name = 'Administrator';
        onLogin({ email: defaultEmail, name, role: 'admin', kelas: null });
        onShowToast(`Login berhasil sebagai Administrator`, 'success');
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        handleQuickLogin('admin', email, password);
    };

    return (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', padding: '20px' }}>
            <div className="card glass" style={{ width: '100%', maxWidth: '420px', padding: '36px 28px' }}>
                <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                    <div style={{ fontSize: '36px', marginBottom: '8px' }}>🏫</div>
                    <h1 style={{ fontSize: '24px', fontWeight: 800, background: 'linear-gradient(135deg, #818cf8, #c084fc)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                        SatuSPP
                    </h1>
                    <p style={{ fontSize: '13px', color: '#94a3b8' }}>Login Admin Sistem SPP X TKR 2</p>
                </div>

                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label>Email Admin</label>
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
                    <button type="submit" className="btn btn-primary btn-full" style={{ marginTop: '8px' }}>Masuk Portal Admin</button>
                </form>

                <div style={{ marginTop: '24px', paddingTop: '20px', borderTop: '1px solid var(--glass-border)', textAlign: 'center' }}>
                    <button onClick={() => handleQuickLogin('admin', 'admin@spp.sch.id', 'admin123')} className="btn btn-ghost btn-sm btn-full">
                        🔑 Login Langsung sebagai Admin
                    </button>
                </div>
            </div>
        </div>
    );
}

