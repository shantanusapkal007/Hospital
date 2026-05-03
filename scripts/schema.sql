-- ============================================================
-- Suradkar Hospital Management — Supabase PostgreSQL Schema
-- ============================================================

-- Users table (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL DEFAULT 'admin' CHECK (role IN ('admin', 'doctor', 'receptionist', 'nurse')),
  photo_url TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Patients
CREATE TABLE IF NOT EXISTS public.patients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_number TEXT NOT NULL UNIQUE,
  treatment_type TEXT CHECK (treatment_type IN ('Allopathic', 'Homeopathic')),
  full_name TEXT NOT NULL,
  mobile_number TEXT NOT NULL,
  alternate_mobile TEXT,
  gender TEXT NOT NULL CHECK (gender IN ('Male', 'Female', 'Other')),
  date_of_birth TEXT,
  age INTEGER DEFAULT 0,
  blood_group TEXT,
  address JSONB DEFAULT '{}',
  email TEXT,
  occupation TEXT,
  marital_status TEXT,
  allergies TEXT,
  chronic_diseases TEXT,
  emergency_contact TEXT,
  lmp TEXT,
  menstrual_cycle_days INTEGER,
  photo TEXT,
  notes TEXT,
  current_medicines JSONB DEFAULT '[]',
  present_complaints TEXT,
  weight NUMERIC,
  height_cm NUMERIC,
  bp TEXT,
  temperature NUMERIC,
  spo2 NUMERIC,
  repetition TEXT,
  khata_balance NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Appointments
CREATE TABLE IF NOT EXISTS public.appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  patient_name TEXT NOT NULL,
  doctor_id UUID REFERENCES public.users(id),
  appointment_date TEXT NOT NULL,
  time_slot TEXT NOT NULL,
  type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled','completed','cancelled','no-show')),
  reason TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Visits (Case Papers)
CREATE TABLE IF NOT EXISTS public.visits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  patient_name TEXT NOT NULL,
  doctor_id UUID REFERENCES public.users(id),
  visit_images TEXT[] DEFAULT '{}',
  complaints TEXT NOT NULL,
  history_of_present_illness TEXT,
  past_history TEXT,
  family_history TEXT,
  examination_findings TEXT,
  diagnosis TEXT NOT NULL,
  prescriptions JSONB DEFAULT '[]',
  vitals JSONB DEFAULT '{}',
  lab_tests TEXT,
  investigations_advised TEXT,
  total_bill NUMERIC DEFAULT 0,
  payment_status TEXT DEFAULT 'unpaid' CHECK (payment_status IN ('paid','unpaid')),
  advice TEXT,
  referral TEXT,
  follow_up_date TEXT,
  follow_up_message_enabled BOOLEAN DEFAULT false,
  is_edited BOOLEAN DEFAULT false,
  edited_at TIMESTAMPTZ,
  edited_by UUID REFERENCES public.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Payments
CREATE TABLE IF NOT EXISTS public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  patient_name TEXT NOT NULL,
  visit_id UUID REFERENCES visits(id),
  amount NUMERIC NOT NULL,
  payment_method TEXT NOT NULL DEFAULT 'cash' CHECK (payment_method IN ('cash','upi','card')),
  status TEXT NOT NULL DEFAULT 'paid' CHECK (status IN ('paid','pending','refunded')),
  description TEXT,
  transaction_id TEXT,
  date TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Clinic settings table (for template system — dynamic branding)
CREATE TABLE IF NOT EXISTS public.clinic_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_name TEXT NOT NULL DEFAULT 'My Clinic',
  doctor_name TEXT DEFAULT '',
  specialization TEXT DEFAULT '',
  registration_number TEXT DEFAULT '',
  phone TEXT DEFAULT '',
  email TEXT DEFAULT '',
  address TEXT DEFAULT '',
  logo_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Insert default clinic settings row
INSERT INTO public.clinic_settings (clinic_name, doctor_name, specialization, phone, email, address)
VALUES ('Suradkar Hospital', 'Dr. Consultant', 'General Physician', '', '', '')
ON CONFLICT DO NOTHING;

-- ============================================================
-- Indexes for performance
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_patients_case_number ON patients(case_number);
CREATE INDEX IF NOT EXISTS idx_patients_mobile ON patients(mobile_number);
CREATE INDEX IF NOT EXISTS idx_appointments_date ON appointments(appointment_date);
CREATE INDEX IF NOT EXISTS idx_appointments_patient ON appointments(patient_id);
CREATE INDEX IF NOT EXISTS idx_visits_patient ON visits(patient_id);
CREATE INDEX IF NOT EXISTS idx_visits_follow_up ON visits(follow_up_date);
CREATE INDEX IF NOT EXISTS idx_payments_patient ON payments(patient_id);
CREATE INDEX IF NOT EXISTS idx_payments_date ON payments(date);

-- ============================================================
-- Row-Level Security (all authenticated users have full access)
-- ============================================================
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE clinic_settings ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any (safe to re-run)
DROP POLICY IF EXISTS "auth_all_patients" ON patients;
DROP POLICY IF EXISTS "auth_all_appointments" ON appointments;
DROP POLICY IF EXISTS "auth_all_visits" ON visits;
DROP POLICY IF EXISTS "auth_all_payments" ON payments;
DROP POLICY IF EXISTS "auth_all_users" ON users;
DROP POLICY IF EXISTS "auth_all_clinic_settings" ON clinic_settings;

CREATE POLICY "auth_all_patients" ON patients FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "auth_all_appointments" ON appointments FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "auth_all_visits" ON visits FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "auth_all_payments" ON payments FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "auth_all_users" ON users FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "auth_all_clinic_settings" ON clinic_settings FOR ALL USING (auth.role() = 'authenticated');

-- ============================================================
-- Khata balance atomic update function
-- ============================================================
CREATE OR REPLACE FUNCTION update_khata_balance(p_id UUID, p_amount NUMERIC)
RETURNS VOID AS $$
BEGIN
  UPDATE patients SET khata_balance = khata_balance + p_amount, updated_at = now() WHERE id = p_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
