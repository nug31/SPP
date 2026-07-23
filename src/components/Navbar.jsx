import React, { useState } from 'react';
import { Bell, LogOut, ShieldCheck, User } from 'lucide-react';

export default function Navbar({ user, onLogout, notifications = [], onMarkRead }) {
    const [showNotif, setShowNotif] = useState(false);
    const unreadCount = notifications.filter(n => !n.is_read).length;

    return (
        <header className="top-nav glass-mini" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 20px', marginBottom: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '20px' }}>🏫</span>
                <strong style={{ fontSize: '16px', background: 'linear-gradient(135deg, #818cf8, #c084fc)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                    SatuSPP
                </strong>
            </div>

            {user ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    {/* Notification Bell */}
                    <div style={{ position: 'relative', cursor: 'pointer' }} onClick={() => setShowNotif(!showNotif)}>
                        <Bell size={20} color="#94a3b8" />
                        {unreadCount > 0 && (
                            <span style={{
                                position: 'absolute', top: '-6px', right: '-8px',
                                background: '#ef4444', color: '#fff', fontSize: '10px',
                                fontWeight: 800, padding: '2px 5px', borderRadius: '10px'
                            }}>
                                {unreadCount}
                            </span>
                        )}

                        {showNotif && (
                            <div className="glass" style={{
                                position: 'absolute', right: 0, top: '32px', width: '300px',
                                padding: '14px', zIndex: 100, border: '1px solid var(--glass-border)'
                            }}>
                                <div style={{ fontWeight: 700, fontSize: '13px', marginBottom: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span>Notifikasi</span>
                                    {unreadCount > 0 && (
                                        <button onClick={(e) => { e.stopPropagation(); onMarkRead(); }} style={{ background: 'none', border: 'none', color: '#818cf8', fontSize: '11px', cursor: 'pointer' }}>
                                            Tandai dibaca
                                        </button>
                                    )}
                                </div>
                                {notifications.length === 0 ? (
                                    <div style={{ fontSize: '12px', color: '#64748b', textAlign: 'center', padding: '10px 0' }}>Tidak ada notifikasi baru</div>
                                ) : (
                                    notifications.slice(0, 5).map(n => (
                                        <div key={n.id} style={{ fontSize: '12px', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                            <div>{n.message}</div>
                                            <small style={{ color: '#64748b', fontSize: '10px' }}>{new Date(n.created_at).toLocaleTimeString('id-ID')}</small>
                                        </div>
                                    ))
                                )}
                            </div>
                        )}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
                        <User size={16} color="#818cf8" />
                        <span>{user.name}</span>
                        <span className={`role-badge role-${user.role}`}>{user.role}</span>
                    </div>

                    <button onClick={onLogout} className="btn btn-ghost btn-sm" title="Keluar">
                        <LogOut size={14} /> Keluar
                    </button>
                </div>
            ) : (
                <span style={{ fontSize: '12px', color: '#94a3b8' }}>Portal Pembayaran SPP Online</span>
            )}
        </header>
    );
}
