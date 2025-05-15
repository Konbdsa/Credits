const express = require('express');
const path = require('path');
const cors = require('cors');
const db = require('./db/init');

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Делаем базу данных доступной в req.app.locals
app.locals.db = db;

// Маршруты
app.use('/api/auth', require('./routes/auth'));
app.use('/api/clients', require('./routes/clients'));
app.use('/api/loans', require('./routes/loans'));
app.use('/api/payments', require('./routes/payments'));

// Обработка ошибок
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ message: 'Что-то пошло не так!' });
});

// Запуск сервера
app.listen(port, () => {
    console.log(`Сервер запущен на порту ${port}`);
}); 