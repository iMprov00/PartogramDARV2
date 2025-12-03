require 'sinatra'
require 'sinatra/activerecord'
require 'require_all'
require 'json'
require 'securerandom'

# Загружаем все файлы
require_all 'models'

# Настройки
configure do
  enable :sessions
  set :database_file, 'config/database.yml'
  set :public_folder, 'public'
  set :views, 'views'
  set :session_secret, ENV['SESSION_SECRET'] || SecureRandom.hex(64)
end

# Главная страница - список пациентов
get '/' do
  redirect '/patients'
end

get '/patients' do
  @patients = Patient.all.order(created_at: :desc)
  erb :'patients/index'
end

# Страница создания нового пациента
get '/patients/new' do
  @patient = Patient.new
  erb :'patients/new'
end

# Создание пациента
post '/patients' do
  @patient = Patient.new(params[:patient])
  
  if @patient.save
    session[:notice] = "Пациентка успешно добавлена."
    redirect '/patients'
  else
    session[:alert] = "Ошибка при добавлении пациентки."
    erb :'patients/new'
  end
end

# Страница редактирования пациента
get '/patients/:id/edit' do
  @patient = Patient.find(params[:id])
  erb :'patients/edit'
end

# Обновление пациента
put '/patients/:id' do
  @patient = Patient.find(params[:id])
  
  if @patient.update(params[:patient])
    session[:notice] = "Данные пациентки обновлены."
    redirect '/patients'
  else
    session[:alert] = "Ошибка при обновлении данных."
    erb :'patients/edit'
  end
end

# Удаление пациента
delete '/patients/:id' do
  @patient = Patient.find(params[:id])
  @patient.destroy
  session[:notice] = "Пациентка удалена."
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
  
  patients = Patient.all
  
  # Фильтрация по поиску
  if params[:search].present?
    patients = patients.where("full_name LIKE ?", "%#{params[:search]}%")
  end
  
  # Фильтрация по статусу
  if params[:status].present? && params[:status] != 'all'
    patients = patients.where(status: params[:status])
  end
  
  # Фильтрация по дате
  if params[:admission_date].present? && params[:filter_by_date] == 'true'
    patients = patients.where(admission_date: params[:admission_date])
  end
  
  patients.order(created_at: :desc).to_json
end