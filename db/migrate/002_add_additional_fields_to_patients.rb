# db/migrate/002_add_additional_fields_to_patients.rb
class AddAdditionalFieldsToPatients < ActiveRecord::Migration[6.1]
  def change
    add_column :patients, :history_number, :string
    add_column :patients, :parity, :integer
    add_column :patients, :labor_start, :datetime
    add_column :patients, :active_phase_start, :datetime
    add_column :patients, :membrane_rupture, :datetime
    add_column :patients, :risk_factors, :text
    add_column :patients, :age, :integer
    add_column :patients, :gestational_age, :integer # срок беременности в неделях
  end
end