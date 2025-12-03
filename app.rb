require 'sinatra'
require 'sinatra/activerecord'
require 'require_all'
require 'json'
require 'securerandom'

# Загружаем все файлы
require_all 'models'

# Включаем логирование
configure do
  enable :logging
  enable :sessions
  set :database_file, 'config/database.yml'
  set :public_folder, 'public'
  set :views, 'views'
  set :session_secret, ENV['SESSION_SECRET'] || SecureRandom.hex(64)
  
  # Логирование запросов
  use Rack::CommonLogger
  
  # Создаем собственный логгер
  def logger
    @logger ||= Logger.new(STDOUT)
  end
end

# Перед каждым запросом
before do
  logger.info "==> #{request.request_method} #{request.path}"
  logger.info "Params: #{params.inspect}" if params.any?
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

# Заглушка для партограммы
get '/patients/:id/partogram' do
  @patient = Patient.find(params[:id])
  erb :'patients/show'
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

# Маршрут для отладки
get '/debug' do
  content_type :text/plain
  "Debug endpoint\n" +
  "Patients count: #{Patient.count}\n" +
  "Session: #{session.inspect}\n" +
  "Params: #{params.inspect}"
end

# Обработка ошибок
not_found do
  logger.error "Route not found: #{request.path}"
  status 404
  erb :'errors/404'
end

error 500 do
  logger.error "Server error: #{env['sinatra.error'].message}"
  erb :'errors/500'
end