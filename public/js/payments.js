// Получение токена из localStorage
const token = localStorage.getItem('token');
if (!token) {
    window.location.href = '/index.html';
}

// Элементы DOM
const modal = document.getElementById('paymentModal');
const closeBtn = document.querySelector('.close');
const addPaymentBtn = document.getElementById('addPaymentBtn');
const paymentForm = document.getElementById('paymentForm');
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

// Загрузка кредитов для выпадающего списка
async function loadLoanOptions() {
    const loanSelect = document.getElementById('loanId');
    loanSelect.innerHTML = '';
    const role = await getUserRole();
    let url = '/api/loans';
    let loans = [];
    try {
        const res = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` } });
        if (res.ok) {
            loans = await res.json();
        }
    } catch {}
    if (loans.length === 0) {
        loanSelect.innerHTML = '<option value="">Нет доступных кредитов</option>';
        return;
    }
    loans.forEach(loan => {
        const option = document.createElement('option');
        option.value = loan.id;
        option.textContent = `ID: ${loan.id} | ${loan.amount}₽ | ${loan.status} | ${loan.first_name || ''} ${loan.last_name || ''}`;
        loanSelect.appendChild(option);
    });
}

// Открытие модального окна для добавления платежа
addPaymentBtn.addEventListener('click', async () => {
    document.getElementById('modalTitle').textContent = 'Добавление платежа';
    document.getElementById('paymentId').value = '';
    paymentForm.reset();
    await loadLoanOptions();
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

// Загрузка списка платежей
async function loadPayments() {
    try {
        const response = await fetch('/api/payments', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            throw new Error('Ошибка при загрузке платежей');
        }

        const payments = await response.json();
        displayPayments(payments);
    } catch (error) {
        console.error('Ошибка:', error);
        alert('Ошибка при загрузке платежей');
    }
}

// Отображение списка платежей
async function displayPayments(payments) {
    const tbody = document.getElementById('paymentsTableBody');
    tbody.innerHTML = '';
    const role = await getUserRole();
    payments.forEach(payment => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${payment.id}</td>
            <td>${payment.loan_id}</td>
            <td>${payment.amount}</td>
            <td>${new Date(payment.payment_date).toLocaleDateString()}</td>
            <td>${payment.payment_type}</td>
            <td>${payment.notes || '-'}</td>
            <td class="action-buttons">
                ${role === 'admin' ? `<button class="btn-edit" onclick="editPayment(${payment.id})">Редактировать</button>
                <button class="btn-delete" onclick="deletePayment(${payment.id})">Удалить</button>` : ''}
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// Редактирование платежа
async function editPayment(id) {
    try {
        const response = await fetch(`/api/payments/${id}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            throw new Error('Ошибка при загрузке данных платежа');
        }

        const payment = await response.json();
        document.getElementById('modalTitle').textContent = 'Редактирование платежа';
        document.getElementById('paymentId').value = payment.id;
        await loadLoanOptions();
        document.getElementById('loanId').value = payment.loan_id;
        document.getElementById('amount').value = payment.amount;
        document.getElementById('paymentDate').value = payment.payment_date;
        document.getElementById('paymentType').value = payment.payment_type;
        document.getElementById('notes').value = payment.notes || '';
        modal.style.display = 'block';
    } catch (error) {
        console.error('Ошибка:', error);
        alert('Ошибка при загрузке данных платежа');
    }
}

// Удаление платежа
async function deletePayment(id) {
    if (!confirm('Вы уверены, что хотите удалить этот платеж?')) {
        return;
    }

    try {
        const response = await fetch(`/api/payments/${id}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            throw new Error('Ошибка при удалении платежа');
        }

        loadPayments();
    } catch (error) {
        console.error('Ошибка:', error);
        alert('Ошибка при удалении платежа');
    }
}

// Обработка формы добавления/редактирования платежа
paymentForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const paymentId = document.getElementById('paymentId').value;
    const paymentData = {
        loan_id: document.getElementById('loanId').value,
        amount: document.getElementById('amount').value,
        payment_date: document.getElementById('paymentDate').value,
        payment_type: document.getElementById('paymentType').value,
        notes: document.getElementById('notes').value
    };

    try {
        const url = paymentId ? `/api/payments/${paymentId}` : '/api/payments';
        const method = paymentId ? 'PUT' : 'POST';

        const response = await fetch(url, {
            method,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(paymentData)
        });

        if (!response.ok) {
            throw new Error('Ошибка при сохранении платежа');
        }

        modal.style.display = 'none';
        loadPayments();
    } catch (error) {
        console.error('Ошибка:', error);
        alert('Ошибка при сохранении платежа');
    }
});

// Поиск платежей
searchInput.addEventListener('input', debounce(async () => {
    const searchValue = searchInput.value.trim();
    const searchBy = searchType.value;

    if (searchValue.length < 1) {
        loadPayments();
        return;
    }

    let url = '/api/payments';
    if (searchBy === 'loan') {
        url = `/api/payments/loan/${searchValue}`;
    } else if (searchBy === 'type') {
        url = `/api/payments?type=${searchValue}`;
    }

    try {
        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            throw new Error('Ошибка при поиске платежей');
        }

        const payments = await response.json();
        displayPayments(payments);
    } catch (error) {
        console.error('Ошибка:', error);
        alert('Ошибка при поиске платежей');
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

// Загрузка платежей при загрузке страницы
loadPayments();

// Делаем функции editPayment и deletePayment глобальными для использования в onclick
window.editPayment = editPayment;
window.deletePayment = deletePayment; 