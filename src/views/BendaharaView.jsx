import React, { useState } from 'react';
import { getStudents, getPayments } from '../services/dataService';
import { DollarSign, PieChart, TrendingUp, Users, CheckCircle2 } from 'lucide-react';

export default function BendaharaView({ user }) {
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
    const students = getStudents();
    const payments = getPayments();

    const bulanNama = ['', 'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

    // Overall stats for selected year
    const yearPayments = payments.filter(p => p.year === selectedYear);
    const lunasYearPayments = yearPayments.filter(p => p.status === 'lunas');
    const totalIncome = lunasYearPayments.length * 700000;

    // Monthly breakdown
    const monthlyStats = Array.from({ length: 12 }, (_, i) => {
        const month = i + 1;
        const monthLunas = yearPayments.filter(p => p.month === month && p.status === 'lunas').length;
        const targetIncome = students.length * 700000;
        const actualIncome = monthLunas * 700000;
        const percentage = Math.round((monthLunas / (students.length || 1)) * 100);
        return { month, name: bulanNama[month], lunasCount: monthLunas, actualIncome, targetIncome, percentage };
    });

    // Class breakdown
    const kelasList = [...new Set(students.map(s => s.kelas).filter(Boolean))].sort();
    const classStats = kelasList.map(kelas => {
        const classStudents = students.filter(s => s.kelas === kelas);
        const classLunas = yearPayments.filter(p => {
            const student = students.find(s => s.id === p.student_id);
            return student && student.kelas === kelas && p.status === 'lunas';
        }).length;
        return { kelas, studentCount: classStudents.length, lunasCount: classLunas };
    });

    return (
        <div className="admin-container">
            <aside className="sidebar">
                <div className="sidebar-brand">
                    <span className="sidebar-icon">🏫</span>
                    <div><h2>SatuSPP</h2><p className="sidebar-sub">Bendahara</p></div>
                </div>
                <div className="sidebar-user">
                    <div className="su-avatar">{user.name.charAt(0).toUpperCase()}</div>
                    <div>
                        <div className="su-name">{user.name}</div>
                        <span className="role-badge role-bendahara">Bendahara</span>
                    </div>
                </div>
            </aside>

            <main className="content">
                <div className="content-header">
                    <h1 className="page-title">💰 Dashboard Rekap Keuangan SPP ({selectedYear})</h1>
                </div>

                {/* Overall Summary Stats */}
                <div className="stats-grid">
                    <div className="stat-card stat-purple">
                        <div className="stat-icon"><DollarSign size={28} color="#c084fc" /></div>
                        <div className="stat-info">
                            <div className="stat-num">Rp {totalIncome.toLocaleString('id-ID')}</div>
                            <div className="stat-label">Total Terkumpul ({selectedYear})</div>
                        </div>
                    </div>
                    <div className="stat-card stat-green">
                        <div className="stat-icon"><CheckCircle2 size={28} color="#10b981" /></div>
                        <div className="stat-info">
                            <div className="stat-num">{lunasYearPayments.length} Pembayaran</div>
                            <div className="stat-label">Transaksi Lunas</div>
                        </div>
                    </div>
                    <div className="stat-card stat-blue">
                        <div className="stat-icon"><Users size={28} color="#3b82f6" /></div>
                        <div className="stat-info">
                            <div className="stat-num">{students.length} Siswa</div>
                            <div className="stat-label">Siswa Terdaftar</div>
                        </div>
                    </div>
                </div>

                {/* Monthly Table Breakdown */}
                <section className="card glass" style={{ padding: '24px', marginBottom: '28px' }}>
                    <h2 style={{ marginBottom: '16px' }}>📊 Rekapitulasi Pembayaran Per Bulan</h2>
                    <div className="table-responsive">
                        <table className="data-table">
                            <thead>
                                <tr><th>Bulan</th><th>Siswa Lunas</th><th>Total Terkumpul</th><th>Prosentase</th><th>Progress</th></tr>
                            </thead>
                            <tbody>
                                {monthlyStats.map(m => (
                                    <tr key={m.month}>
                                        <td><strong>{m.name}</strong></td>
                                        <td>{m.lunasCount} / {students.length} Siswa</td>
                                        <td><strong style={{ color: '#6ee7b7' }}>Rp {m.actualIncome.toLocaleString('id-ID')}</strong></td>
                                        <td>{m.percentage}%</td>
                                        <td style={{ width: '200px' }}>
                                            <div className="progress-bar">
                                                <div className="progress-fill" style={{ width: `${m.percentage}%` }}></div>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </section>

                {/* Per Class Breakdown */}
                <section className="card glass" style={{ padding: '24px' }}>
                    <h2 style={{ marginBottom: '16px' }}>🏫 Rekapitulasi Per Kelas</h2>
                    <div className="stats-grid">
                        {classStats.map(c => (
                            <div key={c.kelas} className="stat-card glass-inner" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
                                <span className="kelas-badge" style={{ fontSize: '14px', marginBottom: '6px' }}>{c.kelas}</span>
                                <div style={{ fontSize: '13px', color: '#94a3b8' }}>Total Siswa: {c.studentCount}</div>
                                <div style={{ fontSize: '13px', color: '#6ee7b7', fontWeight: 600 }}>Total Lunas: {c.lunasCount} Transaksi</div>
                            </div>
                        ))}
                    </div>
                </section>
            </main>
        </div>
    );
}
