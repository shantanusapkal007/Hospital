import {
  collection, doc, addDoc, updateDoc, deleteDoc, getDoc,
  getDocs, query, where, orderBy, Timestamp, increment, writeBatch,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Medicine, Patient, TreatmentType } from "@/lib/types";

const COL = "patients";

// ─── Cache ───────────────────────────────────────────────
let patientCache: Patient[] | null = null;
let patientCachePromise: Promise<Patient[]> | null = null;
let patientSearchIndex: { fullName: string; mobileNumber: string; caseNumber: string; patient: Patient }[] | null = null;

function invalidatePatientCache() {
  patientCache = null;
  patientCachePromise = null;
  patientSearchIndex = null;
}

export function clearPatientCache() {
  invalidatePatientCache();
}

function buildPatientSearchIndex(patients: Patient[]) {
  patientSearchIndex = patients.map((patient) => ({
    fullName: (patient.fullName || "").toLowerCase(),
    mobileNumber: patient.mobileNumber || "",
    caseNumber: (patient.caseNumber || "").toLowerCase(),
    patient,
  }));
}

function mapPatient(snap: { id: string; data: () => any }): Patient {
  return { id: snap.id, ...snap.data() } as Patient;
}

function validateTreatmentType(treatmentType?: TreatmentType | string): boolean {
  return treatmentType === "Allopathic" || treatmentType === "Homeopathic";
}

// ─── Helpers ─────────────────────────────────────────────
function cleanText(value?: string | null) {
  return value?.trim().replace(/\s+/g, " ") ?? "";
}

function cleanPhone(value?: string | null) {
  return value?.trim() ?? "";
}

function normalizeCaseNumber(value?: string | null) {
  return value?.trim().toUpperCase() ?? "";
}

function incrementCaseNumber(caseNumber: string) {
  const normalized = normalizeCaseNumber(caseNumber);
  const match = normalized.match(/(\d+)(?!.*\d)/);

  if (!match || match.index === undefined) return "";

  const digits = match[0];
  const nextValue = String(Number.parseInt(digits, 10) + 1).padStart(digits.length, "0");
  const prefix = normalized.slice(0, match.index);
  const suffix = normalized.slice(match.index + digits.length);
  return `${prefix}${nextValue}${suffix}`;
}

function normalizeMedicines(medicines?: Medicine[] | null) {
  if (!medicines) return undefined;

  return medicines
    .map((medicine) => ({
      ...medicine,
      name: cleanText(medicine.name),
      potency: cleanText(medicine.potency),
      dosage: cleanText(medicine.dosage),
      frequency: cleanText(medicine.frequency),
      notes: cleanText(medicine.notes),
      days: Number.isFinite(medicine.days) ? medicine.days : 0,
    }))
    .filter((medicine) =>
      Boolean(
        medicine.name ||
        medicine.potency ||
        medicine.dosage ||
        medicine.frequency ||
        medicine.notes
      )
    );
}

async function assertUniqueCaseNumber(caseNumber: string, excludeId?: string) {
  const normalized = normalizeCaseNumber(caseNumber);
  const patients = await getPatients();
  const duplicate = patients.find(
    (patient) => normalizeCaseNumber(patient.caseNumber) === normalized && patient.id !== excludeId
  );

  if (duplicate) {
    throw new Error("Case number already exists.");
  }
}

function normalizePatientData<T extends Partial<Patient>>(data: T) {
  const nextData: Partial<Patient> = { ...data };

  if ("caseNumber" in data) nextData.caseNumber = normalizeCaseNumber(data.caseNumber);
  if ("fullName" in data) nextData.fullName = cleanText(data.fullName);
  if ("mobileNumber" in data) nextData.mobileNumber = cleanPhone(data.mobileNumber);
  if ("alternateMobile" in data) nextData.alternateMobile = cleanPhone(data.alternateMobile);
  if ("email" in data) nextData.email = cleanText(data.email);
  if ("occupation" in data) nextData.occupation = cleanText(data.occupation);
  if ("maritalStatus" in data) nextData.maritalStatus = cleanText(data.maritalStatus);
  if ("allergies" in data) nextData.allergies = cleanText(data.allergies);
  if ("chronicDiseases" in data) nextData.chronicDiseases = cleanText(data.chronicDiseases);
  if ("emergencyContact" in data) nextData.emergencyContact = cleanPhone(data.emergencyContact);
  if ("lmp" in data) nextData.lmp = cleanText(data.lmp);
  if ("notes" in data) nextData.notes = cleanText(data.notes);
  if ("presentComplaints" in data) nextData.presentComplaints = cleanText(data.presentComplaints);
  if ("bp" in data) nextData.bp = cleanText(data.bp);
  if ("repetition" in data) nextData.repetition = cleanText(data.repetition);
  if ("currentMedicines" in data) nextData.currentMedicines = normalizeMedicines(data.currentMedicines);

  if ("address" in data && data.address) {
    nextData.address = {
      line1: cleanText(data.address.line1),
      city: cleanText(data.address.city),
      state: cleanText(data.address.state),
      pincode: cleanText(data.address.pincode),
    };
  }

  return nextData as T;
}

function stripUndefinedValues<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => stripUndefinedValues(item)) as T;
  }

  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, entryValue]) => entryValue !== undefined)
      .map(([key, entryValue]) => [key, stripUndefinedValues(entryValue)]);

    return Object.fromEntries(entries) as T;
  }

  return value;
}

