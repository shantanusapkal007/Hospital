import {
  collection, doc, getDoc, getDocs, query, where,
  Timestamp, runTransaction, increment,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { clearPatientCache } from "@/services/patient.service";
import { validateVisitBasics, calculateEDD } from "@/lib/visit-validators";
import type { Visit } from "@/lib/types";

const COL = "visits";

function stripUndefinedValues<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => stripUndefinedValues(item)) as T;
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, entryValue]) => entryValue !== undefined)
        .map(([key, entryValue]) => [key, stripUndefinedValues(entryValue)])
    ) as T;
  }

  return value;
}

export async function getVisits(): Promise<Visit[]> {
  const snap = await getDocs(collection(db, COL));
  const results = snap.docs.map(d => ({ id: d.id, ...d.data() } as Visit));
  return results.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
}

export async function getVisitsByPatient(patientId: string): Promise<Visit[]> {
  const q = query(collection(db, COL), where("patientId", "==", patientId));
  const snap = await getDocs(q);
  const results = snap.docs.map(d => ({ id: d.id, ...d.data() } as Visit));
  return results.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
}

/**
 * Fetch the latest visit for multiple patients in batched queries.
 * Firestore 'in' operator supports max 10 values per query,
 * so we chunk the patient IDs accordingly.
 */
export async function getLatestVisitsForPatients(
  patientIds: string[]
): Promise<Record<string, Visit | null>> {
  const result: Record<string, Visit | null> = {};
  if (patientIds.length === 0) return result;

  // Initialize all to null
  for (const id of patientIds) {
    result[id] = null;
  }

  // Firestore 'in' supports max 10 values per query
  const CHUNK_SIZE = 10;
  const chunks: string[][] = [];
  for (let i = 0; i < patientIds.length; i += CHUNK_SIZE) {
    chunks.push(patientIds.slice(i, i + CHUNK_SIZE));
  }

  const batchPromises = chunks.map(async (chunk) => {
    const q = query(collection(db, COL), where("patientId", "in", chunk));
    const snap = await getDocs(q);
    const visits = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Visit));

    // For each patient in this chunk, find their latest visit
    for (const pid of chunk) {
      const patientVisits = visits
        .filter((v) => v.patientId === pid)
        .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      result[pid] = patientVisits.length > 0 ? patientVisits[0] : null;
    }
  });

  await Promise.all(batchPromises);
  return result;
}

export async function addVisit(data: Omit<Visit, "id" | "createdAt">): Promise<string> {
  const patientName = data.patientName?.trim();
  const complaints = data.complaints?.trim();
  const diagnosis = data.diagnosis?.trim();
  const totalBill = Number(data.totalBill || 0);
  const sanitizedData = stripUndefinedValues({
    ...data,
    patientName,
    complaints,
    diagnosis,
    totalBill,
  });

  if (!data.patientId || !patientName || !complaints || !diagnosis) {
    throw new Error("Patient, complaints, and diagnosis are required.");
  }

  if (!Number.isFinite(totalBill) || totalBill < 0) {
    throw new Error("Total bill must be a valid amount.");
  }

  const visitRef = doc(collection(db, COL));
  const patientRef = doc(db, "patients", data.patientId);

  await runTransaction(db, async (transaction) => {
    const patientSnap = await transaction.get(patientRef);
    if (!patientSnap.exists()) {
      throw new Error("Patient not found.");
    }

    transaction.set(visitRef, {
      ...sanitizedData,
      createdAt: Timestamp.now(),
    });

    if (totalBill > 0) {
      if (data.paymentStatus === "paid") {
        const paymentRef = doc(collection(db, "payments"));
        transaction.set(paymentRef, {
          patientId: data.patientId,
          patientName,
          visitId: visitRef.id,
          amount: totalBill,
          paymentMethod: "cash",
          status: "paid",
          description: "Payment for Visit",
          date: new Date().toISOString().split("T")[0],
          createdAt: Timestamp.now(),
        });
      } else {
        transaction.update(patientRef, {
          khataBalance: increment(-totalBill),
          updatedAt: Timestamp.now(),
        });
      }
    }
  });

  clearPatientCache();
  return visitRef.id;
}

