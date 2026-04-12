import {
  collection, doc, addDoc, updateDoc, deleteDoc,
  getDocs, query, where, Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Appointment, AppointmentStatus } from "@/lib/types";

const COL = "appointments";

export async function getAppointments(): Promise<Appointment[]> {
  const snap = await getDocs(collection(db, COL));
  const results = snap.docs.map(d => ({ id: d.id, ...d.data() } as Appointment));
  return results.sort((a, b) => b.appointmentDate.localeCompare(a.appointmentDate) || a.timeSlot.localeCompare(b.timeSlot));
}

export async function getAppointmentsByDate(date: string): Promise<Appointment[]> {
  const q = query(collection(db, COL), where("appointmentDate", "==", date));
  const snap = await getDocs(q);
  const results = snap.docs.map(d => ({ id: d.id, ...d.data() } as Appointment));
  return results.sort((a, b) => a.timeSlot.localeCompare(b.timeSlot));
}

export async function getAppointmentsByPatient(patientId: string): Promise<Appointment[]> {
  const q = query(collection(db, COL), where("patientId", "==", patientId));
  const snap = await getDocs(q);
  const results = snap.docs.map(d => ({ id: d.id, ...d.data() } as Appointment));
  return results.sort((a, b) => b.appointmentDate.localeCompare(a.appointmentDate));
}

export async function addAppointment(data: Omit<Appointment, "id" | "createdAt">): Promise<string> {
  const appointmentDate = data.appointmentDate?.trim();
  const timeSlot = data.timeSlot?.trim();
  const patientName = data.patientName?.trim();

  if (!data.patientId || !patientName || !appointmentDate || !timeSlot || !data.type?.trim()) {
    throw new Error("Please complete all required appointment fields.");
  }

  const duplicateQuery = query(
    collection(db, COL),
    where("patientId", "==", data.patientId),
    where("appointmentDate", "==", appointmentDate),
    where("timeSlot", "==", timeSlot)
  );
  const duplicateSnap = await getDocs(duplicateQuery);
  if (!duplicateSnap.empty) {
    throw new Error("This patient already has an appointment for the selected date and time.");
  }

  const ref = await addDoc(collection(db, COL), {
    ...data,
    patientName,
    appointmentDate,
    timeSlot,
    createdAt: Timestamp.now(),
  });
  return ref.id;
}

export async function updateAppointmentStatus(id: string, status: AppointmentStatus): Promise<void> {
  if (!id) throw new Error("Appointment not found.");
  await updateDoc(doc(db, COL, id), { status });
}

export async function deleteAppointment(id: string): Promise<void> {
  await deleteDoc(doc(db, COL, id));
}

export async function getTodayAppointmentCount(): Promise<number> {
  const today = new Date().toISOString().split("T")[0];
  const q = query(collection(db, COL), where("appointmentDate", "==", today));
  const snap = await getDocs(q);
  return snap.size;
}
