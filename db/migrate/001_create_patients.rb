class CreatePatients < ActiveRecord::Migration[6.1]
  def change
    create_table :patients do |t|
      t.string :full_name, null: false
      t.date :admission_date, null: false
      t.string :status, null: false
      t.text :notes
      t.timestamps
    end
    
    add_index :patients, :status
    add_index :patients, :admission_date
  end
end