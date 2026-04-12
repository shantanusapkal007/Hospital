"use client";

import { createContext, useContext, useState, useEffect } from 'react';
import { signInWithPopup, signOut as firebaseSignOut, onAuthStateChanged } from 'firebase/auth';
import { auth, googleProvider } from '@/lib/firebase';
import { getOrCreateUser } from '@/services/user.service';
import type { UserRole } from '@/lib/types';

// ==========================================
// 🔒 CHANGE THESE TO YOUR ALLOWED GMAIL IDs
// ==========================================
const DEFAULT_ALLOWED_EMAILS = [
  "shantanusapkal007@gmail.com",
  "tusharsuradkar184@gmail.com",
  "vinaykhairnar9404@gmail.com",
  "adityasutar99999@gmail.com",
  "tusharsuradkar10@gmail.com",
  "doctor@example.com",
];

const ALLOWED_EMAILS = (process.env.NEXT_PUBLIC_ALLOWED_EMAILS?.split(",") ?? DEFAULT_ALLOWED_EMAILS)
  .map((email) => email.trim().toLowerCase())
  .filter(Boolean);

type User = {
  id: string;
  displayName: string;
  email: string;
  role: UserRole;
  photoURL?: string;
} | null;

type AuthContextType = {
  user: User;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isDoctor: boolean;
  isReceptionist: boolean;
};

const AuthContext = createContext<AuthContextType | null>(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        // Enforce whitelist check on session restore
        if (!ALLOWED_EMAILS.includes((firebaseUser.email || '').toLowerCase())) {
          await firebaseSignOut(auth);
          setUser(null);
          setLoading(false);
          return;
        }

        try {
          const appUser = await getOrCreateUser(
            firebaseUser.uid,
            firebaseUser.displayName || 'Doctor',
            firebaseUser.email || '',
            firebaseUser.photoURL || ''
          );
          setUser({
            id: appUser.userId,
            displayName: (appUser.name || 'Doctor').toLowerCase().startsWith('dr') ? (appUser.name || 'Doctor') : `Dr. ${appUser.name || 'Doctor'}`,
            email: appUser.email,
            role: appUser.role,
            photoURL: appUser.photoURL,
          });
        } catch (error: any) {
          console.error('Failed to create/get user:', error);
          setUser(null);
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    }, (error: any) => {
      // Firebase auth state listener error handler
      console.error('Firebase Auth Error:', error);
      if (error.code === 'auth/invalid-api-key') {
        console.error(
          '❌ Firebase API Key is invalid or unauthorized.\n' +
          '📖 Steps to fix:\n' +
          '   1. Check that NEXT_PUBLIC_FIREBASE_API_KEY is correctly set in .env.local\n' +
          '   2. For Vercel: Verify env vars in Project Settings\n' +
          '   3. Ensure the API key belongs to the correct Firebase project\n' +
          '   4. Check Firebase Console > Settings > Authorized domains includes your domain\n' +
          '   See FIREBASE_SETUP.md for detailed instructions.'
        );
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const signInWithGoogle = async (): Promise<void> => {
    setLoading(true);
    try {
      // Use popup for cross-device compatibility, as redirect often fails on mobile due to third-party cookie blocking
      const result = await signInWithPopup(auth, googleProvider);
      
      // Enforce whitelist check immediately on sign-in
      if (!ALLOWED_EMAILS.includes((result.user.email || '').toLowerCase())) {
        await firebaseSignOut(auth);
        throw new Error('auth/unauthorized-email');
      }
    } catch (error: any) {
      setLoading(false);
      
      // Provide helpful error messages for common Firebase errors
      if (error.code === 'auth/invalid-api-key') {
        const newError = new Error(
          'Firebase configuration error: Invalid API Key. ' +
          'Please check your environment variables and Vercel settings. ' +
          'See FIREBASE_SETUP.md for instructions.'
        );
        (newError as any).code = 'auth/invalid-api-key';
        throw newError;
      }
      
      throw error;
    }
  };

  const signOut = async () => {
    await firebaseSignOut(auth);
  };

  const value = {
    user,
    loading,
    signInWithGoogle,
    signOut,
    isAuthenticated: !!user,
    isAdmin: !!user,
    isDoctor: !!user,
    isReceptionist: !!user,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
