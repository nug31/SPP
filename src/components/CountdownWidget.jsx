import React, { useState, useEffect } from 'react';

export default function CountdownWidget() {
    const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, mins: 0, secs: 0, targetDateStr: '', isUrgent: false });

    useEffect(() => {
        const updateCountdown = () => {
            const now = new Date();
            let target = new Date(now.getFullYear(), now.getMonth(), 8, 23, 59, 59);
            if (now.getDate() > 8) {
                target = new Date(now.getFullYear(), now.getMonth() + 1, 8, 23, 59, 59);
            }

            const diff = target - now;
            if (diff <= 0) {
                setTimeLeft({ days: 0, hours: 0, mins: 0, secs: 0, targetDateStr: 'Hari ini jatuh tempo!', isUrgent: true });
                return;
            }

            const days = Math.floor(diff / (1000 * 60 * 60 * 24));
            const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
            const secs = Math.floor((diff % (1000 * 60)) / 1000);

            const opts = { day: 'numeric', month: 'long', year: 'numeric' };
            const targetDateStr = 'Jatuh tempo: ' + target.toLocaleDateString('id-ID', opts);

            setTimeLeft({
                days, hours, mins, secs,
                targetDateStr,
                isUrgent: days <= 2
            });
        };

        updateCountdown();
        const interval = setInterval(updateCountdown, 1000);
        return () => clearInterval(interval);
    }, []);

    const pad = (n) => String(n).padStart(2, '0');

    return (
        <div className={`countdown-widget ${timeLeft.isUrgent ? 'countdown-urgent' : ''}`}>
            <div className="countdown-label">⏳ Jatuh Tempo Pembayaran SPP</div>
            <div className="countdown-blocks">
                <div className="cd-block"><span>{pad(timeLeft.days)}</span><small>Hari</small></div>
                <div className="cd-sep">:</div>
                <div className="cd-block"><span>{pad(timeLeft.hours)}</span><small>Jam</small></div>
                <div className="cd-sep">:</div>
                <div className="cd-block"><span>{pad(timeLeft.mins)}</span><small>Menit</small></div>
                <div className="cd-sep">:</div>
                <div className="cd-block"><span>{pad(timeLeft.secs)}</span><small>Detik</small></div>
            </div>
            <div className="countdown-date">{timeLeft.targetDateStr}</div>
        </div>
    );
}
