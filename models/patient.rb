class Patient < ActiveRecord::Base
  validates :full_name, presence: true
  validates :admission_date, presence: true
  validates :status, presence: true
  
  STATUSES = {
    not_started: "роды не начались",
    in_progress: "в родах",
    completed: "роды завершены"
  }
  
  def status_color
    case status
    when STATUSES[:not_started]
      "secondary"
    when STATUSES[:in_progress]
      "danger"
    when STATUSES[:completed]
      "success"
    else
      "light"
    end
  end
  
  def timer_text
    if status == STATUSES[:in_progress]
      "00:00:00" # Заглушка для таймера
    else
      "Таймер не активен"
    end
  end
  
  def timer_class
    if status == STATUSES[:in_progress]
      "timer-danger"
    else
      "timer-completed"
    end
  end
  
  def partogram_button_text
    case status
    when STATUSES[:not_started]
      "Добавить партограмму"
    when STATUSES[:in_progress]
      "Перейти к партограмме"
    when STATUSES[:completed]
      "Посмотреть партограмму"
    end
  end
  
  def partogram_button_class
    case status
    when STATUSES[:not_started]
      "btn-outline-primary"
    when STATUSES[:in_progress]
      "btn-primary"
    when STATUSES[:completed]
      "btn-outline-secondary"
    end
  end
end