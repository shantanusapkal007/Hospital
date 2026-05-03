"use client"

import { useState, useEffect, useRef, startTransition } from "react"
import {
  ArrowLeft, Edit, Calendar, Pill, MessageSquare, Phone, Mail, Activity,
  UserX, BookOpen, Plus, Printer, XCircle, Loader2, IndianRupee, ClipboardList,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Avatar } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Modal } from "@/components/ui/modal"
import { EditVisitModal } from "@/components/visits/edit-visit-modal"
import { VisitCard } from "@/components/visits/visit-card"
import { FORM_FIELD_PROPS, FORM_PROPS } from "@/lib/form-defaults"
import { cn, formatCurrency, getTreatmentType } from "@/lib/utils"
import { useAuth } from "@/components/providers/AuthProvider"
import Image from "next/image"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { getPatient, updatePatient, deletePatient, getPatientLinkedRecordCounts } from "@/services/patient.service"
import { getVisitsByPatient, addVisit } from "@/services/visit.service"
import { getPaymentsByPatient, addPayment } from "@/services/payment.service"
import { getAppointmentsByPatient } from "@/services/appointment.service"
import type { Patient, Visit, Payment, Appointment, TreatmentType, Medicine, Vitals } from "@/lib/types"
import { Breadcrumb } from "@/components/ui/breadcrumb-nav"
import { PatientMedicines } from "@/components/ui/patient-medicines"
import { useToast } from "@/components/ui/toast"

// ─── RX Quick Templates ───────────────────────────────────
const RX_TEMPLATES: Record<string, Medicine[]> = {
  Fever: [
    { name: "Tab Paracetamol 500mg", dosage: "1-0-1", frequency: "BD", days: 3 },
    { name: "Tab Pantoprazole 40mg", dosage: "1-0-0", frequency: "OD AC", days: 3 },
  ],
  Cold: [
    { name: "Tab Cetirizine 10mg", dosage: "0-0-1", frequency: "HS", days: 5 },
    { name: "Syp Cough Expectorant", dosage: "5ml", frequency: "TDS", days: 5 },
  ],
  Diabetes: [{ name: "Tab Metformin 500mg", dosage: "1-0-1", frequency: "BD", days: 30 }],
  BP: [{ name: "Tab Amlodipine 5mg", dosage: "1-0-0", frequency: "OD", days: 30 }],
}

function parseOptionalInteger(value: string | null | undefined) {
  const input = String(value ?? "").trim()
  if (!input) return undefined
  const parsed = Number.parseInt(input, 10)
  return Number.isFinite(parsed) ? parsed : undefined
}
function parseOptionalFloat(value: string | null | undefined) {
  const input = String(value ?? "").trim()
  if (!input) return undefined
  const parsed = Number.parseFloat(input)
  return Number.isFinite(parsed) ? parsed : undefined
}

// ─── Print Helper ─────────────────────────────────────────
function handlePrintVisit(visit: Visit, patient: Patient) {
  const printContent = `
    <html><head><title>Prescription</title>
    <style>
      body { font-family: 'Segoe UI', sans-serif; padding: 40px; color: #0f172a; }
      .header { text-align: center; border-bottom: 2px solid #e2e8f0; padding-bottom: 15px; margin-bottom: 25px; }
      h1 { margin: 0; color: #0f172a; font-size: 26px; font-weight: 700; }
      h3 { margin: 5px 0 0 0; color: #475569; font-size: 14px; font-weight: normal; }
      .pat-info { display: flex; justify-content: space-between; margin-bottom: 30px; font-size: 14px; background: #f8fafc; padding: 12px; border-radius: 6px; }
      table { width: 100%; border-collapse: collapse; margin-top: 15px; text-align: left; }
      th, td { padding: 12px 10px; border-bottom: 1px solid #e2e8f0; }
      th { background: #f1f5f9; font-size: 12px; text-transform: uppercase; color: #64748b; font-weight: 600; }
      td { font-size: 14px; }
      .notes { font-size: 11px; color: #64748b; margin-top: 4px; display: block; }
      .rx-title { margin: 0 0 10px 0; font-size: 20px; font-weight: 600; border-bottom: 1px solid #000; display: inline-block; padding-bottom: 2px;}
      .footer { margin-top: 80px; text-align: right; }
      .sig { border-top: 1px solid #000; padding-top: 5px; display: inline-block; width: 200px; text-align: center; font-size: 14px;}
      .section { margin-top: 20px; font-size: 14px; }
      .vitals { display: flex; flex-wrap: wrap; gap: 12px; font-size: 13px; background: #f8fafc; padding: 10px 12px; border-radius: 6px; margin-bottom: 20px; }
      .vitals span { font-weight: 600; }
    </style>
    </head><body>
      <div class="header">
        <h1>${process.env.NEXT_PUBLIC_APP_NAME || "Suradkar Hospital"}</h1>
        <h3>Consultation Record</h3>
      </div>
      <div class="pat-info">
        <div><strong>Patient:</strong> ${visit.patientName}</div>
        <div><strong>Case No:</strong> ${patient.caseNumber}</div>
        <div><strong>Age/Gender:</strong> ${patient.age} yrs / ${patient.gender}</div>
        <div><strong>Date:</strong> ${visit.createdAt?.toDate ? visit.createdAt.toDate().toLocaleDateString("en-IN") : new Date().toLocaleDateString("en-IN")}</div>
      </div>
      ${visit.vitals && Object.values(visit.vitals).some(v => v) ? `
      <div class="vitals">
        ${visit.vitals.bp ? `<div>BP: <span>${visit.vitals.bp} mmHg</span></div>` : ""}
        ${visit.vitals.pulse ? `<div>Pulse: <span>${visit.vitals.pulse} bpm</span></div>` : ""}
        ${visit.vitals.temperature ? `<div>Temp: <span>${visit.vitals.temperature}°F</span></div>` : ""}
        ${visit.vitals.spo2 ? `<div>SpO2: <span>${visit.vitals.spo2}%</span></div>` : ""}
        ${visit.vitals.weight ? `<div>Wt: <span>${visit.vitals.weight} kg</span></div>` : ""}
        ${visit.vitals.height ? `<div>Ht: <span>${visit.vitals.height} cm</span></div>` : ""}
      </div>` : ""}
      ${visit.complaints ? `<div class="section"><strong>Chief Complaints:</strong> <p>${visit.complaints}</p></div>` : ""}
      ${visit.diagnosis ? `<div class="section"><strong>Diagnosis:</strong> <p>${visit.diagnosis}</p></div>` : ""}
      ${visit.prescriptions && visit.prescriptions.length > 0 ? `
      <div class="rx-title">Rx</div>
      <table>
        <thead><tr><th>Medicine</th><th>Dose</th><th>Frequency</th><th>Duration</th></tr></thead>
        <tbody>
          ${visit.prescriptions.map(p => `<tr><td><strong>${p.name}</strong>${p.notes ? `<span class="notes">${p.notes}</span>` : ""}</td><td>${p.dosage}</td><td>${p.frequency}</td><td>${p.days} Days</td></tr>`).join("")}
        </tbody>
      </table>` : ""}
      ${visit.advice ? `<div class="section"><strong>Advice &amp; Instructions:</strong> <p>${visit.advice}</p></div>` : ""}
      ${visit.followUpDate ? `<div class="section"><strong>Follow Up:</strong> ${new Date(visit.followUpDate).toLocaleDateString("en-IN")}</div>` : ""}
      <div class="footer"><div class="sig">Doctor Signature</div></div>
    </body></html>
  `
  const printWin = window.open("", "", "width=850,height=700")
  if (printWin) {
    printWin.document.write(printContent)
    printWin.document.close()
    printWin.focus()
    setTimeout(() => { printWin.print() }, 400)
  }
}

