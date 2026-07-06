const cron = require('node-cron');
const db = require('./database');
const waBot = require('./wa-bot');

const start = () => {
    // Run every day at 08:00 AM
    cron.schedule('0 8 * * *', () => {
        const today = new Date();
        const currentMonth = today.getMonth() + 1;
        const currentYear = today.getFullYear();
        
        // Cek jika hari ini adalah tanggal 5 (H-3 jatuh tempo tgl 8)
        if (today.getDate() === 5) {
            console.log('Hari ini tanggal 5. Menjalankan pengingat SPP...');
            
            db.all('SELECT * FROM students', [], (err, students) => {
                if (err) {
                    console.error('Error fetching students for cron:', err);
                    return;
                }
                
                students.forEach(student => {
                    db.get(`SELECT status FROM payments WHERE student_id = ? AND month = ? AND year = ?`, 
                    [student.id, currentMonth, currentYear], (err, payment) => {
                        if (err) return;
                        
                        // Jika belum ada pembayaran atau status belum lunas
                        if (!payment || payment.status !== 'lunas') {
                            const message = `Halo Bapak/Ibu Wali Murid dari ${student.name}.\n\nKami mengingatkan bahwa pembayaran SPP bulan ini sebesar Rp 700.000 akan jatuh tempo pada tanggal 8.\nMohon untuk segera melakukan pembayaran dan mengunggah buktinya melalui website portal SPP sekolah.\n\nTerima kasih.`;
                            
                            waBot.sendMessage(student.parent_wa, message);
                        }
                    });
                });
            });
        }
    });
    console.log('Cron scheduler started.');
};

module.exports = { start };
