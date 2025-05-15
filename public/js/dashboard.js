// Проверка авторизации
function checkAuth() {
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = '/index.html';
        return;
    }

    // Декодируем JWT токен для получения информации о пользователе
    try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        document.getElementById('username').textContent = `Пользователь: ${payload.username}`;
        document.getElementById('role').textContent = `Роль: ${payload.role === 'admin' ? 'Администратор' : 'Клиент'}`;
    } catch (error) {
        console.error('Ошибка при декодировании токена:', error);
        localStorage.removeItem('token');
        window.location.href = '/index.html';
    }
}

// Обработка выхода из системы
document.getElementById('logout').addEventListener('click', (e) => {
    e.preventDefault();
    localStorage.removeItem('token');
    window.location.href = '/index.html';
});

// Обработка навигации
document.querySelectorAll('.nav-links a[data-page]').forEach(link => {
    link.addEventListener('click', (e) => {
        e.preventDefault();
        
        // Убираем активный класс у всех ссылок
        document.querySelectorAll('.nav-links a').forEach(a => a.classList.remove('active'));
        // Добавляем активный класс текущей ссылке
        e.target.classList.add('active');

        // Здесь будет загрузка соответствующего контента
        const page = e.target.dataset.page;
        loadPageContent(page);
    });
});

// Функция загрузки контента страницы
async function loadPageContent(page) {
    const mainContent = document.getElementById('main-content');
    
    // Здесь будет загрузка контента в зависимости от выбранной страницы
    switch(page) {
        case 'clients':
            mainContent.innerHTML = '<h2>Управление клиентами</h2><p>Здесь будет список клиентов</p>';
            break;
        case 'credits':
            mainContent.innerHTML = '<h2>Управление кредитами</h2><p>Здесь будет список кредитов</p>';
            break;
        case 'payments':
            mainContent.innerHTML = '<h2>Управление платежами</h2><p>Здесь будет список платежей</p>';
            break;
        case 'profile':
            mainContent.innerHTML = '<h2>Профиль пользователя</h2><p>Здесь будет информация о профиле</p>';
            break;
        default:
            mainContent.innerHTML = '<h2>Добро пожаловать в систему!</h2><p>Выберите раздел в меню слева для начала работы.</p>';
    }
}

// Проверяем авторизацию при загрузке страницы
checkAuth(); 