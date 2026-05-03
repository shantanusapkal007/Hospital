"use client"

import { useState, useRef, useEffect } from "react"
import { Bell, ChevronDown, LogOut, Search, Calendar, Pill, Clock } from "lucide-react"
import { Avatar } from "@/components/ui/avatar"
import { usePathname, useRouter } from "next/navigation"
import { useAuth } from "@/components/providers/AuthProvider"
import { getUpcomingFollowUps } from "@/services/visit.service"
import { getAppointments } from "@/services/appointment.service"
import type { Visit, Appointment } from "@/lib/types"

const appName = process.env.NEXT_PUBLIC_APP_NAME || "Suradkar Hospital";

export function Header() {
  const pathname = usePathname()
  const router = useRouter()
  const { user, signOut } = useAuth()
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const [isNotifOpen, setIsNotifOpen] = useState(false)
  const [followUps, setFollowUps] = useState<Visit[]>([])
  const [todayAppointments, setTodayAppointments] = useState<Appointment[]>([])
  const [notifLoading, setNotifLoading] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const notifRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false)
      }
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setIsNotifOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const fetchNotifications = async () => {
    if (notifLoading) return
    setNotifLoading(true)
    try {
      const today = new Date().toISOString().split("T")[0]
      const [fups, allApts] = await Promise.all([
        getUpcomingFollowUps(),
        getAppointments(),
      ])
      const threeDaysFromNow = new Date()
      threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3)
      const threeDaysStr = threeDaysFromNow.toISOString().split("T")[0]
      setFollowUps(fups.filter(f => f.followUpDate && f.followUpDate <= threeDaysStr).slice(0, 8))
      setTodayAppointments(allApts.filter(a => a.status === "scheduled" && a.appointmentDate === today).slice(0, 8))
    } catch {
      // silently fail
    } finally {
      setNotifLoading(false)
    }
  }

  const toggleNotifications = () => {
    const nextState = !isNotifOpen
    setIsNotifOpen(nextState)
    if (nextState) {
      fetchNotifications()
    }
  }

  const notifCount = followUps.length + todayAppointments.length

  const openCommandPalette = () => {
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", ctrlKey: true, bubbles: true }))
  }
  
  const getPageTitle = () => {
    if (pathname === "/") return "Dashboard"
    if (pathname.startsWith("/patients")) return "Patients"
    if (pathname.startsWith("/appointments")) return "Appointments"
    if (pathname.startsWith("/visits")) return "Visits"
    if (pathname.startsWith("/payments")) return "Payments"
    if (pathname.startsWith("/settings")) return "Settings"
    return "Dashboard"
  }

  const formatDate = (dateStr: string) => {
    const today = new Date().toISOString().split("T")[0]
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    const tomorrowStr = tomorrow.toISOString().split("T")[0]
    if (dateStr === today) return "Today"
    if (dateStr === tomorrowStr) return "Tomorrow"
    return new Date(dateStr + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short" })
  }

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-slate-200/80 bg-white/90 px-4 backdrop-blur lg:px-8">
      <div className="min-w-0">
        <div className="lg:hidden">
          <p className="truncate text-base font-semibold text-slate-900">{getPageTitle()}</p>
          <p className="truncate text-xs text-slate-500">{appName}</p>
        </div>
        <div className="hidden lg:block">
          <h1 className="text-xl font-semibold text-slate-900">{getPageTitle()}</h1>
          <p className="text-xs text-slate-500">Welcome back, here&apos;s your overview</p>
        </div>
      </div>

      <div className="flex items-center gap-3 ml-auto">
        <button
          onClick={openCommandPalette}
          className="hidden sm:flex items-center gap-2 h-9 px-3 rounded-lg border border-slate-200 bg-slate-50 text-sm text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors"
        >
          <Search className="w-4 h-4" />
          <span className="hidden md:inline">Search...</span>
          <kbd className="hidden md:inline-flex items-center gap-0.5 rounded border border-slate-300 bg-white px-1.5 py-0.5 text-[10px] font-medium text-slate-500">
            Ctrl K
          </kbd>
        </button>

        {/* Notification Bell */}
        <div className="relative" ref={notifRef}>
          <button
            onClick={toggleNotifications}
            className="relative rounded-full p-2 text-slate-600 transition-colors hover:bg-slate-100"
          >
            <Bell className="w-5 h-5" />
            {notifCount > 0 && (
              <span className="absolute top-1 right-1 min-w-[16px] h-4 flex items-center justify-center bg-red-500 rounded-full border-2 border-white text-[9px] font-bold text-white px-0.5">
                {notifCount > 9 ? "9+" : notifCount}
              </span>
            )}
            {notifCount === 0 && !isNotifOpen && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-slate-300 rounded-full border-2 border-white" />
            )}
          </button>

          {isNotifOpen && (
            <div className="absolute right-0 z-50 mt-2 w-80 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl shadow-slate-950/10">
              <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-900">Notifications</h3>
                {notifCount > 0 && (
                  <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">
                    {notifCount}
                  </span>
                )}
              </div>

              <div className="max-h-80 overflow-y-auto">
                {notifLoading ? (
                  <div className="px-4 py-8 text-center text-sm text-slate-400">Loading...</div>
                ) : notifCount === 0 ? (
                  <div className="px-4 py-8 text-center">
                    <Bell className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                    <p className="text-sm text-slate-500">You&apos;re all caught up!</p>
                    <p className="text-xs text-slate-400 mt-1">No upcoming follow-ups or appointments</p>
                  </div>
                ) : (
                  <>
                    {todayAppointments.length > 0 && (
                      <div>
                        <div className="px-4 py-2 bg-slate-50 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                          Today&apos;s Appointments
                        </div>
                        {todayAppointments.map((apt) => (
                          <button
                            key={apt.id}
                            onClick={() => { router.push("/appointments"); setIsNotifOpen(false) }}
                            className="w-full px-4 py-3 flex items-start gap-3 hover:bg-blue-50/50 transition-colors text-left border-b border-slate-50 last:border-0"
                          >
                            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                              <Calendar className="w-4 h-4 text-blue-600" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium text-slate-900 truncate">{apt.patientName}</p>
                              <p className="text-xs text-slate-500 mt-0.5">
                                <Clock className="w-3 h-3 inline mr-1" />{apt.timeSlot} · {apt.type}
                              </p>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}

                    {followUps.length > 0 && (
                      <div>
                        <div className="px-4 py-2 bg-slate-50 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                          Upcoming Follow-ups
                        </div>
                        {followUps.map((visit) => (
                          <button
                            key={visit.id}
                            onClick={() => {
                              if (visit.patientId) router.push(`/patients/${visit.patientId}`)
                              setIsNotifOpen(false)
                            }}
                            className="w-full px-4 py-3 flex items-start gap-3 hover:bg-green-50/50 transition-colors text-left border-b border-slate-50 last:border-0"
                          >
                            <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                              <Pill className="w-4 h-4 text-green-600" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium text-slate-900 truncate">{visit.patientName}</p>
                              <p className="text-xs text-slate-500 mt-0.5">
                                Follow-up: {formatDate(visit.followUpDate!)} · {visit.diagnosis}
                              </p>
                            </div>
                            <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full flex-shrink-0 ${
                              visit.followUpDate === new Date().toISOString().split("T")[0]
                                ? "bg-amber-100 text-amber-700"
                                : "bg-slate-100 text-slate-600"
                            }`}>
                              {formatDate(visit.followUpDate!)}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="relative" ref={dropdownRef}>
          <button 
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className="flex items-center gap-2 rounded-full border border-transparent p-1 pr-2 transition-colors hover:border-slate-200 hover:bg-slate-50"
          >
            <Avatar fallback={user?.displayName?.substring(0, 2).toUpperCase() || "DR"} size="sm" />
            <span className="hidden max-w-32 truncate text-sm font-medium text-slate-700 sm:block">{user?.displayName || "Loading..."}</span>
            <ChevronDown className={`w-4 h-4 text-slate-400 hidden sm:block transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
          </button>

          {isDropdownOpen && (
            <div className="absolute right-0 z-50 mt-2 w-52 overflow-hidden rounded-2xl border border-slate-200 bg-white py-1 shadow-xl shadow-slate-950/10">
              <div className="px-4 py-3 border-b border-slate-100">
                <p className="text-sm font-medium text-slate-900 truncate">{user?.displayName || "Doctor"}</p>
                <p className="text-xs text-slate-500 truncate">{user?.email}</p>
              </div>
              <button 
                onClick={signOut}
                className="w-full text-left flex items-center gap-2 px-4 py-2 hover:bg-slate-50 text-sm font-medium text-red-600 transition-colors"
              >
                <LogOut className="w-4 h-4" /> Sign Out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
