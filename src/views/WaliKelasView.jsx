import React, { useState, useEffect } from 'react';
import { getStudents, getPayments } from '../services/dataService';
import { CheckCircle2, Clock, AlertCircle, Users } from 'lucide-react';

export default function WaliKelasView({ user }) {
    const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
    const [allStudents, setAllStudents] = useState([]);
    const [payments, setPayments] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                const [st, pa] = await Promise.all([getStudents(), getPayments()]);
                setAllStudents(st);
                setPayments(pa);
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    const userKelas = user.kelas || 'X TKR 2';
    const students = allStudents.filter(s => s.kelas === userKelas);

    const bulanNama = ['', 'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

    // Map student payment statuses for selected month
    const studentStatuses = students.map(s => {
        const p = payments.find(p => p.student_id === s.id && p.month === parseInt(selectedMonth) && p.year === parseInt(selectedYear));
        return { student: s, payment: p || null };
    });

    const lunasCount = studentStatuses.filter(s => s.payment?.status === 'lunas').length;
    const pendingCount = studentStatuses.filter(s => s.payment?.status === 'pending').length;
    const belumCount = studentStatuses.filter(s => !s.payment || s.payment?.status === 'ditolak').length;

    return (
        <div className="admin-container">
            <aside className="sidebar">
                <div className="sidebar-brand">
                    <span className="sidebar-icon">🏫</span>
                    <div><h2>SatuSPP</h2><p className="sidebar-sub">Wali Kelas</p></div>
                </div>
                <div className="sidebar-user">
                    <div className="su-avatar">{user.name.charAt(0).toUpperCase()}</div>
                    <div>
                        <div className="su-name">{user.name}</div>
                        <span className="role-badge role-wali_kelas">Wali Kelas</span>
                    </div>
                </div>
            </aside>

            <main className="content">
                <div className="content-header">
                    <h1 className="page-title">📋 Status Pembayaran Kelas {userKelas}</h1>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <select className="form-select" value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)}>
                            {bulanNama.slice(1).map((b, i) => (
                                <option key={i} value={i + 1}>{b}</option>
                            ))}
                        </select>
                        <select className="form-select" value={selectedYear} onChange={e => setSelectedYear(e.target.value)}>
                            <option value={2026}>2026</option>
                            <option value={2025}>2025</option>
                        </select>
                    </div>
                </div>

                {/* Stats */}
                <div className="stats-grid">
                    <div className="stat-card stat-blue">
                        <div className="stat-icon"><Users color="#3b82f6" size={28} /></div>
                        <div className="stat-info"><div className="stat-num">{students.length}</div><div className="stat-label">Total Siswa Kelas</div></div>
                    </div>
                    <div className="stat-card stat-green">
                        <div className="stat-icon"><CheckCircle2 color="#10b981" size={28} /></div>
                        <div className="stat-info"><div className="stat-num">{lunasCount}</div><div className="stat-label">Sudah Lunas</div></div>
                    </div>
                    <div className="stat-card stat-yellow">
                        <div className="stat-icon"><Clock color="#f59e0b" size={28} /></div>
                        <div className="stat-info"><div className="stat-num">{pendingCount}</div><div className="stat-label">Menunggu Verifikasi</div></div>
                    </div>
                    <div className="stat-card stat-red">
                        <div className="stat-icon"><AlertCircle color="#ef4444" size={28} /></div>
                        <div className="stat-info"><div className="stat-num">{belumCount}</div><div className="stat-label">Belum Bayar</div></div>
                    </div>
                </div>

                {/* Data Table */}
                <section className="card glass" style={{ padding: '24px' }}>
                    <h2 style={{ marginBottom: '16px' }}>📋 Daftar Siswa — Bulan {bulanNama[selectedMonth]} {selectedYear}</h2>
                    <div className="table-responsive">
                        <table className="data-table">
                            <thead>
                                <tr><th>#</th><th>NISN</th><th>Nama</th><th>Status Pembayaran</th><th>Tanggal Upload</th></tr>
                            </thead>
                            <tbody>
                                {studentStatuses.map((item, i) => (
                                    <tr key={item.student.id}>
                                        <td>{i + 1}</td>
                                        <td><code>{item.student.nisn || item.student.nis}</code></td>
                                        <td><strong>{item.student.name}</strong></td>
                                        <td>
                                            {!item.payment && <span className="badge badge-danger">Belum Bayar</span>}
                                            {item.payment?.status === 'pending' && <span className="badge badge-warning">⏳ Menunggu Verifikasi</span>}
                                            {item.payment?.status === 'lunas' && <span className="badge badge-success">✅ Lunas</span>}
                                            {item.payment?.status === 'ditolak' && <span className="badge badge-danger">❌ Ditolak</span>}
                                        </td>
                                        <td style={{ fontSize: '12px', color: '#94a3b8' }}>
                                            {item.payment ? new Date(item.payment.created_at).toLocaleDateString('id-ID') : '—'}
                                        </td>
                                    </tr>
                                ))}
                                {studentStatuses.length === 0 && <tr><td colSpan="5" style={{ textAlign: 'center', padding: '20px', color: '#64748b' }}>Tidak ada siswa di kelas ini.</td></tr>}
                            </tbody>
                        </table>
                    </div>
                </section>
            </main>
        </div>
    );
}
