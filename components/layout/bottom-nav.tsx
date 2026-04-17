"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Home, Users, Calendar, Pill, IndianRupee, MoreHorizontal } from "lucide-react"
import { canAccessPath } from "@/lib/access"
import { useAuth } from "@/components/providers/AuthProvider"
import { cn } from "@/lib/utils"

const navItems = [
  { href: "/", label: "Home", icon: Home },
  { href: "/patients", label: "Patients", icon: Users },
  { href: "/appointments", label: "Appts", icon: Calendar },
  { href: "/visits", label: "Log", icon: Pill },
  { href: "/payments", label: "Billing", icon: IndianRupee },
]

export function BottomNav() {
  const pathname = usePathname()
  const { user } = useAuth()
  const visibleNavItems = navItems.filter((item) => canAccessPath(user?.role, item.href))
  const moreHref = canAccessPath(user?.role, "/settings") ? "/settings" : "/khata"

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 h-16 bg-white border-t border-slate-200 flex items-center justify-around px-2 z-40 pb-safe">
      {visibleNavItems.map((item) => {
        const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href))
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex flex-col items-center justify-center w-16 h-full gap-1",
              isActive ? "text-blue-600" : "text-slate-400 hover:text-slate-600"
            )}
          >
            <item.icon className={cn("w-5 h-5", isActive && "fill-blue-50")} />
            <span className="text-[10px] font-medium">{item.label}</span>
          </Link>
        )
      })}
      <Link href={moreHref} className={cn("flex flex-col items-center justify-center w-16 h-full gap-1", pathname.startsWith(moreHref) ? "text-blue-600" : "text-slate-400 hover:text-slate-600")}>
        <MoreHorizontal className={cn("w-5 h-5", pathname.startsWith(moreHref) && "fill-blue-50")} />
        <span className="text-[10px] font-medium">More</span>
      </Link>
    </nav>
  )
}
