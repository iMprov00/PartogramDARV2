# This file is auto-generated from the current state of the database. Instead
# of editing this file, please use the migrations feature of Active Record to
# incrementally modify your database, and then regenerate this schema definition.
#
# This file is the source Rails uses to define your schema when running `bin/rails
# db:schema:load`. When creating a new database, `bin/rails db:schema:load` tends to
# be faster and is potentially less error prone than running all of your
# migrations from scratch. Old migrations may fail to apply correctly if those
# migrations use external dependencies or application code.
#
# It's strongly recommended that you check this file into your version control system.

ActiveRecord::Schema[8.1].define(version: 2) do
  create_table "patients", force: :cascade do |t|
    t.datetime "active_phase_start", precision: nil
    t.date "admission_date", null: false
    t.integer "age"
    t.datetime "created_at", null: false
    t.string "full_name", null: false
    t.integer "gestational_age"
    t.string "history_number"
    t.datetime "labor_start", precision: nil
    t.datetime "membrane_rupture", precision: nil
    t.text "notes"
    t.integer "parity"
    t.text "risk_factors"
    t.string "status", null: false
    t.datetime "updated_at", null: false
    t.index ["admission_date"], name: "index_patients_on_admission_date"
    t.index ["status"], name: "index_patients_on_status"
  end
end
