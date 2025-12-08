# models/measurement.rb
class Measurement < ActiveRecord::Base
  belongs_to :patient
  
  validates :heart_rate, presence: true, numericality: { only_integer: true, greater_than: 0 }
  validates :measured_at, presence: true
  
  before_save :determine_period
  
  private
  
  def determine_period
    self.period = heart_rate > 120 ? 2 : 1
  end
end