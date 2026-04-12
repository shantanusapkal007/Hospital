import {
  collection, doc, getDocs, query, where, Timestamp, runTransaction, increment,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { clearPatientCache } from "@/services/patient.service";
import type { Payment } from "@/lib/types";

const COL = "payments";

export async function getPayments(): Promise<Payment[]> {
  const snap = await getDocs(collection(db, COL));
  const results = snap.docs.map(d => ({ id: d.id, ...d.data() } as Payment));
  return results.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
}

export async function getPaymentsByPatient(patientId: string): Promise<Payment[]> {
  const q = query(collection(db, COL), where("patientId", "==", patientId));
  const snap = await getDocs(q);
  const results = snap.docs.map(d => ({ id: d.id, ...d.data() } as Payment));
  return results.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
}

export async function addPayment(data: Omit<Payment, "id" | "createdAt">): Promise<string> {
  const amount = Number(data.amount);
  const patientName = data.patientName?.trim();
  const date = data.date?.trim();

  if (!data.patientId || !patientName || !date || !Number.isFinite(amount) || amount <= 0) {
    throw new Error("Please enter a valid payment.");
  }

  const paymentRef = doc(collection(db, COL));
  const patientRef = doc(db, "patients", data.patientId);

  await runTransaction(db, async (transaction) => {
    const patientSnap = await transaction.get(patientRef);
    if (!patientSnap.exists()) {
      throw new Error("Patient not found.");
    }

    transaction.set(paymentRef, {
      ...data,
      amount,
      patientName,
      date,
      createdAt: Timestamp.now(),
    });

    if (data.status === "paid") {
      transaction.update(patientRef, {
        khataBalance: increment(amount),
        updatedAt: Timestamp.now(),
      });
    }
  });

  clearPatientCache();
  return paymentRef.id;
}

export async function getTodayRevenue(): Promise<number> {
  const today = new Date().toISOString().split("T")[0];
  const q = query(collection(db, COL), where("date", "==", today));
  const snap = await getDocs(q);
  return snap.docs.filter(d => d.data().status === "paid").reduce((sum, d) => sum + (d.data().amount || 0), 0);
}

export async function getPaymentStats(): Promise<{ total: number; count: number; pending: number }> {
  const all = await getPayments();
  const total = all.filter(p => p.status === "paid").reduce((s, p) => s + p.amount, 0);
  const pending = all.filter(p => p.status === "pending").reduce((s, p) => s + p.amount, 0);
  return { total, count: all.length, pending };
}
