# models/partogram_entry.rb
class PartogramEntry < ActiveRecord::Base
  belongs_to :patient
  
  validates :time, presence: true
  
  # Валидации для полей
  validates :fetal_heart_rate, numericality: { only_integer: true, greater_than: 0, less_than: 300 }, allow_nil: true
  validates :maternal_pulse, numericality: { only_integer: true, greater_than: 0, less_than: 200 }, allow_nil: true
  validates :temperature, numericality: { greater_than: 35, less_than: 42 }, allow_nil: true
  validates :cervical_dilation, numericality: { only_integer: true, greater_than_or_equal_to: 0, less_than_or_equal_to: 10 }, allow_nil: true
  
  # Опции для полей с фиксированными значениями
  DECELERATIONS_OPTIONS = ['ран', 'вар', 'поз'].freeze
  AMNIOTIC_FLUID_OPTIONS = ['Ц', 'С', 'М', 'К'].freeze
  PRESENTATION_OPTIONS = ['А', 'Р', 'Т'].freeze
  CAPUT_OPTIONS = ['0', '+', '++', '+++'].freeze
  MOLDING_OPTIONS = ['О', '+', '++', '+++'].freeze
  HEAD_DESCENT_OPTIONS = [5, 4, 3, 2, 1, 0].freeze
  
  # before_validation :round_time_to_30_minutes
  
  # private
  
  # def round_time_to_30_minutes
  #   return unless time
    
  #   # Округляем время до ближайших 30 минут
  #   minutes = time.min
  #   rounded_minutes = (minutes / 30.0).round * 30
  #   self.time = time.change(min: rounded_minutes, sec: 0)
  # end
end