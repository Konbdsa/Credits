// Получение токена из localStorage
const token = localStorage.getItem('token');
if (!token) {
    window.location.href = '/index.html';
}

// Элементы DOM
const modal = document.getElementById('loanModal');
const closeBtn = document.querySelector('.close');
const addLoanBtn = document.getElementById('addLoanBtn');
const loanForm = document.getElementById('loanForm');
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

// Открытие модального окна для добавления кредита
addLoanBtn.addEventListener('click', async () => {
    const role = await getUserRole();
    if (role !== 'admin') return;
    document.getElementById('modalTitle').textContent = 'Добавление кредита';
    document.getElementById('loanId').value = '';
    loanForm.reset();
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

// Загрузка списка кредитов
async function loadLoans() {
    try {
        const response = await fetch('/api/loans', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            throw new Error('Ошибка при загрузке кредитов');
        }

        const loans = await response.json();
        displayLoans(loans);
    } catch (error) {
        console.error('Ошибка:', error);
        alert('Ошибка при загрузке кредитов');
    }
}

// Отображение списка кредитов
async function displayLoans(loans) {
    const tbody = document.getElementById('loansTableBody');
    tbody.innerHTML = '';
    const role = await getUserRole();
    loans.forEach(loan => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${loan.id}</td>
            <td>${loan.first_name} ${loan.last_name} (${loan.client_id})</td>
            <td>${loan.amount}</td>
            <td>${loan.interest_rate}</td>
            <td>${loan.term_months}</td>
            <td>${new Date(loan.start_date).toLocaleDateString()}</td>
            <td>${loan.status}</td>
            <td class="action-buttons">
                ${role === 'admin' ? `<button class="btn-edit" onclick="editLoan(${loan.id})">Редактировать</button>
                <button class="btn-delete" onclick="deleteLoan(${loan.id})">Удалить</button>` : ''}
            </td>
        `;
        tbody.appendChild(tr);
    });
    // Скрыть кнопку добавления для не-админа
    document.getElementById('addLoanBtn').style.display = (role === 'admin') ? '' : 'none';
}

// Редактирование кредита
async function editLoan(id) {
    try {
        const response = await fetch(`/api/loans/${id}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            throw new Error('Ошибка при загрузке данных кредита');
        }

        const loan = await response.json();
        document.getElementById('modalTitle').textContent = 'Редактирование кредита';
        document.getElementById('loanId').value = loan.id;
        document.getElementById('clientId').value = loan.client_id;
        document.getElementById('amount').value = loan.amount;
        document.getElementById('interestRate').value = loan.interest_rate;
        document.getElementById('termMonths').value = loan.term_months;
        document.getElementById('startDate').value = loan.start_date;
        document.getElementById('status').value = loan.status;
        modal.style.display = 'block';
    } catch (error) {
        console.error('Ошибка:', error);
        alert('Ошибка при загрузке данных кредита');
    }
}

// Удаление кредита
async function deleteLoan(id) {
    if (!confirm('Вы уверены, что хотите удалить этот кредит?')) {
        return;
    }

    try {
        const response = await fetch(`/api/loans/${id}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            throw new Error('Ошибка при удалении кредита');
        }

        loadLoans();
    } catch (error) {
        console.error('Ошибка:', error);
        alert('Ошибка при удалении кредита');
    }
}

// Обработка формы добавления/редактирования кредита
loanForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const loanId = document.getElementById('loanId').value;
    const loanData = {
        client_id: document.getElementById('clientId').value,
        amount: document.getElementById('amount').value,
        interest_rate: document.getElementById('interestRate').value,
        term_months: document.getElementById('termMonths').value,
        start_date: document.getElementById('startDate').value,
        status: document.getElementById('status').value
    };

    try {
        const url = loanId ? `/api/loans/${loanId}` : '/api/loans';
        const method = loanId ? 'PUT' : 'POST';

        const response = await fetch(url, {
            method,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(loanData)
        });

        if (!response.ok) {
            throw new Error('Ошибка при сохранении кредита');
        }

        modal.style.display = 'none';
        loadLoans();
    } catch (error) {
        console.error('Ошибка:', error);
        alert('Ошибка при сохранении кредита');
    }
});

// Поиск кредитов
searchInput.addEventListener('input', debounce(async () => {
    const searchValue = searchInput.value.trim();
    const searchBy = searchType.value;

    if (searchValue.length < 2) {
        loadLoans();
        return;
    }

    let url = '/api/loans';
    if (searchBy === 'client') {
        url = `/api/clients/search?q=${searchValue}&type=name`;
    } else if (searchBy === 'status') {
        url = `/api/loans?status=${searchValue}`;
    }

    try {
        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            throw new Error('Ошибка при поиске кредитов');
        }

        const loans = await response.json();
        if (searchBy === 'client') {
            // Если поиск по клиенту, фильтруем кредиты по client_id
            // (требуется доработка, если нужен сложный поиск)
            // Пока просто не отображаем ничего
            displayLoans([]);
        } else {
            displayLoans(loans);
        }
    } catch (error) {
        console.error('Ошибка:', error);
        alert('Ошибка при поиске кредитов');
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

// Загрузка кредитов при загрузке страницы
loadLoans();

// Делаем функции editLoan и deleteLoan глобальными для использования в onclick
window.editLoan = editLoan;
window.deleteLoan = deleteLoan; 