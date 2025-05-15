const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const jwt = require('jsonwebtoken');

// Middleware для проверки авторизации
const authMiddleware = (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
        return res.status(401).json({ message: 'Требуется авторизация' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
        req.user = decoded;
        next();
    } catch (error) {
        return res.status(401).json({ message: 'Недействительный токен' });
    }
};

// Middleware для проверки роли администратора
const adminMiddleware = (req, res, next) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Доступ запрещен' });
    }
    next();
};

// Получение списка кредитов
router.get('/', authMiddleware, (req, res) => {
    if (req.user.role === 'admin') {
        const query = `
            SELECT l.*, c.first_name, c.last_name, c.email
            FROM loans l
            JOIN clients c ON l.client_id = c.id
            ORDER BY l.created_at DESC
        `;
        req.app.locals.db.all(query, (err, loans) => {
            if (err) {
                console.error('Ошибка при получении кредитов:', err);
                return res.status(500).json({ message: 'Ошибка сервера' });
            }
            res.json(loans);
        });
    } else {
        // user: только свои кредиты
        req.app.locals.db.get('SELECT id FROM clients WHERE email = ?', [req.user.email], (err, client) => {
            if (err || !client) {
                return res.json([]);
            }
            const query = `
                SELECT l.*, c.first_name, c.last_name, c.email
                FROM loans l
                JOIN clients c ON l.client_id = c.id
                WHERE l.client_id = ?
                ORDER BY l.created_at DESC
            `;
            req.app.locals.db.all(query, [client.id], (err, loans) => {
                if (err) {
                    console.error('Ошибка при получении кредитов:', err);
                    return res.status(500).json({ message: 'Ошибка сервера' });
                }
                res.json(loans);
            });
        });
    }
});

// Получение кредита по ID
router.get('/:id', authMiddleware, (req, res) => {
    if (req.user.role === 'admin') {
        const query = `
            SELECT l.*, c.first_name, c.last_name, c.email
            FROM loans l
            JOIN clients c ON l.client_id = c.id
            WHERE l.id = ?
        `;
        req.app.locals.db.get(query, [req.params.id], (err, loan) => {
            if (err) {
                console.error('Ошибка при получении кредита:', err);
                return res.status(500).json({ message: 'Ошибка сервера' });
            }
            if (!loan) {
                return res.status(404).json({ message: 'Кредит не найден' });
            }
            res.json(loan);
        });
    } else {
        // user: только свой кредит
        req.app.locals.db.get('SELECT id FROM clients WHERE email = ?', [req.user.email], (err, client) => {
            if (err || !client) {
                return res.status(403).json({ message: 'Доступ запрещен' });
            }
            const query = `
                SELECT l.*, c.first_name, c.last_name, c.email
                FROM loans l
                JOIN clients c ON l.client_id = c.id
                WHERE l.id = ? AND l.client_id = ?
            `;
            req.app.locals.db.get(query, [req.params.id, client.id], (err, loan) => {
                if (err) {
                    console.error('Ошибка при получении кредита:', err);
                    return res.status(500).json({ message: 'Ошибка сервера' });
                }
                if (!loan) {
                    return res.status(404).json({ message: 'Кредит не найден' });
                }
                res.json(loan);
            });
        });
    }
});

// Создание нового кредита
router.post('/', [
    authMiddleware,
    adminMiddleware,
    body('client_id').isInt(),
    body('amount').isFloat({ min: 0 }),
    body('interest_rate').isFloat({ min: 0, max: 100 }),
    body('term_months').isInt({ min: 1 }),
    body('start_date').isDate()
], (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const { client_id, amount, interest_rate, term_months, start_date } = req.body;

    // Проверяем существование клиента
    req.app.locals.db.get('SELECT id FROM clients WHERE id = ?', [client_id], (err, client) => {
        if (err) {
            console.error('Ошибка при проверке клиента:', err);
            return res.status(500).json({ message: 'Ошибка сервера' });
        }
        if (!client) {
            return res.status(404).json({ message: 'Клиент не найден' });
        }

        // Создаем кредит
        const query = `
            INSERT INTO loans (client_id, amount, interest_rate, term_months, start_date, status)
            VALUES (?, ?, ?, ?, ?, 'active')
        `;
        
        req.app.locals.db.run(query, [client_id, amount, interest_rate, term_months, start_date], function(err) {
            if (err) {
                console.error('Ошибка при создании кредита:', err);
                return res.status(500).json({ message: 'Ошибка сервера' });
            }
            res.status(201).json({ id: this.lastID });
        });
    });
});

// Обновление статуса кредита
router.patch('/:id/status', [
    authMiddleware,
    adminMiddleware,
    body('status').isIn(['active', 'paid', 'defaulted', 'cancelled'])
], (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const { status } = req.body;

    req.app.locals.db.run(
        'UPDATE loans SET status = ? WHERE id = ?',
        [status, req.params.id],
        function(err) {
            if (err) {
                console.error('Ошибка при обновлении статуса кредита:', err);
                return res.status(500).json({ message: 'Ошибка сервера' });
            }
            if (this.changes === 0) {
                return res.status(404).json({ message: 'Кредит не найден' });
            }
            res.json({ message: 'Статус кредита успешно обновлен' });
        }
    );
});

// Получение кредитов клиента
router.get('/client/:clientId', authMiddleware, (req, res) => {
    const query = `
        SELECT l.*, c.first_name, c.last_name, c.email
        FROM loans l
        JOIN clients c ON l.client_id = c.id
        WHERE l.client_id = ?
        ORDER BY l.created_at DESC
    `;
    
    req.app.locals.db.all(query, [req.params.clientId], (err, loans) => {
        if (err) {
            console.error('Ошибка при получении кредитов клиента:', err);
            return res.status(500).json({ message: 'Ошибка сервера' });
        }
        res.json(loans);
    });
});

// Получение статистики по кредитам
router.get('/stats/summary', authMiddleware, (req, res) => {
    const query = `
        SELECT 
            COUNT(*) as total_loans,
            SUM(amount) as total_amount,
            AVG(interest_rate) as avg_interest_rate,
            COUNT(CASE WHEN status = 'active' THEN 1 END) as active_loans,
            COUNT(CASE WHEN status = 'paid' THEN 1 END) as paid_loans,
            COUNT(CASE WHEN status = 'defaulted' THEN 1 END) as defaulted_loans
        FROM loans
    `;
    
    req.app.locals.db.get(query, (err, stats) => {
        if (err) {
            console.error('Ошибка при получении статистики:', err);
            return res.status(500).json({ message: 'Ошибка сервера' });
        }
        res.json(stats);
    });
});

module.exports = router; 