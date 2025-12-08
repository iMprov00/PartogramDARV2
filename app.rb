require 'sinatra'
require 'sinatra/activerecord'
require 'require_all'
require 'json'
require 'securerandom'
require 'active_support/time'

# Загружаем все файлы
require_all 'models'

# Устанавливаем часовой пояс для ActiveSupport
#Time.zone = 'Asia/Novosibirsk'
#ActiveSupport::TimeZone[-7] = 'Asia/Novosibirsk' # GMT+7 для Новосибирска

# Включаем логирование
configure do
  enable :logging
  enable :sessions
  set :database_file, 'config/database.yml'
  set :public_folder, 'public'
  set :views, 'views'
  set :session_secret, ENV['SESSION_SECRET'] || SecureRandom.hex(64)
  
  # Настройки часового пояса для ActiveRecord
  ActiveRecord.default_timezone = :local
  
  # Отключаем CSRF защиту для всех запросов
  set :protection, false
  
  # Логирование запросов
  use Rack::CommonLogger
  
  # Создаем собственный логгер
  def logger
    @logger ||= Logger.new(STDOUT)
  end
end

# Добавим хелпер для получения текущего времени с учетом часового пояса
helpers do
  def current_time
    # Просто используем системное время
    Time.now
  end
  
  def format_time(datetime)
    return '' unless datetime
    # Приводим к местному времени и форматируем
    datetime.strftime('%H:%M:%S')
  end
  
  def format_datetime(datetime)
    return '' unless datetime
    datetime.strftime('%d.%m.%Y %H:%M:%S')
  end
  
  def parse_time_string(time_string)
    return nil unless time_string
    begin
      # Парсим строку и создаем время напрямую
      # Формат: "2025-12-08T10:47"
      parts = time_string.split(/[-T:]/).map(&:to_i)
      
      if parts.length >= 5
        Time.new(parts[0], parts[1], parts[2], parts[3], parts[4], 0)
      else
        nil
      end
    rescue => e
      logger.error "Ошибка парсинга времени: #{time_string}, ошибка: #{e.message}"
      nil
    end
  end
end

# Перед каждым запросом
before do
  logger.info "==> #{request.request_method} #{request.path}"
  logger.info "Params: #{params.inspect}" if params.any?
  
  # Отключаем CSRF для API запросов
  if request.path =~ /^\/api\//
    env['rack.session.options'][:skip] = true
  end
end

# После каждого запроса
after do
  logger.info "<== Response: #{response.status}"
end

# Главная страница - список пациентов
get '/' do
  redirect '/patients'
end

get '/patients' do
  logger.info "Loading patients list"
  @patients = Patient.all.order(created_at: :desc)
  logger.info "Found #{@patients.count} patients"
  erb :'patients/index'
end

# Страница создания нового пациента
get '/patients/new' do
  @patient = Patient.new
  erb :'patients/new'
end

# Создание пациента
post '/patients' do
  logger.info "Creating new patient with params: #{params[:patient].inspect}"
  @patient = Patient.new(params[:patient])
  
  if @patient.save
    logger.info "Patient created successfully: #{@patient.id}"
    session[:notice] = "Пациентка успешно добавлена."
    redirect '/patients'
  else
    logger.error "Failed to create patient: #{@patient.errors.full_messages}"
    session[:alert] = "Ошибка при добавлении пациентки: #{@patient.errors.full_messages.join(', ')}"
    erb :'patients/new'
  end
end

# Страница редактирования пациента
get '/patients/:id/edit' do
  logger.info "Editing patient #{params[:id]}"
  @patient = Patient.find(params[:id])
  erb :'patients/edit'
end

# Обновление пациента
put '/patients/:id' do
  logger.info "Updating patient #{params[:id]} with params: #{params[:patient].inspect}"
  @patient = Patient.find(params[:id])
  
  if @patient.update(params[:patient])
    logger.info "Patient updated successfully"
    session[:notice] = "Данные пациентки обновлены."
    redirect '/patients'
  else
    logger.error "Failed to update patient: #{@patient.errors.full_messages}"
    session[:alert] = "Ошибка при обновлении данных: #{@patient.errors.full_messages.join(', ')}"
    erb :'patients/edit'
  end