export async function getUpcomingFollowUps(): Promise<Visit[]> {
  const snap = await getDocs(collection(db, COL));
  const today = new Date().toISOString().split("T")[0];
  const results = snap.docs.map(d => ({ id: d.id, ...d.data() } as Visit));
  return results
    .filter(v => v.followUpDate && v.followUpDate >= today)
    .sort((a, b) => (a.followUpDate || "").localeCompare(b.followUpDate || ""));
}

export async function updateVisitImages(visitId: string, visitImages: string[]): Promise<void> {
  if (!visitId || !Array.isArray(visitImages)) return;
  const visitRef = doc(db, COL, visitId);
  await runTransaction(db, async (transaction) => {
    transaction.update(visitRef, { visitImages });
  });
}

export async function getVisit(visitId: string): Promise<Visit | null> {
  const visitRef = doc(db, COL, visitId);
  const snap = await getDoc(visitRef);
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as Visit;
}

/**
 * Updates a visit with validation
 * Maintains audit trail with isEdited, editedAt, editedBy fields
 */
export async function updateVisit(
  visitId: string,
  updates: Partial<Visit>,
  userId: string
): Promise<void> {
  if (!visitId) {
    throw new Error("Visit ID is required");
  }

  if (!userId) {
    throw new Error("User ID is required for audit trail");
  }

  // Validate the updates
  const validation = validateVisitBasics(updates);
  if (!validation.valid) {
    throw new Error(`Validation failed: ${validation.errors.join("; ")}`);
  }

  const visitRef = doc(db, COL, visitId);

  // Prepare the update data
  const sanitizedUpdates = stripUndefinedValues({
    ...updates,
    complaints: updates.complaints?.trim(),
    diagnosis: updates.diagnosis?.trim(),
    advice: updates.advice?.trim(),
    pastHistory: updates.pastHistory?.trim(),
    familyHistory: updates.familyHistory?.trim(),
    examinationFindings: updates.examinationFindings?.trim(),
    historyOfPresentIllness: updates.historyOfPresentIllness?.trim(),
  });

  // Add audit trail
  const auditUpdate = {
    ...sanitizedUpdates,
    isEdited: true,
    editedAt: Timestamp.now(),
    editedBy: userId,
  };

  await runTransaction(db, async (transaction) => {
    const visitSnap = await transaction.get(visitRef);
    if (!visitSnap.exists()) {
      throw new Error("Visit not found");
    }

    transaction.update(visitRef, auditUpdate);
  });

  clearPatientCache();
}

/**
 * Deletes a medicine from a visit's prescription list
 */
export async function removeMedicineFromVisit(
  visitId: string,
  medicineIndex: number,
  userId: string
): Promise<void> {
  const visit = await getVisit(visitId);
  if (!visit) {
    throw new Error("Visit not found");
  }

  const updatedPrescriptions = visit.prescriptions?.filter((_, idx) => idx !== medicineIndex) || [];

  await updateVisit(visitId, { prescriptions: updatedPrescriptions }, userId);
}

/**
 * Adds a new medicine to a visit's prescription list
 */
export async function addMedicineToVisit(
  visitId: string,
  medicine: any, // Medicine type
  userId: string
): Promise<void> {
  const visit = await getVisit(visitId);
  if (!visit) {
    throw new Error("Visit not found");
  }

  const updatedPrescriptions = [...(visit.prescriptions || []), medicine];

  await updateVisit(visitId, { prescriptions: updatedPrescriptions }, userId);
}

/**
 * Updates a specific medicine in a visit's prescription list
 */
export async function updateMedicineInVisit(
  visitId: string,
  medicineIndex: number,
  medicine: any, // Medicine type
  userId: string
): Promise<void> {
  const visit = await getVisit(visitId);
  if (!visit) {
    throw new Error("Visit not found");
  }

  const updatedPrescriptions = [...(visit.prescriptions || [])];
  if (medicineIndex >= 0 && medicineIndex < updatedPrescriptions.length) {
    updatedPrescriptions[medicineIndex] = medicine;
  } else {
    throw new Error("Invalid medicine index");
  }

  await updateVisit(visitId, { prescriptions: updatedPrescriptions }, userId);
}
