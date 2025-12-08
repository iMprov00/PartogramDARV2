// public/js/partogram.js - ИСПРАВЛЕННЫЙ КОД С ПЕРЕЗАГРУЗКОЙ

class PartogramManager {
  constructor(patientId) {
    this.patientId = patientId;
    this.timerInterval = null;
    this.syncInterval = null;
    this.remainingTime = 0;
    this.currentPeriod = 1;
    this.lastServerUpdate = null;
    this.isPageVisible = true;
    this.isSyncing = false;
    this.entries = [];
    this.entryToDelete = null;
    this.lastSyncTime = 0;
    
    this.visibilityHandler = this.handleVisibilityChange.bind(this);
    
    this.init();
  }
  
  async init() {
    console.log(`Initializing PartogramManager for patient ${this.patientId}`);
    
    // Настройка обработчиков видимости
    this.setupVisibilityHandler();
    
    // Загрузка начальных данных
    await this.loadInitialData();
    
    // Запуск систем
    this.startSystems();
    
    // Настройка обработчиков событий
    this.setupEventListeners();
    
    console.log('PartogramManager initialized');
  }
  
  // Настройка обработчика видимости страницы
  setupVisibilityHandler() {
    document.addEventListener('visibilitychange', this.visibilityHandler);
    this.isPageVisible = !document.hidden;
    console.log(`Initial page visibility: ${this.isPageVisible ? 'visible' : 'hidden'}`);
  }
  
  // Обработчик изменения видимости
  handleVisibilityChange() {
    const wasVisible = this.isPageVisible;
    this.isPageVisible = !document.hidden;
    
    console.log(`Page visibility changed: ${wasVisible ? 'visible' : 'hidden'} -> ${this.isPageVisible ? 'visible' : 'hidden'}`);
    
    if (this.isPageVisible && !wasVisible) {
      // Страница стала видимой
      console.log('Page became visible, forcing sync');
      this.startSystems();
      this.syncWithServer(true);
    } else if (!this.isPageVisible && wasVisible) {
      // Страница скрыта
      console.log('Page hidden, stopping systems');
      this.stopSystems();
    }
  }
  
  // Загрузка начальных данных
  async loadInitialData() {
    try {
      await Promise.all([
        this.loadPatientData(),
        this.loadPartogramEntries()
      ]);
      console.log('Initial data loaded');
    } catch (error) {
      console.error('Error loading initial data:', error);
      this.showNotification('Ошибка загрузки данных', 'danger');
    }
  }
  
  // Запуск всех систем
  startSystems() {
    this.stopSystems();
    
    // Запуск таймера
    this.startTimer();
    
    // Запуск синхронизации
    this.startSync();
    
    console.log('Systems started');
  }
  
  // Остановка всех систем
  stopSystems() {
    this.stopTimer();
    this.stopSync();
    console.log('Systems stopped');
  }
  
  // Запуск таймера
  startTimer() {
    this.stopTimer();
    
    this.timerInterval = setInterval(() => {
      if (this.remainingTime > 0 && this.isPageVisible) {
        this.remainingTime--;
        this.updateTimerDisplay();
      }
    }, 1000);
    
    console.log('Timer started');
  }
  
