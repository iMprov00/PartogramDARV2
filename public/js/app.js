document.addEventListener('DOMContentLoaded', function() {
  // Инициализация
  initFilters();
  initDeleteButtons();
  initAutoComplete();
  initTouchOptimizations();
  
  // Анимация навигации
  animateNavbar();
  
  // Анимация строк таблицы
  animateTableRows();
});

// Инициализация фильтров
function initFilters() {
  const dateFilterToggle = document.getElementById('date-filter-toggle');
  const dateFilter = document.getElementById('date-filter');
  
  if (dateFilterToggle && dateFilter) {
    dateFilterToggle.addEventListener('change', function() {
      dateFilter.disabled = !this.checked;
      if (this.checked) {
        dateFilter.focus();
      }
    });
  }
  
  // Поиск при вводе
  const searchInput = document.getElementById('search-input');
  if (searchInput) {
    let searchTimeout;
    searchInput.addEventListener('input', function() {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        applyFilters();
      }, 300); // Задержка 300ms
    });
  }
  
  // Фильтрация при изменении статуса
  const statusFilter = document.getElementById('status-filter');
  if (statusFilter) {
    statusFilter.addEventListener('change', applyFilters);
  }
  
  // Фильтрация при изменении даты
  if (dateFilter) {
    dateFilter.addEventListener('change', applyFilters);
  }
}

// Применение фильтров
function applyFilters() {
  const search = document.getElementById('search-input')?.value || '';
  const status = document.getElementById('status-filter')?.value || 'all';
  const dateFilterToggle = document.getElementById('date-filter-toggle');
  const date = document.getElementById('date-filter')?.value || '';
  const filterByDate = dateFilterToggle?.checked ? 'true' : 'false';
  
  // Показать индикатор загрузки
  showLoading();
  
  // Запрос к API
  fetch(`/api/patients?search=${encodeURIComponent(search)}&status=${status}&admission_date=${date}&filter_by_date=${filterByDate}`)
    .then(response => response.json())
    .then(patients => {
      updatePatientsTable(patients);
      updatePatientsCount(patients.length);
      hideLoading();
    })
    .catch(error => {
      console.error('Error:', error);
      hideLoading();
      alert('Ошибка при загрузке данных');
    });
}

