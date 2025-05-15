const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Создаем подключение к базе данных
const db = new sqlite3.Database(path.join(__dirname, 'database.sqlite'), (err) => {
    if (err) {
        console.error('Ошибка при подключении к базе данных:', err);
    } else {
        console.log('Подключение к базе данных установлено');
    }
});

// Включаем поддержку внешних ключей
db.run('PRAGMA foreign_keys = ON');

// Создаем таблицы
db.serialize(() => {
    // Таблица пользователей
    db.run(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            role TEXT NOT NULL CHECK(role IN ('admin', 'user')),
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // Таблица клиентов
    db.run(`
        CREATE TABLE IF NOT EXISTS clients (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            first_name TEXT NOT NULL,
            last_name TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            phone TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // Таблица кредитов
    db.run(`
        CREATE TABLE IF NOT EXISTS loans (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            client_id INTEGER NOT NULL,
            amount DECIMAL(10,2) NOT NULL,
            interest_rate DECIMAL(5,2) NOT NULL,
            term_months INTEGER NOT NULL,
            start_date DATE NOT NULL,
            status TEXT NOT NULL CHECK(status IN ('active', 'paid', 'defaulted', 'cancelled')),
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (client_id) REFERENCES clients(id)
        )
    `);

    // Таблица платежей
    db.run(`
        CREATE TABLE IF NOT EXISTS payments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            loan_id INTEGER NOT NULL,
            amount DECIMAL(10,2) NOT NULL,
            payment_date DATE NOT NULL,
            payment_type TEXT NOT NULL CHECK(payment_type IN ('principal', 'interest', 'both')),
            notes TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (loan_id) REFERENCES loans(id)
        )
    `);

    // Создаем индексы для оптимизации запросов
    db.run('CREATE INDEX IF NOT EXISTS idx_clients_email ON clients(email)');
    db.run('CREATE INDEX IF NOT EXISTS idx_loans_client_id ON loans(client_id)');
    db.run('CREATE INDEX IF NOT EXISTS idx_loans_status ON loans(status)');
    db.run('CREATE INDEX IF NOT EXISTS idx_payments_loan_id ON payments(loan_id)');
    db.run('CREATE INDEX IF NOT EXISTS idx_payments_date ON payments(payment_date)');
});

// Создаем администратора по умолчанию, если его нет
db.get('SELECT id FROM users WHERE username = ?', ['admin'], (err, user) => {
    if (err) {
        console.error('Ошибка при проверке администратора:', err);
        return;
    }
    if (!user) {
        const bcrypt = require('bcrypt');
        bcrypt.hash('admin123', 10, (err, hash) => {
            if (err) {
                console.error('Ошибка при хешировании пароля:', err);
                return;
            }
            db.run(
                'INSERT INTO users (username, password, email, role) VALUES (?, ?, ?, ?)',
                ['admin', hash, 'admin@example.com', 'admin'],
                function(err) {
                    if (err) {
                        console.error('Ошибка при создании администратора:', err);
                    } else {
                        console.log('Администратор создан успешно');
                    }
                }
            );
        });
    }
});

module.exports = db; 