  // Остановка таймера
  stopTimer() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }
  
  // Запуск синхронизации
  startSync() {
    this.stopSync();
    
    // Определяем интервал в зависимости от видимости
    const interval = this.isPageVisible ? 10000 : 30000;
    
    console.log(`Setting sync interval to ${interval}ms`);
    
    this.syncInterval = setInterval(() => {
      this.syncWithServer(false);
    }, interval);
    
    // Первая синхронизация
    this.syncWithServer(true);
  }
  
  // Остановка синхронизации
  stopSync() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }
  
  // Загрузка данных пациента
  async loadPatientData() {
    try {
      const response = await fetch(`/api/patients/${this.patientId}/data?_=${Date.now()}`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      
      const data = await response.json();
      
      this.remainingTime = data.remaining_time;
      this.currentPeriod = data.period || 1;
      
      this.updateTimerDisplay();
      this.updatePeriodDisplay();
      
      // ДОБАВЬ ЭТУ СТРОЧКУ
      this.updateFixedTimer();
      
      console.log('Patient data loaded');
    } catch (error) {
      console.error('Error loading patient data:', error);
      throw error;
    }
  }
  
  // Синхронизация с сервером
  // Синхронизация с сервером
  async syncWithServer(force = false) {
    const now = Date.now();
    const timeSinceLastSync = now - this.lastSyncTime;
    
    // Защита от слишком частых запросов
    if (this.isSyncing || (!force && timeSinceLastSync < 3000)) {
      return;
    }
    
    this.isSyncing = true;
    
    try {
      console.log(`${force ? 'Forced' : 'Regular'} sync started`);
      
      const response = await fetch(`/api/patients/${this.patientId}/timer_data?_=${Date.now()}`);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      this.lastSyncTime = now;
      
      // Проверяем, изменились ли данные
      const oldPeriod = this.currentPeriod;
      const oldRemainingTime = this.remainingTime;
      
      this.remainingTime = data.remaining_time;
      this.currentPeriod = data.period;
      this.lastServerUpdate = data.updated_at;
      
      // Обновляем отображение
      this.updateTimerDisplay();
      this.updatePeriodDisplay();
      this.updateFixedTimer(); // ДОБАВЬ ЭТУ СТРОЧКУ
      
      // Если период изменился, показываем уведомление
      if (oldPeriod !== this.currentPeriod) {
        this.showNotification(`Переход на ${this.currentPeriod} период родов. Таймер обновлен.`, 'info');
      }
      
      // Если время сильно изменилось (более чем на 10 секунд), показываем уведомление
      if (Math.abs(oldRemainingTime - this.remainingTime) > 10) {
        console.log(`Time corrected: ${oldRemainingTime} -> ${this.remainingTime}`);
      }
      
      console.log('Sync completed');
      
    } catch (error) {
      console.error('Error syncing with server:', error);
      this.showNotification('Ошибка синхронизации с сервером', 'danger');
    } finally {
      this.isSyncing = false;
    }
  }
  
  // Загрузка записей партограммы
  async loadPartogramEntries() {
    try {
      const response = await fetch(`/api/patients/${this.patientId}/partogram_entries?_=${Date.now()}`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      
      this.entries = await response.json();
      this.updatePartogramTable();
      
      console.log(`Loaded ${this.entries.length} partogram entries`);
    } catch (error) {
      console.error('Error loading partogram entries:', error);
      throw error;
    }
  }
  
  // Настройка управления временем
  setupTimeControls() {
    const useCurrentTimeCheckbox = document.getElementById('use-current-time');
    const timeInput = document.getElementById('measurement-time');
    
    if (useCurrentTimeCheckbox && timeInput) {
      const now = new Date();
      const localDateTime = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
      timeInput.value = localDateTime;
      
      useCurrentTimeCheckbox.addEventListener('change', function() {
        if (this.checked) {
          timeInput.disabled = true;
          const now = new Date();
          const localDateTime = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
          timeInput.value = localDateTime;
        } else {
          timeInput.disabled = false;
        }
      });
      
      useCurrentTimeCheckbox.checked = true;
      timeInput.disabled = true;
    }
  }
  
  // Обновление отображения таймера
  updateTimerDisplay() {
    const timerDisplay = document.getElementById('timer-display');
    const timerContainer = document.getElementById('timer-display-container');
    
    if (timerDisplay) {
      const hours = Math.floor(this.remainingTime / 3600);
      const minutes = Math.floor((this.remainingTime % 3600) / 60);
      const seconds = this.remainingTime % 60;
      timerDisplay.textContent = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
      
      if (timerContainer) {
        // Обновляем классы в зависимости от оставшегося времени и периода
        timerContainer.classList.remove('timer-danger', 'timer-warning');
        
        const warningThreshold = this.currentPeriod === 2 ? 150 : 300;
        const dangerThreshold = this.currentPeriod === 2 ? 60 : 120;
        
        if (this.remainingTime < dangerThreshold) {
          timerContainer.classList.add('timer-danger');
        } else if (this.remainingTime < warningThreshold) {
          timerContainer.classList.add('timer-warning');
        }
      }
    }
        this.updateFixedTimer();
  }
  
  // Обновление отображения периода
  updatePeriodDisplay() {
    const periodElement = document.querySelector('.timer-label');
    if (periodElement) {
      periodElement.textContent = `Период ${this.currentPeriod}`;
    }
  }
  
  // Обновление таблицы партограммы
  updatePartogramTable() {
    const tbody = document.getElementById('partogram-tbody');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    if (this.entries.length === 0) {
      tbody.innerHTML = `
        <tr class="no-data-row">
          <td colspan="8">
            <div class="text-center py-4">
              <i class="bi bi-clipboard-data display-4 d-block mb-3 text-muted"></i>
              <h6 class="text-secondary">Нет измерений</h6>
              <p class="text-muted">Добавьте первое измерение</p>
            </div>
          </td>
        </tr>
      `;
      return;
    }
    
    this.entries.forEach(entry => {
      const row = document.createElement('tr');
      row.id = `entry-row-${entry.id}`;
      row.className = 'fade-in';
      
      const time = new Date(entry.time);
      const timeStr = time.toLocaleTimeString('ru-RU', { 
        hour: '2-digit', 
        minute: '2-digit',
        second: '2-digit'
      });
      
      // Форматируем данные для отображения
      const details = [
        entry.fetal_heart_rate ? `ЧСС: ${entry.fetal_heart_rate}` : null,
        entry.cervical_dilation !== null ? `Раскрытие: ${entry.cervical_dilation} см` : null,
        entry.amniotic_fluid ? `Воды: ${entry.amniotic_fluid}` : null
      ].filter(Boolean).join(', ');
      
      row.innerHTML = `
        <td>${timeStr}</td>
        <td>${entry.fetal_heart_rate || '—'}</td>
        <td>
          ${entry.decelerations ? 
            `<span class="badge ${entry.decelerations === 'нет' ? 'bg-secondary' : 'bg-warning'}">
              ${entry.decelerations}
            </span>` : 
            '—'
          }
        </td>
        <td>${entry.amniotic_fluid || '—'}</td>
        <td>${entry.presentation || '—'}</td>
        <td>
          ${entry.cervical_dilation !== null ? 
            `<span class="badge ${entry.cervical_dilation >= 10 ? 'bg-success' : 'bg-info'}">
              ${entry.cervical_dilation} см
            </span>` : 
            '—'
          }
        </td>
        <td>
          ${entry.contraction_frequency ? 
            `<div>
              <small>${entry.contraction_frequency} в 10 мин</small>
              ${entry.contraction_duration ? `<br><small>${entry.contraction_duration} сек</small>` : ''}
              ${entry.pushing ? '<br><span class="badge bg-info">Потуги</span>' : ''}
            </div>` : 
            '—'
          }
        </td>
        <td>
          <button type="button" 
                  class="btn btn-sm btn-outline-danger delete-entry-btn" 
                  data-entry-id="${entry.id}"
                  data-entry-time="${timeStr}"
                  data-entry-details="${details}"
                  title="Удалить">
            <i class="bi bi-trash"></i>
          </button>
        </td>
      `;
      
      tbody.appendChild(row);
    });
    
    // Инициализируем кнопки удаления
    this.initDeleteEntryButtons();
  }
  
updateFixedTimer() {
    const fixedTimerDisplay = document.getElementById('fixed-timer-display');
    const fixedPeriodDisplay = document.getElementById('fixed-period-display');
    const fixedTimerContainer = document.getElementById('fixed-timer-container');
    
    if (fixedTimerDisplay && fixedPeriodDisplay && fixedTimerContainer) {
      // Обновление периода
      fixedPeriodDisplay.textContent = this.currentPeriod;
      
      // Форматирование времени
      const hours = Math.floor(this.remainingTime / 3600);
      const minutes = Math.floor((this.remainingTime % 3600) / 60);
      const seconds = this.remainingTime % 60;
      fixedTimerDisplay.textContent = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
      
      // Обновление стилей
      fixedTimerContainer.classList.remove('timer-warning', 'timer-danger');
      
      const warningThreshold = this.currentPeriod === 2 ? 150 : 300;
      const dangerThreshold = this.currentPeriod === 2 ? 60 : 120;
      
      if (this.remainingTime < dangerThreshold) {
        fixedTimerContainer.classList.add('timer-danger');
      } else if (this.remainingTime < warningThreshold) {
        fixedTimerContainer.classList.add('timer-warning');
      }
    }
  }

  // Настройка обработчиков событий
  setupEventListeners() {
    // Форма партограммы
    const partogramForm = document.getElementById('partogram-form');
    if (partogramForm) {
      partogramForm.addEventListener('submit', (e) => this.handlePartogramSubmit(e));
    }
    
    // Кнопка завершения родов
    const completeBtn = document.getElementById('complete-labor-btn');
    if (completeBtn) {
      completeBtn.addEventListener('click', () => this.showCompleteModal());
    }
    
    // Подтверждение завершения родов
    const confirmCompleteBtn = document.getElementById('confirm-complete-labor');
    if (confirmCompleteBtn) {
      confirmCompleteBtn.addEventListener('click', () => this.completeLabor());
    }
    
    // Подтверждение удаления записи
    const confirmDeleteEntryBtn = document.getElementById('confirm-delete-entry');
    if (confirmDeleteEntryBtn) {
      confirmDeleteEntryBtn.addEventListener('click', () => this.deleteSelectedEntry());
    }
    
    // Кнопки удаления записей
    this.initDeleteEntryButtons();
    
    // Настройка управления временем
    this.setupTimeControls();
    
    console.log('Event listeners setup completed');
  }
  
  // Инициализация кнопок удаления записей
  initDeleteEntryButtons() {
    const deleteButtons = document.querySelectorAll('.delete-entry-btn');
    
    deleteButtons.forEach(button => {
      button.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        this.entryToDelete = {
          id: button.dataset.entryId,
          time: button.dataset.entryTime,
          details: button.dataset.entryDetails
        };
        
        this.showDeleteEntryModal();
      });
    });
  }
  
  // Показать модальное окно удаления записи
  showDeleteEntryModal() {
    if (!this.entryToDelete) return;
    
    const timeElement = document.getElementById('entry-time-to-delete');
    const detailsElement = document.getElementById('entry-details-to-delete');
    
    if (timeElement) {
      timeElement.textContent = this.entryToDelete.time;
    }
    
    if (detailsElement) {
      detailsElement.textContent = this.entryToDelete.details || 'Нет дополнительных данных';
    }
    
    const modalElement = document.getElementById('deleteEntryModal');
    if (modalElement) {
      const modal = new bootstrap.Modal(modalElement);
      modal.show();
    }
  }
  
  // Показать модальное окно завершения родов
  showCompleteModal() {
    const modalElement = document.getElementById('completeLaborModal');
    if (modalElement) {
      const modal = new bootstrap.Modal(modalElement);
      modal.show();
    }
  }
  
  // Закрыть модальное окно
  closeModal(modalId) {
    const modalElement = document.getElementById(modalId);
    if (!modalElement) return;
    
    const modal = bootstrap.Modal.getInstance(modalElement);
    if (modal) {
      modal.hide();
    }
  }
  
  // Обработка отправки формы партограммы
  async handlePartogramSubmit(e) {
    e.preventDefault();
    
    const form = e.target;
    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());
    
    // Проверка заполнения обязательных полей
    if (!data.fetal_heart_rate && !data.cervical_dilation && !data.contraction_frequency) {
      this.showNotification('Заполните хотя бы одно поле измерения', 'warning');
      return;
    }
    
    // Обработка времени измерения
    const useCurrentTime = document.getElementById('use-current-time').checked;
    if (useCurrentTime) {
      delete data.measurement_time;
    } else {
      const timeInput = document.getElementById('measurement-time');
      if (timeInput && timeInput.value) {
        data.measurement_time = timeInput.value;
      }
    }
    
    // Очистка пустых значений
    Object.keys(data).forEach(key => {
      if (data[key] === '' || data[key] === undefined) {
        delete data[key];
      }
    });
    
    const saveBtn = document.getElementById('save-partogram-btn');
    const originalText = saveBtn.innerHTML;
    saveBtn.innerHTML = '<i class="bi bi-hourglass-split me-2"></i>Сохранение...';
    saveBtn.disabled = true;
    
    try {
      const params = new URLSearchParams();
      Object.keys(data).forEach(key => {
        if (data[key] !== null && data[key] !== undefined) {
          params.append(key, data[key]);
        }
      });
      
      const response = await fetch(`/api/patients/${this.patientId}/partogram_entries`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params
      });
      
      const result = await response.json();
      
      if (result.success) {
        this.showNotification('Измерение сохранено! Синхронизация...', 'success');
        
        // Синхронизируемся с сервером
        await this.syncWithServer(true);
        
        // Обновляем записи
        await this.loadPartogramEntries();
        
        // Сбрасываем форму
        form.reset();
        
        // Обновляем время в форме
        const timeInput = document.getElementById('measurement-time');
        const useCurrentTimeCheckbox = document.getElementById('use-current-time');
        if (useCurrentTimeCheckbox && useCurrentTimeCheckbox.checked && timeInput) {
          const now = new Date();
          const localDateTime = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
          timeInput.value = localDateTime;
        }
        
        // Показываем финальное уведомление
        this.showNotification('Данные обновлены и синхронизированы', 'success', 2000);
        
      } else {
        this.showNotification('Ошибка при сохранении: ' + (result.errors || ['Неизвестная ошибка']).join(', '), 'danger');
      }
    } catch (error) {
      this.showNotification('Ошибка при сохранении измерения: ' + error.message, 'danger');
      console.error('Ошибка:', error);
    } finally {
      saveBtn.innerHTML = originalText;
      saveBtn.disabled = false;
    }
  }
  
  // Удаление выбранной записи - ПРОСТО ПЕРЕЗАГРУЖАЕМ СТРАНИЦУ
  async deleteSelectedEntry() {
    if (!this.entryToDelete) {
      this.showNotification('Ошибка: запись для удаления не выбрана', 'danger');
      return;
    }
    
    const confirmBtn = document.getElementById('confirm-delete-entry');
    const originalText = confirmBtn.innerHTML;
    confirmBtn.innerHTML = '<i class="bi bi-trash me-2"></i>Удаление...';
    confirmBtn.disabled = true;
    
    try {
      const response = await fetch(`/api/patients/${this.patientId}/partogram_entries/${this.entryToDelete.id}`, {
        method: 'DELETE'
      });
      
      const result = await response.json();
      
      if (result.success) {
        // Закрываем модальное окно
        this.closeModal('deleteEntryModal');
        
        // Показываем уведомление
        this.showNotification('Измерение удалено. Перезагрузка страницы...', 'success', 1500);
        
        // Перезагружаем страницу через 1.5 секунды
        setTimeout(() => {
          window.location.reload();
        }, 1500);
        
      } else {
        this.showNotification('Ошибка при удалении: ' + (result.errors || ['Неизвестная ошибка']).join(', '), 'danger');
        confirmBtn.innerHTML = originalText;
        confirmBtn.disabled = false;
      }
    } catch (error) {
      this.showNotification('Ошибка при удалении записи: ' + error.message, 'danger');
      console.error('Ошибка:', error);
      confirmBtn.innerHTML = originalText;
      confirmBtn.disabled = false;
    }
  }
  
  // Завершение родов
  async completeLabor() {
    const confirmBtn = document.getElementById('confirm-complete-labor');
    const originalText = confirmBtn.innerHTML;
    confirmBtn.innerHTML = '<i class="bi bi-hourglass-split me-2"></i>Завершение...';
    confirmBtn.disabled = true;
    
    try {
      const response = await fetch(`/api/patients/${this.patientId}/complete_labor`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        }
      });
      
      const data = await response.json();
      
      if (data.success) {
        // Останавливаем системы
        this.stopSystems();
        
        // Закрываем модальное окно
        this.closeModal('completeLaborModal');
        
        // Показываем уведомление
        this.showNotification('Роды успешно завершены! Перезагрузка страницы...', 'success', 1500);
        
        // Перезагружаем страницу через 1.5 секунды
        setTimeout(() => {
          window.location.reload();
        }, 1500);
        
      } else {
        this.showNotification('Ошибка при завершении родов', 'danger');
        confirmBtn.innerHTML = originalText;
        confirmBtn.disabled = false;
      }
    } catch (error) {
      this.showNotification('Ошибка при завершении родов', 'danger');
      console.error('Ошибка:', error);
      confirmBtn.innerHTML = originalText;
      confirmBtn.disabled = false;
    }
  }
  
  // Показать уведомление
  showNotification(message, type = 'info', duration = 5000) {
    // Удаляем старые уведомления
    const oldAlerts = document.querySelectorAll('.partogram-notification');
    oldAlerts.forEach(alert => alert.remove());
    
    const alertDiv = document.createElement('div');
    alertDiv.className = `partogram-notification alert alert-${type} alert-dismissible fade show`;
    
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
  
  // Очистка при уничтожении
  cleanup() {
    this.stopSystems();
    document.removeEventListener('visibilitychange', this.visibilityHandler);
    console.log('PartogramManager cleaned up');
  }
}

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', function() {
  console.log('Partogram page loaded');
  
  // Определяем ID пациента из URL
  const urlParts = window.location.pathname.split('/');
  const patientId = urlParts[urlParts.length - 2];
  
  if (patientId && !isNaN(patientId)) {
    console.log(`Initializing for patient ID: ${patientId}`);
    
    // Создаем экземпляр менеджера
    window.partogramManager = new PartogramManager(patientId);
    
    // Очистка при закрытии страницы
    window.addEventListener('beforeunload', function() {
      if (window.partogramManager) {
        window.partogramManager.cleanup();
      }
    });
    
  } else {
    console.error('Не удалось определить ID пациента из URL:', window.location.pathname);
  }
});

