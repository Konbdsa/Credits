// Получение токена из localStorage
const token = localStorage.getItem('token');
if (!token) {
    window.location.href = '/index.html';
}

// Загрузка информации о пользователе
async function loadProfile() {
    try {
        const response = await fetch('/api/auth/me', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        if (!response.ok) {
            throw new Error('Ошибка при получении профиля');
        }
        const user = await response.json();
        document.getElementById('username').textContent = user.username;
        document.getElementById('email').textContent = user.email;
        document.getElementById('role').textContent = user.role === 'admin' ? 'Администратор' : 'Пользователь';
    } catch (error) {
        console.error('Ошибка:', error);
        alert('Ошибка при получении профиля');
    }
}

// Смена пароля
const changePasswordForm = document.getElementById('changePasswordForm');
changePasswordForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const current_password = document.getElementById('currentPassword').value;
    const new_password = document.getElementById('newPassword').value;
    try {
        const response = await fetch('/api/auth/change-password', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ current_password, new_password })
        });
        const data = await response.json();
        if (response.ok) {
            alert('Пароль успешно изменён!');
            changePasswordForm.reset();
        } else {
            alert(data.message || 'Ошибка при смене пароля');
        }
    } catch (error) {
        console.error('Ошибка:', error);
        alert('Ошибка при смене пароля');
    }
});

// Загрузка профиля при открытии страницы
loadProfile(); 