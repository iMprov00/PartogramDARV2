// public/js/app.js - ПОЛНОСТЬЮ ОБНОВЛЕННЫЙ КОД

// Глобальные переменные
let patientsDataCache = {};
let indexTimerInterval = null;
let syncInterval = null;
let isPageVisible = true;
let lastSyncTime = 0;
let isSyncing = false;
let activePatientIds = new Set();

// Константы
const SYNC_INTERVAL_VISIBLE = 10000; // 10 секунд при видимой странице
const SYNC_INTERVAL_HIDDEN = 30000;  // 30 секунд при скрытой странице
const MIN_SYNC_INTERVAL = 3000;      // Минимальный интервал между синхронизациями
const TIMER_UPDATE_INTERVAL = 1000;  // 1 секунда для обновления таймеров

// Page Visibility API обработчик
function setupVisibilityHandler() {
  document.addEventListener('visibilitychange', function() {
    const wasVisible = isPageVisible;
    isPageVisible = !document.hidden;
    
    console.log(`Page visibility changed: ${wasVisible ? 'visible' : 'hidden'} -> ${isPageVisible ? 'visible' : 'hidden'}`);
    
    if (isPageVisible && !wasVisible) {
      // Страница стала видимой - немедленная синхронизация
      console.log('Page became visible, forcing sync');
      syncTimersWithServer(true);
      startTimers();
    } else if (!isPageVisible && wasVisible) {
      // Страница скрыта - останавливаем локальные таймеры
      console.log('Page hidden, stopping timers');
      stopTimers();
    }
  });
  
  // Инициализация состояния
  isPageVisible = !document.hidden;
  console.log(`Initial page visibility: ${isPageVisible ? 'visible' : 'hidden'}`);
}

// Запуск всех таймеров
function startTimers() {
  stopTimers();
  
  // Обновление локальных таймеров каждую секунду
  indexTimerInterval = setInterval(updateIndexTimers, TIMER_UPDATE_INTERVAL);
  
  // Запускаем синхронизацию с сервером
  startSync();
  
  console.log('Timers started');
}

// Остановка всех таймеров
function stopTimers() {
  if (indexTimerInterval) {
    clearInterval(indexTimerInterval);
    indexTimerInterval = null;
  }
  if (syncInterval) {
    clearInterval(syncInterval);
    syncInterval = null;
  }
  console.log('Timers stopped');
}

// Запуск синхронизации с сервером
function startSync() {
  if (syncInterval) clearInterval(syncInterval);
  
  // Определяем интервал в зависимости от видимости страницы
  const interval = isPageVisible ? SYNC_INTERVAL_VISIBLE : SYNC_INTERVAL_HIDDEN;
  
  console.log(`Setting sync interval to ${interval}ms (${isPageVisible ? 'visible' : 'hidden'})`);
  
  syncInterval = setInterval(() => {
    syncTimersWithServer(false);
  }, interval);
  
  // Первая синхронизация
  syncTimersWithServer(true);
}

// Улучшенная синхронизация с сервером
async function syncTimersWithServer(force = false) {
  const now = Date.now();
  const timeSinceLastSync = now - lastSyncTime;
  
  // Если уже идет синхронизация или прошло мало времени (и не форсированная)
  if (isSyncing || (!force && timeSinceLastSync < MIN_SYNC_INTERVAL)) {
    return;
  }
  
  isSyncing = true;
  lastSyncTime = now;
  
  try {
    console.log(`${force ? 'Forced' : 'Regular'} sync started`);
    
    // Получаем обновленные данные для всех пациентов
    const response = await fetch('/api/patients/timers?_=' + Date.now());
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const patientsData = await response.json();
    
    // Обновляем кэш
    patientsDataCache = patientsData.reduce((acc, patient) => {
      acc[patient.id] = patient;
      activePatientIds.add(patient.id);
      return acc;
    }, {});
    
    // Обновляем только строки с таймерами
    updateTimersFromCache();
    
    console.log(`Sync completed: ${patientsData.length} patients updated`);
    
    // Показываем уведомление о успешной синхронизации (только для форсированной)
    if (force && patientsData.length > 0) {
      showNotification('Данные синхронизированы', 'info', 2000);
    }
  } catch (error) {
    console.error('Error syncing timers:', error);
    showNotification('Ошибка синхронизации таймеров', 'danger');
  } finally {
    isSyncing = false;
  }
}

