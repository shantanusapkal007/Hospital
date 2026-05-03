"use client"

import { useEffect, useState } from "react"
import { Calendar, CheckCircle2, ChevronRight, Clock, Clock3, IndianRupee, Sparkles, Users } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Avatar } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useAuth } from "@/components/providers/AuthProvider"
import { getAppointmentsByDate } from "@/services/appointment.service"
import { getTodayRevenue } from "@/services/payment.service"
import { getPatientCount, getPatients } from "@/services/patient.service"
import { getUpcomingFollowUps } from "@/services/visit.service"
import { formatCurrency, getTreatmentType } from "@/lib/utils"
import type { Appointment, Patient, Visit } from "@/lib/types"

export default function DashboardPage() {
  const { user } = useAuth()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [stats, setStats] = useState({ todayAppts: 0, pendingAppts: 0, totalPatients: 0, revenue: 0 })
  const [todayAppointments, setTodayAppointments] = useState<Appointment[]>([])
  const [recentPatients, setRecentPatients] = useState<Patient[]>([])
  const [followUps, setFollowUps] = useState<Visit[]>([])
  const [greeting, setGreeting] = useState("Hello")

  useEffect(() => {
    async function fetchDashboard() {
      try {
        const todayStr = new Date().toISOString().split("T")[0]
        const [appointments, revenue, patientCount, patients, followUpRows] = await Promise.all([
          getAppointmentsByDate(todayStr),
          getTodayRevenue(),
          getPatientCount(),
          getPatients(),
          getUpcomingFollowUps(),
        ])

        setStats({
          todayAppts: appointments.length,
          pendingAppts: appointments.filter((appointment) => appointment.status === "scheduled").length,
          totalPatients: patientCount,
          revenue,
        })

        setTodayAppointments(appointments.slice(0, 8))
        setRecentPatients(patients.slice(0, 5))
        setFollowUps(followUpRows.slice(0, 5))
      } catch (error) {
        setError("Failed to load dashboard data.")
      } finally {
        setLoading(false)
      }
    }

    fetchDashboard()
  }, [])

  useEffect(() => {
    const hour = new Date().getHours()
    setGreeting(hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening")
  }, [])

  if (loading) {
    return <div className="app-section px-6 py-16 text-center text-sm text-slate-500">Gathering dashboard analytics...</div>
  }

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-3xl border border-blue-100 bg-gradient-to-br from-blue-600 via-blue-500 to-cyan-500 p-6 text-white shadow-lg shadow-blue-900/10">
        <div className="absolute -right-10 -top-10 h-36 w-36 rounded-full bg-white/15 blur-2xl" />
        <div className="absolute bottom-0 left-8 h-20 w-20 rounded-full bg-cyan-200/20 blur-xl" />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/10 px-3 py-1 text-xs font-medium">
              <Sparkles className="h-3.5 w-3.5" />
              Intelligent dashboard
            </div>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Suradkar Hospital</h1>
            <p className="text-sm text-blue-50">{greeting}, {user?.displayName || "Doctor"} - here&apos;s your clinic overview for today.</p>
          </div>
          <Badge className="border-white/30 bg-white/15 text-white">Live Operations View</Badge>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={Calendar} label="Today's appointments" value={String(stats.todayAppts)} tone="blue" />
        <StatCard icon={Clock} label="Pending confirmations" value={String(stats.pendingAppts)} tone="amber" />
        <StatCard icon={Users} label="Total patients" value={String(stats.totalPatients)} tone="teal" />
        <StatCard icon={IndianRupee} label="Today's revenue" value={formatCurrency(stats.revenue)} tone="green" />
      </div>

      {error ? <div className="rounded-lg bg-red-50 p-4 text-sm text-red-700">{error}</div> : null}

      <div className="grid gap-6 xl:grid-cols-[1.35fr,1fr]">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between border-b border-slate-100 pb-4">
            <div>
              <CardTitle>Today&apos;s Appointments</CardTitle>
              <p className="mt-1 text-sm text-slate-500">The current queue, ordered by time.</p>
            </div>
            <Link href="/appointments" className="text-sm font-medium text-blue-600 transition-colors hover:text-blue-700">
              View all
            </Link>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-slate-100">
              {todayAppointments.map((appointment) => (
                <button
                  key={appointment.id}
                  type="button"
                  onClick={() => router.push(`/patients/${appointment.patientId}`)}
                  className="flex w-full items-center justify-between gap-4 p-4 text-left transition-colors hover:bg-slate-50"
                >
                  <div className="flex min-w-0 items-center gap-4">
                    <div className="w-14 shrink-0 text-sm font-semibold text-slate-900">{appointment.timeSlot}</div>
                    <Avatar fallback={appointment.patientName.substring(0, 2).toUpperCase()} size="md" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-900">{appointment.patientName}</p>
                      <Badge variant={appointment.type === "Follow-up" ? "followup" : "new"} className="mt-1">
                        {appointment.type}
                      </Badge>
                    </div>
                  </div>
                  {appointment.status === "completed" ? (
                    <CheckCircle2 className="h-5 w-5 shrink-0 text-green-600" />
                  ) : (
                    <Clock3 className="h-5 w-5 shrink-0 text-amber-500" />
                  )}
                </button>
              ))}
              {todayAppointments.length === 0 ? <div className="p-6 text-center text-sm text-slate-500">No appointments scheduled for today.</div> : null}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between border-b border-slate-100 pb-4">
            <div>
              <CardTitle>Recent Patients</CardTitle>
              <p className="mt-1 text-sm text-slate-500">Latest registrations from the records list.</p>
            </div>
            <Link href="/patients" className="text-sm font-medium text-blue-600 transition-colors hover:text-blue-700">
              View all
            </Link>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-slate-100">
              {recentPatients.map((patient) => (
                <Link key={patient.id} href={`/patients/${patient.id}`} className="flex items-center justify-between gap-3 p-4 transition-colors hover:bg-slate-50">
                  <div className="flex min-w-0 items-center gap-3">
                    <Avatar fallback={patient.fullName.substring(0, 2).toUpperCase()} size="md" />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-sm font-medium text-slate-900">{patient.fullName}</p>
                        <Badge variant="outline" className={getTreatmentType(patient.caseNumber, patient.treatmentType) === "Homeopathic" ? "border-green-200 bg-green-50 text-green-700" : "border-blue-200 bg-blue-50 text-blue-700"}>
                          {getTreatmentType(patient.caseNumber, patient.treatmentType)}
                        </Badge>
                      </div>
                      <p className="truncate text-xs text-slate-500">{patient.mobileNumber}</p>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="border-b border-slate-100 pb-4">
          <CardTitle>Upcoming Follow-ups</CardTitle>
          <p className="mt-1 text-sm text-slate-500">Pulled from visit notes and case records.</p>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-slate-100">
            {followUps.map((followUp) => (
              <button
                key={followUp.id}
                type="button"
                onClick={() => router.push(`/patients/${followUp.patientId}`)}
                className="grid w-full gap-2 p-4 text-left transition-colors hover:bg-slate-50 sm:grid-cols-[140px,1fr,1fr]"
              >
                <span className="text-sm font-medium text-slate-900">{followUp.followUpDate}</span>
                <span className="truncate text-sm font-medium text-slate-900">{followUp.patientName}</span>
                <span className="truncate text-sm text-slate-500">{followUp.diagnosis}</span>
              </button>
            ))}
            {followUps.length === 0 ? <div className="p-6 text-center text-sm text-slate-500">No upcoming follow-ups scheduled.</div> : null}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function StatCard({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof Calendar
  label: string
  value: string
  tone: "blue" | "amber" | "teal" | "green"
}) {
  const tones = {
    blue: "bg-blue-50 text-blue-600",
    amber: "bg-amber-50 text-amber-600",
    teal: "bg-teal-50 text-teal-600",
    green: "bg-green-50 text-green-600",
  }

  return (
    <Card className="border-slate-200/70 bg-white/90 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
      <CardContent className="flex items-start justify-between gap-4 p-5">
        <div className="space-y-3">
          <div className={`flex h-11 w-11 items-center justify-center rounded-2xl ${tones[tone]}`}>
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <p className="text-2xl font-semibold tracking-tight text-slate-950">{value}</p>
            <p className="mt-1 text-sm text-slate-500">{label}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
