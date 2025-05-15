document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;

    try {
        const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, password })
        });

        const data = await response.json();

        if (response.ok) {
            // Сохраняем токен в localStorage
            localStorage.setItem('token', data.token);
            // Перенаправляем на главную страницу
            window.location.href = '/dashboard.html';
        } else {
            alert(data.message || 'Ошибка при входе');
        }
    } catch (error) {
        console.error('Ошибка:', error);
        alert('Произошла ошибка при попытке входа');
    }
}); 