// Обновление таймеров из кэша
function updateTimersFromCache() {
  const timerBadges = document.querySelectorAll('.timer-badge-modern[data-patient-id]');
  
  if (timerBadges.length === 0) return;
  
  let updatedCount = 0;
  
  timerBadges.forEach(badge => {
    const patientId = parseInt(badge.dataset.patientId);
    const patientData = patientsDataCache[patientId];
    
    if (patientData) {
      const oldStatus = badge.dataset.status;
      const oldPeriod = badge.dataset.period;
      
      // Обновляем атрибуты
      badge.dataset.remainingTime = patientData.remaining_time;
      badge.dataset.duration = patientData.timer_duration;
      badge.dataset.status = patientData.status;
      badge.dataset.period = patientData.period;
      
      // Обновляем отображение
      updateSingleTimer(badge);
      
      // Если статус или период изменился, обновляем всю строку
      if (oldStatus !== patientData.status || oldPeriod !== patientData.period.toString()) {
        const row = badge.closest('tr');
        if (row) {
          updatePatientRowStatus(row, patientData);
          updatedCount++;
        }
      }
    }
  });
  
  if (updatedCount > 0) {
    console.log(`${updatedCount} patient rows updated`);
  }
}

// Обновление одного таймера
function updateSingleTimer(badge) {
  const status = badge.dataset.status;
  const patientId = badge.dataset.patientId;
  
  // Если статус не "в родах", показываем прочерк
  if (status !== 'в родах') {
    badge.textContent = '—';
    badge.className = 'badge timer-badge-modern timer-completed';
    return;
  }
  
  let remainingTime = parseInt(badge.dataset.remainingTime) || 0;
  const period = parseInt(badge.dataset.period) || 1;
  
  if (remainingTime > 0) {
    // Форматируем время
    const minutes = Math.floor(remainingTime / 60);
    const seconds = remainingTime % 60;
    const timeText = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    
    // Обновляем текст
    badge.textContent = timeText;
    
    // Обновляем стили
    badge.classList.remove('timer-primary', 'timer-warning', 'timer-danger');
    
    // Определяем цвет в зависимости от оставшегося времени и периода
    const warningThreshold = period === 2 ? 150 : 300; // 2.5 мин для 2 периода, 5 мин для 1
    const dangerThreshold = period === 2 ? 60 : 120;   // 1 мин для 2 периода, 2 мин для 1
    
    if (remainingTime < dangerThreshold) {
      badge.classList.add('timer-danger');
    } else if (remainingTime < warningThreshold) {
      badge.classList.add('timer-warning');
    } else {
      badge.classList.add('timer-primary');
    }
    
    // Уменьшаем локальное значение (только если страница видима)
    if (isPageVisible) {
      remainingTime--;
      badge.dataset.remainingTime = remainingTime;
    }
  } else {
    badge.textContent = '00:00';
    badge.classList.remove('timer-primary', 'timer-warning');
    badge.classList.add('timer-danger');
  }
}

// Обновление всех таймеров на странице
function updateIndexTimers() {
  // Обновляем только если страница видима
  if (!isPageVisible) return;
  
  const timerBadges = document.querySelectorAll('.timer-badge-modern[data-patient-id][data-status="в родах"]');
  
  if (timerBadges.length === 0) return;
  
  timerBadges.forEach(badge => {
    updateSingleTimer(badge);
  });
}

