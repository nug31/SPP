require('dotenv').config();
const cron = require('node-cron');
const supabase = require('./database');
const waBot = require('./wa-bot');

const start = () => {
    // ========== Setiap hari jam 08:00 ==========
    cron.schedule('0 8 * * *', async () => {
        const today = new Date();
        const currentMonth = today.getMonth() + 1;
        const currentYear = today.getFullYear();
        const day = today.getDate();

        console.log(`[Cron] Hari ini: ${day}/${currentMonth}/${currentYear}`);

        const { data: students, error } = await supabase.from('students').select('*');
        if (error) { console.error('Cron error:', error); return; }

        // Hitung sisa hari ke tanggal 8
        let targetDate = new Date(currentYear, currentMonth - 1, 8);
        if (day > 8) {
            // Jatuh tempo bulan depan
            const nextMonth = currentMonth === 12 ? 1 : currentMonth + 1;
            const nextYear = currentMonth === 12 ? currentYear + 1 : currentYear;
            targetDate = new Date(nextYear, nextMonth - 1, 8);
        }
        const daysLeft = Math.ceil((targetDate - today) / (1000 * 60 * 60 * 24));

        for (const student of students) {
            const { data: payment } = await supabase
                .from('payments').select('status')
                .eq('student_id', student.id)
                .eq('month', currentMonth).eq('year', currentYear).single();

            // Tanggal 1: Reminder awal bulan untuk yang belum bayar
            if (day === 1 && (!payment || payment.status !== 'lunas')) {
                console.log(`[Cron] Reminder awal bulan → ${student.name}`);
                waBot.sendPaymentReminder(student.parent_wa, student.name, 7);
            }

            // Tanggal 5 (H-3): Reminder untuk yang belum bayar
            if (day === 5 && (!payment || payment.status !== 'lunas')) {
                console.log(`[Cron] Reminder H-3 → ${student.name}`);
                waBot.sendPaymentReminder(student.parent_wa, student.name, daysLeft);
            }

            // Tanggal 7 (H-1): Reminder untuk yang belum bayar
            if (day === 7 && (!payment || payment.status !== 'lunas')) {
                console.log(`[Cron] Reminder H-1 → ${student.name}`);
                waBot.sendPaymentReminder(student.parent_wa, student.name, 1);
            }

            // Tanggal 5: Juga info ke yang masih pending (menunggu verifikasi)
            if (day === 5 && payment && payment.status === 'pending') {
                console.log(`[Cron] Pending reminder → ${student.name}`);
                waBot.sendPendingReminder(student.parent_wa, student.name);
            }
        }
    });

    console.log('✅ Cron scheduler started. Reminder aktif tanggal 1, 5, dan 7 jam 08:00.');
};

module.exports = { start };
