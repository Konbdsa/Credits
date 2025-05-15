// Получение токена из localStorage
const token = localStorage.getItem('token');
if (!token) {
    window.location.href = '/index.html';
}

// Элементы DOM
const modal = document.getElementById('clientModal');
const closeBtn = document.querySelector('.close');
const addClientBtn = document.getElementById('addClientBtn');
const clientForm = document.getElementById('clientForm');
const searchInput = document.getElementById('searchInput');
const searchType = document.getElementById('searchType');

// Получение роли пользователя
let userRole = null;
async function getUserRole() {
    if (userRole) return userRole;
    const token = localStorage.getItem('token');
    if (!token) return null;
    try {
        const res = await fetch('/api/auth/me', { headers: { 'Authorization': `Bearer ${token}` } });
        if (!res.ok) return null;
        const user = await res.json();
        userRole = user.role;
        return user.role;
    } catch {
        return null;
    }
}

// Открытие модального окна для добавления клиента
addClientBtn.addEventListener('click', async () => {
    const role = await getUserRole();
    if (role !== 'admin') return;
    document.getElementById('modalTitle').textContent = 'Добавление клиента';
    document.getElementById('clientId').value = '';
    clientForm.reset();
    modal.style.display = 'block';
});

// Закрытие модального окна
closeBtn.addEventListener('click', () => {
    modal.style.display = 'none';
});

window.addEventListener('click', (e) => {
    if (e.target === modal) {
        modal.style.display = 'none';
    }
});

// Загрузка списка клиентов
async function loadClients() {
    try {
        const response = await fetch('/api/clients', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            throw new Error('Ошибка при загрузке клиентов');
        }

        const clients = await response.json();
        displayClients(clients);
    } catch (error) {
        console.error('Ошибка:', error);
        alert('Ошибка при загрузке клиентов');
    }
}

// Отображение списка клиентов
async function displayClients(clients) {
    const tbody = document.getElementById('clientsTableBody');
    tbody.innerHTML = '';
    const role = await getUserRole();
    clients.forEach(client => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${client.id}</td>
            <td>${client.first_name}</td>
            <td>${client.last_name}</td>
            <td>${client.email}</td>
            <td>${client.phone || '-'}</td>
            <td>${new Date(client.created_at).toLocaleDateString()}</td>
            <td class="action-buttons">
                ${role === 'admin' ? `<button class="btn-edit" onclick="editClient(${client.id})">Редактировать</button>
                <button class="btn-delete" onclick="deleteClient(${client.id})">Удалить</button>` : ''}
            </td>
        `;
        tbody.appendChild(tr);
    });
    // Скрыть кнопку добавления для не-админа
    document.getElementById('addClientBtn').style.display = (role === 'admin') ? '' : 'none';
}

// Редактирование клиента
async function editClient(id) {
    try {
        const response = await fetch(`/api/clients/${id}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            throw new Error('Ошибка при загрузке данных клиента');
        }

        const client = await response.json();
        
        document.getElementById('modalTitle').textContent = 'Редактирование клиента';
        document.getElementById('clientId').value = client.id;
        document.getElementById('firstName').value = client.first_name;
        document.getElementById('lastName').value = client.last_name;
        document.getElementById('email').value = client.email;
        document.getElementById('phone').value = client.phone || '';

        modal.style.display = 'block';
    } catch (error) {
        console.error('Ошибка:', error);
        alert('Ошибка при загрузке данных клиента');
    }
}

// Удаление клиента
async function deleteClient(id) {
    if (!confirm('Вы уверены, что хотите удалить этого клиента?')) {
        return;
    }

    try {
        const response = await fetch(`/api/clients/${id}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            throw new Error('Ошибка при удалении клиента');
        }

        loadClients();
    } catch (error) {
        console.error('Ошибка:', error);
        alert('Ошибка при удалении клиента');
    }
}

// Обработка формы добавления/редактирования клиента
clientForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const clientId = document.getElementById('clientId').value;
    const clientData = {
        first_name: document.getElementById('firstName').value,
        last_name: document.getElementById('lastName').value,
        email: document.getElementById('email').value,
        phone: document.getElementById('phone').value
    };

    try {
        const url = clientId ? `/api/clients/${clientId}` : '/api/clients';
        const method = clientId ? 'PUT' : 'POST';

        const response = await fetch(url, {
            method,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(clientData)
        });

        if (!response.ok) {
            throw new Error('Ошибка при сохранении клиента');
        }

        modal.style.display = 'none';
        loadClients();
    } catch (error) {
        console.error('Ошибка:', error);
        alert('Ошибка при сохранении клиента');
    }
});

// Поиск клиентов
searchInput.addEventListener('input', debounce(async () => {
    const searchValue = searchInput.value.trim();
    const searchBy = searchType.value;

    if (searchValue.length < 2) {
        loadClients();
        return;
    }

    try {
        const response = await fetch(`/api/clients/search?q=${searchValue}&type=${searchBy}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            throw new Error('Ошибка при поиске клиентов');
        }

        const clients = await response.json();
        displayClients(clients);
    } catch (error) {
        console.error('Ошибка:', error);
        alert('Ошибка при поиске клиентов');
    }
}, 300));

// Функция debounce для оптимизации поиска
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Загрузка клиентов при загрузке страницы
loadClients(); 