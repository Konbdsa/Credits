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

// Получение списка клиентов
router.get('/', authMiddleware, (req, res) => {
    if (req.user.role === 'admin') {
        req.app.locals.db.all('SELECT * FROM clients ORDER BY created_at DESC', (err, clients) => {
            if (err) {
                console.error('Ошибка при получении клиентов:', err);
                return res.status(500).json({ message: 'Ошибка сервера' });
            }
            res.json(clients);
        });
    } else {
        // user: ищем клиента по email пользователя
        req.app.locals.db.get('SELECT * FROM clients WHERE email = ?', [req.user.email], (err, client) => {
            if (err) {
                console.error('Ошибка при получении клиента:', err);
                return res.status(500).json({ message: 'Ошибка сервера' });
            }
            res.json(client ? [client] : []);
        });
    }
});

// Поиск клиентов
router.get('/search', authMiddleware, (req, res) => {
    if (req.user.role === 'admin') {
        const { q, type } = req.query;
        let query;
        let params;

        switch (type) {
            case 'name':
                query = 'SELECT * FROM clients WHERE first_name LIKE ? OR last_name LIKE ?';
                params = [`%${q}%`, `%${q}%`];
                break;
            case 'email':
                query = 'SELECT * FROM clients WHERE email LIKE ?';
                params = [`%${q}%`];
                break;
            case 'phone':
                query = 'SELECT * FROM clients WHERE phone LIKE ?';
                params = [`%${q}%`];
                break;
            default:
                query = 'SELECT * FROM clients WHERE first_name LIKE ? OR last_name LIKE ? OR email LIKE ? OR phone LIKE ?';
                params = [`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`];
        }

        req.app.locals.db.all(query, params, (err, clients) => {
            if (err) {
                console.error('Ошибка при поиске клиентов:', err);
                return res.status(500).json({ message: 'Ошибка сервера' });
            }
            res.json(clients);
        });
    } else {
        // user: ищем только себя по email или имени
        const { q } = req.query;
        req.app.locals.db.get('SELECT * FROM clients WHERE email = ? OR first_name LIKE ? OR last_name LIKE ?', [req.user.email, `%${q}%`, `%${q}%`], (err, client) => {
            if (err) {
                console.error('Ошибка при поиске клиента:', err);
                return res.status(500).json({ message: 'Ошибка сервера' });
            }
            res.json(client ? [client] : []);
        });
    }
});

// Получение клиента по ID
router.get('/:id', authMiddleware, (req, res) => {
    if (req.user.role === 'admin') {
        req.app.locals.db.get('SELECT * FROM clients WHERE id = ?', [req.params.id], (err, client) => {
            if (err) {
                console.error('Ошибка при получении клиента:', err);
                return res.status(500).json({ message: 'Ошибка сервера' });
            }
            if (!client) {
                return res.status(404).json({ message: 'Клиент не найден' });
            }
            res.json(client);
        });
    } else {
        // user: только свой профиль
        req.app.locals.db.get('SELECT * FROM clients WHERE email = ?', [req.user.email], (err, client) => {
            if (err) {
                console.error('Ошибка при получении клиента:', err);
                return res.status(500).json({ message: 'Ошибка сервера' });
            }
            if (!client || String(client.id) !== String(req.params.id)) {
                return res.status(403).json({ message: 'Доступ запрещен' });
            }
            res.json(client);
        });
    }
});

// Создание нового клиента
router.post('/', [
    authMiddleware,
    adminMiddleware,
    body('first_name').trim().notEmpty(),
    body('last_name').trim().notEmpty(),
    body('email').isEmail(),
    body('phone').optional().trim()
], (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const { first_name, last_name, email, phone } = req.body;

    req.app.locals.db.run(
        'INSERT INTO clients (first_name, last_name, email, phone) VALUES (?, ?, ?, ?)',
        [first_name, last_name, email, phone],
        function(err) {
            if (err) {
                if (err.message.includes('UNIQUE constraint failed')) {
                    return res.status(400).json({ message: 'Клиент с таким email уже существует' });
                }
                console.error('Ошибка при создании клиента:', err);
                return res.status(500).json({ message: 'Ошибка сервера' });
            }
            res.status(201).json({ id: this.lastID });
        }
    );
});

// Обновление клиента
router.put('/:id', [
    authMiddleware,
    adminMiddleware,
    body('first_name').trim().notEmpty(),
    body('last_name').trim().notEmpty(),
    body('email').isEmail(),
    body('phone').optional().trim()
], (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const { first_name, last_name, email, phone } = req.body;

    req.app.locals.db.run(
        'UPDATE clients SET first_name = ?, last_name = ?, email = ?, phone = ? WHERE id = ?',
        [first_name, last_name, email, phone, req.params.id],
        function(err) {
            if (err) {
                if (err.message.includes('UNIQUE constraint failed')) {
                    return res.status(400).json({ message: 'Клиент с таким email уже существует' });
                }
                console.error('Ошибка при обновлении клиента:', err);
                return res.status(500).json({ message: 'Ошибка сервера' });
            }
            if (this.changes === 0) {
                return res.status(404).json({ message: 'Клиент не найден' });
            }
            res.json({ message: 'Клиент успешно обновлен' });
        }
    );
});

// Удаление клиента
router.delete('/:id', [authMiddleware, adminMiddleware], (req, res) => {
    req.app.locals.db.run('DELETE FROM clients WHERE id = ?', [req.params.id], function(err) {
        if (err) {
            console.error('Ошибка при удалении клиента:', err);
            return res.status(500).json({ message: 'Ошибка сервера' });
        }
        if (this.changes === 0) {
            return res.status(404).json({ message: 'Клиент не найден' });
        }
        res.json({ message: 'Клиент успешно удален' });
    });
});

module.exports = router; 