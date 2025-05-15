const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');

// Секретный ключ для JWT
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Middleware для проверки ошибок валидации
const validate = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    next();
};

// Регистрация нового пользователя
router.post('/register', [
    body('username').trim().isLength({ min: 3 }),
    body('password').isLength({ min: 6 }),
    body('email').isEmail(),
    body('role').isIn(['admin', 'user'])
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const { username, password, email, role } = req.body;

    // Проверяем, существует ли пользователь
    req.app.locals.db.get('SELECT id FROM users WHERE username = ? OR email = ?', [username, email], async (err, user) => {
        if (err) {
            console.error('Ошибка при проверке пользователя:', err);
            return res.status(500).json({ message: 'Ошибка сервера' });
        }
        if (user) {
            return res.status(400).json({ message: 'Пользователь с таким именем или email уже существует' });
        }

        try {
            // Хешируем пароль
            const hashedPassword = await bcrypt.hash(password, 10);

            // Создаем пользователя
            req.app.locals.db.run(
                'INSERT INTO users (username, password, email, role) VALUES (?, ?, ?, ?)',
                [username, hashedPassword, email, role],
                function(err) {
                    if (err) {
                        console.error('Ошибка при создании пользователя:', err);
                        return res.status(500).json({ message: 'Ошибка сервера' });
                    }
                    // Если это клиент, создаём запись в clients
                    if (role === 'user') {
                        req.app.locals.db.run(
                            'INSERT OR IGNORE INTO clients (first_name, last_name, email) VALUES (?, ?, ?)',
                            [username, '', email],
                            function(err2) {
                                if (err2) {
                                    console.error('Ошибка при создании клиента:', err2);
                                    // Не прерываем регистрацию, просто логируем
                                }
                                res.status(201).json({ message: 'Пользователь успешно зарегистрирован' });
                            }
                        );
                    } else {
                        res.status(201).json({ message: 'Пользователь успешно зарегистрирован' });
                    }
                }
            );
        } catch (error) {
            console.error('Ошибка при хешировании пароля:', error);
            res.status(500).json({ message: 'Ошибка сервера' });
        }
    });
});

// Вход пользователя
router.post('/login', [
    body('username').trim().notEmpty(),
    body('password').notEmpty()
], (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const { username, password } = req.body;

    // Ищем пользователя
    req.app.locals.db.get('SELECT * FROM users WHERE username = ?', [username], async (err, user) => {
        if (err) {
            console.error('Ошибка при поиске пользователя:', err);
            return res.status(500).json({ message: 'Ошибка сервера' });
        }
        if (!user) {
            return res.status(401).json({ message: 'Неверное имя пользователя или пароль' });
        }

        try {
            // Проверяем пароль
            const isValidPassword = await bcrypt.compare(password, user.password);
            if (!isValidPassword) {
                return res.status(401).json({ message: 'Неверное имя пользователя или пароль' });
            }

            // Создаем JWT токен
            const token = jwt.sign(
                { id: user.id, username: user.username, role: user.role },
                process.env.JWT_SECRET || 'your-secret-key',
                { expiresIn: '24h' }
            );

            res.json({
                token,
                user: {
                    id: user.id,
                    username: user.username,
                    email: user.email,
                    role: user.role
                }
            });
        } catch (error) {
            console.error('Ошибка при проверке пароля:', error);
            res.status(500).json({ message: 'Ошибка сервера' });
        }
    });
});

// Получение информации о текущем пользователе
router.get('/me', (req, res) => {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
        return res.status(401).json({ message: 'Требуется авторизация' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
        
        req.app.locals.db.get('SELECT id, username, email, role FROM users WHERE id = ?', [decoded.id], (err, user) => {
            if (err) {
                console.error('Ошибка при получении информации о пользователе:', err);
                return res.status(500).json({ message: 'Ошибка сервера' });
            }
            if (!user) {
                return res.status(404).json({ message: 'Пользователь не найден' });
            }
            res.json(user);
        });
    } catch (error) {
        return res.status(401).json({ message: 'Недействительный токен' });
    }
});

// Изменение пароля
router.post('/change-password', [
    body('current_password').notEmpty(),
    body('new_password').isLength({ min: 6 })
], (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
        return res.status(401).json({ message: 'Требуется авторизация' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
        const { current_password, new_password } = req.body;

        // Получаем текущий пароль пользователя
        req.app.locals.db.get('SELECT password FROM users WHERE id = ?', [decoded.id], async (err, user) => {
            if (err) {
                console.error('Ошибка при получении пароля:', err);
                return res.status(500).json({ message: 'Ошибка сервера' });
            }
            if (!user) {
                return res.status(404).json({ message: 'Пользователь не найден' });
            }

            try {
                // Проверяем текущий пароль
                const isValidPassword = await bcrypt.compare(current_password, user.password);
                if (!isValidPassword) {
                    return res.status(401).json({ message: 'Неверный текущий пароль' });
                }

                // Хешируем новый пароль
                const hashedPassword = await bcrypt.hash(new_password, 10);

                // Обновляем пароль
                req.app.locals.db.run(
                    'UPDATE users SET password = ? WHERE id = ?',
                    [hashedPassword, decoded.id],
                    function(err) {
                        if (err) {
                            console.error('Ошибка при обновлении пароля:', err);
                            return res.status(500).json({ message: 'Ошибка сервера' });
                        }
                        res.json({ message: 'Пароль успешно изменен' });
                    }
                );
            } catch (error) {
                console.error('Ошибка при проверке пароля:', error);
                res.status(500).json({ message: 'Ошибка сервера' });
            }
        });
    } catch (error) {
        return res.status(401).json({ message: 'Недействительный токен' });
    }
});

module.exports = router; 