end

# Удаление пациента
delete '/patients/:id' do
  logger.info "Deleting patient #{params[:id]}"
  @patient = Patient.find(params[:id])
  
  if @patient.destroy
    logger.info "Patient deleted successfully"
    session[:notice] = "Пациентка удалена."
  else
    logger.error "Failed to delete patient: #{@patient.errors.full_messages}"
    session[:alert] = "Ошибка при удалении пациентки."
  end
  
  redirect '/patients'
end

# Страница партограммы
get '/patients/:id/partogram' do
  @patient = Patient.find(params[:id])
  erb :'partogram/index'
end

# API для поиска пациентов
get '/api/patients' do
  content_type :json
  
  logger.info "API request with params: #{params.inspect}"
  
  patients = Patient.all
  
  # Фильтрация по поиску ФИО
  if params[:search].present? && params[:search] != ''
    search_term = "%#{params[:search]}%"
    logger.info "Filtering by search: #{search_term}"
    patients = patients.where("full_name LIKE ?", search_term)
  end
  
  # Фильтрация по статусу
  if params[:status].present? && params[:status] != 'all'
    logger.info "Filtering by status: #{params[:status]}"
    patients = patients.where(status: params[:status])
  end
  
  # Фильтрация по дате поступления
  if params[:filter_by_date] == 'true' && params[:admission_date].present?
    begin
      filter_date = Date.parse(params[:admission_date])
      logger.info "Filtering by admission date: #{filter_date}"
      patients = patients.where(admission_date: filter_date)
    rescue Date::Error => e
      logger.error "Invalid date format: #{params[:admission_date]}"
    end
  end
  
  logger.info "Found #{patients.count} patients after filtering"
  
  patients.order(created_at: :desc).to_json
end

# API для получения времени сервера
get '/api/server_time' do
  content_type :json
  { time: current_time.to_i }.to_json
end

# API для получения данных пациента
get '/api/patients/:id/data' do
  content_type :json
  patient = Patient.find(params[:id])
  
  {
    status: patient.status,
    remaining_time: patient.remaining_time,
    current_duration: patient.current_timer_duration,
    period: patient.period,
    measurements: patient.partogram_entries.order(time: :desc).limit(10).map do |entry|
      {
        id: entry.id,
        time: format_time(entry.time),
        fetal_heart_rate: entry.fetal_heart_rate,
        cervical_dilation: entry.cervical_dilation,
        contraction_frequency: entry.contraction_frequency
      }
    end
  }.to_json
end

# API для сохранения записи партограммы
post '/api/patients/:id/partogram_entries' do
  content_type :json
  patient = Patient.find(params[:id])
  
  # Если это первая запись и статус "роды не начались", меняем статус
  if patient.status == Patient::STATUSES[:not_started]
    patient.update(
      status: Patient::STATUSES[:in_progress],
      labor_start: current_time
    )
  end
  
  # Определяем время для записи
  measurement_time = if params[:measurement_time].present? && params[:measurement_time] != ''
    # Парсим время из формы (формат: YYYY-MM-DDTHH:MM)
    parse_time_string(params[:measurement_time])
  else
    # Используем текущее время
    current_time
  end
  
  if measurement_time.nil?
    return { success: false, errors: ['Некорректный формат времени'] }.to_json
  end
  
  logger.info "Создание записи партограммы для пациента #{patient.id}, время: #{measurement_time}"
  
  # Создаем запись
  entry = patient.partogram_entries.create(
    time: measurement_time,
    fetal_heart_rate: params[:fetal_heart_rate],
    decelerations: params[:decelerations],
    amniotic_fluid: params[:amniotic_fluid],
    presentation: params[:presentation],
    caput: params[:caput],
    molding: params[:molding],
    maternal_pulse: params[:maternal_pulse],
    blood_pressure: params[:blood_pressure],
    temperature: params[:temperature],
    urination: params[:urination] == 'true',
    contraction_frequency: params[:contraction_frequency],
    contraction_duration: params[:contraction_duration],
    pushing: params[:pushing] == 'true',
    cervical_dilation: params[:cervical_dilation],
    head_descent: params[:head_descent],
    oxytocin: params[:oxytocin],
    medications: params[:medications],
    iv_fluids: params[:iv_fluids]
  )
  
  if entry.persisted?
    logger.info "Запись успешно создана: #{entry.id}"
    { 
      success: true, 
      remaining_time: patient.remaining_time,
      period: patient.period,
      next_measurement_time: patient.next_measurement_time&.strftime('%H:%M')
    }.to_json
  else
    logger.error "Ошибка при создании записи: #{entry.errors.full_messages}"
    { success: false, errors: entry.errors.full_messages }.to_json
  end