export default function PatientDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { user } = useAuth()
  const patientId = params.id as string

  // ─── Core Data State ───────────────────────────────────────
  const [patient, setPatient] = useState<Patient | null>(null)
  const [visits, setVisits] = useState<Visit[]>([])
  const [payments, setPayments] = useState<Payment[]>([])
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [activeTab, setActiveTab] = useState("history")

  // ─── Edit Patient Modal ───────────────────────────────────
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [editGender, setEditGender] = useState("Male")
  const [editTreatmentType, setEditTreatmentType] = useState<TreatmentType>("Allopathic")
  const [editMedicines, setEditMedicines] = useState<Medicine[]>([])
  const [medicineDraft, setMedicineDraft] = useState<Medicine[]>([])

  // ─── WhatsApp Modal ───────────────────────────────────────
  const [isWhatsAppModalOpen, setIsWhatsAppModalOpen] = useState(false)
  const [selectedWhatsAppNumber, setSelectedWhatsAppNumber] = useState("9420893995")

  // ─── Edit Visit Modal ─────────────────────────────────────
  const [selectedVisit, setSelectedVisit] = useState<Visit | null>(null)
  const [isEditVisitModalOpen, setIsEditVisitModalOpen] = useState(false)

  // ─── Record Visit Modal ───────────────────────────────────
  const [isRecordVisitOpen, setIsRecordVisitOpen] = useState(false)
  const [isRecordingSaving, setIsRecordingSaving] = useState(false)
  const [visitMedicines, setVisitMedicines] = useState<Medicine[]>([])

  // ─── Record Payment Modal ─────────────────────────────────
  const [isRecordPaymentOpen, setIsRecordPaymentOpen] = useState(false)
  const [isPaymentSaving, setIsPaymentSaving] = useState(false)

  // ─── Clinical Details Form ────────────────────────────────
  const [clinicalDetailsFormData, setClinicalDetailsFormData] = useState({
    presentComplaints: "", weight: "", heightCm: "", bp: "",
    temperature: "", spo2: "", repetition: "", lmp: "",
  })
  const [isSavingClinical, setIsSavingClinical] = useState(false)
  const [isSavingMedicines, setIsSavingMedicines] = useState(false)

  const { showToast } = useToast()

  // ─── Visit form ref (for reset) ───────────────────────────
  const visitFormRef = useRef<HTMLFormElement>(null)

  const ic = "w-full h-10 rounded-xl border border-slate-200 bg-white/90 px-3 text-sm text-slate-800 shadow-sm transition focus:outline-none focus:ring-2 focus:ring-sky-500"
  const lbl = "text-sm font-medium text-slate-700"

  // ─── Helpers ──────────────────────────────────────────────
  const buildMedicineDraft = () => [] as Medicine[]

  const buildEmptyClinicalDetailsFormData = () => ({
    presentComplaints: "", weight: "", heightCm: "", bp: "",
    temperature: "", spo2: "", repetition: "", lmp: "",
  })

  const parseOptionalNumber = (value: string) => {
    const trimmed = value.trim()
    if (!trimmed) return null
    const parsed = Number.parseFloat(trimmed)
    return Number.isFinite(parsed) ? parsed : null
  }

  const sanitizeMedicines = (medicines: Medicine[]) =>
    medicines
      .map(m => ({
        ...m,
        name: m.name.trim(),
        potency: m.potency?.trim() || "",
        dosage: m.dosage.trim(),
        frequency: m.frequency.trim(),
        notes: m.notes?.trim() || "",
        days: Number.isFinite(m.days) ? m.days : 0,
      }))
      .filter(m => Boolean(m.name || m.potency || m.dosage || m.frequency || m.notes))

  const resetEditFormState = (nextPatient: Patient | null = patient) => {
    if (!nextPatient) return
    setEditGender(nextPatient.gender)
    setEditTreatmentType(getTreatmentType(nextPatient.caseNumber, nextPatient.treatmentType))
    setEditMedicines(nextPatient.currentMedicines || [])
  }

  const resetVisitForm = () => {
    setVisitMedicines([])
    visitFormRef.current?.reset()
  }

  // ─── Quick follow-up helper for Visit form ─────────────────
  const setQuickFollowUp = (days: number, formRef: React.RefObject<HTMLFormElement | null>) => {
    const d = new Date()
    d.setDate(d.getDate() + days)
    const el = formRef.current?.querySelector<HTMLInputElement>("[name='visitFollowUpDate']")
    if (el) el.value = d.toISOString().split("T")[0]
  }

  // ─── Load Data ────────────────────────────────────────────
  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const [p, v, pay, apt] = await Promise.all([
          getPatient(patientId),
          getVisitsByPatient(patientId),
          getPaymentsByPatient(patientId),
          getAppointmentsByPatient(patientId),
        ])
        setPatient(p)
        setVisits(v)
        setPayments(pay)
        setAppointments(apt)
        setError("")
        if (p) {
          setEditGender(p.gender)
          setEditTreatmentType(getTreatmentType(p.caseNumber, p.treatmentType))
          setEditMedicines(p.currentMedicines || [])
          setMedicineDraft(buildMedicineDraft())
        }
      } catch {
        setError("Failed to load patient details.")
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [patientId])

  // ─── Edit Patient Handler ─────────────────────────────────
  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!patient?.id) return
    setIsSaving(true)
    const form = e.currentTarget
    const fd = new FormData(form)
    try {
      const updateData: any = {
        caseNumber: fd.get("caseNumber") as string,
        treatmentType: fd.get("treatmentType") as TreatmentType,
        fullName: `${fd.get("firstName")} ${fd.get("lastName")}`,
        mobileNumber: fd.get("mobile") as string,
        alternateMobile: fd.get("alternateMobile") as string || "",
        age: parseInt(fd.get("age") as string) || 0,
        gender: editGender as "Male" | "Female" | "Other",
        dateOfBirth: fd.get("dob") as string || "",
        bloodGroup: fd.get("bloodGroup") as string || "",
        email: fd.get("email") as string || "",
        occupation: fd.get("occupation") as string || "",
        maritalStatus: fd.get("maritalStatus") as string || "",
        address: {
          line1: fd.get("addressLine1") as string || "",
          city: fd.get("city") as string || "",
          state: fd.get("state") as string || "",
          pincode: fd.get("pincode") as string || "",
        },
        allergies: fd.get("allergies") as string || "",
        chronicDiseases: fd.get("chronicDiseases") as string || "",
        emergencyContact: fd.get("emergencyContact") as string || "",
        notes: fd.get("notes") as string || "",
        currentMedicines: editMedicines,
      }
      if (editGender?.toLowerCase() === "female") {
        updateData.lmp = fd.get("lmp") as string || ""
        updateData.menstrualCycleDays = parseInt(fd.get("menstrualCycleDays") as string) || null
      } else {
        updateData.lmp = null
        updateData.menstrualCycleDays = null
      }
      await updatePatient(patient.id, updateData)
      const updated = await getPatient(patient.id)
      setPatient(updated)
      resetEditFormState(updated)
      setMedicineDraft(buildMedicineDraft())
      setIsEditModalOpen(false)
      showToast("Patient profile updated", "success")
    } catch (e: any) {
      showToast(e.message || "Failed to update patient.", "error")
    } finally {
      setIsSaving(false)
    }
  }

  // ─── Save Clinical Details ────────────────────────────────
  const handleSaveClinicalDetails = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!patient?.id) return
    setIsSavingClinical(true)
    try {
      const updateData: any = {
        presentComplaints: clinicalDetailsFormData.presentComplaints.trim(),
        weight: parseOptionalNumber(clinicalDetailsFormData.weight),
        heightCm: parseOptionalNumber(clinicalDetailsFormData.heightCm),
        bp: clinicalDetailsFormData.bp.trim(),
        temperature: parseOptionalNumber(clinicalDetailsFormData.temperature),
        spo2: parseOptionalNumber(clinicalDetailsFormData.spo2),
        repetition: clinicalDetailsFormData.repetition.trim(),
      }
      if (patient.gender?.toLowerCase() === "female") {
        updateData.lmp = clinicalDetailsFormData.lmp
      }
      await updatePatient(patient.id, updateData)
      const updated = await getPatient(patient.id)
      setPatient(updated)
      setClinicalDetailsFormData(buildEmptyClinicalDetailsFormData())
      showToast("Clinical details saved", "success")
    } catch (e: any) {
      showToast(e.message || "Failed to save clinical details", "error")
    } finally {
      setIsSavingClinical(false)
    }
  }

  // ─── Save Medicines ───────────────────────────────────────
  const handleSaveMedicines = async () => {
    if (!patient?.id) return
    setIsSavingMedicines(true)
    try {
      const nextMedicines = sanitizeMedicines(medicineDraft)
      await updatePatient(patient.id, { currentMedicines: nextMedicines })
      const updated = await getPatient(patient.id)
      setPatient(updated)
      setEditMedicines(updated?.currentMedicines || [])
      setMedicineDraft(buildMedicineDraft())
      showToast("Current medicines saved", "success")
    } catch (e: any) {
      showToast(e.message || "Failed to save medicines", "error")
    } finally {
      setIsSavingMedicines(false)
    }
  }

  // ─── Record Visit Handler ─────────────────────────────────
  const handleRecordVisit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!patient) return
    setIsRecordingSaving(true)
    const form = e.currentTarget
    const fd = new FormData(form)

    try {
      const complaints = (fd.get("visitComplaints") as string)?.trim()
      const diagnosis = (fd.get("visitDiagnosis") as string)?.trim()

      if (!complaints) { showToast("Chief complaints are required", "warning"); setIsRecordingSaving(false); return }
      if (!diagnosis) { showToast("Diagnosis is required", "warning"); setIsRecordingSaving(false); return }

      const prescriptionsToSave = visitMedicines.filter(m => m.name.trim() !== "")

      const vitals: Vitals = {}
      const vBP = (fd.get("visitBP") as string)?.trim(); if (vBP) vitals.bp = vBP
      const vPulse = parseOptionalInteger(fd.get("visitPulse") as string); if (vPulse) vitals.pulse = vPulse
      const vTemp = parseOptionalFloat(fd.get("visitTemp") as string); if (vTemp) vitals.temperature = vTemp
      const vSpo2 = parseOptionalInteger(fd.get("visitSpo2") as string); if (vSpo2) vitals.spo2 = vSpo2
      const vWeight = parseOptionalInteger(fd.get("visitWeight") as string); if (vWeight) vitals.weight = vWeight
      const vHeight = parseOptionalInteger(fd.get("visitHeight") as string); if (vHeight) vitals.height = vHeight
      const vRR = parseOptionalInteger(fd.get("visitRR") as string); if (vRR) vitals.respiratoryRate = vRR

      const totalBill = parseInt(fd.get("visitTotalBill") as string) || 0
      const paymentStatus = (fd.get("visitPaymentStatus") as "paid" | "unpaid") || "unpaid"
      const followUpDate = (fd.get("visitFollowUpDate") as string) || ""

      await addVisit({
        patientId: patient.id!,
        patientName: patient.fullName,
        complaints,
        historyOfPresentIllness: (fd.get("visitHPI") as string) || "",
        pastHistory: (fd.get("visitPastHistory") as string) || "",
        familyHistory: (fd.get("visitFamilyHistory") as string) || "",
        examinationFindings: (fd.get("visitExamination") as string) || "",
        diagnosis,
        prescriptions: prescriptionsToSave,
        vitals,
        labTests: (fd.get("visitLabTests") as string) || "",
        investigationsAdvised: (fd.get("visitInvestigations") as string) || "",
        advice: (fd.get("visitAdvice") as string) || "",
        referral: (fd.get("visitReferral") as string) || "",
        followUpDate,
        totalBill,
        paymentStatus,
        visitImages: [],
      })

      // Refresh visits + patient (khata balance may have changed)
      const [refreshedVisits, refreshedPay, refreshedPatient] = await Promise.all([
        getVisitsByPatient(patientId),
        getPaymentsByPatient(patientId),
        getPatient(patientId),
      ])
      setVisits(refreshedVisits)
      setPayments(refreshedPay)
      if (refreshedPatient) setPatient(refreshedPatient)

      setIsRecordVisitOpen(false)
      resetVisitForm()
      setActiveTab("history")
      showToast("Visit recorded successfully!", "success")

      // Auto-print if medicines were prescribed
      if (prescriptionsToSave.length > 0 && refreshedVisits[0]) {
        setTimeout(() => handlePrintVisit(refreshedVisits[0], patient), 300)
      }
    } catch (e: any) {
      showToast(e.message || "Failed to record visit.", "error")
    } finally {
      setIsRecordingSaving(false)
    }
  }

  // ─── Record Payment Handler ───────────────────────────────
  const handleRecordPayment = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!patient) return
    setIsPaymentSaving(true)
    const form = e.currentTarget
    const fd = new FormData(form)
    try {
      const amount = parseFloat(fd.get("payAmount") as string)
      if (!amount || amount <= 0) { showToast("Enter a valid amount", "warning"); setIsPaymentSaving(false); return }
      await addPayment({
        patientId: patient.id!,
        patientName: patient.fullName,
        amount,
        paymentMethod: (fd.get("payMethod") as any) || "cash",
        status: "paid",
        description: (fd.get("payDesc") as string) || "",
        date: (fd.get("payDate") as string) || new Date().toISOString().split("T")[0],
      })
      const [refreshedPay, refreshedPatient] = await Promise.all([
        getPaymentsByPatient(patientId),
        getPatient(patientId),
      ])
      setPayments(refreshedPay)
      if (refreshedPatient) setPatient(refreshedPatient)
      setIsRecordPaymentOpen(false)
      form.reset()
      showToast("Payment recorded!", "success")
    } catch (e: any) {
      showToast(e.message || "Failed to record payment.", "error")
    } finally {
      setIsPaymentSaving(false)
    }
  }

  // ─── Visit Medicine Helpers ───────────────────────────────
  const addVisitMedicine = () => setVisitMedicines(prev => [...prev, { name: "", dosage: "", frequency: "", days: 3 }])
  const updateVisitMedicine = (idx: number, field: keyof Medicine, val: string | number) => {
    setVisitMedicines(prev => { const n = [...prev]; n[idx] = { ...n[idx], [field]: val as any }; return n })
  }
  const removeVisitMedicine = (idx: number) => setVisitMedicines(prev => prev.filter((_, i) => i !== idx))
  const applyRxTemplate = (meds: Medicine[]) => setVisitMedicines(meds.map(m => ({ ...m })))

  // ─── Guards ───────────────────────────────────────────────
  if (loading) return <div className="flex items-center justify-center py-20 text-slate-500">Loading patient...</div>
  if (!patient) return <div className="flex items-center justify-center py-20 text-slate-500">Patient not found.</div>

  // ─── Derived Values ───────────────────────────────────────
  const nameParts = patient.fullName?.split(" ") || [""]
  const firstName = nameParts[0] || ""
  const lastName = nameParts.slice(1).join(" ") || ""
  const patientTreatmentType = getTreatmentType(patient.caseNumber, patient.treatmentType)
  const savedMedicines = patient.currentMedicines || []
  const normalizedSavedMedicines = sanitizeMedicines(savedMedicines)
  const normalizedMedicineDraft = sanitizeMedicines(medicineDraft)
  const hasSavedMedicines = normalizedSavedMedicines.length > 0
  const hasMedicineChanges = normalizedMedicineDraft.length > 0
  const clinicalSummaryItems = [
    { label: "Weight", value: patient.weight != null ? `${patient.weight} kg` : "-" },
    { label: "Height", value: patient.heightCm != null ? `${patient.heightCm} cm` : "-" },
    { label: "Blood Pressure", value: patient.bp || "-" },
    { label: "Temperature", value: patient.temperature != null ? `${patient.temperature} °F` : "-" },
    { label: "SpO2", value: patient.spo2 != null ? `${patient.spo2}%` : "-" },
    { label: "Repetition", value: patient.repetition || "-" },
  ]
  if (patient.gender?.toLowerCase() === "female") {
    clinicalSummaryItems.push({ label: "LMP", value: patient.lmp || "-" })
  }
  const previousComplaint = visits.length > 0 ? visits[0].complaints : ""
  const hasClinicalDetails = clinicalSummaryItems.some(i => i.value !== "-") || Boolean(patient.presentComplaints) || Boolean(previousComplaint)
  const hasPatientCareSummary = hasClinicalDetails || hasSavedMedicines
  const khataBalance = patient.khataBalance || 0
  const khataLabel = khataBalance < 0
    ? `Due ${formatCurrency(Math.abs(khataBalance))}`
    : khataBalance > 0 ? `Advance ${formatCurrency(khataBalance)}` : "Clear"

  const patientStats = [
    {
      label: "Visits", value: String(visits.length),
      hint: visits.length > 0 ? "Case papers recorded" : "No visits yet",
      icon: Activity, shell: "border-sky-200/80 bg-gradient-to-br from-sky-100 via-white to-blue-50 text-sky-900",
      iconShell: "bg-sky-600 text-white shadow-sky-200",
    },
    {
      label: "Appointments", value: String(appointments.length),
      hint: appointments.length > 0 ? "Scheduled history" : "Nothing booked yet",
      icon: Calendar, shell: "border-amber-200/80 bg-gradient-to-br from-amber-100 via-white to-orange-50 text-amber-900",
      iconShell: "bg-amber-500 text-white shadow-amber-200",
    },
    {
      label: "Payments", value: String(payments.length),
      hint: payments.length > 0 ? "Transactions on file" : "No payment records",
      icon: BookOpen, shell: "border-emerald-200/80 bg-gradient-to-br from-emerald-100 via-white to-teal-50 text-emerald-900",
      iconShell: "bg-emerald-600 text-white shadow-emerald-200",
    },
    {
      label: "Khata", value: khataLabel,
      hint: khataBalance < 0 ? "Pending ledger balance" : khataBalance > 0 ? "Advance available" : "No open balance",
      icon: MessageSquare,
      shell: khataBalance < 0 ? "border-rose-200/80 bg-gradient-to-br from-rose-100 via-white to-red-50 text-rose-900"
        : khataBalance > 0 ? "border-emerald-200/80 bg-gradient-to-br from-emerald-100 via-white to-lime-50 text-emerald-900"
          : "border-slate-200/80 bg-gradient-to-br from-slate-100 via-white to-slate-50 text-slate-900",
      iconShell: khataBalance < 0 ? "bg-rose-600 text-white shadow-rose-200"
        : khataBalance > 0 ? "bg-emerald-600 text-white shadow-emerald-200"
          : "bg-slate-700 text-white shadow-slate-200",
    },
  ]

  const tabItems = [
    { id: "history", label: "History", count: visits.length },
    { id: "appointments", label: "Appointments", count: appointments.length },
    { id: "payments", label: "Payments", count: payments.length },
    { id: "khata", label: "Khata Record", count: visits.filter(v => (v.totalBill || 0) > 0).length + payments.length },
  ]

  // ─── Shared input class shortcuts ─────────────────────────
  const secHead = "text-xs font-semibold text-slate-400 uppercase tracking-wider mt-2 mb-1 pt-3 border-t border-slate-100"

  return (
    <div className="relative mx-auto max-w-5xl space-y-6 pb-8">
      <Breadcrumb items={[
        { label: "Dashboard", href: "/" },
        { label: "Patients", href: "/patients" },
        { label: patient?.fullName || "Loading..." }
      ]} />
      <Link href="/patients" className="inline-flex items-center text-sm font-medium text-slate-500 hover:text-slate-900 transition-colors">
        <ArrowLeft className="w-4 h-4 mr-1" /> Back to Patients
      </Link>

      {error && <div className="rounded-lg bg-red-50 p-4 text-sm text-red-700">{error}</div>}

      {/* ───────────────── Edit Patient Modal ───────────────── */}
      <Modal isOpen={isEditModalOpen} onClose={() => { setIsEditModalOpen(false); resetEditFormState() }} title="Edit Patient">
        <form className="space-y-3 max-h-[70vh] overflow-y-auto pr-2" onSubmit={handleSave} {...FORM_PROPS}>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1"><label className={lbl}>Case Number</label><input required name="caseNumber" defaultValue={patient.caseNumber} className={ic} {...FORM_FIELD_PROPS} /></div>
            <div className="space-y-1"><label className={lbl}>Mobile</label><input required name="mobile" type="tel" defaultValue={patient.mobileNumber} className={ic} {...FORM_FIELD_PROPS} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1"><label className={lbl}>First Name</label><input required name="firstName" defaultValue={firstName} className={ic} {...FORM_FIELD_PROPS} /></div>
            <div className="space-y-1"><label className={lbl}>Last Name</label><input required name="lastName" defaultValue={lastName} className={ic} {...FORM_FIELD_PROPS} /></div>
          </div>
          <div className="grid grid-cols-4 gap-3">
            <div className="space-y-1"><label className={lbl}>Age</label><input required name="age" type="number" defaultValue={patient.age} className={ic} {...FORM_FIELD_PROPS} /></div>
            <div className="space-y-1"><label className={lbl}>Gender</label>
              <select value={editGender} onChange={e => setEditGender(e.target.value)} className={ic} {...FORM_FIELD_PROPS}>
                <option value="Male">Male</option><option value="Female">Female</option><option value="Other">Other</option>
              </select>
            </div>
            <div className="space-y-1 col-span-2"><label className={lbl}>Treatment Type</label>
              <select name="treatmentType" value={editTreatmentType} onChange={e => setEditTreatmentType(e.target.value as TreatmentType)} className={ic} required {...FORM_FIELD_PROPS}>
                <option value="Allopathic">Allopathic</option>
                <option value="Homeopathic">Homeopathic</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1"><label className={lbl}>Blood</label><input name="bloodGroup" defaultValue={patient.bloodGroup} className={ic} {...FORM_FIELD_PROPS} /></div>
            <div className="space-y-1"><label className={lbl}>DOB</label><input name="dob" type="date" defaultValue={patient.dateOfBirth} className={ic} {...FORM_FIELD_PROPS} /></div>
          </div>
          {editGender?.toLowerCase() === "female" && (
            <div className="p-3 bg-pink-50 border border-pink-100 rounded-lg space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1"><label className="text-sm font-medium text-pink-800">LMP</label><input name="lmp" type="date" defaultValue={patient.lmp ?? ""} className={ic} {...FORM_FIELD_PROPS} /></div>
                <div className="space-y-1"><label className="text-sm font-medium text-pink-800">Cycle (days)</label><input name="menstrualCycleDays" type="number" defaultValue={patient.menstrualCycleDays ?? ""} className={ic} placeholder="28" {...FORM_FIELD_PROPS} /></div>
              </div>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1"><label className={lbl}>Alt. Mobile</label><input name="alternateMobile" defaultValue={patient.alternateMobile} className={ic} {...FORM_FIELD_PROPS} /></div>
            <div className="space-y-1"><label className={lbl}>Email</label><input name="email" type="email" defaultValue={patient.email} className={ic} {...FORM_FIELD_PROPS} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1"><label className={lbl}>Emergency</label><input name="emergencyContact" defaultValue={patient.emergencyContact} className={ic} {...FORM_FIELD_PROPS} /></div>
            <div className="space-y-1"><label className={lbl}>Occupation</label><input name="occupation" defaultValue={patient.occupation} className={ic} {...FORM_FIELD_PROPS} /></div>
          </div>
          <div className="space-y-1"><label className={lbl}>Address</label><input name="addressLine1" defaultValue={patient.address?.line1} className={ic} {...FORM_FIELD_PROPS} /></div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1"><label className={lbl}>City</label><input name="city" defaultValue={patient.address?.city} className={ic} {...FORM_FIELD_PROPS} /></div>
            <div className="space-y-1"><label className={lbl}>State</label><input name="state" defaultValue={patient.address?.state} className={ic} {...FORM_FIELD_PROPS} /></div>
            <div className="space-y-1"><label className={lbl}>Pincode</label><input name="pincode" defaultValue={patient.address?.pincode} className={ic} {...FORM_FIELD_PROPS} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1"><label className={lbl}>Marital Status</label>
              <select name="maritalStatus" defaultValue={patient.maritalStatus} className={ic} {...FORM_FIELD_PROPS}>
                <option value="">Select</option><option value="Single">Single</option><option value="Married">Married</option><option value="Divorced">Divorced</option><option value="Widowed">Widowed</option>
              </select>
            </div>
            <div className="space-y-1"><label className={lbl}>Allergies</label><input name="allergies" defaultValue={patient.allergies} className={ic} {...FORM_FIELD_PROPS} /></div>
          </div>
          <div className="space-y-1"><label className={lbl}>Chronic Diseases</label><input name="chronicDiseases" defaultValue={patient.chronicDiseases} className={ic} {...FORM_FIELD_PROPS} /></div>
          <div className="space-y-1"><label className={lbl}>Notes</label><textarea name="notes" defaultValue={patient.notes} className="w-full p-3 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" rows={2} {...FORM_FIELD_PROPS} /></div>
          <div className="pt-3 border-t border-slate-100">
            <label className="text-sm font-medium text-slate-700 block mb-3">Overall Medicines</label>
            <PatientMedicines medicines={editMedicines} onMedicinesChange={setEditMedicines} />
          </div>
          <div className="pt-4 flex justify-end gap-2 sticky bottom-0 bg-white pb-1">
            <Button type="button" variant="outline" onClick={() => { setIsEditModalOpen(false); resetEditFormState() }} disabled={isSaving}>Cancel</Button>
            <Button type="submit" disabled={isSaving}>{isSaving ? "Saving..." : "Save Changes"}</Button>
          </div>
        </form>
      </Modal>

      {/* ───────────────── WhatsApp Modal ───────────────────── */}
      <Modal isOpen={isWhatsAppModalOpen} onClose={() => setIsWhatsAppModalOpen(false)} title="Send WhatsApp Message">
        <div className="space-y-4">
          <p className="text-sm text-slate-600">Select the number to send WhatsApp details from:</p>
          <div className="space-y-2">
            <label className="flex items-center gap-3 p-3 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50">
              <input type="radio" value="9420893995" checked={selectedWhatsAppNumber === "9420893995"} onChange={e => setSelectedWhatsAppNumber(e.target.value)} className="text-green-600 w-4 h-4" />
              <span className="text-sm font-medium text-slate-900">Primary (+91 9420893995)</span>
            </label>
            <label className="flex items-center gap-3 p-3 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50">
              <input type="radio" value="9421311486" checked={selectedWhatsAppNumber === "9421311486"} onChange={e => setSelectedWhatsAppNumber(e.target.value)} className="text-green-600 w-4 h-4" />
              <span className="text-sm font-medium text-slate-900">Secondary (+91 9421311486)</span>
            </label>
          </div>
          <div className="pt-4 flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setIsWhatsAppModalOpen(false)}>Cancel</Button>
            <Button className="bg-green-600 hover:bg-green-700 text-white" onClick={() => {
              window.open(`https://wa.me/91${patient.mobileNumber}?text=Hello ${firstName}, this message is sent from our clinic via +91 ${selectedWhatsAppNumber}.`, "_blank")
              setIsWhatsAppModalOpen(false)
            }}>
              <MessageSquare className="w-4 h-4 mr-2" /> Send Message
            </Button>
          </div>
        </div>
      </Modal>

      {/* ───────────────── Edit Visit Modal ─────────────────── */}
      {selectedVisit && user && (
        <EditVisitModal
          isOpen={isEditVisitModalOpen}
          visit={selectedVisit}
          userId={user.id}
          onClose={() => { setIsEditVisitModalOpen(false); setSelectedVisit(null) }}
          onSaved={async () => {
            const refreshedVisits = await getVisitsByPatient(patientId)
            setVisits(refreshedVisits)
            setSelectedVisit(null)
            setIsEditVisitModalOpen(false)
            showToast("Visit updated successfully!", "success")
          }}
        />
      )}

      {/* ═══════════════ RECORD VISIT MODAL ══════════════════ */}
      <Modal
        isOpen={isRecordVisitOpen}
        onClose={() => { setIsRecordVisitOpen(false); resetVisitForm() }}
        title={`Record Visit — ${patient.fullName}`}
      >
        <form
          ref={visitFormRef}
          className="space-y-3 max-h-[78vh] overflow-y-auto pr-2"
          onSubmit={handleRecordVisit}
          {...FORM_PROPS}
        >
          {/* Patient info banner */}
          <div className="flex items-center gap-3 rounded-xl bg-gradient-to-r from-sky-50 to-blue-50 border border-sky-100 px-4 py-3">
            <div className="w-9 h-9 rounded-full bg-sky-600 flex items-center justify-center text-white font-bold text-sm shrink-0">
              {patient.fullName.substring(0, 2).toUpperCase()}
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900">{patient.fullName}</p>
              <p className="text-xs text-slate-500">Case #{patient.caseNumber} · {patient.age} yrs · {patient.gender}</p>
            </div>
          </div>

          {/* Vitals */}
          <h4 className={secHead}>Vitals</h4>
          <div className="grid grid-cols-4 gap-2">
            <div className="space-y-1"><label className={lbl}>BP</label><input name="visitBP" className={ic} placeholder="120/80" {...FORM_FIELD_PROPS} /></div>
            <div className="space-y-1"><label className={lbl}>Pulse</label><input name="visitPulse" type="number" className={ic} placeholder="72" {...FORM_FIELD_PROPS} /></div>
            <div className="space-y-1"><label className={lbl}>Temp (°F)</label><input name="visitTemp" type="number" step="0.1" className={ic} placeholder="98.6" {...FORM_FIELD_PROPS} /></div>
            <div className="space-y-1"><label className={lbl}>SpO2 (%)</label><input name="visitSpo2" type="number" className={ic} placeholder="98" {...FORM_FIELD_PROPS} /></div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-1"><label className={lbl}>Weight (kg)</label><input name="visitWeight" type="number" className={ic} placeholder="70" {...FORM_FIELD_PROPS} /></div>
            <div className="space-y-1"><label className={lbl}>Height (cm)</label><input name="visitHeight" type="number" className={ic} placeholder="170" {...FORM_FIELD_PROPS} /></div>
            <div className="space-y-1"><label className={lbl}>Resp Rate</label><input name="visitRR" type="number" className={ic} placeholder="16" {...FORM_FIELD_PROPS} /></div>
          </div>

          {/* History & Complaints */}
          <h4 className={secHead}>History &amp; Complaints</h4>
          <div className="space-y-1">
            <label className={lbl}>Chief Complaints <span className="text-red-500">*</span></label>
            <textarea required name="visitComplaints" className="w-full p-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 bg-white/90" rows={2} placeholder="Fever since 3 days, headache, body ache..." {...FORM_FIELD_PROPS} />
          </div>
          <div className="space-y-1">
            <label className={lbl}>History of Present Illness</label>
            <textarea name="visitHPI" className="w-full p-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 bg-white/90" rows={2} placeholder="Detailed history of current illness..." {...FORM_FIELD_PROPS} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1"><label className={lbl}>Past History</label><input name="visitPastHistory" className={ic} placeholder="Previous surgeries, illnesses..." {...FORM_FIELD_PROPS} /></div>
            <div className="space-y-1"><label className={lbl}>Family History</label><input name="visitFamilyHistory" className={ic} placeholder="Diabetes in family..." {...FORM_FIELD_PROPS} /></div>
          </div>

          {/* Examination & Diagnosis */}
          <h4 className={secHead}>Examination &amp; Diagnosis</h4>
          <div className="space-y-1">
            <label className={lbl}>Examination Findings</label>
            <textarea name="visitExamination" className="w-full p-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 bg-white/90" rows={2} placeholder="On examination: Throat congested..." {...FORM_FIELD_PROPS} />
          </div>
          <div className="space-y-1">
            <label className={lbl}>Diagnosis <span className="text-red-500">*</span></label>
            <input required name="visitDiagnosis" className={ic} placeholder="Acute Viral Fever" {...FORM_FIELD_PROPS} />
          </div>

          {/* Prescription */}
          <div className="flex items-center justify-between border-t border-slate-100 mt-2 mb-1 pt-3">
            <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Prescription (Rx)</h4>
            <div className="flex gap-1 flex-wrap">
              {Object.keys(RX_TEMPLATES).map(k => (
                <button type="button" key={k} onClick={() => applyRxTemplate(RX_TEMPLATES[k])} className="text-[10px] font-medium bg-sky-100 hover:bg-sky-200 text-sky-700 px-2 py-0.5 rounded uppercase">{k}</button>
              ))}
            </div>
          </div>
          <div className="space-y-2 border border-slate-200 rounded-xl overflow-hidden bg-slate-50 p-2">
            {visitMedicines.length === 0 && (
              <p className="text-xs text-center text-slate-400 py-2">No medicines added. Select a template or add manually.</p>
            )}
            {visitMedicines.map((med, idx) => (
              <div key={idx} className="flex gap-2 items-start bg-white p-2 rounded-lg shadow-sm border border-slate-100">
                <div className="flex-1 space-y-2">
                  <div className="grid grid-cols-12 gap-2">
                    <input className="col-span-12 sm:col-span-5 h-8 px-2 border border-slate-200 rounded-lg text-sm focus:ring-1 focus:ring-sky-500" placeholder="Medicine Name" value={med.name} onChange={e => updateVisitMedicine(idx, "name", e.target.value)} />
                    <input className="col-span-4 sm:col-span-2 h-8 px-2 border border-slate-200 rounded-lg text-sm focus:ring-1 focus:ring-sky-500" placeholder="Dose" value={med.dosage} onChange={e => updateVisitMedicine(idx, "dosage", e.target.value)} />
                    <input className="col-span-4 sm:col-span-2 h-8 px-2 border border-slate-200 rounded-lg text-sm focus:ring-1 focus:ring-sky-500" placeholder="Freq" value={med.frequency} onChange={e => updateVisitMedicine(idx, "frequency", e.target.value)} />
                    <div className="col-span-4 sm:col-span-3 flex items-center gap-1">
                      <input type="number" className="w-full h-8 px-2 border border-slate-200 rounded-lg text-sm focus:ring-1 focus:ring-sky-500" placeholder="Days" value={med.days || ""} onChange={e => updateVisitMedicine(idx, "days", parseInt(e.target.value) || 0)} />
                      <span className="text-xs text-slate-500">d</span>
                    </div>
                  </div>
                  <input className="w-full h-8 px-2 border border-slate-200 rounded-lg text-xs focus:ring-1 focus:ring-sky-500" placeholder="Notes (e.g., After food)" value={med.notes || ""} onChange={e => updateVisitMedicine(idx, "notes", e.target.value)} />
                </div>
                <button type="button" onClick={() => removeVisitMedicine(idx)} className="text-slate-300 hover:text-red-500 p-1 mt-1"><XCircle className="w-5 h-5" /></button>
              </div>
            ))}
            <Button type="button" variant="ghost" size="sm" onClick={addVisitMedicine} className="w-full text-sky-600 text-xs mt-1 border border-dashed border-sky-200 bg-sky-50/50 hover:bg-sky-50 focus:ring-0">
              <Plus className="w-3 h-3 mr-1" /> Add Medicine
            </Button>
          </div>

          {/* Investigations */}
          <h4 className={secHead}>Investigations &amp; Lab</h4>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1"><label className={lbl}>Lab Tests Done</label><input name="visitLabTests" className={ic} placeholder="CBC, Urine, X-ray..." {...FORM_FIELD_PROPS} /></div>
            <div className="space-y-1"><label className={lbl}>Investigations Advised</label><input name="visitInvestigations" className={ic} placeholder="MRI, Blood Sugar..." {...FORM_FIELD_PROPS} /></div>
          </div>

          {/* Advice & Follow-up */}
          <h4 className={secHead}>Advice &amp; Follow-up</h4>
          <div className="space-y-1">
            <label className={lbl}>Advice / Instructions</label>
            <textarea name="visitAdvice" className="w-full p-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 bg-white/90" rows={2} placeholder="Take rest, drink fluids..." {...FORM_FIELD_PROPS} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className={lbl}>Follow-up Date</label>
                <div className="flex gap-1">
                  {[3, 5, 7].map(d => (
                    <button type="button" key={d} onClick={() => setQuickFollowUp(d, visitFormRef)} className="text-[10px] bg-slate-100 hover:bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded">+{d}d</button>
                  ))}
                </div>
              </div>
              <input name="visitFollowUpDate" type="date" className={ic} {...FORM_FIELD_PROPS} />
            </div>
            <div className="space-y-1"><label className={lbl}>Referral (if any)</label><input name="visitReferral" className={ic} placeholder="Dr. XYZ, Cardiologist" {...FORM_FIELD_PROPS} /></div>
          </div>

          {/* Billing */}
          <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl mt-2 space-y-3">
            <label className="text-sm font-semibold text-rose-800 block">Billing Details</label>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-rose-800">Total Bill (Rs.)</label>
                <input name="visitTotalBill" type="number" className="w-full h-10 px-3 rounded-xl border border-rose-200 text-sm focus:outline-none focus:ring-2 focus:ring-rose-400 bg-white" placeholder="500" {...FORM_FIELD_PROPS} />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-rose-800">Payment Status</label>
                <select name="visitPaymentStatus" defaultValue="unpaid" className="w-full h-10 px-3 rounded-xl border border-rose-200 text-sm focus:outline-none focus:ring-2 focus:ring-rose-400 bg-white" {...FORM_FIELD_PROPS}>
                  <option value="unpaid">Unpaid (Add to Khata)</option>
                  <option value="paid">Paid (Instantly)</option>
                </select>
              </div>
            </div>
          </div>

          {visitMedicines.length > 0 && (
            <div className="flex items-center gap-2 rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-2.5 text-sm text-emerald-700">
              <Printer className="w-4 h-4 shrink-0" />
              <span>Prescription will print automatically after saving.</span>
            </div>
          )}

          <div className="pt-4 flex justify-end gap-2 sticky bottom-0 bg-white pb-1 border-t border-slate-100 mt-2">
            <Button type="button" variant="outline" onClick={() => { setIsRecordVisitOpen(false); resetVisitForm() }} disabled={isRecordingSaving}>Cancel</Button>
            <Button type="submit" disabled={isRecordingSaving} className="bg-gradient-to-r from-sky-600 to-cyan-500 text-white shadow-sky-200">
              {isRecordingSaving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving...</> : "Save Visit"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* ═══════════════ RECORD PAYMENT MODAL ════════════════ */}
      <Modal isOpen={isRecordPaymentOpen} onClose={() => setIsRecordPaymentOpen(false)} title={`Record Payment — ${patient.fullName}`}>
        <form className="space-y-4" onSubmit={handleRecordPayment} {...FORM_PROPS}>
          <div className="flex items-center gap-3 rounded-xl bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-100 px-4 py-3">
            <div className="w-9 h-9 rounded-full bg-emerald-600 flex items-center justify-center text-white font-bold text-sm shrink-0">
              {patient.fullName.substring(0, 2).toUpperCase()}
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900">{patient.fullName}</p>
              <p className={`text-xs font-medium mt-0.5 ${khataBalance < 0 ? "text-rose-600" : "text-emerald-600"}`}>
                Khata: {khataLabel}
              </p>
            </div>
          </div>
          <div className="space-y-1">
            <label className={lbl}>Amount (Rs.) <span className="text-red-500">*</span></label>
            <input required name="payAmount" type="number" step="0.01" placeholder="e.g. 500" className={ic} {...FORM_FIELD_PROPS} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className={lbl}>Payment Method</label>
              <select name="payMethod" className={ic} {...FORM_FIELD_PROPS}>
                <option value="cash">Cash</option>
                <option value="upi">UPI</option>
                <option value="card">Card</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className={lbl}>Date</label>
              <input name="payDate" type="date" defaultValue={new Date().toISOString().split("T")[0]} className={ic} {...FORM_FIELD_PROPS} />
            </div>
          </div>
          <div className="space-y-1">
            <label className={lbl}>Description (optional)</label>
            <input name="payDesc" type="text" placeholder="e.g. Consultation fee" className={ic} {...FORM_FIELD_PROPS} />
          </div>
          <div className="pt-4 flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setIsRecordPaymentOpen(false)} disabled={isPaymentSaving}>Cancel</Button>
            <Button type="submit" disabled={isPaymentSaving} className="bg-emerald-600 hover:bg-emerald-700 text-white">
              {isPaymentSaving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving...</> : <><IndianRupee className="w-4 h-4 mr-1" />Record Payment</>}
            </Button>
          </div>
        </form>
      </Modal>

      {/* ═══════════════ PATIENT PROFILE CARD ════════════════ */}
      <div className="relative overflow-hidden rounded-[28px] border border-sky-100 bg-gradient-to-br from-sky-50 via-white to-emerald-50 p-6 shadow-[0_24px_80px_-36px_rgba(14,116,144,0.35)] sm:p-8">
        <div className="absolute inset-x-0 top-0 h-40 bg-[radial-gradient(circle_at_top_right,_rgba(14,165,233,0.2),_transparent_45%),radial-gradient(circle_at_left,_rgba(16,185,129,0.16),_transparent_30%)]" />
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-start gap-5">
            {patient.photo ? (
              <div className="relative h-20 w-20 overflow-hidden rounded-[24px] border-4 border-white shadow-lg shadow-sky-100">
                <Image src={patient.photo} alt={patient.fullName} fill unoptimized sizes="80px" className="object-cover" />
              </div>
            ) : (
              <div className="rounded-[24px] bg-white p-1 shadow-lg shadow-sky-100">
                <Avatar fallback={patient.fullName?.substring(0, 2).toUpperCase()} size="xl" />
              </div>
            )}
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="border-sky-200 bg-white/80 text-sky-700">Case: {patient.caseNumber}</Badge>
                <Badge variant="outline" className={`font-bold ${patientTreatmentType === "Homeopathic" ? "border-green-200 text-green-700 bg-green-50" : "border-blue-200 text-blue-700 bg-blue-50"}`}>
                  {patientTreatmentType}
                </Badge>
                <Badge variant="secondary" className="bg-white/80 text-slate-700">{patient.gender}</Badge>
                <Badge variant="secondary" className="bg-white/80 text-slate-700">{patient.age} yrs</Badge>
                {patient.bloodGroup && <Badge variant="secondary" className="bg-rose-50 text-rose-700">{patient.bloodGroup}</Badge>}
              </div>
              <div>
                <h1 className="text-3xl font-semibold tracking-tight text-slate-950">{patient.fullName}</h1>
                <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600">Patient profile, visit history, and ledger — all in one place.</p>
              </div>
              <div className="flex flex-wrap gap-3 text-sm text-slate-600">
                <span className="inline-flex items-center gap-2 rounded-full bg-white/80 px-3 py-1.5 shadow-sm"><Phone className="h-4 w-4 text-sky-600" /> {patient.mobileNumber}</span>
                {patient.alternateMobile && <span className="inline-flex items-center gap-2 rounded-full bg-white/80 px-3 py-1.5 shadow-sm"><Phone className="h-4 w-4 text-violet-600" /> {patient.alternateMobile}</span>}
                {patient.email && <span className="inline-flex items-center gap-2 rounded-full bg-white/80 px-3 py-1.5 shadow-sm"><Mail className="h-4 w-4 text-emerald-600" /> {patient.email}</span>}
              </div>
              <div className="flex flex-wrap gap-2">
                {patient.maritalStatus && <Badge variant="secondary" className="bg-white/80 text-slate-700">{patient.maritalStatus}</Badge>}
                {patient.occupation && <Badge variant="secondary" className="bg-white/80 text-slate-700">{patient.occupation}</Badge>}
                {patient.lmp && <Badge variant="secondary" className="bg-pink-50 text-pink-700">LMP: {patient.lmp}</Badge>}
                {patient.menstrualCycleDays && <Badge variant="secondary" className="bg-pink-50 text-pink-700">Cycle: {patient.menstrualCycleDays}d</Badge>}
                <Badge variant="secondary" className={khataBalance < 0 ? "bg-rose-50 text-rose-700" : khataBalance > 0 ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-700"}>
                  Khata: {khataLabel}
                </Badge>
              </div>
            </div>
          </div>
          <div className="flex w-full flex-wrap gap-3 lg:w-auto lg:justify-end">
            <Button size="sm" className="flex-1 bg-slate-900 text-white shadow-lg shadow-slate-200 hover:bg-slate-800 lg:flex-none" onClick={() => { resetEditFormState(); setIsEditModalOpen(true) }}>
              <Edit className="w-4 h-4 mr-2" /> Edit Profile
            </Button>
            <Button variant="outline" size="sm" className="flex-1 border-rose-200 bg-white/80 text-rose-600 hover:bg-rose-50 hover:text-rose-700 lg:flex-none" onClick={async () => {
              const linked = await getPatientLinkedRecordCounts(patient.id!)
              const linkedSummary = [
                linked.appointments ? `${linked.appointments} appointment${linked.appointments > 1 ? "s" : ""}` : "",
                linked.visits ? `${linked.visits} visit${linked.visits > 1 ? "s" : ""}` : "",
                linked.payments ? `${linked.payments} payment${linked.payments > 1 ? "s" : ""}` : "",
              ].filter(Boolean).join(", ")
              const confirmMessage = linkedSummary
                ? `Are you sure you want to delete this patient? This will also delete ${linkedSummary}.`
                : "Are you sure you want to delete this patient?"
              if (window.confirm(confirmMessage)) {
                await deletePatient(patient.id!)
                router.push("/patients")
              }
            }}>
              <UserX className="w-4 h-4 mr-2" /> Delete
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="relative mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {patientStats.map(stat => (
            <div key={stat.label} className={cn("rounded-[24px] border p-4 shadow-sm backdrop-blur", stat.shell)}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">{stat.label}</p>
                  <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">{stat.value}</p>
                </div>
                <div className={cn("rounded-2xl p-3 shadow-lg", stat.iconShell)}>
                  <stat.icon className="h-5 w-5" />
                </div>
              </div>
              <p className="mt-3 text-sm text-slate-600">{stat.hint}</p>
            </div>
          ))}
        </div>

        {/* Extended Details */}
        <div className="relative mt-6 grid grid-cols-1 gap-4 border-t border-white/60 pt-6 text-sm md:grid-cols-2 xl:grid-cols-4">
          {patient.address?.line1 && (
            <div className="rounded-[24px] border border-sky-100 bg-white/85 p-4 shadow-sm"><span className="text-xs font-semibold uppercase tracking-[0.24em] text-sky-600">Address</span><p className="mt-2 text-sm leading-6 text-slate-700">{patient.address.line1}{patient.address.city ? `, ${patient.address.city}` : ""}{patient.address.state ? `, ${patient.address.state}` : ""}{patient.address.pincode ? ` - ${patient.address.pincode}` : ""}</p></div>
          )}
          {patient.emergencyContact && (
            <div className="rounded-[24px] border border-violet-100 bg-white/85 p-4 shadow-sm"><span className="text-xs font-semibold uppercase tracking-[0.24em] text-violet-600">Emergency Contact</span><p className="mt-2 text-sm font-medium text-slate-800">{patient.emergencyContact}</p></div>
          )}
          {patient.allergies && (
            <div className="rounded-[24px] border border-rose-100 bg-rose-50/80 p-4 shadow-sm"><span className="text-xs font-semibold uppercase tracking-[0.24em] text-rose-500">Allergies</span><p className="mt-2 text-sm font-medium text-rose-700">{patient.allergies}</p></div>
          )}
          {patient.chronicDiseases && (
            <div className="rounded-[24px] border border-amber-100 bg-amber-50/80 p-4 shadow-sm"><span className="text-xs font-semibold uppercase tracking-[0.24em] text-amber-600">Chronic Diseases</span><p className="mt-2 text-sm font-medium text-amber-800">{patient.chronicDiseases}</p></div>
          )}
          {patient.dateOfBirth && (
            <div className="rounded-[24px] border border-slate-200 bg-white/85 p-4 shadow-sm"><span className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Date of Birth</span><p className="mt-2 text-sm font-medium text-slate-800">{patient.dateOfBirth}</p></div>
          )}
          {patient.notes && (
            <div className="rounded-[24px] border border-emerald-100 bg-white/85 p-4 shadow-sm md:col-span-2 xl:col-span-2"><span className="text-xs font-semibold uppercase tracking-[0.24em] text-emerald-600">Notes</span><p className="mt-2 text-sm leading-6 text-slate-700">{patient.notes}</p></div>
          )}
        </div>

        {/* Patient Care Summary */}
        {hasPatientCareSummary && (
          <div className="mt-6 rounded-[28px] border border-slate-200/80 bg-white/80 p-5 shadow-inner shadow-slate-100 backdrop-blur">
            <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.24em] text-slate-700">
                  <Activity className="h-4 w-4 text-sky-600" /> Patient Care Summary
                </h3>
                <p className="mt-1 text-sm text-slate-500">Saved clinical details and current medicines for quick review.</p>
              </div>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">Auto-refreshed after save</span>
            </div>
            <div className="space-y-6">
              {hasClinicalDetails && (
                <div>
                  <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.24em] text-slate-700">
                    <Activity className="h-4 w-4 text-sky-600" /> Clinical Details
                  </h4>
                  <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                    {clinicalSummaryItems.map(item => (
                      <div key={item.label} className="rounded-2xl border border-sky-100 bg-gradient-to-br from-white to-sky-50 px-4 py-3 shadow-sm">
                        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">{item.label}</p>
                        <p className="mt-1 text-sm font-medium text-slate-900">{item.value}</p>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 rounded-2xl border border-violet-100 bg-gradient-to-br from-violet-50 to-white px-4 py-3 shadow-sm">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-violet-600">Present Complaints</p>
                    <p className="mt-1 text-sm text-slate-900">{patient.presentComplaints || "-"}</p>
                  </div>
                  <div className="mt-4 rounded-2xl border border-violet-100 bg-gradient-to-br from-violet-50 to-white px-4 py-3 shadow-sm">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-violet-600">Previous Complaint</p>
                    <p className="mt-1 text-sm text-slate-900">{previousComplaint || "-"}</p>
                  </div>
                </div>
              )}
              {hasSavedMedicines && (
                <div className={cn(hasClinicalDetails && "border-t border-slate-200 pt-6")}>
                  <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.24em] text-slate-700">
                    <Pill className="h-4 w-4 text-emerald-600" /> Current Medicines
                  </h4>
                  <div className="rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-50/70 to-white p-4 shadow-sm">
                    <PatientMedicines medicines={normalizedSavedMedicines} readOnly onMedicinesChange={() => {}} />
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Quick Actions Row */}
        <div className="mt-6 grid grid-cols-1 gap-3 border-t border-white/60 pt-6 sm:grid-cols-3">
          <Button variant="outline" className="w-full justify-start rounded-2xl border-sky-200 bg-white/80 text-slate-700 hover:bg-sky-50" onClick={() => router.push("/appointments")}>
            <Calendar className="w-4 h-4 mr-2 text-sky-600" /> Book Appointment
          </Button>
          <Button variant="outline" className="w-full justify-start rounded-2xl border-violet-200 bg-white/80 text-slate-700 hover:bg-violet-50" onClick={() => setIsWhatsAppModalOpen(true)}>
            <MessageSquare className="w-4 h-4 mr-2 text-violet-600" /> WhatsApp
          </Button>
          <Button variant="outline" className="w-full justify-start rounded-2xl border-emerald-200 bg-white/80 text-slate-700 hover:bg-emerald-50" onClick={() => setIsRecordPaymentOpen(true)}>
            <IndianRupee className="w-4 h-4 mr-2 text-emerald-600" /> Record Payment
          </Button>
        </div>

        {/* Update Patient Care (Clinical Details + Medicines) */}
        <div className="mt-6 rounded-[28px] border border-slate-200 bg-gradient-to-br from-white via-white to-sky-50/70 p-6 shadow-[0_24px_80px_-42px_rgba(15,23,42,0.35)]">
          <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                <Activity className="w-5 h-5 text-sky-600" /> Update Patient Care
              </h2>
              <p className="mt-1 text-sm text-slate-500">Enter clinical details and current medicines, then save each part when ready.</p>
            </div>
            <div className="rounded-full bg-sky-50 px-3 py-1 text-xs font-medium text-sky-700">Quick clinical workspace</div>
          </div>
          <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
            <form onSubmit={handleSaveClinicalDetails} {...FORM_PROPS} className="rounded-[24px] border border-sky-100 bg-gradient-to-br from-sky-50 via-white to-cyan-50 p-5 shadow-sm space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-[0.24em] flex items-center gap-2">
                  <Activity className="w-4 h-4 text-sky-600" /> Clinical Details
                </h3>
                <p className="mt-1 text-sm text-slate-500">Track complaints, vitals, and repetition.</p>
              </div>
              <div className="space-y-1">
                <label className={lbl}>Present Complaints</label>
                <input type="text" placeholder="e.g. Fever, Headache since 2 days" value={clinicalDetailsFormData.presentComplaints} onChange={e => setClinicalDetailsFormData({ ...clinicalDetailsFormData, presentComplaints: e.target.value })} className={ic} {...FORM_FIELD_PROPS} />
              </div>
              {patient.gender?.toLowerCase() === "female" && (
                <div className="space-y-1">
                  <label className={lbl}>LMP</label>
                  <input type="date" value={clinicalDetailsFormData.lmp} onChange={e => setClinicalDetailsFormData({ ...clinicalDetailsFormData, lmp: e.target.value })} className={ic} {...FORM_FIELD_PROPS} />
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                {[
                  { key: "weight", label: "Weight (kg)", ph: "e.g. 70", type: "number", step: "0.1" },
                  { key: "heightCm", label: "Height (cm)", ph: "e.g. 170", type: "number", step: "0.1" },
                  { key: "bp", label: "Blood Pressure", ph: "120/80", type: "text" },
                  { key: "temperature", label: "Temperature (°F)", ph: "98.6", type: "number", step: "0.1" },
                  { key: "spo2", label: "SpO2 (%)", ph: "e.g. 98", type: "number" },
                  { key: "repetition", label: "Repetition", ph: "e.g. BD, TDS", type: "text" },
                ].map(f => (
                  <div key={f.key} className="space-y-1">
                    <label className={lbl}>{f.label}</label>
                    <input type={f.type} placeholder={f.ph} step={(f as any).step} value={(clinicalDetailsFormData as any)[f.key]} onChange={e => setClinicalDetailsFormData({ ...clinicalDetailsFormData, [f.key]: e.target.value })} className={ic} {...FORM_FIELD_PROPS} />
                  </div>
                ))}
              </div>
              <div className="pt-2 flex justify-end">
                <Button type="submit" disabled={isSavingClinical} className="rounded-2xl bg-sky-600 text-white hover:bg-sky-700">
                  {isSavingClinical ? "Saving..." : "Save Clinical Details"}
                </Button>
              </div>
            </form>

            <div className="rounded-[24px] border border-emerald-100 bg-gradient-to-br from-emerald-50 via-white to-lime-50 p-5 shadow-sm">
              <div className="mb-4">
                <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-[0.24em] flex items-center gap-2">
                  <Pill className="w-4 h-4 text-emerald-600" /> Current Medicines
                </h3>
                <p className="mt-1 text-sm text-slate-500">Update medicines and save once.</p>
              </div>
              <PatientMedicines medicines={medicineDraft} onMedicinesChange={setMedicineDraft} />
              <div className="pt-4 flex justify-end gap-2">
                <Button type="button" variant="outline" className="rounded-2xl border-slate-200 bg-white/80" disabled={isSavingMedicines || !hasMedicineChanges} onClick={() => setMedicineDraft(buildMedicineDraft())}>Reset</Button>
                <Button type="button" className="rounded-2xl bg-emerald-600 text-white hover:bg-emerald-700" disabled={isSavingMedicines || !hasMedicineChanges} onClick={handleSaveMedicines}>
                  {isSavingMedicines ? "Saving..." : "Save Medicines"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ═══════════════ TAB BAR + RECORD VISIT BUTTON ═══════ */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="overflow-x-auto rounded-[24px] border border-slate-200 bg-white/90 p-2 shadow-sm backdrop-blur flex-1">
          <div className="flex min-w-max gap-2">
            {tabItems.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "rounded-2xl px-5 py-3 text-sm font-medium transition-all whitespace-nowrap",
                  activeTab === tab.id
                    ? "bg-gradient-to-r from-sky-600 to-cyan-500 text-white shadow-lg shadow-sky-100"
                    : "bg-transparent text-slate-500 hover:bg-slate-50 hover:text-slate-800"
                )}
              >
                {tab.label} ({tab.count})
              </button>
            ))}
          </div>
        </div>
        {/* ★ RECORD VISIT BUTTON — always visible ★ */}
        <Button
          onClick={() => { resetVisitForm(); setIsRecordVisitOpen(true) }}
          className="shrink-0 rounded-2xl bg-gradient-to-r from-sky-600 to-cyan-500 text-white shadow-lg shadow-sky-200 hover:from-sky-700 hover:to-cyan-600 px-6 py-3 h-auto font-semibold"
        >
          <ClipboardList className="w-4 h-4 mr-2" /> Record Visit
        </Button>
      </div>

      {/* ═══════════════ HISTORY TAB ═════════════════════════ */}
      {activeTab === "history" && (
        <div className="space-y-4">
          {visits.length === 0 && (
            <div className="rounded-[24px] border border-dashed border-sky-200 bg-gradient-to-br from-white to-sky-50 py-16 text-center">
              <ClipboardList className="w-10 h-10 mx-auto mb-3 text-sky-300" />
              <p className="text-sm font-medium text-slate-600 mb-1">No visit records yet</p>
              <p className="text-xs text-slate-400 mb-5">Record your first visit using the button above.</p>
              <Button onClick={() => { resetVisitForm(); setIsRecordVisitOpen(true) }} className="rounded-2xl bg-gradient-to-r from-sky-600 to-cyan-500 text-white">
                <Plus className="w-4 h-4 mr-2" /> Record First Visit
              </Button>
            </div>
          )}
          {visits.map(visit => (
            <VisitCard
              key={visit.id}
              visit={visit}
              onEdit={v => { setSelectedVisit(v); setIsEditVisitModalOpen(true) }}
              onPrint={v => handlePrintVisit(v, patient)}
            />
          ))}
        </div>
      )}

      {/* ═══════════════ APPOINTMENTS TAB ════════════════════ */}
      {activeTab === "appointments" && (
        <div className="space-y-3">
          {appointments.length === 0 && <div className="rounded-[24px] border border-dashed border-amber-200 bg-gradient-to-br from-white to-amber-50 py-12 text-center text-sm text-slate-500">No appointments</div>}
          {appointments.map(apt => (
            <div key={apt.id} className="flex items-center justify-between rounded-[24px] border border-amber-100 bg-gradient-to-r from-white to-amber-50/60 p-4 shadow-sm">
              <div>
                <p className="text-sm font-medium text-slate-900">{apt.appointmentDate} at {apt.timeSlot}</p>
                <p className="text-xs text-slate-500 mt-1">{apt.type}</p>
              </div>
              <Badge variant={apt.status === "completed" ? "completed" : apt.status === "cancelled" ? "destructive" : "pending"}>{apt.status}</Badge>
            </div>
          ))}
        </div>
      )}

      {/* ═══════════════ PAYMENTS TAB ════════════════════════ */}
      {activeTab === "payments" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-500">{payments.length} payment record{payments.length !== 1 ? "s" : ""}</p>
            <Button size="sm" onClick={() => setIsRecordPaymentOpen(true)} className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white">
              <Plus className="w-3.5 h-3.5 mr-1" /> Record Payment
            </Button>
          </div>
          {payments.length === 0 && <div className="rounded-[24px] border border-dashed border-emerald-200 bg-gradient-to-br from-white to-emerald-50 py-12 text-center text-sm text-slate-500">No payment records</div>}
          {payments.map(pay => (
            <div key={pay.id} className="flex items-center justify-between rounded-[24px] border border-emerald-100 bg-gradient-to-r from-white to-emerald-50/60 p-4 shadow-sm">
              <div>
                <p className="text-sm font-medium text-slate-900">{formatCurrency(pay.amount)}</p>
                <p className="text-xs text-slate-500 mt-1">{pay.date} • {pay.paymentMethod?.toUpperCase()}{pay.description ? ` - ${pay.description}` : ""}</p>
              </div>
              <Badge variant={pay.status === "paid" ? "completed" : "pending"}>{pay.status}</Badge>
            </div>
          ))}
        </div>
      )}

      {/* ═══════════════ KHATA RECORD TAB ════════════════════ */}
      {activeTab === "khata" && (
        <div className="space-y-4">
          <div className="rounded-[28px] border border-slate-200 bg-gradient-to-br from-white via-white to-emerald-50/70 p-4 shadow-[0_24px_80px_-42px_rgba(15,23,42,0.35)]">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-sky-600" /> Khata Record (Passbook)
              </h3>
              <div className="flex items-center gap-3">
                <div className={`px-3 py-1 rounded-xl text-sm font-bold ${(patient.khataBalance || 0) < 0 ? "bg-red-50 text-red-700" : (patient.khataBalance || 0) > 0 ? "bg-green-50 text-green-700" : "bg-slate-50 text-slate-700"}`}>
                  Balance: {(patient.khataBalance || 0) < 0 ? `Due ${formatCurrency(Math.abs(patient.khataBalance || 0))}` : formatCurrency(patient.khataBalance || 0)}
                </div>
                <Button size="sm" onClick={() => setIsRecordPaymentOpen(true)} className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white">
                  <Plus className="w-3.5 h-3.5 mr-1" /> Record Payment
                </Button>
              </div>
            </div>
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white/90">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase">
                  <tr>
                    <th className="px-4 py-2">Date</th>
                    <th className="px-4 py-2">Description</th>
                    <th className="px-4 py-2 text-right text-red-600">Debit (Rs.)</th>
                    <th className="px-4 py-2 text-right text-green-600">Credit (Rs.)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(() => {
                    const entries: { date: string; sortKey: number; desc: string; debit: number; credit: number }[] = []
                    visits.forEach(v => {
                      if (v.totalBill && v.totalBill > 0) {
                        const visitDate = v.createdAt?.toDate?.()
                        entries.push({
                          date: visitDate?.toLocaleDateString("en-IN") || "-",
                          sortKey: visitDate?.getTime() || 0,
                          desc: `Visit: ${v.diagnosis || "Consultation"}`,
                          debit: v.totalBill, credit: 0,
                        })
                      }
                    })
                    payments.forEach(p => {
                      const paymentDate = p.date ? new Date(`${p.date}T00:00:00`) : p.createdAt?.toDate?.()
                      entries.push({
                        date: p.date || paymentDate?.toLocaleDateString("en-IN") || "-",
                        sortKey: paymentDate?.getTime() || 0,
                        desc: `Payment: ${p.paymentMethod?.toUpperCase() || ""}${p.description ? ` - ${p.description}` : ""}`,
                        debit: 0, credit: p.amount,
                      })
                    })
                    entries.sort((a, b) => b.sortKey - a.sortKey)
                    if (entries.length === 0) {
                      return <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-500">No transactions recorded</td></tr>
                    }
                    return entries.map((entry, i) => (
                      <tr key={i} className="hover:bg-slate-50">
                        <td className="px-4 py-2 text-slate-600">{entry.date}</td>
                        <td className="px-4 py-2 text-slate-900 font-medium">{entry.desc}</td>
                        <td className="px-4 py-2 text-right font-medium text-red-600">{entry.debit > 0 ? formatCurrency(entry.debit) : "-"}</td>
                        <td className="px-4 py-2 text-right font-medium text-green-600">{entry.credit > 0 ? formatCurrency(entry.credit) : "-"}</td>
                      </tr>
                    ))
                  })()}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
