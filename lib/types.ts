import { Timestamp } from "firebase/firestore";

// ─── Users ───────────────────────────────────────────────
export type UserRole = "admin";
export type TreatmentType = "Allopathic" | "Homeopathic";

export interface AppUser {
  userId: string;
  name: string;
  email: string;
  role: UserRole;
  photoURL?: string;
  createdAt: Timestamp;
}

// ─── Patients ────────────────────────────────────────────
export interface Patient {
  id?: string; // Firestore document ID
  caseNumber: string;
  treatmentType?: TreatmentType;
  fullName: string;
  mobileNumber: string;
  alternateMobile?: string;
  gender: "Male" | "Female" | "Other";
  dateOfBirth?: string;
  age: number;
  bloodGroup?: string;
  address?: {
    line1?: string;
    city?: string;
    state?: string;
    pincode?: string;
  };
  email?: string;
  occupation?: string;
  maritalStatus?: string;
  allergies?: string;
  chronicDiseases?: string;
  emergencyContact?: string;
  lmp?: string | null; // Last Menstrual Period for females
  menstrualCycleDays?: number | null; // Menstrual cycle length in days
  photo?: string; // URL from Firebase Storage
  notes?: string;
  currentMedicines?: Medicine[]; // Overall/regular medicines for the patient
  // Clinical vitals (patient-level quick access)
  presentComplaints?: string;
  weight?: number | null; // kg
  heightCm?: number | null; // cm
  bp?: string; // e.g. "120/80"
  temperature?: number | null; // °F
  spo2?: number | null; // %
  repetition?: string; // Medicine repetition schedule
  khataBalance?: number; // Ledger balance (Negative = Owes Money, Positive = Advance)
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ─── Appointments ────────────────────────────────────────
export type AppointmentStatus = "scheduled" | "completed" | "cancelled" | "no-show";

export interface Appointment {
  id?: string;
  patientId: string;
  patientName: string; // denormalized for fast reads
  doctorId?: string;
  appointmentDate: string; // YYYY-MM-DD
  timeSlot: string; // HH:mm
  type: string; // "New Consultation" | "Follow-up" | "Routine Checkup"
  status: AppointmentStatus;
  reason?: string;
  notes?: string;
  createdAt: Timestamp;
}

// ─── Visits (Case Papers) ────────────────────────────────
export interface Medicine {
  name: string;
  potency?: string;
  dosage: string;
  frequency: string;
  days: number;
  notes?: string;
}

export interface Vitals {
  bp?: string;
  weight?: number;
  height?: number;
  temperature?: number; // °F
  pulse?: number; // bpm
  spo2?: number; // %
  respiratoryRate?: number; // breaths/min
}

export interface Visit {
  id?: string;
  patientId: string;
  patientName: string;
  doctorId?: string;
  visitImages?: string[];
  // Clinical
  complaints: string;
  historyOfPresentIllness?: string;
  pastHistory?: string;
  familyHistory?: string;
  examinationFindings?: string;
  diagnosis: string;
  prescriptions: Medicine[];
  vitals: Vitals;
  labTests?: string;
  investigationsAdvised?: string;
  totalBill?: number; // Charge applied to Khata
  paymentStatus?: "paid" | "unpaid";
  advice?: string;
  referral?: string;
  followUpDate?: string;
  followUpMessageEnabled?: boolean;
  isEdited?: boolean;
  editedAt?: Timestamp;
  editedBy?: string;
  createdAt: Timestamp;
}

// ─── Payments ────────────────────────────────────────────
export type PaymentMethod = "cash" | "upi" | "card";
export type PaymentStatus = "paid" | "pending" | "refunded";

export interface Payment {
  id?: string;
  patientId: string;
  patientName: string;
  visitId?: string;
  amount: number;
  paymentMethod: PaymentMethod;
  status: PaymentStatus;
  description?: string;
  transactionId?: string;
  date: string; // YYYY-MM-DD
  createdAt: Timestamp;
}

// ─── Clinic Settings ─────────────────────────────────────
export interface ClinicSettings {
  id?: string;
  clinicName: string;
  doctorName: string;
  specialization: string;
  registrationNumber?: string;
  phone: string;
  email: string;
  address: string;
  logoUrl?: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}
