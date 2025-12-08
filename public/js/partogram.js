// public/js/partogram.js
class PartogramTimer {
  constructor(patientId) {
    this.patientId = patientId;
    this.serverTimeOffset = 0;
    this.timerInterval = null;
    this.remainingTime = 0;
    this.currentDuration = 30; // в минутах
    this.currentPeriod = 1;
    this.measurementHistory = [];
    
    this.init();
  }
  
  async init() {
    await this.syncServerTime();
    await this.loadPatientData();
    this.startTimer();
    this.setupEventListeners();
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
      this.currentDuration = data.current_duration;
      this.currentPeriod = data.remaining_time > 0 ? (data.current_duration === 15 ? 2 : 1) : 1;
      this.measurementHistory = data.measurements || [];
      
      this.updateUI();
      this.updateMeasurementHistory();
    } catch (error) {
      console.error('Ошибка загрузки данных:', error);
    }
  }
  
  // Обновление UI
  updateUI() {
    // Обновление таймера
    const minutes = Math.floor(this.remainingTime / 60);
    const seconds = this.remainingTime % 60;
    document.getElementById('timer-display').textContent = 
      `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    
    // Обновление периода
    document.getElementById('current-period').textContent = this.currentPeriod;
    document.getElementById('timer-duration').textContent = `${this.currentDuration} мин`;
    
    // Обновление прогресс-бара
    const progressRing = document.querySelector('.progress-ring-progress');
    if (progressRing) {
      const circumference = 2 * Math.PI * 90;
      const offset = circumference - (this.remainingTime / (this.currentDuration * 60)) * circumference;
      progressRing.style.strokeDashoffset = Math.max(0, offset);
      
      // Меняем цвет в зависимости от времени
      if (this.remainingTime < 60) {
        progressRing.style.stroke = '#dc3545'; // Красный при < 1 минуты
      } else if (this.remainingTime < 300) {
        progressRing.style.stroke = '#ffc107'; // Желтый при < 5 минут
      } else {
        progressRing.style.stroke = '#0d6efd'; // Синий в остальное время
      }
    }
  }
  
  // Обновление истории измерений
  updateMeasurementHistory() {
    const tbody = document.getElementById('measurements-tbody');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    this.measurementHistory.forEach(measurement => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${measurement.measured_at}</td>
        <td>${measurement.heart_rate}</td>
        <td>
          <span class="badge ${measurement.period == 1 ? 'bg-info' : 'bg-warning'}">
            Период ${measurement.period}
          </span>
        </td>
        <td>${measurement.period == 1 ? '30 мин' : '15 мин'}</td>
      `;
      tbody.appendChild(row);
    });
  }
  
  // Запуск таймера
  startTimer() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
    }
    
    this.timerInterval = setInterval(() => {
      if (this.remainingTime > 0) {
        this.remainingTime--;
        this.updateUI();
      }
    }, 1000);
  }
  
  // Настройка обработчиков событий
  setupEventListeners() {
    // Форма измерения
    const measurementForm = document.getElementById('measurement-form');
    if (measurementForm) {
      measurementForm.addEventListener('submit', (e) => this.handleMeasurementSubmit(e));
    }
    
    // Кнопка завершения родов
    const completeBtn = document.getElementById('complete-labor-btn');
    if (completeBtn) {
      completeBtn.addEventListener('click', () => this.showCompleteModal());
    }
    
    // Подтверждение завершения
    const confirmBtn = document.getElementById('confirm-complete-labor');
    if (confirmBtn) {
      confirmBtn.addEventListener('click', () => this.completeLabor());
    }
  }
  
  // Обработка отправки измерения
  async handleMeasurementSubmit(e) {
    e.preventDefault();
    
    const heartRateInput = document.getElementById('heart-rate');
    const heartRate = parseInt(heartRateInput.value);
    
    if (!heartRate || heartRate < 1) {
      alert('Пожалуйста, введите корректное значение ЧДД');
      return;
    }
    
    const saveBtn = document.getElementById('save-measurement-btn');
    const originalText = saveBtn.innerHTML;
    saveBtn.innerHTML = '<i class="bi bi-hourglass-split me-2"></i>Сохранение...';
    saveBtn.disabled = true;
    
    try {
      const response = await fetch(`/api/patients/${this.patientId}/measurements`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: `heart_rate=${heartRate}`
      });
      
      const data = await response.json();
      
      if (data.success) {
        // Показываем уведомление
        this.showNotification('Измерение сохранено! Страница перезагрузится...', 'success');
        
        // Перезагружаем страницу через 1.5 секунды
        setTimeout(() => {
          window.location.reload();
        }, 1500);
      } else {
        this.showNotification('Ошибка при сохранении: ' + data.errors.join(', '), 'danger');
        saveBtn.innerHTML = originalText;
        saveBtn.disabled = false;
      }
    } catch (error) {
      this.showNotification('Ошибка при сохранении измерения', 'danger');
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
        
        // Обновляем UI
        document.getElementById('timer-display').textContent = '00:00';
        document.querySelector('.progress-ring-progress').style.strokeDashoffset = '565.48';
        
        // Обновляем статус на странице
        const statusBadge = document.querySelector('.status-badge-modern');
        statusBadge.className = 'badge status-badge-modern bg-success fs-6';
        statusBadge.textContent = 'роды завершены';
        
        // Отключаем кнопки
        document.getElementById('save-measurement-btn').disabled = true;
        document.getElementById('complete-labor-btn').disabled = true;
        
        // Закрываем модальное окно
        const modal = bootstrap.Modal.getInstance(document.getElementById('completeLaborModal'));
        modal.hide();
        
        this.showNotification('Роды успешно завершены!', 'success');
        
        // Обновляем данные
        setTimeout(() => this.loadPatientData(), 1000);
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
    
    // Стили для корректного отображения
    Object.assign(alertDiv.style, {
      position: 'fixed',
      top: '80px', // Отступ от верха под навбаром
      right: '20px',
      zIndex: '1060', // Выше чем у навбара (обычно 1055)
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
    
    // Добавим анимацию
    const style = document.createElement('style');
    if (!document.querySelector('#notification-styles')) {
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
}

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', function() {
  const timerElement = document.getElementById('patient-timer');
  if (timerElement) {
    const patientId = timerElement.dataset.patientId;
    window.partogramTimer = new PartogramTimer(patientId);
  }
});