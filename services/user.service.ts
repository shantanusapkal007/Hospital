import { doc, getDoc, setDoc, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { AppUser, UserRole } from "@/lib/types";

export async function getOrCreateUser(uid: string, name: string, email: string, photoURL?: string): Promise<AppUser> {
  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);
  if (snap.exists()) {
    return snap.data() as AppUser;
  }
  // First-time sign-in → create user document with default role
  const newUser: AppUser = {
    userId: uid,
    name,
    email,
    role: "admin", // single user system, everyone is admin
    photoURL: photoURL || "",
    createdAt: Timestamp.now(),
  };
  await setDoc(ref, newUser);
  return newUser;
}

export async function updateUserRole(uid: string, role: UserRole) {
  const ref = doc(db, "users", uid);
  await setDoc(ref, { role }, { merge: true });
}
