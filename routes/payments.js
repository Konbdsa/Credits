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

// Получение списка платежей
router.get('/', authMiddleware, (req, res) => {
    if (req.user.role === 'admin') {
        const query = `
            SELECT p.*, l.amount as loan_amount, c.first_name, c.last_name
            FROM payments p
            JOIN loans l ON p.loan_id = l.id
            JOIN clients c ON l.client_id = c.id
            ORDER BY p.payment_date DESC
        `;
        req.app.locals.db.all(query, (err, payments) => {
            if (err) {
                console.error('Ошибка при получении платежей:', err);
                return res.status(500).json({ message: 'Ошибка сервера' });
            }
            res.json(payments);
        });
    } else {
        // user: только свои платежи
        req.app.locals.db.get('SELECT id FROM clients WHERE email = ?', [req.user.email], (err, client) => {
            if (err || !client) {
                return res.json([]);
            }
            const query = `
                SELECT p.*, l.amount as loan_amount, c.first_name, c.last_name
                FROM payments p
                JOIN loans l ON p.loan_id = l.id
                JOIN clients c ON l.client_id = c.id
                WHERE l.client_id = ?
                ORDER BY p.payment_date DESC
            `;
            req.app.locals.db.all(query, [client.id], (err, payments) => {
                if (err) {
                    console.error('Ошибка при получении платежей:', err);
                    return res.status(500).json({ message: 'Ошибка сервера' });
                }
                res.json(payments);
            });
        });
    }
});

// Получение платежа по ID
router.get('/:id', authMiddleware, (req, res) => {
    if (req.user.role === 'admin') {
        const query = `
            SELECT p.*, l.amount as loan_amount, c.first_name, c.last_name
            FROM payments p
            JOIN loans l ON p.loan_id = l.id
            JOIN clients c ON l.client_id = c.id
            WHERE p.id = ?
        `;
        req.app.locals.db.get(query, [req.params.id], (err, payment) => {
            if (err) {
                console.error('Ошибка при получении платежа:', err);
                return res.status(500).json({ message: 'Ошибка сервера' });
            }
            if (!payment) {
                return res.status(404).json({ message: 'Платеж не найден' });
            }
            res.json(payment);
        });
    } else {
        // user: только свой платеж
        req.app.locals.db.get('SELECT id FROM clients WHERE email = ?', [req.user.email], (err, client) => {
            if (err || !client) {
                return res.status(403).json({ message: 'Доступ запрещен' });
            }
            const query = `
                SELECT p.*, l.amount as loan_amount, c.first_name, c.last_name
                FROM payments p
                JOIN loans l ON p.loan_id = l.id
                JOIN clients c ON l.client_id = c.id
                WHERE p.id = ? AND l.client_id = ?
            `;
            req.app.locals.db.get(query, [req.params.id, client.id], (err, payment) => {
                if (err) {
                    console.error('Ошибка при получении платежа:', err);
                    return res.status(500).json({ message: 'Ошибка сервера' });
                }
                if (!payment) {
                    return res.status(404).json({ message: 'Платеж не найден' });
                }
                res.json(payment);
            });
        });
    }
});

// Создание нового платежа
router.post('/', [
    authMiddleware,
    // adminMiddleware, // убираем, чтобы user мог вносить платежи по своим кредитам
    body('loan_id').isInt(),
    body('amount').isFloat({ min: 0 }),
    body('payment_date').isDate(),
    body('payment_type').isIn(['principal', 'interest', 'both']),
    body('notes').optional().trim()
], (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const { loan_id, amount, payment_date, payment_type, notes } = req.body;

    // Проверяем существование кредита и принадлежность клиенту
    req.app.locals.db.get('SELECT l.id, l.status, l.client_id, c.email FROM loans l JOIN clients c ON l.client_id = c.id WHERE l.id = ?', [loan_id], (err, loan) => {
        if (err) {
            console.error('Ошибка при проверке кредита:', err);
            return res.status(500).json({ message: 'Ошибка сервера' });
        }
        if (!loan) {
            return res.status(404).json({ message: 'Кредит не найден' });
        }
        if (loan.status !== 'active') {
            return res.status(400).json({ message: 'Невозможно добавить платеж для неактивного кредита' });
        }
        if (req.user.role !== 'admin' && loan.email !== req.user.email) {
            return res.status(403).json({ message: 'Доступ запрещен' });
        }

        // Создаем платеж
        const query = `
            INSERT INTO payments (loan_id, amount, payment_date, payment_type, notes)
            VALUES (?, ?, ?, ?, ?)
        `;
        req.app.locals.db.run(query, [loan_id, amount, payment_date, payment_type, notes], function(err) {
            if (err) {
                console.error('Ошибка при создании платежа:', err);
                return res.status(500).json({ message: 'Ошибка сервера' });
            }
            // --- Обновление статуса кредита ---
            const updateLoanStatusIfNeeded = (loan_id) => {
                req.app.locals.db.get(
                    'SELECT SUM(amount) as total_paid FROM payments WHERE loan_id = ?',
                    [loan_id],
                    (err, row) => {
                        if (err) return;
                        const totalPaid = row?.total_paid || 0;
                        req.app.locals.db.get(
                            'SELECT amount, interest_rate, status FROM loans WHERE id = ?',
                            [loan_id],
                            (err2, loan) => {
                                if (err2 || !loan) return;
                                const interest = loan.amount * (loan.interest_rate / 100);
                                const totalToPay = loan.amount + interest;
                                if (totalPaid >= totalToPay && loan.status === 'active') {
                                    req.app.locals.db.run(
                                        'UPDATE loans SET status = ? WHERE id = ?',
                                        ['paid', loan_id]
                                    );
                                }
                            }
                        );
                    }
                );
            };
            updateLoanStatusIfNeeded(loan_id);
            // --- конец обновления статуса ---
            res.status(201).json({ id: this.lastID });
        });
    });
});

// Получение платежей по кредиту
router.get('/loan/:loanId', authMiddleware, (req, res) => {
    const query = `
        SELECT p.*, l.amount as loan_amount
        FROM payments p
        JOIN loans l ON p.loan_id = l.id
        WHERE p.loan_id = ?
        ORDER BY p.payment_date DESC
    `;
    
    req.app.locals.db.all(query, [req.params.loanId], (err, payments) => {
        if (err) {
            console.error('Ошибка при получении платежей по кредиту:', err);
            return res.status(500).json({ message: 'Ошибка сервера' });
        }
        res.json(payments);
    });
});

// Получение статистики по платежам
router.get('/stats/summary', authMiddleware, (req, res) => {
    const query = `
        SELECT 
            COUNT(*) as total_payments,
            SUM(amount) as total_amount,
            COUNT(CASE WHEN payment_type = 'principal' THEN 1 END) as principal_payments,
            COUNT(CASE WHEN payment_type = 'interest' THEN 1 END) as interest_payments,
            COUNT(CASE WHEN payment_type = 'both' THEN 1 END) as combined_payments
        FROM payments
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