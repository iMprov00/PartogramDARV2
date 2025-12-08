// public/js/partogram.js - обновленная версия с модальным окном
class PartogramManager {
  constructor(patientId) {
    this.patientId = patientId;
    this.serverTimeOffset = 0;
    this.timerInterval = null;
    this.remainingTime = 0;
    this.currentPeriod = 1;
    this.entries = [];
    this.entryToDelete = null; // Храним запись для удаления
    
    this.init();
  }
  
  async init() {
    await this.syncServerTime();
    await this.loadPatientData();
    await this.loadPartogramEntries();
    this.startTimer();
    this.setupEventListeners();
    this.setupTimeControls();
  }
  
  // Синхронизация времени с сервером
  async syncServerTime() {
    try {
      const response = await fetch('/api/server_time');
      const data = await response.json();
      const serverTime = data.time;
      const localTime = Math.floor(Date.now() / 1000);
      this.serverTimeOffset = serverTime - localTime;
    } catch (error) {
      console.error('Ошибка синхронизации времени:', error);
    }
  }
  
  // Загрузка данных пациента
  async loadPatientData() {
    try {
      const response = await fetch(`/api/patients/${this.patientId}/data`);
      const data = await response.json();
      
      this.remainingTime = data.remaining_time;
      this.currentPeriod = data.period || 1;
      
      this.updateTimerDisplay();
    } catch (error) {
      console.error('Ошибка загрузки данных пациента:', error);
    }
  }
  
  // Настройка управления временем
  setupTimeControls() {
    const useCurrentTimeCheckbox = document.getElementById('use-current-time');
    const timeInput = document.getElementById('measurement-time');
    
    if (useCurrentTimeCheckbox && timeInput) {
      // Устанавливаем текущее время по умолчанию
      const now = new Date();
      const localDateTime = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
      timeInput.value = localDateTime;
      
      // Обработчик изменения чекбокса
      useCurrentTimeCheckbox.addEventListener('change', function() {
        if (this.checked) {
          // Использовать текущее время
          timeInput.disabled = true;
          const now = new Date();
          const localDateTime = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
          timeInput.value = localDateTime;
        } else {
          // Разрешить ручной ввод
          timeInput.disabled = false;
        }
      });
      
      // По умолчанию используем текущее время
      useCurrentTimeCheckbox.checked = true;
      timeInput.disabled = true;
    }
  }
  
  // Загрузка записей партограммы
  async loadPartogramEntries() {
    try {
      const response = await fetch(`/api/patients/${this.patientId}/partogram_entries`);
      this.entries = await response.json();
      this.updatePartogramTable();
    } catch (error) {
      console.error('Ошибка загрузки записей партограммы:', error);
    }
  }
  
  // Обновление отображения таймера
  updateTimerDisplay() {
    const timerDisplay = document.getElementById('timer-display');
    const currentPeriodEl = document.getElementById('current-period');
    
    if (timerDisplay) {
      const hours = Math.floor(this.remainingTime / 3600);
      const minutes = Math.floor((this.remainingTime % 3600) / 60);
      const seconds = this.remainingTime % 60;
      timerDisplay.textContent = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
      
      // Меняем цвет в зависимости от оставшегося времени
      if (this.remainingTime < 300) { // < 5 минут
        timerDisplay.style.color = '#dc3545';
      } else if (this.remainingTime < 600) { // < 10 минут
        timerDisplay.style.color = '#ffc107';
      } else {
        timerDisplay.style.color = '#0d6efd';
      }
    }
    
    if (currentPeriodEl) {
      currentPeriodEl.textContent = this.currentPeriod;
    }
  }
  