// Обновление таблицы пациентов
function updatePatientsTable(patients) {
  const tbody = document.getElementById('patients-tbody');
  if (!tbody) return;
  
  tbody.innerHTML = '';
  
  patients.forEach((patient, index) => {
    const row = document.createElement('tr');
    row.dataset.patientId = patient.id;
    
    // Определяем цвета статуса
    let statusColor = 'secondary';
    if (patient.status === 'роды не начались') statusColor = 'secondary';
    if (patient.status === 'в родах') statusColor = 'danger';
    if (patient.status === 'роды завершены') statusColor = 'success';
    
    // Определяем текст и класс таймера
    let timerText = 'Таймер не активен';
    let timerClass = 'timer-completed';
    if (patient.status === 'в родах') {
      timerText = '00:00:00'; // Заглушка
      timerClass = 'timer-danger';
    }
    
    // Определяем текст и класс кнопки партограммы
    let partogramButtonText = 'Партограмма';
    let partogramButtonClass = 'btn-outline-secondary';
    if (patient.status === 'роды не начались') {
      partogramButtonText = 'Добавить партограмму';
      partogramButtonClass = 'btn-outline-primary';
    } else if (patient.status === 'в родах') {
      partogramButtonText = 'Перейти к партограмме';
      partogramButtonClass = 'btn-primary';
    } else if (patient.status === 'роды завершены') {
      partogramButtonText = 'Посмотреть партограмму';
      partogramButtonClass = 'btn-outline-secondary';
    }
    
    // Форматируем дату
    const admissionDate = new Date(patient.admission_date);
    const formattedDate = admissionDate.toLocaleDateString('ru-RU');
    
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
  
  // Переинициализация кнопок удаления
  initDeleteButtons();
  animateTableRows();
}

// Обновление счетчика пациентов
function updatePatientsCount(count) {
  const countElement = document.getElementById('patients-count');
  if (countElement) {
    countElement.textContent = `Всего пациенток: ${count}`;
  }
}

// Инициализация кнопок удаления
function initDeleteButtons() {
  const deleteButtons = document.querySelectorAll('.delete-btn');
  const deleteModal = new bootstrap.Modal(document.getElementById('deleteModal'));
  const patientNameElement = document.getElementById('patient-name-to-delete');
  const confirmDeleteButton = document.getElementById('confirm-delete');
  
  let patientToDelete = null;
  
  deleteButtons.forEach(button => {
    button.addEventListener('click', function(e) {
      e.preventDefault();
      const patientId = this.dataset.patientId;
      const patientName = this.dataset.patientName;
      
      patientToDelete = patientId;
      patientNameElement.textContent = patientName;
      deleteModal.show();
    });
  });
  
  if (confirmDeleteButton) {
    confirmDeleteButton.addEventListener('click', function() {
      if (!patientToDelete) return;
      
      // Отправка DELETE запроса
      fetch(`/patients/${patientToDelete}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        }
      })
      .then(response => {
        if (response.ok) {
          // Перезагружаем страницу для обновления списка
          window.location.reload();
        } else {
          alert('Ошибка при удалении пациентки');
        }
      })
      .catch(error => {
        console.error('Error:', error);
        alert('Ошибка при удалении пациентки');
      });
    });
  }
}

// Автодополнение для поиска
function initAutoComplete() {
  const searchInput = document.getElementById('search-input');
  if (!searchInput) return;
  
  // Можно добавить автодополнение здесь, если нужно
  // Для простоты оставим обычный поиск
}

// Оптимизация для сенсорных устройств
function initTouchOptimizations() {
  // Увеличиваем область клика для маленьких элементов
  const smallButtons = document.querySelectorAll('.btn-group-sm .btn');
  smallButtons.forEach(button => {
    button.style.minWidth = '44px';
    button.style.minHeight = '44px';
  });
  
  // Предотвращаем масштабирование при фокусе на мобильных устройствах
  const inputs = document.querySelectorAll('input, select, textarea');
  inputs.forEach(input => {
    input.addEventListener('focus', function() {
      if (window.innerWidth <= 768) {
        this.style.fontSize = '16px'; // Предотвращает масштабирование в iOS
      }
    });
  });
}

// Анимация навигации
function animateNavbar() {
  const navbar = document.querySelector('.navbar-main');
  if (!navbar) return;
  
  navbar.style.opacity = '0';
  navbar.style.transform = 'translateY(-20px)';
  
  setTimeout(() => {
    navbar.style.transition = 'all 0.5s ease-out';
    navbar.style.opacity = '1';
    navbar.style.transform = 'translateY(0)';
  }, 100);
}

// Анимация строк таблицы
function animateTableRows() {
  const rows = document.querySelectorAll('#patients-tbody tr');
  rows.forEach((row, index) => {
    row.style.opacity = '0';
    row.style.transform = 'translateX(-20px)';
    
    setTimeout(() => {
      row.style.transition = 'all 0.3s ease-out';
      row.style.opacity = '1';
      row.style.transform = 'translateX(0)';
    }, index * 50);
  });
}

// Показать индикатор загрузки
function showLoading() {
  let loadingDiv = document.getElementById('loading');
  if (!loadingDiv) {
    loadingDiv = document.createElement('div');
    loadingDiv.id = 'loading';
    loadingDiv.className = 'loading';
    loadingDiv.innerHTML = '<div class="spinner"></div><p>Загрузка...</p>';
    document.querySelector('.card-body').appendChild(loadingDiv);
  }
  loadingDiv.style.display = 'block';
}

// Скрыть индикатор загрузки
function hideLoading() {
  const loadingDiv = document.getElementById('loading');
  if (loadingDiv) {
    loadingDiv.style.display = 'none';
  }
}

// Сохранение состояния фильтров в localStorage
function saveFilterState() {
  const state = {
    search: document.getElementById('search-input')?.value || '',
    status: document.getElementById('status-filter')?.value || 'all',
    dateFilter: document.getElementById('date-filter-toggle')?.checked || false,
    date: document.getElementById('date-filter')?.value || ''
  };
  localStorage.setItem('patientFilters', JSON.stringify(state));
}

// Восстановление состояния фильтров из localStorage
function restoreFilterState() {
  const savedState = localStorage.getItem('patientFilters');
  if (savedState) {
    const state = JSON.parse(savedState);
    
    const searchInput = document.getElementById('search-input');
    const statusFilter = document.getElementById('status-filter');
    const dateFilterToggle = document.getElementById('date-filter-toggle');
    const dateFilter = document.getElementById('date-filter');
    
    if (searchInput) searchInput.value = state.search;
    if (statusFilter) statusFilter.value = state.status;
    if (dateFilterToggle) dateFilterToggle.checked = state.dateFilter;
    if (dateFilter) {
      dateFilter.value = state.date;
      dateFilter.disabled = !state.dateFilter;
    }
    
    // Если есть сохраненное состояние, применяем фильтры
    setTimeout(applyFilters, 100);
  }
}

// Сохраняем состояние фильтров при изменении
document.addEventListener('input', saveFilterState);
document.addEventListener('change', saveFilterState);

// Восстанавливаем состояние при загрузке
window.addEventListener('load', restoreFilterState);