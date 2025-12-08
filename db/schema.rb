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

ActiveRecord::Schema[8.1].define(version: 4) do
  create_table "measurements", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.integer "heart_rate"
    t.datetime "measured_at", precision: nil
    t.integer "patient_id", null: false
    t.integer "period", default: 1
    t.datetime "updated_at", null: false
    t.index ["measured_at"], name: "index_measurements_on_measured_at"
    t.index ["patient_id"], name: "index_measurements_on_patient_id"
  end

  create_table "partogram_entries", force: :cascade do |t|
    t.string "amniotic_fluid"
    t.string "blood_pressure"
    t.string "caput"
    t.integer "cervical_dilation"
    t.integer "contraction_duration"
    t.integer "contraction_frequency"
    t.datetime "created_at", null: false
    t.string "decelerations"
    t.integer "fetal_heart_rate"
    t.integer "head_descent"
    t.text "iv_fluids"
    t.integer "maternal_pulse"
    t.text "medications"
    t.string "molding"
    t.string "oxytocin"
    t.integer "patient_id", null: false
    t.string "presentation"
    t.boolean "pushing"
    t.decimal "temperature"
    t.datetime "time", precision: nil, null: false
    t.datetime "updated_at", null: false
    t.boolean "urination"
    t.index ["patient_id"], name: "index_partogram_entries_on_patient_id"
    t.index ["time"], name: "index_partogram_entries_on_time"
  end

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

  add_foreign_key "measurements", "patients"
  add_foreign_key "partogram_entries", "patients"
end
