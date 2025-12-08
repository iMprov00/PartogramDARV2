# db/migrate/003_create_partogram_entries.rb
class CreatePartogramEntries < ActiveRecord::Migration[6.1]
  def change
    create_table :partogram_entries do |t|
      t.references :patient, null: false, foreign_key: true
      t.datetime :time, null: false
      
      # Частота сердечных сокращений плода
      t.integer :fetal_heart_rate
      t.string :decelerations # ран, вар, поз
      
      # Околоплодные воды
      t.string :amniotic_fluid # Ц, С, М, К
      
      # Предлежание плода
      t.string :presentation # А, Р, Т
      
      # Родовая опухоль и конфигурация головки
      t.string :caput # 0, +, ++, +++
      t.string :molding # О, +, ++, +++
      
      # Состояние матери
      t.integer :maternal_pulse
      t.string :blood_pressure
      t.decimal :temperature
      t.boolean :urination
      
      # Схватки
      t.integer :contraction_frequency
      t.integer :contraction_duration
      t.boolean :pushing
      
      # Раскрытие и опускание
      t.integer :cervical_dilation
      t.integer :head_descent # 5, 4, 3, 2, 1, 0
      
      # Медикаменты
      t.string :oxytocin
      t.text :medications
      t.text :iv_fluids
      
      t.timestamps
    end
    
    add_index :partogram_entries, :time
  end
end