"use client"

import { useState, useEffect, useCallback, startTransition } from "react"
import { Plus, ChevronLeft, ChevronRight, CheckCircle2, Clock3, XCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Avatar } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Modal } from "@/components/ui/modal"
import { FORM_FIELD_PROPS, FORM_PROPS } from "@/lib/form-defaults"
import { useDebouncedValue } from "@/lib/use-debounced-value"
import { useRouter } from "next/navigation"
import { getAppointmentsByDate, addAppointment, updateAppointmentStatus } from "@/services/appointment.service"
import { searchPatients, addPatient, getNextPatientCaseNumber, getPatient } from "@/services/patient.service"
import type { Appointment, Patient } from "@/lib/types"
import { useToast } from "@/components/ui/toast"

export default function AppointmentsPage() {
  const [isBookModalOpen, setIsBookModalOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [updatingStatusId, setUpdatingStatusId] = useState<string | null>(null)
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split("T")[0])
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [patientSearch, setPatientSearch] = useState("")
  const [patientResults, setPatientResults] = useState<Patient[]>([])
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null)
  const [isQuickAddPatient, setIsQuickAddPatient] = useState(false)
  const [nextCaseNumber, setNextCaseNumber] = useState("")
  const debouncedPatientSearch = useDebouncedValue(patientSearch, 120)
  const router = useRouter()
  const { showToast } = useToast()

  const resetBookingState = () => {
    setSelectedPatient(null)
    setPatientSearch("")
    setPatientResults([])
    setIsQuickAddPatient(false)
    setNextCaseNumber("")
  }

  const fetchAppointments = useCallback(async () => {
    setLoading(true)
    try {
      const data = await getAppointmentsByDate(selectedDate)
      setAppointments(data)
      setError("")
    } catch (e) {
      setError("Failed to load appointments.")
    } finally {
      setLoading(false)
    }
  }, [selectedDate])

  useEffect(() => { fetchAppointments() }, [fetchAppointments])

  useEffect(() => {
    let active = true
    if (debouncedPatientSearch.length >= 2) {
      searchPatients(debouncedPatientSearch, 8).then((results) => {
        if (active) {
          startTransition(() => {
            setPatientResults(results)
          })
        }
      })
    } else {
      startTransition(() => {
        setPatientResults([])
      })
    }
    return () => {
      active = false
    }
  }, [debouncedPatientSearch])

  useEffect(() => {
    if (!isQuickAddPatient) return

    let active = true

    getNextPatientCaseNumber()
      .then((value) => {
        if (active) {
          setNextCaseNumber(value)
        }
      })
      .catch(() => {
        if (active) {
          setNextCaseNumber("CS-1001")
        }
      })

    return () => {
      active = false
    }
  }, [isQuickAddPatient])

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!selectedPatient) { showToast("Please select a patient", "warning"); return }
    setIsSaving(true)
    const form = e.currentTarget
    const fd = new FormData(form)
    try {
      if (!(fd.get("date") as string) || !(fd.get("time") as string)) {
        throw new Error("Date and time are required.");
      }

      await addAppointment({
        patientId: selectedPatient.id!,
        patientName: selectedPatient.fullName,
        appointmentDate: fd.get("date") as string,
        timeSlot: fd.get("time") as string,
        type: fd.get("type") as string,
        status: "scheduled",
        notes: fd.get("notes") as string || "",
      })
      if (typeof form.reset === "function") {
        form.reset()
      }
      setIsBookModalOpen(false)
      resetBookingState()
      fetchAppointments()
    } catch (e: any) {
      showToast(e.message || "Failed to book appointment.", "error")
    } finally {
      setIsSaving(false)
    }
  }

  const changeDate = (days: number) => {
    const d = new Date(selectedDate)
    d.setDate(d.getDate() + days)
    setSelectedDate(d.toISOString().split("T")[0])
  }

  const completed = appointments.filter(a => a.status === "completed").length
  const pending = appointments.filter(a => a.status === "scheduled").length
  const cancelled = appointments.filter(a => a.status === "cancelled").length
  const dateDisplay = new Date(selectedDate + "T00:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-950">Appointments</h1>
          <p className="text-sm text-slate-500">Manage the day schedule and update statuses quickly.</p>
        </div>
        <Button className="w-full sm:w-auto" onClick={() => setIsBookModalOpen(true)}>
          <Plus className="w-4 h-4 mr-2" /> Book Appointment
        </Button>
      </div>

      <Modal isOpen={isBookModalOpen} onClose={() => { setIsBookModalOpen(false); resetBookingState() }} title="Book Appointment">
        <form className="space-y-4" onSubmit={handleSave} {...FORM_PROPS}>
          {isQuickAddPatient ? (
            <div className="space-y-3 p-3 bg-slate-50 border border-slate-200 rounded-lg">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold text-slate-900">Quick Add Patient</h4>
                <button type="button" onClick={() => setIsQuickAddPatient(false)} className="text-xs text-slate-500 hover:text-slate-700 font-medium">Cancel</button>
              </div>
              <input type="text" id="quickName" placeholder="Full Name *" className="w-full h-9 px-3 rounded border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <input type="text" id="quickMobile" placeholder="Mobile Number *" className="w-full h-9 px-3 rounded border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <Button type="button" size="sm" className="w-full" disabled={isSaving} onClick={async () => {
                const name = (document.getElementById('quickName') as HTMLInputElement).value.trim();
                const mobile = (document.getElementById('quickMobile') as HTMLInputElement).value.trim();
                if (!name || mobile.length < 10) { showToast('Valid name and 10-digit mobile required', 'warning'); return; }
                setIsSaving(true);
                try {
                  const newPatient = {
                    fullName: name, mobileNumber: mobile, caseNumber: nextCaseNumber || "CS-1001", treatmentType: "Allopathic" as const, gender: "Other" as const, age: 0
                  };
                  const newId = await addPatient(newPatient);
                  const createdPatient = await getPatient(newId);
                  if (!createdPatient) {
                    throw new Error("Patient was created but could not be loaded.");
                  }
                  setSelectedPatient(createdPatient);
                  setIsQuickAddPatient(false);
                } catch (e: any) { showToast(e.message || 'Failed to add patient', 'error'); } finally { setIsSaving(false); }
              }}>{isSaving ? "Saving..." : "Save & Select"}</Button>
            </div>
          ) : (
            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <label className="text-sm font-medium text-slate-700">Patient</label>
                {!selectedPatient && (
                  <button type="button" onClick={() => setIsQuickAddPatient(true)} className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center"><Plus className="w-3 h-3 mr-1" /> New Patient</button>
                )}
              </div>
              <input type="text" value={selectedPatient ? selectedPatient.fullName : patientSearch}
                onChange={(e) => { setPatientSearch(e.target.value); setSelectedPatient(null) }}
                className="w-full h-10 px-3 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Search patient by name or mobile..." {...FORM_FIELD_PROPS} />
              {patientResults.length > 0 && !selectedPatient && (
                <div className="border border-slate-200 rounded-lg max-h-32 overflow-y-auto bg-white shadow-lg">
                  {patientResults.map(p => (
                    <button type="button" key={p.id} onClick={() => { setSelectedPatient(p); setPatientSearch(""); setPatientResults([]) }}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50">{p.fullName} - {p.mobileNumber}</button>
                  ))}
                </div>
              )}
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">Date</label>
              <input required name="date" type="date" defaultValue={selectedDate} className="w-full h-10 px-3 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" {...FORM_FIELD_PROPS} />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">Time</label>
              <input required name="time" type="time" className="w-full h-10 px-3 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" {...FORM_FIELD_PROPS} />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700">Type</label>
            <select name="type" className="w-full h-10 px-3 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" {...FORM_FIELD_PROPS}>
              <option value="New Consultation">New Consultation</option>
              <option value="Follow-up">Follow-up</option>
              <option value="Routine Checkup">Routine Checkup</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700">Notes (Optional)</label>
            <textarea name="notes" className="w-full p-3 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" rows={2} placeholder="Reason for visit..." {...FORM_FIELD_PROPS} />
          </div>
          <div className="pt-4 flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => { setIsBookModalOpen(false); resetBookingState() }} disabled={isSaving}>Cancel</Button>
            <Button type="submit" disabled={isSaving}>{isSaving ? "Booking..." : "Book Appointment"}</Button>
          </div>
        </form>
      </Modal>

      <div className="app-section flex flex-col items-center justify-between gap-4 p-4 lg:flex-row">
        <div className="flex items-center justify-between w-full lg:w-auto gap-4">
          <Button variant="outline" size="icon" onClick={() => changeDate(-1)}><ChevronLeft className="w-4 h-4" /></Button>
          <div className="flex flex-col items-center">
            <span className="font-semibold text-slate-900">{dateDisplay}</span>
            <button className="text-xs text-blue-600 font-medium cursor-pointer hover:underline" onClick={() => setSelectedDate(new Date().toISOString().split("T")[0])}>Today</button>
          </div>
          <Button variant="outline" size="icon" onClick={() => changeDate(1)}><ChevronRight className="w-4 h-4" /></Button>
        </div>
      </div>

      <div className="flex items-center gap-4 overflow-x-auto pb-2">
        <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-full border border-slate-200 shadow-sm whitespace-nowrap">
          <span className="text-sm font-medium text-slate-600">Total:</span>
          <span className="text-sm font-bold text-slate-900">{appointments.length}</span>
        </div>
        <div className="flex items-center gap-2 bg-green-50 px-4 py-2 rounded-full border border-green-100 whitespace-nowrap">
          <CheckCircle2 className="w-4 h-4 text-green-600" />
          <span className="text-sm font-medium text-green-700">Done: {completed}</span>
        </div>
        <div className="flex items-center gap-2 bg-amber-50 px-4 py-2 rounded-full border border-amber-100 whitespace-nowrap">
          <Clock3 className="w-4 h-4 text-amber-600" />
          <span className="text-sm font-medium text-amber-700">Pending: {pending}</span>
        </div>
        <div className="flex items-center gap-2 bg-red-50 px-4 py-2 rounded-full border border-red-100 whitespace-nowrap">
          <XCircle className="w-4 h-4 text-red-600" />
          <span className="text-sm font-medium text-red-700">Cancel: {cancelled}</span>
        </div>
      </div>

      {error && <div className="rounded-lg bg-red-50 p-4 text-sm text-red-700">{error}</div>}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="hidden lg:grid grid-cols-12 gap-4 p-4 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
          <div className="col-span-2">Time</div>
          <div className="col-span-4">Patient</div>
          <div className="col-span-3">Type</div>
          <div className="col-span-3 text-right">Status</div>
        </div>
        <div className="divide-y divide-slate-100">
          {loading && <div className="p-8 text-center text-sm text-slate-500">Loading appointments...</div>}
          {!loading && appointments.length === 0 && <div className="p-8 text-center text-sm text-slate-500">No appointments for this date</div>}
          {appointments.map((apt) => (
            <div key={apt.id} onClick={() => router.push(`/patients/${apt.patientId}`)} className="grid grid-cols-1 lg:grid-cols-12 gap-4 p-4 hover:bg-slate-50 transition-colors items-center group cursor-pointer">
              <div className="col-span-2"><span className="text-sm font-bold text-slate-700">{apt.timeSlot}</span></div>
              <div className="col-span-4 flex items-center gap-3">
                <Avatar fallback={apt.patientName?.substring(0, 2).toUpperCase()} size="sm" />
                <span className="font-medium text-slate-900 group-hover:text-blue-600 transition-colors">{apt.patientName}</span>
              </div>
              <div className="col-span-3 hidden lg:block">
                <Badge variant={apt.type === "Follow-up" ? "followup" : "new"}>{apt.type}</Badge>
              </div>
              <div className="col-span-3 flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                <select value={apt.status} disabled={updatingStatusId === apt.id} onChange={async (e) => {
                  try {
                    setUpdatingStatusId(apt.id!)
                    await updateAppointmentStatus(apt.id!, e.target.value as any)
                    await fetchAppointments()
                  } catch (error: any) {
                    showToast(error.message || "Failed to update appointment status.", "error")
                  } finally {
                    setUpdatingStatusId(null)
                  }
                }} className="h-8 px-2 rounded border border-slate-200 text-xs font-medium" {...FORM_FIELD_PROPS}>
                  <option value="scheduled">Pending</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                  <option value="no-show">No-show</option>
                </select>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
