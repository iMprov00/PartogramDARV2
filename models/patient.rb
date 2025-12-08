class Patient < ActiveRecord::Base
  validates :full_name, presence: true
  validates :admission_date, presence: true
  validates :status, presence: true
  
  has_many :partogram_entries, dependent: :destroy
  
  STATUSES = {
    not_started: "роды не начались",
    in_progress: "в родах",
    completed: "роды завершены"
  }.freeze
  
  # Сериализация для JSON API
  def as_json(options = {})
    super(options.merge(
      except: [:updated_at],
      methods: [:status_color, :timer_text, :timer_class, :remaining_time, :current_timer_duration, :period, :next_measurement_time]
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
  
  # Определяем текущий период родов (1 или 2)
  def period
    # Ищем последнее измерение с раскрытием шейки матки
    last_dilation = partogram_entries.where.not(cervical_dilation: nil).order(time: :desc).first
    
    if last_dilation && last_dilation.cervical_dilation >= 10
      2
    else
      1
    end
  end
  
  # Длительность таймера в зависимости от периода
  def current_timer_duration
    period == 2 ? 15 : 30
  end
  
  # Время до окончания текущего таймера в секундах
  def remaining_time
    return 0 unless status == STATUSES[:in_progress]
    
    # Используем последнее время измерения или начало родов
    last_time = last_measurement_time || labor_start
    return 0 unless last_time
    
    duration = current_timer_duration * 60 # в секундах
    now = Time.current.in_time_zone('Asia/Novosibirsk')
    elapsed = (now - last_time.in_time_zone('Asia/Novosibirsk')).to_i
    remaining = duration - elapsed
    remaining > 0 ? remaining : 0
  end
  
  # Время последнего измерения в партограмме
  def last_measurement_time
    partogram_entries.order(time: :desc).first&.time
  end
  
  # Рекомендуемое время следующего измерения
  def next_measurement_time
    return nil unless last_measurement_time
    
    interval_minutes = case period
                      when 1
                        # В первом периоде: ЧСС плода каждые 30 мин, воды каждые 4 часа при норме
                        30
                      when 2
                        # Во втором периоде: чаще
                        15
                      else
                        30
                      end
    
    last_measurement_time + interval_minutes.minutes
  end
  
  # Метод для API таймеров (используем существующий period)
  def api_period
    period
  end
  
  # Метод для API таймеров
  def api_remaining_time
    remaining_time
  end
  
  # Метод для API таймеров
  def api_timer_duration
    current_timer_duration
  end
  
  private
  
  def format_time(seconds)
    hours = seconds / 3600
    minutes = (seconds % 3600) / 60
    secs = seconds % 60
    format("%02d:%02d:%02d", hours, minutes, secs)
  end
end