"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Home, Users, Calendar, Pill, IndianRupee, BookOpen, FileSpreadsheet, Settings, LogOut } from "lucide-react"
import { canAccessPath } from "@/lib/access"
import { cn } from "@/lib/utils"
import { Avatar } from "@/components/ui/avatar"
import { useAuth } from "@/components/providers/AuthProvider"

const navItems = [
  { href: "/", label: "Dashboard", icon: Home },
  { href: "/patients", label: "Patients", icon: Users },
  { href: "/appointments", label: "Appointments", icon: Calendar },
  { href: "/visits", label: "Clinic Log", icon: Pill },
  { href: "/payments", label: "Billing", icon: IndianRupee },
  { href: "/khata", label: "Khata", icon: BookOpen },
  { href: "/data", label: "Import / Export", icon: FileSpreadsheet },
]

export function Sidebar() {
  const pathname = usePathname()
  const { user, signOut } = useAuth()
  const visibleNavItems = navItems.filter((item) => canAccessPath(user?.role, item.href))
  const canAccessSettings = canAccessPath(user?.role, "/settings")

  return (
    <aside className="hidden lg:flex flex-col w-60 h-screen fixed top-0 left-0 bg-white border-r border-slate-200 z-40">
      <div className="flex items-center gap-3 px-6 h-16 border-b border-slate-200">
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-blue-600 text-white font-bold text-lg">
          +
        </div>
        <span className="text-xl font-bold text-slate-900">{process.env.NEXT_PUBLIC_APP_NAME || "OPD Clinic"}</span>
      </div>

      <div className="flex-1 overflow-y-auto py-6 px-3 flex flex-col gap-1">
        {visibleNavItems.map((item) => {
          const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href))
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                isActive
                  ? "bg-blue-50 text-blue-600 relative before:absolute before:left-0 before:top-1/2 before:-translate-y-1/2 before:h-2/3 before:w-1 before:bg-blue-600 before:rounded-r-full"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              )}
            >
              <item.icon className={cn("w-5 h-5", isActive ? "text-blue-600" : "text-slate-500")} />
              {item.label}
            </Link>
          )
        })}

        <div className="mt-8 mb-2 px-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">
          System
        </div>
        {canAccessSettings && (
          <Link
            href="/settings"
            className={cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
              pathname.startsWith("/settings")
                ? "bg-blue-50 text-blue-600 relative before:absolute before:left-0 before:top-1/2 before:-translate-y-1/2 before:h-2/3 before:w-1 before:bg-blue-600 before:rounded-r-full"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            )}
          >
            <Settings className={cn("w-5 h-5", pathname.startsWith("/settings") ? "text-blue-600" : "text-slate-500")} />
            Settings
          </Link>
        )}
      </div>

      <div className="p-4 border-t border-slate-200">
        <div className="flex items-center gap-3 mb-4">
          <Avatar fallback={user?.displayName?.substring(0, 2).toUpperCase() || "DR"} size="md" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-slate-900 truncate">{user?.displayName || "Doctor"}</p>
            <p className="text-xs text-slate-500 truncate">{user?.role || "doctor"}</p>
          </div>
        </div>
        <button onClick={signOut} className="flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors">
          <LogOut className="w-5 h-5 text-slate-500" />
          Sign Out
        </button>
      </div>
    </aside>
  )
}
