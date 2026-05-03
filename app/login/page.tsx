"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/providers/AuthProvider";
import { Activity, CheckCircle2 } from "lucide-react";

const appName = process.env.NEXT_PUBLIC_APP_NAME || "Suradkar Hospital";

const features = [
  "Patient Records Management",
  "Smart Appointment Scheduling",
  "Prescription & Case Paper System",
  "Access from Any Device",
];

export default function LoginPage() {
  const { signInWithGoogle, isAuthenticated, loading: authLoading } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      router.replace("/");
    }
  }, [authLoading, isAuthenticated, router]);

  const handleLogin = async () => {
    try {
      setLoading(true);
      setError("");
      await signInWithGoogle();
      // OAuth redirect happens — no need to router.replace here
    } catch (err: any) {
      setError(err.message || "Sign in failed. Please try again.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* ── Left panel ── */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-blue-600 via-blue-700 to-blue-900 relative overflow-hidden flex-col justify-between p-12 text-white">
        <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-white/[0.04] rounded-full -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-white/[0.04] rounded-full translate-y-1/2 -translate-x-1/2" />

        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-11 h-11 rounded-xl bg-white/10 backdrop-blur-sm flex items-center justify-center">
              <Activity size={24} className="text-white" />
            </div>
            <span className="text-xl font-bold tracking-tight">{appName}</span>
          </div>
          <h1 className="text-[28px] font-bold leading-[1.2] mb-3">
            Smart Clinic<br />Management System
          </h1>
          <p className="text-white/70 text-[15px] max-w-md leading-relaxed">
            Streamline your practice with intelligent patient management, automated reminders, and seamless scheduling.
          </p>
        </div>

        <div className="relative z-10 space-y-3.5">
          {features.map((f, i) => (
            <div key={i} className="flex items-center gap-3">
              <CheckCircle2 size={18} className="text-white/50 shrink-0" />
              <span className="text-white/80 text-[14px]">{f}</span>
            </div>
          ))}
        </div>

        <p className="relative z-10 text-white/40 text-xs">&copy; {new Date().getFullYear()} {appName}. All rights reserved.</p>
      </div>

      {/* ── Right panel ── */}
      <div className="flex-1 flex items-center justify-center p-6 bg-white">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="lg:hidden flex flex-col items-center mb-10">
            <div className="w-12 h-12 rounded-xl bg-blue-600 flex items-center justify-center mb-3">
              <Activity size={26} className="text-white" />
            </div>
            <h2 className="text-xl font-bold text-slate-900">{appName}</h2>
            <p className="text-sm text-slate-500 mt-1">Smart Clinic Management System</p>
          </div>

          <div className="lg:text-left text-center">
            <h2 className="text-xl font-bold text-slate-900 mb-1">Welcome Back</h2>
            <p className="text-slate-500 text-sm mb-8">Sign in to manage your clinic</p>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {error}
            </div>
          )}

          <button
            onClick={handleLogin}
            disabled={loading}
            className="w-full h-11 flex items-center justify-center gap-3 bg-white border border-slate-200 rounded-lg text-slate-700 text-sm font-medium shadow-sm hover:bg-slate-50 hover:shadow-md transition-all duration-200 disabled:opacity-50 disabled:cursor-wait"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-slate-200 border-t-blue-600 rounded-full animate-spin" />
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
            )}
            {loading ? "Signing in…" : "Sign in with Google"}
          </button>

          <p className="text-xs text-slate-400 text-center mt-6">
            By continuing, you agree to our{" "}
            <a href="#" className="text-blue-600 hover:underline">Terms</a>
            {" & "}
            <a href="#" className="text-blue-600 hover:underline">Privacy Policy</a>
          </p>

          <p className="lg:hidden text-xs text-slate-400 text-center mt-12">&copy; {new Date().getFullYear()} {appName}</p>
        </div>
      </div>
    </div>
  );
}
