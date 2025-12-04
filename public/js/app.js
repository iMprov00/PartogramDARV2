// /public/js/app.js - Оптимизированная версия для нового дизайна

// Глобальная функция applyFilters
function applyFilters() {
  console.log('applyFilters function called');
  
  const search = document.getElementById('search-input')?.value || '';
  const status = document.getElementById('status-filter')?.value || 'all';
  const dateFilterToggle = document.getElementById('date-filter-toggle');
  const date = document.getElementById('date-filter')?.value || '';
  const filterByDate = dateFilterToggle?.checked ? 'true' : 'false';
  
  console.log('Filter parameters:', { search, status, date, filterByDate });
  
  // Показать индикатор загрузки с новым стилем
  showLoading(true);
  
  // Формируем URL с параметрами
  const url = `/api/patients?search=${encodeURIComponent(search)}&status=${encodeURIComponent(status)}&admission_date=${encodeURIComponent(date)}&filter_by_date=${encodeURIComponent(filterByDate)}`;
  
  console.log('Fetching from URL:', url);
  
  // Запрос к API
  fetch(url)
    .then(response => {
      console.log('API Response status:', response.status);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return response.json();
    })
    .then(patients => {
      console.log('Received patients:', patients.length);
      updatePatientsTable(patients);
      updatePatientsCount(patients.length);
      showLoading(false);
    })
    .catch(error => {
      console.error('Error fetching patients:', error);
      showLoading(false);
      showAlert('Ошибка при загрузке данных: ' + error.message, 'danger');
    });
}

