require('dotenv').config();
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'spp.db');
const db = new sqlite3.Database(dbPath);

// Initialize Tables
db.serialize(() => {
    db.run(`
        CREATE TABLE IF NOT EXISTS students (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nis TEXT,
            nisn TEXT,
            name TEXT NOT NULL,
            parent_wa TEXT NOT NULL,
            kelas TEXT DEFAULT 'X TKR 2',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // Ensure nisn column exists in existing sqlite databases
    db.run(`ALTER TABLE students ADD COLUMN nisn TEXT`, (err) => {
        // Ignore error if column already exists
    });

    db.run(`
        CREATE TABLE IF NOT EXISTS payments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            student_id INTEGER NOT NULL,
            month INTEGER NOT NULL,
            year INTEGER NOT NULL,
            proof_file TEXT NOT NULL,
            status TEXT DEFAULT 'pending',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (student_id) REFERENCES students(id)
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            role TEXT NOT NULL,
            kelas TEXT,
            student_id INTEGER,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (student_id) REFERENCES students(id)
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS notifications (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            type TEXT NOT NULL,
            student_id INTEGER,
            payment_id INTEGER,
            message TEXT NOT NULL,
            is_read INTEGER DEFAULT 0,
            target_role TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (student_id) REFERENCES students(id)
        )
    `);
});

// Helper for DB Promise execution
const dbAll = (sql, params = []) => new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => err ? reject(err) : resolve(rows));
});
const dbRun = (sql, params = []) => new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
        if (err) reject(err);
        else resolve({ lastID: this.lastID, changes: this.changes });
    });
});

// Helper to normalize student row to have both nisn and nis properties
const normalizeStudentRow = (r) => {
    if (!r) return r;
    const val = r.nisn || r.nis || '';
    return { ...r, nisn: val, nis: val };
};

// Supabase-like Query Builder for SQLite
class QueryBuilder {
    constructor(tableName) {
        this.tableName = tableName;
        this.selectCols = '*';
        this.whereClause = [];
        this.params = [];
        this.orderByClause = [];
        this.limitVal = null;
        this.isSingle = false;
        this.action = 'SELECT';
        this.updateData = null;
        this.insertData = null;
        this.upsertConflict = null;
    }

    select(cols = '*') {
        this.selectCols = cols;
        return this;
    }

    insert(data) {
        this.action = 'INSERT';
        this.insertData = Array.isArray(data) ? data : [data];
        return this;
    }

    update(data) {
        this.action = 'UPDATE';
        this.updateData = data;
        return this;
    }

    delete() {
        this.action = 'DELETE';
        return this;
    }

    upsert(data, options = {}) {
        this.action = 'UPSERT';
        this.insertData = Array.isArray(data) ? data : [data];
        this.upsertConflict = options.onConflict || null;
        return this;
    }

    eq(col, val) {
        if (col === 'nis' || col === 'nisn') {
            this.whereClause.push(`(nis = ? OR nisn = ?)`);
            this.params.push(val, val);
        } else {
            this.whereClause.push(`${col} = ?`);
            this.params.push(val);
        }
        return this;
    }

    in(col, arr) {
        if (!arr || arr.length === 0) {
            this.whereClause.push('1 = 0');
        } else {
            const placeholders = arr.map(() => '?').join(', ');
            this.whereClause.push(`${col} IN (${placeholders})`);
            this.params.push(...arr);
        }
        return this;
    }

    or(conditionStr) {
        const parts = conditionStr.split(',');
        const orConditions = [];
        for (const p of parts) {
            const [field, op, val] = p.split('.');
            if (op === 'ilike') {
                if (field === 'nis' || field === 'nisn') {
                    orConditions.push(`nis LIKE ? OR nisn LIKE ?`);
                    this.params.push(val, val);
                } else {
                    orConditions.push(`${field} LIKE ?`);
                    this.params.push(val);
                }
            }
        }
        if (orConditions.length > 0) {
            this.whereClause.push(`(${orConditions.join(' OR ')})`);
        }
        return this;
    }

    single() {
        this.isSingle = true;
        return this;
    }

    order(col, opts = {}) {
        const dir = opts.ascending === false ? 'DESC' : 'ASC';
        this.orderByClause.push(`${col} ${dir}`);
        return this;
    }

    limit(num) {
        this.limitVal = num;
        return this;
    }

    async then(resolve, reject) {
        try {
            const res = await this.execute();
            resolve(res);
        } catch (err) {
            if (reject) reject(err);
            else resolve({ data: null, error: err });
        }
    }

    async execute() {
        try {
            if (this.action === 'INSERT' || this.action === 'UPSERT') {
                const insertedItems = [];
                for (const item of this.insertData) {
                    // Populate both nis and nisn
                    const nisVal = item.nisn || item.nis || '';
                    const fullItem = { ...item, nisn: nisVal, nis: nisVal };

                    const keys = Object.keys(fullItem);
                    const placeholders = keys.map(() => '?').join(', ');
                    const vals = keys.map(k => fullItem[k]);

                    let sql = '';
                    if (this.action === 'UPSERT' && this.upsertConflict) {
                        const conflictCol = this.upsertConflict === 'nisn' ? 'nis' : this.upsertConflict;
                        const updateAssigns = keys
                            .filter(k => k !== conflictCol)
                            .map(k => `${k} = excluded.${k}`)
                            .join(', ');
                        sql = `INSERT INTO ${this.tableName} (${keys.join(', ')}) VALUES (${placeholders}) ON CONFLICT(${conflictCol}) DO UPDATE SET ${updateAssigns}`;
                    } else {
                        sql = `INSERT INTO ${this.tableName} (${keys.join(', ')}) VALUES (${placeholders})`;
                    }

                    const res = await dbRun(sql, vals);
                    insertedItems.push(normalizeStudentRow({ id: res.lastID, ...fullItem }));
                }

                return { data: this.isSingle ? insertedItems[0] : insertedItems, error: null };
            }

            if (this.action === 'UPDATE') {
                const keys = Object.keys(this.updateData);
                const setClause = keys.map(k => `${k} = ?`).join(', ');
                const updateVals = keys.map(k => this.updateData[k]);

                let sql = `UPDATE ${this.tableName} SET ${setClause}`;
                if (this.whereClause.length > 0) {
                    sql += ` WHERE ${this.whereClause.join(' AND ')}`;
                }

                await dbRun(sql, [...updateVals, ...this.params]);
                return { data: null, error: null };
            }

            if (this.action === 'DELETE') {
                let sql = `DELETE FROM ${this.tableName}`;
                if (this.whereClause.length > 0) {
                    sql += ` WHERE ${this.whereClause.join(' AND ')}`;
                }
                await dbRun(sql, this.params);
                return { data: null, error: null };
            }

            // SELECT Action
            let sql = `SELECT * FROM ${this.tableName}`;
            let whereStr = this.whereClause.length > 0 ? ` WHERE ${this.whereClause.join(' AND ')}` : '';
            sql += whereStr;

            if (this.orderByClause.length > 0) {
                sql += ` ORDER BY ${this.orderByClause.join(', ')}`;
            }
            if (this.limitVal) {
                sql += ` LIMIT ${this.limitVal}`;
            }

            let rows = await dbAll(sql, this.params);

            if (this.tableName === 'students') {
                rows = rows.map(normalizeStudentRow);
            }

            // Handle joined relationship: students(name, nis, nisn, kelas, parent_wa)
            if (this.selectCols.includes('students(') && this.tableName === 'payments') {
                for (let r of rows) {
                    if (r.student_id) {
                        const studentRows = await dbAll('SELECT name, nis, nisn, kelas, parent_wa FROM students WHERE id = ?', [r.student_id]);
                        r.students = normalizeStudentRow(studentRows[0] || null);
                    } else {
                        r.students = null;
                    }
                }
            }

            if (this.isSingle) {
                return { data: rows[0] || null, error: rows.length === 0 ? { message: 'Not found' } : null };
            }

            return { data: rows, error: null };
        } catch (err) {
            console.error(`Database error on ${this.tableName}:`, err.message);
            return { data: null, error: err };
        }
    }
}

const supabase = {
    from: (tableName) => new QueryBuilder(tableName)
};

console.log('Database (SQLite spp.db) initialized.');

module.exports = supabase;