async function validatePatientData(data: Partial<Patient>, excludeId?: string) {
  if ("caseNumber" in data && !normalizeCaseNumber(data.caseNumber)) {
    throw new Error("Case number is required.");
  }

  if ("fullName" in data && !cleanText(data.fullName)) {
    throw new Error("Patient name is required.");
  }

  if ("mobileNumber" in data && !cleanPhone(data.mobileNumber)) {
    throw new Error("Mobile number is required.");
  }

  if ("treatmentType" in data && !validateTreatmentType(data.treatmentType)) {
    throw new Error("Treatment type is required.");
  }

  if ("age" in data) {
    if (!Number.isFinite(data.age) || (data.age ?? 0) < 0) {
      throw new Error("Age must be a valid number.");
    }
  }

  if ("caseNumber" in data && data.caseNumber) {
    await assertUniqueCaseNumber(data.caseNumber, excludeId);
  }
}

export async function getPatients(): Promise<Patient[]> {
  if (patientCache) return patientCache;
  if (patientCachePromise) return patientCachePromise;

  patientCachePromise = (async () => {
    try {
      const q = query(collection(db, COL), orderBy("createdAt", "desc"));
      const snap = await getDocs(q);
      const patients = snap.docs.map(mapPatient);
      patientCache = patients;
      buildPatientSearchIndex(patients);
      return patients;
    } finally {
      patientCachePromise = null;
    }
  })();

  return patientCachePromise;
}

export async function getNextPatientCaseNumber(): Promise<string> {
  const patients = await getPatients();

  for (const patient of patients) {
    const nextCaseNumber = incrementCaseNumber(patient.caseNumber);
    if (nextCaseNumber) {
      return nextCaseNumber;
    }
  }

  return "CS-1001";
}

export async function getPatient(id: string): Promise<Patient | null> {
  const cachedPatient = patientCache?.find((patient) => patient.id === id);
  if (cachedPatient) return cachedPatient;

  const snap = await getDoc(doc(db, COL, id));
  return snap.exists() ? mapPatient(snap) : null;
}

export async function searchPatients(term: string, maxResults?: number): Promise<Patient[]> {
  const trimmed = term.trim();
  if (!trimmed) return getPatients();

  await getPatients();

  const lower = trimmed.toLowerCase();
  const results = (patientSearchIndex ?? []).filter(
    (entry) =>
      entry.fullName.includes(lower) ||
      entry.mobileNumber.includes(trimmed) ||
      entry.caseNumber.includes(lower)
  );

  const patients = results.map((entry) => entry.patient);
  return typeof maxResults === "number" ? patients.slice(0, maxResults) : patients;
}

export async function addPatient(data: Omit<Patient, "id" | "createdAt" | "updatedAt">): Promise<string> {
  const normalized = stripUndefinedValues(normalizePatientData(data));
  await validatePatientData(normalized);

  const ref = await addDoc(collection(db, COL), {
    ...normalized,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  });
  invalidatePatientCache();
  return ref.id;
}

export async function updatePatient(id: string, data: Partial<Patient>): Promise<void> {
  const normalized = stripUndefinedValues(normalizePatientData(data));
  await validatePatientData(normalized, id);
  await updateDoc(doc(db, COL, id), { ...normalized, updatedAt: Timestamp.now() });
  invalidatePatientCache();
}

export async function deletePatient(id: string): Promise<void> {
  const linkedQueries = [
    query(collection(db, "appointments"), where("patientId", "==", id)),
    query(collection(db, "visits"), where("patientId", "==", id)),
    query(collection(db, "payments"), where("patientId", "==", id)),
  ];

  const snapshots = await Promise.all(linkedQueries.map((linkedQuery) => getDocs(linkedQuery)));
  const batch = writeBatch(db);

  snapshots.forEach((snapshot) => {
    snapshot.docs.forEach((linkedDoc) => {
      batch.delete(linkedDoc.ref);
    });
  });

  batch.delete(doc(db, COL, id));
  await batch.commit();
  invalidatePatientCache();
}

export async function getPatientLinkedRecordCounts(id: string) {
  const [appointmentsSnap, visitsSnap, paymentsSnap] = await Promise.all([
    getDocs(query(collection(db, "appointments"), where("patientId", "==", id))),
    getDocs(query(collection(db, "visits"), where("patientId", "==", id))),
    getDocs(query(collection(db, "payments"), where("patientId", "==", id))),
  ]);

  return {
    appointments: appointmentsSnap.size,
    visits: visitsSnap.size,
    payments: paymentsSnap.size,
  };
}

export async function getPatientCount(): Promise<number> {
  const patients = await getPatients();
  return patients.length;
}

export async function updatePatientBalance(id: string, amount: number): Promise<void> {
  // Uses atomic increment to avoid write race conditions
  await updateDoc(doc(db, COL, id), { khataBalance: increment(amount) });
  invalidatePatientCache();
}

export async function getKhataPatients(): Promise<Patient[]> {
  const all = await getPatients();
  // Negative balance means they owe money. 
  // Positive means they paid advance.
  return all.filter(p => (p.khataBalance ?? 0) !== 0).sort((a,b) => (a.khataBalance || 0) - (b.khataBalance || 0));
}
