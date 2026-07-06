const express = require('express');
const multer = require('multer');
const path = require('path');
const xlsx = require('xlsx');
const db = require('./database');
const waBot = require('./wa-bot');
const cronScheduler = require('./cron-scheduler');

const app = express();
const port = 3001;

app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));

// Multer Config
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'public/uploads/');
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

// Routes for Parent Portal
app.get('/', (req, res) => {
    const { nis } = req.query;
    if (nis) {
        db.get('SELECT * FROM students WHERE nis = ?', [nis], (err, student) => {
            if (err) return res.status(500).send("Database error");
            if (!student) {
                return res.render('index', { student: null, error: 'Siswa tidak ditemukan.' });
            }
            
            const currentMonth = new Date().getMonth() + 1;
            const currentYear = new Date().getFullYear();

            db.get('SELECT * FROM payments WHERE student_id = ? AND month = ? AND year = ?', 
            [student.id, currentMonth, currentYear], (err, payment) => {
                if (err) return res.status(500).send("Database error");
                res.render('index', { student, payment, error: null, currentMonth, currentYear });
            });
        });
    } else {
        res.render('index', { student: null, payment: null, error: null });
    }
});

app.post('/upload-proof', upload.single('proof'), (req, res) => {
    const { student_id, month, year } = req.body;
    const file = req.file;

    if (!file) {
        return res.status(400).send('File bukti pembayaran diperlukan.');
    }

    db.run(`INSERT INTO payments (student_id, month, year, proof_file, status) VALUES (?, ?, ?, ?, 'pending')`, 
    [student_id, month, year, file.filename], function(err) {
        if (err) {
            console.error(err);
            return res.status(500).send('Gagal menyimpan data.');
        }
        res.redirect('/?success=1');
    });
});


// Admin Routes
app.get('/admin', (req, res) => {
    db.all('SELECT * FROM students', [], (err, students) => {
        if (err) return res.status(500).send("Database error");
        
        db.all(`SELECT payments.*, students.name, students.nis FROM payments 
                JOIN students ON payments.student_id = students.id 
                ORDER BY created_at DESC`, [], (err, payments) => {
            if (err) return res.status(500).send("Database error");
            res.render('admin', { students, payments });
        });
    });
});

app.post('/admin/import', upload.single('excel'), (req, res) => {
    if (!req.file) return res.redirect('/admin?error=nofile');
    
    try {
        const workbook = xlsx.readFile(req.file.path);
        const sheetName = workbook.SheetNames[0];
        const data = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);

        let successCount = 0;
        data.forEach(row => {
            if (row.nis && row.name && row.parent_wa) {
                db.run('INSERT OR IGNORE INTO students (nis, name, parent_wa) VALUES (?, ?, ?)', 
                [String(row.nis), row.name, String(row.parent_wa)]);
            }
        });
        res.redirect('/admin?success=imported');
    } catch (err) {
        console.error(err);
        res.redirect('/admin?error=importfailed');
    }
});

app.post('/admin/confirm/:id', (req, res) => {
    const { id } = req.params;
    db.run("UPDATE payments SET status = 'lunas' WHERE id = ?", [id], (err) => {
        if (err) return res.status(500).send("Database error");
        res.redirect('/admin');
    });
});

app.post('/admin/delete-student/:id', (req, res) => {
    const { id } = req.params;
    db.run("DELETE FROM students WHERE id = ?", [id], (err) => {
        res.redirect('/admin');
    });
});

// Start Cron Jobs
cronScheduler.start();

app.listen(port, () => {
    console.log(`SPP Portal running at http://localhost:${port}`);
});
