# db/migrate/003_create_measurements.rb
class CreateMeasurements < ActiveRecord::Migration[6.1]
  def change
    create_table :measurements do |t|
      t.references :patient, null: false, foreign_key: true
      t.integer :heart_rate # ЧДД
      t.integer :period, default: 1 # Период родов (1 или 2)
      t.datetime :measured_at
      t.timestamps
    end

    add_index :measurements, :measured_at
  end
end