// Стили для фиксированного таймера с БЕЛЫМ ТЕКСТОМ ВСЕГДА
const fixedTimerStyles = `
  /* Фиксированный таймер */
  .fixed-timer-container {
    position: fixed;
    bottom: 20px;
    left: 20px;
    z-index: 1050;
    background: linear-gradient(135deg, #54c654 0%, #3a8a3a 100%);
    color: white !important;
    border-radius: 12px;
    padding: 0.75rem 1rem;
    min-width: 160px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.25);
    border: 2px solid rgba(255, 255, 255, 0.2);
    transition: all 0.3s ease;
  }
  
  .fixed-timer-container:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 25px rgba(0, 0, 0, 0.3);
  }
  
  .fixed-timer-content {
    text-align: center;
  }
  
  .fixed-timer-header {
    font-size: 0.8rem;
    opacity: 0.9;
    margin-bottom: 0.25rem;
    color: white !important;
  }
  
  .fixed-timer-value {
    font-family: 'Courier New', monospace;
    font-weight: bold;
    font-size: 1.5rem;
    line-height: 1;
    margin: 0.25rem 0;
    color: white !important;
  }
  
  .fixed-timer-patient {
    font-size: 0.7rem;
    opacity: 0.8;
    border-top: 1px dashed rgba(255, 255, 255, 0.3);
    padding-top: 0.25rem;
    max-width: 150px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: white !important;
  }
  
  /* Состояния таймера - ВСЕ РАВНО БЕЛЫЙ ТЕКСТ */
  .fixed-timer-container.timer-warning {
    background: linear-gradient(135deg, #ffc107 0%, #e0a800 100%);
    color: white !important;
  }
  
  .fixed-timer-container.timer-danger {
    background: linear-gradient(135deg, #dc3545 0%, #bd2130 100%);
    color: white !important;
  }
  
  /* Адаптивность для мобильных */
  @media (max-width: 768px) {
    .fixed-timer-container {
      bottom: 10px;
      left: 10px;
      padding: 0.5rem;
      min-width: 140px;
    }
    
    .fixed-timer-value {
      font-size: 1.2rem;
    }
  }
  
  /* Убедимся, что внутри контейнера все тексты белые */
  .fixed-timer-container * {
    color: white !important;
  }
`;

// Добавляем стили в документ
const styleElement = document.createElement('style');
styleElement.textContent = fixedTimerStyles;
document.head.appendChild(styleElement);