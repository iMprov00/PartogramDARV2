# models/patient.rb
class Patient < ActiveRecord::Base
  validates :full_name, presence: true
  validates :admission_date, presence: true
  validates :status, presence: true
  
  has_many :measurements, dependent: :destroy
  
  STATUSES = {
    not_started: "роды не начались",
    in_progress: "в родах",
    completed: "роды завершены"
  }.freeze
  
  # Сериализация для JSON API
  def as_json(options = {})
    super(options.merge(
      except: [:updated_at],
      methods: [:status_color, :timer_text, :timer_class, :remaining_time, :current_timer_duration]
    ))
  end
  
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
    return "00:00:00" if status != STATUSES[:in_progress]
    
    if labor_start.present?
      # Используем текущее время с учетом часового пояса
      duration = (Time.current.in_time_zone('Asia/Novosibirsk') - labor_start.in_time_zone('Asia/Novosibirsk')).to_i
      format_time(duration)
    else
      "00:00:00"
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
  
  # Время до окончания текущего таймера в секундах
  def remaining_time
    return 0 unless status == STATUSES[:in_progress] && last_measurement_time
    
    duration = current_timer_duration * 60 # в секундах
    elapsed = (Time.current.in_time_zone('Asia/Novosibirsk') - last_measurement_time.in_time_zone('Asia/Novosibirsk')).to_i
    remaining = duration - elapsed
    remaining > 0 ? remaining : 0
  end
  
  # Текущая длительность таймера в минутах
  def current_timer_duration
    return 30 unless measurements.any?
    
    last_measurement = measurements.order(measured_at: :desc).first
    # Если последнее измерение ЧДД > 120, то 15 минут, иначе 30
    last_measurement.heart_rate > 120 ? 15 : 30
  end
  
  # Время последнего измерения
  def last_measurement_time
    measurements.order(measured_at: :desc).first&.measured_at
  end
  
  private
  
  def format_time(seconds)
    hours = seconds / 3600
    minutes = (seconds % 3600) / 60
    secs = seconds % 60
    format("%02d:%02d:%02d", hours, minutes, secs)
  end
end