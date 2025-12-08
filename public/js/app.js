// /public/js/app.js - Полностью обновленная версия с таймерами каждую секунду

// Глобальные переменные
let patientsDataCache = {};
let indexTimerInterval = null;
let activeTimers = new Map(); // Хранит активные таймеры

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
      
      // Кэшируем данные пациентов для обновления таймеров
      patientsDataCache = {};
      patients.forEach(patient => {
        patientsDataCache[patient.id] = patient;
      });
      
      updatePatientsTable(patients);
      updatePatientsCount(patients.length);
      showLoading(false);
      
      // Запускаем обновление таймеров после загрузки таблицы
      startIndexTimers();
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
    
    // Получаем данные таймера
    const timerData = getTimerData(patient);
    
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
        <span class="badge timer-badge-modern ${timerData.class}" 
              id="timer-${patient.id}"
              data-patient-id="${patient.id}"
              data-remaining-time="${timerData.remaining}"
              data-duration="${timerData.duration}"
              data-status="${patient.status}">
          ${timerData.text}
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

// Получение данных таймера
function getTimerData(patient) {
  if (patient.status !== 'в родах') {
    return {
      text: '—',
      class: 'timer-completed',
      remaining: 0,
      duration: 0
    };
  }
  
  let remainingTime = patient.remaining_time || 0;
  
  // Если данные есть, форматируем
  if (remainingTime > 0) {
    const minutes = Math.floor(remainingTime / 60);
    const seconds = remainingTime % 60;
    const timerText = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    
    let timerClass = 'timer-primary';
    if (remainingTime < 300) { // < 5 минут
      timerClass = 'timer-danger';
    } else if (remainingTime < 600) { // < 10 минут
      timerClass = 'timer-warning';
    }
    
    return {
      text: timerText,
      class: timerClass,
      remaining: remainingTime,
      duration: patient.current_timer_duration || 30
    };
  } else {
    // Таймер истек, но статус еще "в родах"
    return {
      text: '00:00',
      class: 'timer-danger',
      remaining: 0,
      duration: patient.current_timer_duration || 30
    };
  }
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

// Запуск обновления таймеров на главной странице
function startIndexTimers() {
  // Останавливаем предыдущий интервал
  if (indexTimerInterval) {
    clearInterval(indexTimerInterval);
  }
  
  // Обновляем таймеры сразу
  updateIndexTimers();
  
  // Запускаем обновление каждую секунду
  indexTimerInterval = setInterval(updateIndexTimers, 1000);
  
  // Синхронизируем с сервером каждые 30 секунд
  setInterval(syncTimersWithServer, 30000);
}

// Обновление всех таймеров на главной странице
function updateIndexTimers() {
  const timerBadges = document.querySelectorAll('.timer-badge-modern[data-patient-id]');
  
  if (timerBadges.length === 0) return;
  
  timerBadges.forEach(badge => {
    const status = badge.dataset.status;
    
    // Обновляем только активные таймеры (статус "в родах")
    if (status === 'в родах') {
      updateSingleTimer(badge);
    }
  });
}

// Обновление одного таймера
function updateSingleTimer(badge) {
  let remainingTime = parseInt(badge.dataset.remainingTime) || 0;
  const duration = parseInt(badge.dataset.duration) || 30;
  
  if (remainingTime > 0) {
    // Уменьшаем оставшееся время
    remainingTime--;
    badge.dataset.remainingTime = remainingTime;
    
    // Обновляем отображение
    const minutes = Math.floor(remainingTime / 60);
    const seconds = remainingTime % 60;
    badge.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    
    // Обновляем классы
    badge.classList.remove('timer-primary', 'timer-warning', 'timer-danger');
    
    if (remainingTime < 300) { // < 5 минут
      badge.classList.add('timer-danger');
    } else if (remainingTime < 600) { // < 10 минут
      badge.classList.add('timer-warning');
    } else {
      badge.classList.add('timer-primary');
    }
  } else if (badge.dataset.status === 'в родах') {
    // Таймер истек, но статус еще "в родах"
    badge.textContent = '00:00';
    badge.classList.remove('timer-primary', 'timer-warning');
    badge.classList.add('timer-danger');
  }
}

// Синхронизация таймеров с сервером
function syncTimersWithServer() {
  const timerBadges = document.querySelectorAll('.timer-badge-modern[data-status="в родах"]');
  
  if (timerBadges.length === 0) return;
  
  const patientIds = Array.from(timerBadges).map(badge => badge.dataset.patientId);
  
  // Делаем запрос для каждого пациента
  patientIds.forEach(patientId => {
    fetch(`/api/patients/${patientId}/data`)
      .then(response => {
        if (!response.ok) throw new Error('Network response was not ok');
        return response.json();
      })
      .then(data => {
        // Обновляем кэш
        if (patientsDataCache[patientId]) {
          patientsDataCache[patientId].remaining_time = data.remaining_time;
          patientsDataCache[patientId].current_timer_duration = data.current_duration;
          patientsDataCache[patientId].status = data.status;
        }
        
        // Обновляем бейдж
        const badge = document.getElementById(`timer-${patientId}`);
        if (badge) {
          badge.dataset.remainingTime = data.remaining_time;
          badge.dataset.duration = data.current_duration;
          badge.dataset.status = data.status;
          
          // Если статус изменился, обновляем весь ряд
          if (data.status !== 'в родах') {
            const row = badge.closest('tr');
            if (row) {
              updatePatientRowStatus(row, data.status);
            }
          }
        }
      })
      .catch(error => {
        console.error('Error syncing timer for patient', patientId, error);
      });
  });
}

// Обновление статуса пациента в строке
function updatePatientRowStatus(row, newStatus) {
  const statusBadge = row.querySelector('.status-badge-modern');
  const timerBadge = row.querySelector('.timer-badge-modern');
  
  if (!statusBadge || !timerBadge) return;
  
  let statusColor = 'secondary';
  let statusText = newStatus;
  
  if (newStatus === 'роды не начались') {
    statusColor = 'secondary';
    statusText = 'Роды не начались';
  } else if (newStatus === 'в родах') {
    statusColor = 'danger';
    statusText = 'В родах';
  } else if (newStatus === 'роды завершены') {
    statusColor = 'success';
    statusText = 'Роды завершены';
  }
  
  // Обновляем статус
  statusBadge.className = `badge status-badge-modern bg-${statusColor}`;
  statusBadge.textContent = statusText;
  
  // Обновляем таймер
  timerBadge.dataset.status = newStatus;
  if (newStatus !== 'в родах') {
    timerBadge.textContent = '—';
    timerBadge.className = 'badge timer-badge-modern timer-completed';
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
// public/js/app.js - обновим функцию showAlert
function showAlert(message, type = 'info') {
  // Удаляем старые уведомления
  const oldAlerts = document.querySelectorAll('.custom-notification');
  oldAlerts.forEach(alert => alert.remove());
  
  const alertDiv = document.createElement('div');
  alertDiv.className = `custom-notification alert alert-${type} alert-dismissible fade show`;
  
  // Стили для корректного отображения
  Object.assign(alertDiv.style, {
    position: 'fixed',
    top: '80px', // Отступ от верха под навбаром
    right: '20px',
    zIndex: '1060',
    maxWidth: '400px',
    minWidth: '300px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
    animation: 'slideInRight 0.3s ease-out'
  });
  
  alertDiv.innerHTML = `
    <div class="d-flex align-items-center">
      <i class="bi ${type === 'danger' ? 'bi-exclamation-triangle-fill' : 
                         type === 'success' ? 'bi-check-circle-fill' : 
                         type === 'warning' ? 'bi-exclamation-circle-fill' : 
                         'bi-info-circle-fill'} me-2"></i>
      <div class="flex-grow-1">${message}</div>
      <button type="button" class="btn-close btn-close-white" data-bs-dismiss="alert"></button>
    </div>
  `;
  
  document.body.appendChild(alertDiv);
  
  // Добавим стили анимации если их еще нет
  if (!document.querySelector('#notification-styles')) {
    const style = document.createElement('style');
    style.id = 'notification-styles';
    style.textContent = `
      @keyframes slideInRight {
        from {
          transform: translateX(100%);
          opacity: 0;
        }
        to {
          transform: translateX(0);
          opacity: 1;
        }
      }
      
      @keyframes slideOutRight {
        from {
          transform: translateX(0);
          opacity: 1;
        }
        to {
          transform: translateX(100%);
          opacity: 0;
        }
      }
      
      .custom-notification {
        animation: slideInRight 0.3s ease-out;
      }
      
      .custom-notification.fade {
        animation: slideOutRight 0.3s ease-out forwards;
      }
    `;
    document.head.appendChild(style);
  }
  
  // Автоматически скрыть через 5 секунд
  setTimeout(() => {
    if (alertDiv.parentNode) {
      alertDiv.classList.add('fade');
      setTimeout(() => {
        if (alertDiv.parentNode) {
          alertDiv.remove();
        }
      }, 300);
    }
  }, 5000);
  
  // Закрытие по кнопке
  const closeBtn = alertDiv.querySelector('.btn-close');
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      alertDiv.classList.add('fade');
      setTimeout(() => {
        if (alertDiv.parentNode) {
          alertDiv.remove();
        }
      }, 300);
    });
  }
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
document.addEventListener('DOMContentLoaded', function() {
  console.log('DOM fully loaded - new design with timers');
  
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
  
  // Инициализация кнопок удаления
  initDeleteButtons();
  
  // Если есть таблица пациентов, запускаем обновление таймеров
  if (document.getElementById('patients-table')) {
    // Сначала загружаем данные, затем запускаем таймеры
    applyFilters();
  }
  
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
    
    /* Стили для таймеров */
    .timer-badge-modern {
      font-family: 'Courier New', monospace;
      font-weight: bold;
      padding: 0.5rem 0.75rem;
      border-radius: 8px;
      min-width: 85px;
      text-align: center;
      display: inline-block;
      transition: all 0.3s ease;
    }
    
    .timer-primary {
      background-color: #e3f2fd !important;
      color: #0d6efd !important;
      border: 2px solid #0d6efd;
    }
    
    .timer-warning {
      background-color: #fff3cd !important;
      color: #ffc107 !important;
      border: 2px solid #ffc107;
      animation: pulse 2s infinite;
    }
    
    .timer-danger {
      background-color: #f8d7da !important;
      color: #dc3545 !important;
      border: 2px solid #dc3545;
      animation: pulse 1s infinite;
    }
    
    .timer-completed {
      background-color: #f8f9fa !important;
      color: #6c757d !important;
      border: 2px solid #dee2e6;
    }
    
    @keyframes pulse {
      0% { opacity: 1; }
      50% { opacity: 0.7; }
      100% { opacity: 1; }
    }
  `;
  document.head.appendChild(style);
  
  // Делаем функцию глобально доступной
  window.applyFilters = applyFilters;
});

// Делаем функции доступными глобально
window.applyFilters = applyFilters;
window.showAlert = showAlert;