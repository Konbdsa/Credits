document.getElementById('registerForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const username = document.getElementById('username').value;
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    const role = document.getElementById('role').value;

    // Проверка совпадения паролей
    if (password !== confirmPassword) {
        alert('Пароли не совпадают');
        return;
    }

    try {
        const response = await fetch('/api/auth/register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, password, email, role })
        });

        const data = await response.json();

        if (response.ok) {
            // Сохраняем токен в localStorage
            localStorage.setItem('token', data.token);
            // Перенаправляем на главную страницу
            window.location.href = '/dashboard.html';
        } else {
            alert(data.message || 'Ошибка при регистрации');
        }
    } catch (error) {
        console.error('Ошибка:', error);
        alert('Произошла ошибка при попытке регистрации');
    }
}); 