  // Обновление таблицы партограммы
  updatePartogramTable() {
    const tbody = document.getElementById('partogram-tbody');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    this.entries.forEach(entry => {
      const row = document.createElement('tr');
      row.id = `entry-row-${entry.id}`;
      
      // Форматируем время
      const time = new Date(entry.time);
      const timeStr = time.toLocaleTimeString('ru-RU', { 
        hour: '2-digit', 
        minute: '2-digit',
        second: '2-digit'
      });
      
      // Определяем цвет для раскрытия
      let dilationBadge = '—';
      if (entry.cervical_dilation !== null) {
        const badgeClass = entry.cervical_dilation >= 10 ? 'bg-success' : 'bg-info';
        dilationBadge = `<span class="badge ${badgeClass}">${entry.cervical_dilation} см</span>`;
      }
      
      // Информация о схватках
      let contractionsInfo = '—';
      if (entry.contraction_frequency) {
        contractionsInfo = `${entry.contraction_frequency} в 10 мин`;
        if (entry.contraction_duration) {
          contractionsInfo += ` / ${entry.contraction_duration} сек`;
        }
        if (entry.pushing) {
          contractionsInfo += ' (П)';
        }
      }
      
      // Формируем детали записи для модального окна
      const details = [
        entry.fetal_heart_rate ? `ЧСС: ${entry.fetal_heart_rate}` : null,
        entry.cervical_dilation !== null ? `Раскрытие: ${entry.cervical_dilation} см` : null,
        entry.amniotic_fluid ? `Воды: ${entry.amniotic_fluid}` : null
      ].filter(Boolean).join(', ');
      
      row.innerHTML = `
        <td>${timeStr}</td>
        <td>${entry.fetal_heart_rate || '—'}</td>
        <td>${entry.decelerations || '—'}</td>
        <td>${entry.amniotic_fluid || '—'}</td>
        <td>${entry.presentation || '—'}</td>
        <td>${dilationBadge}</td>
        <td>${contractionsInfo}</td>
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
  
  // Запуск таймера
  startTimer() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
    }
    
    this.timerInterval = setInterval(() => {
      if (this.remainingTime > 0) {
        this.remainingTime--;
        this.updateTimerDisplay();
      }
    }, 1000);
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
    
    const modal = new bootstrap.Modal(document.getElementById('deleteEntryModal'));
    modal.show();
  }
  
  // Удаление выбранной записи
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
        // Корректно закрываем модальное окно
        const modalElement = document.getElementById('deleteEntryModal');
        const modal = bootstrap.Modal.getInstance(modalElement);
        
        if (modal) {
          // Скрываем модальное окно
          modal.hide();
          
          // Ждем завершения анимации скрытия
          setTimeout(() => {
            // Удаляем фоновый overlay если он остался
            const backdrop = document.querySelector('.modal-backdrop');
            if (backdrop) {
              backdrop.remove();
            }
            
            // Убираем класс с body
            document.body.classList.remove('modal-open');
            document.body.style.paddingRight = '';
          }, 150);
        }
        
        // Удаляем строку из таблицы
        const row = document.getElementById(`entry-row-${this.entryToDelete.id}`);
        if (row) {
          row.remove();
        }
        
        // Удаляем запись из массива
        this.entries = this.entries.filter(entry => entry.id !== parseInt(this.entryToDelete.id));
        
        this.showNotification('Запись успешно удалена', 'success');
        
        // Обновляем данные пациента
        await this.loadPatientData();
      } else {
        this.showNotification('Ошибка при удалении: ' + (result.errors || ['Неизвестная ошибка']).join(', '), 'danger');
      }
    } catch (error) {
      this.showNotification('Ошибка при удалении записи', 'danger');
      console.error('Ошибка:', error);
    } finally {
      confirmBtn.innerHTML = originalText;
      confirmBtn.disabled = false;
      this.entryToDelete = null;
    }
  }
  
  // Обработка отправки формы партограммы
  async handlePartogramSubmit(e) {
    e.preventDefault();
    
    const form = e.target;
    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());
    
    // Проверяем обязательные поля
    if (!data.fetal_heart_rate && !data.cervical_dilation && !data.contraction_frequency) {
      this.showNotification('Заполните хотя бы одно поле измерения', 'warning');
      return;
    }
    
    // Если чекбокс "Использовать текущее время" отмечен, не отправляем поле времени
    const useCurrentTime = document.getElementById('use-current-time').checked;
    if (useCurrentTime) {
      delete data.measurement_time;
    } else {
      // Преобразуем локальное время в ISO строку
      const timeInput = document.getElementById('measurement-time');
      if (timeInput.value) {
        data.measurement_time = timeInput.value;
      }
    }
    
    // Очищаем пустые значения
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
      // Преобразуем данные для отправки
      const params = new URLSearchParams();
      Object.keys(data).forEach(key => {
        if (data[key] !== null && data[key] !== undefined) {
          params.append(key, data[key]);
        }
      });
      
      console.log('Отправляемые данные:', Object.fromEntries(params));
      
      const response = await fetch(`/api/patients/${this.patientId}/partogram_entries`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params
      });
      
      const result = await response.json();
      
      if (result.success) {
        // Показываем уведомление
        this.showNotification('Измерение сохранено! Страница перезагрузится...', 'success');
        
        // Перезагружаем страницу через 1.5 секунды
        setTimeout(() => {
          window.location.reload();
        }, 1500);
      } else {
        this.showNotification('Ошибка при сохранении: ' + result.errors.join(', '), 'danger');
        saveBtn.innerHTML = originalText;
        saveBtn.disabled = false;
      }
    } catch (error) {
      this.showNotification('Ошибка при сохранении измерения: ' + error.message, 'danger');
      console.error('Ошибка:', error);
      saveBtn.innerHTML = originalText;
      saveBtn.disabled = false;
    }
  }
  
  // Показать модальное окно завершения
  showCompleteModal() {
    const modal = new bootstrap.Modal(document.getElementById('completeLaborModal'));
    modal.show();
  }
  
  // Завершение родов
  async completeLabor() {
    try {
      const response = await fetch(`/api/patients/${this.patientId}/complete_labor`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        }
      });
      
      const data = await response.json();
      
      if (data.success) {
        // Останавливаем таймер
        if (this.timerInterval) {
          clearInterval(this.timerInterval);
          this.timerInterval = null;
        }
        
        // Закрываем модальное окно
        const modal = bootstrap.Modal.getInstance(document.getElementById('completeLaborModal'));
        modal.hide();
        
        this.showNotification('Роды успешно завершены! Страница перезагрузится...', 'success');
        
        // Перезагружаем страницу через 1.5 секунды
        setTimeout(() => {
          window.location.reload();
        }, 1500);
      } else {
        this.showNotification('Ошибка при завершении родов', 'danger');
      }
    } catch (error) {
      this.showNotification('Ошибка при завершении родов', 'danger');
      console.error('Ошибка:', error);
    }
  }
  
  // Показать уведомление
  showNotification(message, type = 'info') {
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
    
    // Автоматически скрыть через 5 секунд
    setTimeout(() => {
      if (alertDiv.parentNode) {
        alertDiv.remove();
      }
    }, 5000);
    
    // Закрытие по кнопке
    const closeBtn = alertDiv.querySelector('.btn-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        alertDiv.remove();
      });
    }
  }
}

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', function() {
  const timerElement = document.getElementById('timer-display-container');
  if (timerElement) {
    // Находим patient_id из URL
    const urlParts = window.location.pathname.split('/');
    const patientId = urlParts[urlParts.length - 2]; // /patients/1/partogram
    
    if (patientId && !isNaN(patientId)) {
      window.partogramManager = new PartogramManager(patientId);
    } else {
      console.error('Не удалось определить ID пациента');
    }
  }
});