end

# API для получения записей партограммы
get '/api/patients/:id/partogram_entries' do
  content_type :json
  patient = Patient.find(params[:id])
  
  patient.partogram_entries.order(time: :desc).to_json(
    only: [:id, :time, :fetal_heart_rate, :decelerations, :amniotic_fluid, 
           :presentation, :caput, :molding, :maternal_pulse, :blood_pressure,
           :temperature, :urination, :contraction_frequency, :contraction_duration,
           :pushing, :cervical_dilation, :head_descent, :oxytocin, :medications, :iv_fluids]
  )
end

# API для удаления записи партограммы
  delete '/api/patients/:patient_id/partogram_entries/:id' do
    content_type :json
    patient = Patient.find(params[:patient_id])
    
    begin
      entry = patient.partogram_entries.find_by(id: params[:id])
      
      if entry.nil?
        logger.info "Запись #{params[:id]} уже удалена или не существует"
        return { success: true }.to_json
      end
      
      if entry.destroy
        logger.info "Запись успешно удалена: #{params[:id]}"
        { success: true }.to_json
      else
        logger.error "Ошибка при удалении записи: #{entry.errors.full_messages}"
        { success: false, errors: entry.errors.full_messages }.to_json
      end
    rescue => e
      logger.error "Исключение при удалении записи: #{e.message}"
      { success: false, errors: ['Внутренняя ошибка сервера'] }.to_json
    end
  end


# API для завершения родов
post '/api/patients/:id/complete_labor' do
  content_type :json
  patient = Patient.find(params[:id])
  
  if patient.update(status: Patient::STATUSES[:completed])
    { success: true }.to_json
  else
    { success: false, errors: patient.errors.full_messages }.to_json
  end
end

# app.rb - ДОБАВИМ НОВЫЕ ENDPOINTS

# API для получения таймеров всех пациентов (оптимизированный)
get '/api/patients/timers' do
  content_type :json
  
  # Получаем всех пациентов с предзагрузкой последних записей
  patients = Patient.includes(:partogram_entries).all
  
  # Формируем ответ с оптимизацией
  patients_data = patients.map do |patient|
    {
      id: patient.id,
      full_name: patient.full_name,
      status: patient.status,
      status_color: patient.status_color,
      period: patient.period,  # Используем публичный метод period
      remaining_time: patient.remaining_time,  # Используем публичный метод remaining_time
      timer_duration: patient.current_timer_duration,  # Используем публичный метод
      admission_date: patient.admission_date,
      age: patient.age,
      labor_start: patient.labor_start&.iso8601,
      updated_at: patient.updated_at.iso8601
    }
  end
  
  patients_data.to_json
end

# API для получения данных таймера конкретного пациента
get '/api/patients/:id/timer_data' do
  content_type :json
  patient = Patient.find(params[:id])
  
  {
    id: patient.id,
    status: patient.status,
    period: patient.period,
    remaining_time: patient.remaining_time,
    timer_duration: patient.current_timer_duration,
    last_measurement_time: patient.last_measurement_time&.iso8601,
    next_measurement_time: patient.next_measurement_time&.iso8601,
    labor_start: patient.labor_start&.iso8601,
    updated_at: patient.updated_at.iso8601
  }.to_json
end