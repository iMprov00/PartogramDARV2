// Упрощенная версия app.js с исправлениями
console.log('app.js loaded successfully');

// Глобальная функция applyFilters
function applyFilters() {
  console.log('applyFilters function called');
  
  const search = document.getElementById('search-input')?.value || '';
  const status = document.getElementById('status-filter')?.value || 'all';
  const dateFilterToggle = document.getElementById('date-filter-toggle');
  const date = document.getElementById('date-filter')?.value || '';
  const filterByDate = dateFilterToggle?.checked ? 'true' : 'false';
  
  console.log('Filter parameters:', { search, status, date, filterByDate });
  
  // Показать индикатор загрузки
  const loadingDiv = document.getElementById('loading');
  if (loadingDiv) loadingDiv.style.display = 'block';
  
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
      console.log('Received patients:', patients);
      updatePatientsTable(patients);
      updatePatientsCount(patients.length);
      if (loadingDiv) loadingDiv.style.display = 'none';
    })
    .catch(error => {
      console.error('Error fetching patients:', error);
      if (loadingDiv) loadingDiv.style.display = 'none';
      alert('Ошибка при загрузке данных: ' + error.message);
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
      <tr>
        <td colspan="6" class="text-center py-4 text-muted">
          <i class="bi bi-search display-4 d-block mb-3"></i>
          <h4>Пациенты не найдены</h4>
          <p>Попробуйте изменить параметры поиска</p>
        </td>
      </tr>
    `;
    return;
  }
  
  patients.forEach((patient, index) => {
    const row = document.createElement('tr');
    row.dataset.patientId = patient.id;
    
    // Определяем цвета статуса
    let statusColor = 'secondary';
    if (patient.status === 'роды не начались') statusColor = 'secondary';
    if (patient.status === 'в родах') statusColor = 'danger';
    if (patient.status === 'роды завершены') statusColor = 'success';
    
    // Таймер
    let timerText = 'Таймер не активен';
    let timerClass = 'timer-completed';
    if (patient.status === 'в родах') {
      timerText = '00:00:00';
      timerClass = 'timer-danger';
    }
    
    // Кнопка партограммы
    let partogramButtonText = 'Партограмма';
    let partogramButtonClass = 'btn-outline-secondary';
    if (patient.status === 'роды не начались') {
      partogramButtonText = 'Добавить партограмму';
      partogramButtonClass = 'btn-outline-primary';
    } else if (patient.status === 'в родах') {
      partogramButtonText = 'Перейти к партограмме';
      partogramButtonClass = 'btn-primary';
    }
    
    // Форматируем дату
    let formattedDate = '';
    try {
      const admissionDate = new Date(patient.admission_date);
      formattedDate = admissionDate.toLocaleDateString('ru-RU');
    } catch (e) {
      formattedDate = patient.admission_date;
    }
    
    row.innerHTML = `
      <td>${index + 1}</td>
      <td><strong>${patient.full_name}</strong></td>
      <td>${formattedDate}</td>
      <td>
        <span class="badge bg-${statusColor} status-badge">
          ${patient.status}
        </span>
      </td>
      <td>
        <span class="badge ${timerClass} timer-badge">
          ${timerText}
        </span>
      </td>
      <td>
        <div class="btn-group btn-group-sm" role="group">
          <a href="/patients/${patient.id}/partogram" 
             class="btn ${partogramButtonClass} touch-friendly">
            <i class="bi bi-graph-up"></i>
            <span class="d-none d-md-inline">${partogramButtonText}</span>
          </a>
          <a href="/patients/${patient.id}/edit" 
             class="btn btn-outline-secondary touch-friendly">
            <i class="bi bi-pencil"></i>
            <span class="d-none d-md-inline">Изменить</span>
          </a>
          <button type="button" 
                  class="btn btn-outline-danger delete-btn touch-friendly"
                  data-patient-id="${patient.id}"
                  data-patient-name="${patient.full_name}">
            <i class="bi bi-trash"></i>
            <span class="d-none d-md-inline">Удалить</span>
          </button>
        </div>
      </td>
    `;
    
    tbody.appendChild(row);
  });
  
  // Инициализируем кнопки удаления
  initDeleteButtons();
}

// Инициализация кнопок удаления
function initDeleteButtons() {
  console.log('Initializing delete buttons');
  
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
      
      console.log('Preparing to delete patient:', patientName, patientToDelete);
      
      if (patientNameElement) {
        patientNameElement.textContent = patientName;
      }
      
      modal.show();
    });
  });
  
  if (confirmDeleteButton) {
    confirmDeleteButton.addEventListener('click', function() {
      if (!patientToDelete) {
        alert('Ошибка: пациент не выбран для удаления');
        return;
      }
      
      console.log('Deleting patient:', patientToDelete);
      
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
    countElement.textContent = `Всего пациенток: ${count}`;
  }
}

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', function() {
  console.log('DOM fully loaded');
  
  // Инициализация фильтров
  const dateFilterToggle = document.getElementById('date-filter-toggle');
  const dateFilter = document.getElementById('date-filter');
  
  if (dateFilterToggle && dateFilter) {
    dateFilterToggle.addEventListener('change', function() {
      dateFilter.disabled = !this.checked;
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
  
  // Поиск по вводу
  const searchInput = document.getElementById('search-input');
  if (searchInput) {
    let searchTimeout;
    searchInput.addEventListener('input', function() {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(applyFilters, 300);
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
  
  // Проверяем доступность функции
  console.log('applyFilters function available:', typeof applyFilters === 'function');
  
  // Делаем функцию глобально доступной
  window.applyFilters = applyFilters;
});

// Делаем функцию доступной глобально (на всякий случай)
window.applyFilters = applyFilters;
window.updatePatientsTable = updatePatientsTable;