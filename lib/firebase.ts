"use client";

import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

// Validate that all required Firebase credentials are present
const validateFirebaseConfig = () => {
  const requiredVars = [
    'NEXT_PUBLIC_FIREBASE_API_KEY',
    'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN',
    'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
    'NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET',
    'NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
    'NEXT_PUBLIC_FIREBASE_APP_ID',
  ];

  const missingVars = requiredVars.filter(
    (varName) => !process.env[varName as keyof typeof process.env]
  );

  if (missingVars.length > 0) {
    console.error(
      '❌ Firebase Configuration Error: Missing environment variables:',
      missingVars.join(', '),
      '\n📖 See FIREBASE_SETUP.md for setup instructions.'
    );
  }
};

validateFirebaseConfig();

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || '',
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || '',
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || '',
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || '',
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID || '',
};

let app;
try {
  app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
} catch (error: any) {
  console.error('❌ Firebase Initialization Error:', error.message);
  console.error(
    '📖 If you recently changed Firebase accounts, update your environment variables:'
  );
  console.error(
    '   1. Update NEXT_PUBLIC_FIREBASE_* in .env.local (for local dev)'
  );
  console.error(
    '   2. Update env vars in Vercel Settings (for production)'
  );
  console.error('   3. Restart your app and redeploy');
  console.error('   📄 See FIREBASE_SETUP.md for detailed instructions');
  throw error;
}

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const db = getFirestore(app);
export const storage = getStorage(app);
export default app;
