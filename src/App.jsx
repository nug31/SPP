import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import Toast from './components/Toast';
import ParentView from './views/ParentView';
import AdminView from './views/AdminView';
import BendaharaView from './views/BendaharaView';
import WaliKelasView from './views/WaliKelasView';
import LoginView from './views/LoginView';
import { getCurrentUser, setCurrentUser, getNotifications, markNotificationsRead } from './services/dataService';

export default function App() {
    const [user, setUser] = useState(getCurrentUser());
    const [notifications, setNotifications] = useState(getNotifications());
    const [toast, setToast] = useState({ message: '', type: 'info' });
    const [currentView, setCurrentView] = useState('parent'); // 'parent', 'login', 'admin', 'bendahara', 'wali_kelas'

    useEffect(() => {
        if (user) {
            if (user.role === 'admin') setCurrentView('admin');
            else if (user.role === 'bendahara') setCurrentView('bendahara');
            else if (user.role === 'wali_kelas') setCurrentView('wali_kelas');
            else setCurrentView('parent');
        } else {
            setCurrentView('parent');
        }
    }, [user]);

    const handleLogin = (userData) => {
        setCurrentUser(userData);
        setUser(userData);
    };

    const handleLogout = () => {
        setCurrentUser(null);
        setUser(null);
        setCurrentView('parent');
        showToast('Anda telah keluar dari akun.', 'info');
    };

    const showToast = (message, type = 'info') => {
        setToast({ message, type });
    };

    const handleMarkRead = () => {
        if (user) {
            markNotificationsRead(user.role);
            setNotifications(getNotifications());
        }
    };

    return (
        <div>
            <div className="background-shape"></div>

            {/* Top Navigation Bar */}
            <Navbar
                user={user}
                onLogout={handleLogout}
                notifications={user ? notifications.filter(n => n.target_role === user.role) : []}
                onMarkRead={handleMarkRead}
            />

            {/* Role Switcher Bar / Public Link */}
            <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', paddingBottom: '16px' }}>
                <button
                    onClick={() => setCurrentView('parent')}
                    className={`btn btn-sm ${currentView === 'parent' ? 'btn-primary' : 'btn-ghost'}`}
                >
                    🌐 Portal Publik (Orang Tua)
                </button>

                {!user ? (
                    <button
                        onClick={() => setCurrentView('login')}
                        className={`btn btn-sm ${currentView === 'login' ? 'btn-primary' : 'btn-ghost'}`}
                    >
                        🔑 Login Staff
                    </button>
                ) : (
                    <>
                        {user.role === 'admin' && (
                            <button onClick={() => setCurrentView('admin')} className={`btn btn-sm ${currentView === 'admin' ? 'btn-primary' : 'btn-ghost'}`}>
                                📊 Panel Admin
                            </button>
                        )}
                        {user.role === 'bendahara' && (
                            <button onClick={() => setCurrentView('bendahara')} className={`btn btn-sm ${currentView === 'bendahara' ? 'btn-primary' : 'btn-ghost'}`}>
                                💰 Rekap Bendahara
                            </button>
                        )}
                        {user.role === 'wali_kelas' && (
                            <button onClick={() => setCurrentView('wali_kelas')} className={`btn btn-sm ${currentView === 'wali_kelas' ? 'btn-primary' : 'btn-ghost'}`}>
                                📋 Wali Kelas
                            </button>
                        )}
                    </>
                )}
            </div>

            {/* Toast Notification */}
            <Toast message={toast.message} type={toast.type} onClose={() => setToast({ message: '', type: 'info' })} />

            {/* Dynamic View Rendering */}
            {currentView === 'parent' && <ParentView onShowToast={showToast} />}
            {currentView === 'login' && <LoginView onLogin={handleLogin} onShowToast={showToast} />}
            {currentView === 'admin' && user?.role === 'admin' && <AdminView user={user} onShowToast={showToast} />}
            {currentView === 'bendahara' && (user?.role === 'bendahara' || user?.role === 'admin') && <BendaharaView user={user} />}
            {currentView === 'wali_kelas' && user?.role === 'wali_kelas' && <WaliKelasView user={user} />}
        </div>
    );
}