// Обновление таблицы пациентов
function updatePatientsTable(patients) {
  console.log('Updating table with', patients.length, 'patients');
  
  const tbody = document.getElementById('patients-tbody');
  if (!tbody) {
    console.error('Table body not found!');
    return;
  }
  
  tbody.innerHTML = '';
  
  if (patients.length === 0) {
    tbody.innerHTML = `
      <tr class="no-data-row">
        <td colspan="6">
          <div class="text-center py-5">
            <i class="bi bi-search display-4 d-block mb-3 text-muted"></i>
            <h5 class="text-secondary">Пациенты не найдены</h5>
            <p class="text-muted">Попробуйте изменить параметры поиска</p>
          </div>
        </td>
      </tr>
    `;
    return;
  }
  
  patients.forEach((patient, index) => {
    const row = document.createElement('tr');
    row.className = 'fade-in';
    row.dataset.patientId = patient.id;
    
    // Определяем цвета статуса
    let statusColor = 'secondary';
    let statusText = patient.status;
    
    if (patient.status === 'роды не начались') {
      statusColor = 'secondary';
      statusText = 'Роды не начались';
    } else if (patient.status === 'в родах') {
      statusColor = 'danger';
      statusText = 'В родах';
    } else if (patient.status === 'роды завершены') {
      statusColor = 'success';
      statusText = 'Роды завершены';
    }
    
    // Таймер
    let timerText = 'Не активно';
    let timerClass = 'timer-completed';
    
    if (patient.status === 'в родах') {
      // Здесь можно добавить логику расчета времени
      timerText = '00:00:00';
      timerClass = 'timer-danger';
    } else if (patient.status === 'роды не начались') {
      timerText = '—';
      timerClass = 'timer-completed';
    }
    
    // Форматируем дату
    let formattedDate = '';
    try {
      const admissionDate = new Date(patient.admission_date);
      formattedDate = admissionDate.toLocaleDateString('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });
    } catch (e) {
      formattedDate = patient.admission_date;
    }
    
    row.innerHTML = `
      <td class="fw-medium">${index + 1}</td>
      <td>
        <div class="d-flex align-items-center">
          <i class="bi bi-person-circle me-2 text-primary"></i>
          <div>
            <strong>${patient.full_name}</strong>
            ${patient.age ? `<small class="d-block text-muted">${patient.age} лет</small>` : ''}
          </div>
        </div>
      </td>
      <td>${formattedDate}</td>
      <td>
        <span class="badge status-badge-modern bg-${statusColor}">
          ${statusText}
        </span>
      </td>
      <td>
        <span class="badge timer-badge-modern ${timerClass}">
          ${timerText}
        </span>
      </td>
      <td>
        <div class="table-actions-modern">
          ${getPartogramButton(patient)}
          <a href="/patients/${patient.id}/edit" 
             class="btn btn-outline-secondary"
             title="Изменить">
            <i class="bi bi-pencil"></i>
          </a>
          <button type="button" 
                  class="btn btn-outline-danger delete-btn"
                  data-patient-id="${patient.id}"
                  data-patient-name="${patient.full_name}"
                  title="Удалить">
            <i class="bi bi-trash"></i>
          </button>
        </div>
      </td>
    `;
    
    tbody.appendChild(row);
  });
  
  // Инициализируем кнопки удаления
  initDeleteButtons();
}

// Вспомогательная функция для кнопки партограммы
function getPartogramButton(patient) {
  if (patient.status === 'роды не начались') {
    return `
      <a href="/patients/${patient.id}/partogram" 
         class="btn btn-outline-primary"
         title="Добавить партограмму">
        <i class="bi bi-plus-circle"></i>
      </a>
    `;
  } else {
    return `
      <a href="/patients/${patient.id}/partogram" 
         class="btn btn-primary"
         title="Перейти к партограмме">
        <i class="bi bi-graph-up"></i>
      </a>
    `;
  }
}

// Управление индикатором загрузки
function showLoading(show) {
  let loadingDiv = document.getElementById('loading');
  
  if (!loadingDiv) {
    loadingDiv = document.createElement('div');
    loadingDiv.id = 'loading';
    loadingDiv.className = 'loading-overlay';
    loadingDiv.innerHTML = `
      <div class="loading-content">
        <div class="spinner-border text-primary" role="status">
          <span class="visually-hidden">Загрузка...</span>
        </div>
        <p class="mt-2 text-primary">Загрузка данных...</p>
      </div>
    `;
    document.body.appendChild(loadingDiv);
    
    // Добавим стили для индикатора загрузки
    const style = document.createElement('style');
    style.textContent = `
      .loading-overlay {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(255, 255, 255, 0.9);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 9999;
        backdrop-filter: blur(2px);
      }
      .loading-content {
        text-align: center;
        background: white;
        padding: 2rem;
        border-radius: 16px;
        box-shadow: 0 10px 40px rgba(0, 0, 0, 0.1);
      }
    `;
    document.head.appendChild(style);
  }
  
  loadingDiv.style.display = show ? 'flex' : 'none';
}

// Показать уведомление
function showAlert(message, type = 'info') {
  const alertDiv = document.createElement('div');
  alertDiv.className = `alert alert-${type} alert-dismissible fade show position-fixed top-0 end-0 m-3`;
  alertDiv.style.zIndex = '1000';
  alertDiv.style.maxWidth = '400px';
  alertDiv.innerHTML = `
    <div class="d-flex align-items-center">
      <i class="bi ${type === 'danger' ? 'bi-exclamation-triangle-fill' : 'bi-info-circle-fill'} me-2"></i>
      <div>${message}</div>
    </div>
    <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
  `;
  
  document.body.appendChild(alertDiv);
  
  // Автоматически скрыть через 5 секунд
  setTimeout(() => {
    if (alertDiv.parentNode) {
      alertDiv.remove();
    }
  }, 5000);
}

// Инициализация кнопок удаления
function initDeleteButtons() {
  const deleteButtons = document.querySelectorAll('.delete-btn');
  const deleteModal = document.getElementById('deleteModal');
  
  if (!deleteModal) {
    console.error('Delete modal not found');
    return;
  }
  
  const modal = new bootstrap.Modal(deleteModal);
  const patientNameElement = document.getElementById('patient-name-to-delete');
  const confirmDeleteButton = document.getElementById('confirm-delete');
  
  let patientToDelete = null;
  
  deleteButtons.forEach(button => {
    button.addEventListener('click', function(e) {
      e.preventDefault();
      patientToDelete = this.dataset.patientId;
      const patientName = this.dataset.patientName;
      
      if (patientNameElement) {
        patientNameElement.textContent = patientName;
      }
      
      modal.show();
    });
  });
  
  if (confirmDeleteButton) {
    confirmDeleteButton.addEventListener('click', function() {
      if (!patientToDelete) {
        showAlert('Ошибка: пациент не выбран для удаления', 'danger');
        return;
      }
      
      // Создаем форму для отправки DELETE запроса
      const form = document.createElement('form');
      form.method = 'POST';
      form.action = `/patients/${patientToDelete}`;
      
      const methodInput = document.createElement('input');
      methodInput.type = 'hidden';
      methodInput.name = '_method';
      methodInput.value = 'DELETE';
      
      const csrfToken = document.querySelector('meta[name="csrf-token"]');
      if (csrfToken) {
        const csrfInput = document.createElement('input');
        csrfInput.type = 'hidden';
        csrfInput.name = 'authenticity_token';
        csrfInput.value = csrfToken.content;
        form.appendChild(csrfInput);
      }
      
      form.appendChild(methodInput);
      document.body.appendChild(form);
      form.submit();
    });
  }
}

// Обновление счетчика пациентов
function updatePatientsCount(count) {
  const countElement = document.getElementById('patients-count');
  if (countElement) {
    countElement.innerHTML = `<i class="bi bi-people me-1"></i> Всего пациенток: <strong>${count}</strong>`;
  }
}

// Инициализация при загрузке страницы
// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', function() {
  console.log('DOM fully loaded - new design');
  
  // Инициализация фильтров
  const dateFilterToggle = document.getElementById('date-filter-toggle');
  const dateFilter = document.getElementById('date-filter');
  
  if (dateFilterToggle && dateFilter) {
    // Устанавливаем сегодняшнюю дату
    const today = new Date().toISOString().split('T')[0];
    dateFilter.value = today;
    
    dateFilterToggle.addEventListener('change', function() {
      dateFilter.disabled = !this.checked;
      if (!this.checked) {
        dateFilter.value = '';
      } else {
        dateFilter.value = today;
      }
      dateFilter.classList.toggle('bg-light', this.checked);
    });
  }
  
  // Кнопка "Применить фильтры"
  const applyFiltersBtn = document.getElementById('apply-filters-btn');
  if (applyFiltersBtn) {
    applyFiltersBtn.addEventListener('click', function(e) {
      e.preventDefault();
      applyFilters();
    });
  }
  
  // Поиск по вводу с дебаунсом
  const searchInput = document.getElementById('search-input');
  if (searchInput) {
    let searchTimeout;
    searchInput.addEventListener('input', function() {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(applyFilters, 400);
    });
  }
  
  // Фильтр по статусу
  const statusFilter = document.getElementById('status-filter');
  if (statusFilter) {
    statusFilter.addEventListener('change', applyFilters);
  }
  
  // Фильтр по дате
  if (dateFilter) {
    dateFilter.addEventListener('change', applyFilters);
  }
  
  // ИНИЦИАЛИЗАЦИЯ КНОПОК УДАЛЕНИЯ ПРИ ЗАГРУЗКЕ СТРАНИЦЫ - ДОБАВЬТЕ ЭТО!
  initDeleteButtons();
  
  // Добавляем анимацию для строк таблицы
  const style = document.createElement('style');
  style.textContent = `
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(5px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .fade-in {
      animation: fadeIn 0.3s ease-out;
    }
  `;
  document.head.appendChild(style);
  
  // Делаем функцию глобально доступной
  window.applyFilters = applyFilters;
});

// Делаем функции доступными глобально
window.applyFilters = applyFilters;
window.showAlert = showAlert;