// Обновление статуса строки пациента
// Обновляем статус строки пациента
function updatePatientRowStatus(row, patientData) {
  const statusBadge = row.querySelector('.status-badge-modern');
  const timerBadge = row.querySelector('.timer-badge-modern');
  const partogramBtn = row.querySelector('a[href*="/partogram"]');
  
  // Обновляем статус
  if (statusBadge) {
    statusBadge.className = `badge status-badge-modern bg-${patientData.status_color}`;
    statusBadge.textContent = patientData.status;
  }
  
  // Обновляем таймер
  if (timerBadge) {
    timerBadge.dataset.status = patientData.status;
    timerBadge.dataset.period = patientData.period;
    timerBadge.dataset.remainingTime = patientData.remaining_time;
    timerBadge.dataset.duration = patientData.timer_duration;
    updateSingleTimer(timerBadge);
  }
  
  // Обновляем кнопку партограммы если нужно
  if (partogramBtn) {
    if (patientData.status === 'роды не начались') {
      partogramBtn.className = 'btn btn-outline-primary';
      partogramBtn.title = 'Добавить партограмму';
      partogramBtn.innerHTML = '<i class="bi bi-plus-circle"></i>';
    } else {
      partogramBtn.className = 'btn btn-primary';
      partogramBtn.title = 'Перейти к партограмме';
      partogramBtn.innerHTML = '<i class="bi bi-graph-up"></i>';
    }
  }
}
// Функция applyFilters (обновленная)
function applyFilters() {
  console.log('applyFilters function called');
  
  const search = document.getElementById('search-input')?.value || '';
  const status = document.getElementById('status-filter')?.value || 'all';
  const dateFilterToggle = document.getElementById('date-filter-toggle');
  const date = document.getElementById('date-filter')?.value || '';
  const filterByDate = dateFilterToggle?.checked ? 'true' : 'false';
  
  console.log('Filter parameters:', { search, status, date, filterByDate });
  
  // Показать индикатор загрузки
  showLoading(true);
  
  // Формируем URL с параметрами
  const url = `/api/patients?search=${encodeURIComponent(search)}&status=${encodeURIComponent(status)}&admission_date=${encodeURIComponent(date)}&filter_by_date=${encodeURIComponent(filterByDate)}`;
  
  console.log('Fetching from URL:', url);
  
  // Запрос к API
  fetch(url + '&_=' + Date.now())
    .then(response => {
      console.log('API Response status:', response.status);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return response.json();
    })
    .then(patients => {
      console.log('Received patients:', patients.length);
      
      // Кэшируем данные пациентов
      patientsDataCache = {};
      activePatientIds.clear();
      
      patients.forEach(patient => {
        patientsDataCache[patient.id] = patient;
        activePatientIds.add(patient.id);
      });
      
      updatePatientsTable(patients);
      updatePatientsCount(patients.length);
      showLoading(false);
      
      // После загрузки фильтрованных данных запускаем таймеры
      startTimers();
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
    
    // Данные для таймера
    const timerData = getTimerData(patient);
    
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
        <span class="badge status-badge-modern bg-${patient.status_color}">
          ${patient.status}
        </span>
      </td>
      <td>
        <span class="badge timer-badge-modern ${timerData.class}" 
              id="timer-${patient.id}"
              data-patient-id="${patient.id}"
              data-remaining-time="${timerData.remaining}"
              data-duration="${timerData.duration}"
              data-period="${patient.period || 1}"
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
      duration: patient.timer_duration || 30
    };
  }
  
  let remainingTime = patient.remaining_time || 0;
  const period = patient.period || 1;
  
  // Если данные есть, форматируем
  if (remainingTime > 0) {
    const minutes = Math.floor(remainingTime / 60);
    const seconds = remainingTime % 60;
    const timerText = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    
    let timerClass = 'timer-primary';
    const warningThreshold = period === 2 ? 150 : 300;
    const dangerThreshold = period === 2 ? 60 : 120;
    
    if (remainingTime < dangerThreshold) {
      timerClass = 'timer-danger';
    } else if (remainingTime < warningThreshold) {
      timerClass = 'timer-warning';
    }
    
    return {
      text: timerText,
      class: timerClass,
      remaining: remainingTime,
      duration: patient.timer_duration || (period === 2 ? 15 : 30)
    };
  } else {
    // Таймер истек, но статус еще "в родах"
    return {
      text: '00:00',
      class: 'timer-danger',
      remaining: 0,
      duration: patient.timer_duration || (period === 2 ? 15 : 30)
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
  }
  
  loadingDiv.style.display = show ? 'flex' : 'none';
}

// Показать уведомление
function showAlert(message, type = 'info', duration = 5000) {
  // Удаляем старые уведомления
  const oldAlerts = document.querySelectorAll('.custom-notification');
  oldAlerts.forEach(alert => alert.remove());
  
  const alertDiv = document.createElement('div');
  alertDiv.className = `custom-notification alert alert-${type} alert-dismissible fade show`;
  
  Object.assign(alertDiv.style, {
    position: 'fixed',
    top: '80px',
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
  
  // Автоматически скрыть
  setTimeout(() => {
    if (alertDiv.parentNode) {
      alertDiv.classList.add('fade');
      setTimeout(() => {
        if (alertDiv.parentNode) {
          alertDiv.remove();
        }
      }, 300);
    }
  }, duration);
  
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

// Показать уведомление (синоним для совместимости)
function showNotification(message, type = 'info', duration = 5000) {
  showAlert(message, type, duration);
}

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', function() {
  console.log('DOM fully loaded - enhanced timer system');
  
  // Настройка обработчика видимости страницы
  setupVisibilityHandler();
  
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
  
  // Если есть таблица пациентов, запускаем систему таймеров
  if (document.getElementById('patients-table')) {
    console.log('Patients table found, starting timers system');
    
    // Загружаем начальные данные
    applyFilters();
  } else {
    console.log('No patients table found, timers system not started');
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
    
    /* Стили для индикатора загрузки */
    .loading-overlay {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(255, 255, 255, 0.9);
      display: none;
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
  
  // Делаем функции глобально доступными
  window.applyFilters = applyFilters;
  window.showAlert = showAlert;
  window.showNotification = showNotification;
  window.syncTimersWithServer = syncTimersWithServer;
});

// Очистка при закрытии страницы
window.addEventListener('beforeunload', function() {
  stopTimers();
});

// Делаем функции доступными глобально
window.applyFilters = applyFilters;
window.showAlert = showAlert;
window.showNotification = showNotification;
window.syncTimersWithServer = syncTimersWithServer;