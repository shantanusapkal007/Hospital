import { doc, getDoc, setDoc, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { ClinicSettings } from "@/lib/types";

const DOC_ID = "main"; // Single settings document

let settingsCache: ClinicSettings | null = null;

export async function getClinicSettings(): Promise<ClinicSettings> {
  if (settingsCache) return settingsCache;

  const ref = doc(db, "clinic_settings", DOC_ID);
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    // Return defaults if no settings document exists
    return {
      clinicName: process.env.NEXT_PUBLIC_APP_NAME || "Suradkar Hospital",
      doctorName: "",
      specialization: "",
      phone: "",
      email: "",
      address: "",
    };
  }

  settingsCache = { id: snap.id, ...snap.data() } as ClinicSettings;
  return settingsCache;
}

export async function updateClinicSettings(
  updates: Partial<ClinicSettings>
): Promise<void> {
  const ref = doc(db, "clinic_settings", DOC_ID);

  await setDoc(ref, {
    ...updates,
    updatedAt: Timestamp.now(),
  }, { merge: true });

  settingsCache = null; // Invalidate cache
}
