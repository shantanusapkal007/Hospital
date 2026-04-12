"use client"

import { useState, useEffect } from "react"
import { ArrowLeft, Edit, Calendar, Pill, MessageSquare, Phone, Mail, Activity, UserX, BookOpen } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Avatar } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Modal } from "@/components/ui/modal"
import { EditVisitModal } from "@/components/visits/edit-visit-modal"
import { VisitCard } from "@/components/visits/visit-card"
import { VisitImageGallery } from "@/components/visits/visit-image-gallery"
import { FORM_FIELD_PROPS, FORM_PROPS } from "@/lib/form-defaults"
import { cn, formatCurrency, getTreatmentType } from "@/lib/utils"
import { useAuth } from "@/components/providers/AuthProvider"
import Image from "next/image"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { getPatient, updatePatient, deletePatient, getPatientLinkedRecordCounts } from "@/services/patient.service"
import { getVisitsByPatient } from "@/services/visit.service"
import { getPaymentsByPatient } from "@/services/payment.service"
import { getAppointmentsByPatient } from "@/services/appointment.service"
import type { Patient, Visit, Payment, Appointment, TreatmentType, Medicine } from "@/lib/types"
import { Breadcrumb } from "@/components/ui/breadcrumb-nav"
import { PatientMedicines } from "@/components/ui/patient-medicines"
import { useToast } from "@/components/ui/toast"

export default function PatientDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { user } = useAuth()
  const patientId = params.id as string

  const [patient, setPatient] = useState<Patient | null>(null)
  const [visits, setVisits] = useState<Visit[]>([])
  const [payments, setPayments] = useState<Payment[]>([])
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [activeTab, setActiveTab] = useState("visits")
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [editGender, setEditGender] = useState("Male")
  const [editTreatmentType, setEditTreatmentType] = useState<TreatmentType>("Allopathic")
  const [editMedicines, setEditMedicines] = useState<Medicine[]>([])
  const [medicineDraft, setMedicineDraft] = useState<Medicine[]>([])
  const [isWhatsAppModalOpen, setIsWhatsAppModalOpen] = useState(false)
  const [selectedWhatsAppNumber, setSelectedWhatsAppNumber] = useState("9420893995")
  const [selectedVisit, setSelectedVisit] = useState<Visit | null>(null)
  const [isEditVisitModalOpen, setIsEditVisitModalOpen] = useState(false)
  const [clinicalDetailsFormData, setClinicalDetailsFormData] = useState({
    presentComplaints: "",
    weight: "",
    heightCm: "",
    bp: "",
    temperature: "",
    spo2: "",
    repetition: "",
    lmp: "",
  })
  const [isSavingClinical, setIsSavingClinical] = useState(false)
  const [isSavingMedicines, setIsSavingMedicines] = useState(false)
  const { showToast } = useToast()

  const buildMedicineDraft = () => [] as Medicine[]

  const buildEmptyClinicalDetailsFormData = () => ({
    presentComplaints: "",
    weight: "",
    heightCm: "",
    bp: "",
    temperature: "",
    spo2: "",
    repetition: "",
    lmp: "",
  })

  const buildClinicalDetailsFormData = (nextPatient: Patient | null) => ({
    presentComplaints: "",
    weight: "",
    heightCm: "",
    bp: "",
    temperature: "",
    spo2: "",
    repetition: "",
    lmp: "",
  })

  const parseOptionalNumber = (value: string) => {
    const trimmed = value.trim()
    if (!trimmed) return null

    const parsed = Number.parseFloat(trimmed)
    return Number.isFinite(parsed) ? parsed : null
  }

  const sanitizeMedicines = (medicines: Medicine[]) =>
    medicines
      .map((medicine) => ({
        ...medicine,
        name: medicine.name.trim(),
        potency: medicine.potency?.trim() || "",
        dosage: medicine.dosage.trim(),
        frequency: medicine.frequency.trim(),
        notes: medicine.notes?.trim() || "",
        days: Number.isFinite(medicine.days) ? medicine.days : 0,
      }))
      .filter((medicine) =>
        Boolean(
          medicine.name ||
          medicine.potency ||
          medicine.dosage ||
          medicine.frequency ||
          medicine.notes
        )
      )

  const resetEditFormState = (nextPatient: Patient | null = patient) => {
    if (!nextPatient) return
    setEditGender(nextPatient.gender)
    setEditTreatmentType(getTreatmentType(nextPatient.caseNumber, nextPatient.treatmentType))
    setEditMedicines(nextPatient.currentMedicines || [])
  }

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
          setClinicalDetailsFormData(buildClinicalDetailsFormData(p))
        }
      } catch (e) {
        setError("Failed to load patient details.")
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [patientId])

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
      };

      if (editGender?.toLowerCase() === "female") {
        updateData.lmp = fd.get("lmp") as string || "";
        updateData.menstrualCycleDays = parseInt(fd.get("menstrualCycleDays") as string) || null;
      } else {
        updateData.lmp = null;
        updateData.menstrualCycleDays = null;
      }

      await updatePatient(patient.id, updateData)
      if (typeof form.reset === "function") {
        form.reset()
      }
      const updated = await getPatient(patient.id)
      setPatient(updated)
      resetEditFormState(updated)
      setMedicineDraft(buildMedicineDraft())
      setIsEditModalOpen(false)
    } catch (e: any) {
      showToast(e.message || "Failed to update patient.", "error")
    } finally {
      setIsSaving(false)
    }
  }

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
      if (patient.gender?.toLowerCase() === 'female') {
        updateData.lmp = clinicalDetailsFormData.lmp;
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

  if (loading) return <div className="flex items-center justify-center py-20 text-slate-500">Loading patient...</div>
  if (!patient) return <div className="flex items-center justify-center py-20 text-slate-500">Patient not found.</div>

  const nameParts = patient.fullName?.split(" ") || [""]
  const firstName = nameParts[0] || ""
  const lastName = nameParts.slice(1).join(" ") || ""
  const ic = "w-full h-10 rounded-xl border border-slate-200 bg-white/90 px-3 text-sm text-slate-800 shadow-sm transition focus:outline-none focus:ring-2 focus:ring-sky-500"
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
    { label: "Temperature", value: patient.temperature != null ? `${patient.temperature} deg F` : "-" },
    { label: "SpO2", value: patient.spo2 != null ? `${patient.spo2}%` : "-" },
    { label: "Repetition", value: patient.repetition || "-" },
  ];
  if (patient.gender?.toLowerCase() === 'female') {
    clinicalSummaryItems.push({ label: "LMP", value: patient.lmp || "-" });
  }
  const previousComplaint = visits.length > 0 ? visits[0].complaints : "";
  const hasClinicalDetails = clinicalSummaryItems.some((item) => item.value !== "-") || Boolean(patient.presentComplaints) || Boolean(previousComplaint)
  const hasPatientCareSummary = hasClinicalDetails || hasSavedMedicines
  const khataBalance = patient.khataBalance || 0
  const khataLabel = khataBalance < 0
    ? `Due ${formatCurrency(Math.abs(khataBalance))}`
    : khataBalance > 0
      ? `Advance ${formatCurrency(khataBalance)}`
      : "Clear"
  const patientStats = [
    {
      label: "Visits",
      value: String(visits.length),
      hint: visits.length > 0 ? "Case papers recorded" : "No visits yet",
      icon: Activity,
      shell: "border-sky-200/80 bg-gradient-to-br from-sky-100 via-white to-blue-50 text-sky-900",
      iconShell: "bg-sky-600 text-white shadow-sky-200",
    },
    {
      label: "Appointments",
      value: String(appointments.length),
      hint: appointments.length > 0 ? "Scheduled history" : "Nothing booked yet",
      icon: Calendar,
      shell: "border-amber-200/80 bg-gradient-to-br from-amber-100 via-white to-orange-50 text-amber-900",
      iconShell: "bg-amber-500 text-white shadow-amber-200",
    },
    {
      label: "Payments",
      value: String(payments.length),
      hint: payments.length > 0 ? "Transactions on file" : "No payment records",
      icon: BookOpen,
      shell: "border-emerald-200/80 bg-gradient-to-br from-emerald-100 via-white to-teal-50 text-emerald-900",
      iconShell: "bg-emerald-600 text-white shadow-emerald-200",
    },
    {
      label: "Khata",
      value: khataLabel,
      hint: khataBalance < 0 ? "Pending ledger balance" : khataBalance > 0 ? "Advance available" : "No open balance",
      icon: MessageSquare,
      shell: khataBalance < 0
        ? "border-rose-200/80 bg-gradient-to-br from-rose-100 via-white to-red-50 text-rose-900"
        : khataBalance > 0
          ? "border-emerald-200/80 bg-gradient-to-br from-emerald-100 via-white to-lime-50 text-emerald-900"
          : "border-slate-200/80 bg-gradient-to-br from-slate-100 via-white to-slate-50 text-slate-900",
      iconShell: khataBalance < 0
        ? "bg-rose-600 text-white shadow-rose-200"
        : khataBalance > 0
          ? "bg-emerald-600 text-white shadow-emerald-200"
          : "bg-slate-700 text-white shadow-slate-200",
    },
  ]
  const tabItems = [
    { id: "visits", label: "Visits", count: visits.length },
    { id: "appointments", label: "Appointments", count: appointments.length },
    { id: "payments", label: "Payments", count: payments.length },
    {
      id: "khata",
      label: "Khata Ledger",
      count: visits.filter((visit) => (visit.totalBill || 0) > 0).length + payments.length,
    },
  ]

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

      <Modal isOpen={isEditModalOpen} onClose={() => { setIsEditModalOpen(false); resetEditFormState() }} title="Edit Patient">
        <form className="space-y-3 max-h-[70vh] overflow-y-auto pr-2" onSubmit={handleSave} {...FORM_PROPS}>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1"><label className="text-sm font-medium text-slate-700">Case Number</label><input required name="caseNumber" defaultValue={patient.caseNumber} className={ic} {...FORM_FIELD_PROPS} /></div>
            <div className="space-y-1"><label className="text-sm font-medium text-slate-700">Mobile</label><input required name="mobile" type="tel" defaultValue={patient.mobileNumber} className={ic} {...FORM_FIELD_PROPS} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1"><label className="text-sm font-medium text-slate-700">First Name</label><input required name="firstName" defaultValue={firstName} className={ic} {...FORM_FIELD_PROPS} /></div>
            <div className="space-y-1"><label className="text-sm font-medium text-slate-700">Last Name</label><input required name="lastName" defaultValue={lastName} className={ic} {...FORM_FIELD_PROPS} /></div>
          </div>
          <div className="grid grid-cols-4 gap-3">
            <div className="space-y-1"><label className="text-sm font-medium text-slate-700">Age</label><input required name="age" type="number" defaultValue={patient.age} className={ic} {...FORM_FIELD_PROPS} /></div>
            <div className="space-y-1"><label className="text-sm font-medium text-slate-700">Gender</label>
              <select value={editGender} onChange={(e) => setEditGender(e.target.value)} className={ic} {...FORM_FIELD_PROPS}>
                <option value="Male">Male</option><option value="Female">Female</option><option value="Other">Other</option>
              </select>
            </div>
            <div className="space-y-1 col-span-2"><label className="text-sm font-medium text-slate-700">Treatment Type</label>
              <select name="treatmentType" value={editTreatmentType} onChange={(e) => setEditTreatmentType(e.target.value as TreatmentType)} className={ic} required {...FORM_FIELD_PROPS}>
                <option value="Allopathic">Allopathic</option>
                <option value="Homeopathic">Homeopathic</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1"><label className="text-sm font-medium text-slate-700">Blood</label><input name="bloodGroup" defaultValue={patient.bloodGroup} className={ic} {...FORM_FIELD_PROPS} /></div>
            <div className="space-y-1"><label className="text-sm font-medium text-slate-700">DOB</label><input name="dob" type="date" defaultValue={patient.dateOfBirth} className={ic} {...FORM_FIELD_PROPS} /></div>
          </div>
          {editGender?.toLowerCase() === "female" && (
            <div className="p-3 bg-pink-50 border border-pink-100 rounded-lg space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-sm font-medium text-pink-800">LMP</label>
                  <input name="lmp" type="date" defaultValue={patient.lmp ?? ""} className={ic} {...FORM_FIELD_PROPS} />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-pink-800">Cycle (days)</label>
                  <input name="menstrualCycleDays" type="number" defaultValue={patient.menstrualCycleDays ?? ""} className={ic} placeholder="28" {...FORM_FIELD_PROPS} />
                </div>
              </div>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1"><label className="text-sm font-medium text-slate-700">Alt. Mobile</label><input name="alternateMobile" defaultValue={patient.alternateMobile} className={ic} {...FORM_FIELD_PROPS} /></div>
            <div className="space-y-1"><label className="text-sm font-medium text-slate-700">Email</label><input name="email" type="email" defaultValue={patient.email} className={ic} {...FORM_FIELD_PROPS} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1"><label className="text-sm font-medium text-slate-700">Emergency</label><input name="emergencyContact" defaultValue={patient.emergencyContact} className={ic} {...FORM_FIELD_PROPS} /></div>
            <div className="space-y-1"><label className="text-sm font-medium text-slate-700">Occupation</label><input name="occupation" defaultValue={patient.occupation} className={ic} {...FORM_FIELD_PROPS} /></div>
          </div>
          <div className="space-y-1"><label className="text-sm font-medium text-slate-700">Address</label><input name="addressLine1" defaultValue={patient.address?.line1} className={ic} {...FORM_FIELD_PROPS} /></div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1"><label className="text-sm font-medium text-slate-700">City</label><input name="city" defaultValue={patient.address?.city} className={ic} {...FORM_FIELD_PROPS} /></div>
            <div className="space-y-1"><label className="text-sm font-medium text-slate-700">State</label><input name="state" defaultValue={patient.address?.state} className={ic} {...FORM_FIELD_PROPS} /></div>
            <div className="space-y-1"><label className="text-sm font-medium text-slate-700">Pincode</label><input name="pincode" defaultValue={patient.address?.pincode} className={ic} {...FORM_FIELD_PROPS} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1"><label className="text-sm font-medium text-slate-700">Marital Status</label>
              <select name="maritalStatus" defaultValue={patient.maritalStatus} className={ic} {...FORM_FIELD_PROPS}>
                <option value="">Select</option><option value="Single">Single</option><option value="Married">Married</option><option value="Divorced">Divorced</option><option value="Widowed">Widowed</option>
              </select>
            </div>
            <div className="space-y-1"><label className="text-sm font-medium text-slate-700">Allergies</label><input name="allergies" defaultValue={patient.allergies} className={ic} {...FORM_FIELD_PROPS} /></div>
          </div>
          <div className="space-y-1"><label className="text-sm font-medium text-slate-700">Chronic Diseases</label><input name="chronicDiseases" defaultValue={patient.chronicDiseases} className={ic} {...FORM_FIELD_PROPS} /></div>
          <div className="space-y-1"><label className="text-sm font-medium text-slate-700">Notes</label><textarea name="notes" defaultValue={patient.notes} className="w-full p-3 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" rows={2} {...FORM_FIELD_PROPS} /></div>
          
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

      <Modal isOpen={isWhatsAppModalOpen} onClose={() => setIsWhatsAppModalOpen(false)} title="Send WhatsApp Message">
        <div className="space-y-4">
          <p className="text-sm text-slate-600">Select the number to send WhatsApp details from:</p>
          <div className="space-y-2">
            <label className="flex items-center gap-3 p-3 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50">
              <input type="radio" value="9420893995" checked={selectedWhatsAppNumber === "9420893995"} onChange={(e) => setSelectedWhatsAppNumber(e.target.value)} className="text-green-600 w-4 h-4" />
              <span className="text-sm font-medium text-slate-900">Primary (+91 9420893995)</span>
            </label>
            <label className="flex items-center gap-3 p-3 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50">
              <input type="radio" value="9421311486" checked={selectedWhatsAppNumber === "9421311486"} onChange={(e) => setSelectedWhatsAppNumber(e.target.value)} className="text-green-600 w-4 h-4" />
              <span className="text-sm font-medium text-slate-900">Secondary (+91 9421311486)</span>
            </label>
          </div>
          <div className="pt-4 flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setIsWhatsAppModalOpen(false)}>Cancel</Button>
            <Button className="bg-green-600 hover:bg-green-700 text-white" onClick={() => {
              window.open(`https://wa.me/91${patient.mobileNumber}?text=Hello ${firstName}, this message is sent from our clinic via +91 ${selectedWhatsAppNumber}.`, '_blank')
              setIsWhatsAppModalOpen(false)
            }}>
              <MessageSquare className="w-4 h-4 mr-2" /> Send Message
            </Button>
          </div>
        </div>
      </Modal>

      {/* Edit Visit Modal */}
      {selectedVisit && user && (
        <EditVisitModal
          isOpen={isEditVisitModalOpen}
          visit={selectedVisit}
          userId={user.id}
          onClose={() => {
            setIsEditVisitModalOpen(false)
            setSelectedVisit(null)
          }}
          onSaved={async (updatedVisit) => {
            // Refresh all visits from the database to ensure we have the latest data
            const refreshedVisits = await getVisitsByPatient(patientId)
            setVisits(refreshedVisits)
            setSelectedVisit(null)
            setIsEditVisitModalOpen(false)
            showToast("Visit updated successfully!", "success")
          }}
        />
      )}

      {/* Patient Profile Card */}
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
                <Badge variant="outline" className={`font-bold ${patientTreatmentType === 'Homeopathic' ? 'border-green-200 text-green-700 bg-green-50' : 'border-blue-200 text-blue-700 bg-blue-50'}`}>
                  {patientTreatmentType}
                </Badge>
                <Badge variant="secondary" className="bg-white/80 text-slate-700">{patient.gender}</Badge>
                <Badge variant="secondary" className="bg-white/80 text-slate-700">{patient.age} yrs</Badge>
                {patient.bloodGroup && <Badge variant="secondary" className="bg-rose-50 text-rose-700">{patient.bloodGroup}</Badge>}
              </div>
              <div>
                <h1 className="text-3xl font-semibold tracking-tight text-slate-950">{patient.fullName}</h1>
                <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600">
                  Patient profile, recent care context, and ledger activity in one place.
                </p>
              </div>
              <div className="flex flex-wrap gap-3 text-sm text-slate-600">
                <span className="inline-flex items-center gap-2 rounded-full bg-white/80 px-3 py-1.5 shadow-sm">
                  <Phone className="h-4 w-4 text-sky-600" /> {patient.mobileNumber}
                </span>
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

        <div className="relative mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {patientStats.map((stat) => (
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

        {/* Extended Details Grid */}
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

        {/* Overall Medicines Section — always visible */}
        {hasPatientCareSummary && (
          <div className="mt-6 rounded-[28px] border border-slate-200/80 bg-white/80 p-5 shadow-inner shadow-slate-100 backdrop-blur">
            <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.24em] text-slate-700">
                  <Activity className="h-4 w-4 text-sky-600" /> Patient Care Summary
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  Saved clinical details and current medicines are grouped together here for quick review.
                </p>
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
                    {clinicalSummaryItems.map((item) => (
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
                    <PatientMedicines medicines={normalizedSavedMedicines} readOnly />
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="mt-6 grid grid-cols-1 gap-3 border-t border-white/60 pt-6 sm:grid-cols-3">
          <Button variant="outline" className="w-full justify-start rounded-2xl border-sky-200 bg-white/80 text-slate-700 hover:bg-sky-50" onClick={() => router.push('/appointments')}>
            <Calendar className="w-4 h-4 mr-2 text-sky-600" /> Book Appointment
          </Button>
          <Button variant="outline" className="w-full justify-start rounded-2xl border-emerald-200 bg-white/80 text-slate-700 hover:bg-emerald-50" onClick={() => router.push('/visits')}>
            <Pill className="w-4 h-4 mr-2 text-emerald-600" /> Record Visit
          </Button>
          <Button variant="outline" className="w-full justify-start rounded-2xl border-violet-200 bg-white/80 text-slate-700 hover:bg-violet-50" onClick={() => setIsWhatsAppModalOpen(true)}>
            <MessageSquare className="w-4 h-4 mr-2 text-violet-600" /> WhatsApp
          </Button>
        </div>

        <div className="mt-6 rounded-[28px] border border-slate-200 bg-gradient-to-br from-white via-white to-sky-50/70 p-6 shadow-[0_24px_80px_-42px_rgba(15,23,42,0.35)]">
          <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                <Activity className="w-5 h-5 text-sky-600" /> Update Patient Care
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Enter clinical details and current medicines together, then save each part when you are ready.
              </p>
            </div>
            <div className="rounded-full bg-sky-50 px-3 py-1 text-xs font-medium text-sky-700">
              Quick clinical workspace
            </div>
          </div>

          <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
            <form onSubmit={handleSaveClinicalDetails} {...FORM_PROPS} className="rounded-[24px] border border-sky-100 bg-gradient-to-br from-sky-50 via-white to-cyan-50 p-5 shadow-sm space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-[0.24em] flex items-center gap-2">
                  <Activity className="w-4 h-4 text-sky-600" /> Clinical Details
                </h3>
                <p className="mt-1 text-sm text-slate-500">Track complaints, vitals, and repetition in one place.</p>
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700">Present Complaints</label>
                <input
                  type="text"
                  placeholder="e.g. Fever, Headache since 2 days"
                  value={clinicalDetailsFormData.presentComplaints}
                  onChange={(e) => setClinicalDetailsFormData({ ...clinicalDetailsFormData, presentComplaints: e.target.value })}
                  className={ic}
                  {...FORM_FIELD_PROPS}
                />
              </div>

              {patient.gender?.toLowerCase() === "female" && (
                <div className="space-y-1">
                  <label className="text-sm font-medium text-slate-700">LMP</label>
                  <input
                    type="date"
                    value={clinicalDetailsFormData.lmp}
                    onChange={(e) => setClinicalDetailsFormData({ ...clinicalDetailsFormData, lmp: e.target.value })}
                    className={ic}
                    {...FORM_FIELD_PROPS}
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-sm font-medium text-slate-700">Weight (kg)</label>
                  <input
                    type="number"
                    placeholder="e.g. 70"
                    step="0.1"
                    value={clinicalDetailsFormData.weight}
                    onChange={(e) => setClinicalDetailsFormData({ ...clinicalDetailsFormData, weight: e.target.value })}
                    className={ic}
                    {...FORM_FIELD_PROPS}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-slate-700">Height (cm)</label>
                  <input
                    type="number"
                    placeholder="e.g. 170"
                    step="0.1"
                    value={clinicalDetailsFormData.heightCm}
                    onChange={(e) => setClinicalDetailsFormData({ ...clinicalDetailsFormData, heightCm: e.target.value })}
                    className={ic}
                    {...FORM_FIELD_PROPS}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-slate-700">Blood Pressure</label>
                  <input
                    type="text"
                    placeholder="120/80"
                    value={clinicalDetailsFormData.bp}
                    onChange={(e) => setClinicalDetailsFormData({ ...clinicalDetailsFormData, bp: e.target.value })}
                    className={ic}
                    {...FORM_FIELD_PROPS}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-slate-700">Temperature (deg F)</label>
                  <input
                    type="number"
                    placeholder="98.6"
                    step="0.1"
                    value={clinicalDetailsFormData.temperature}
                    onChange={(e) => setClinicalDetailsFormData({ ...clinicalDetailsFormData, temperature: e.target.value })}
                    className={ic}
                    {...FORM_FIELD_PROPS}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-slate-700">SpO2 (%)</label>
                  <input
                    type="number"
                    placeholder="e.g. 98"
                    value={clinicalDetailsFormData.spo2}
                    onChange={(e) => setClinicalDetailsFormData({ ...clinicalDetailsFormData, spo2: e.target.value })}
                    className={ic}
                    {...FORM_FIELD_PROPS}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-slate-700">Repetition</label>
                  <input
                    type="text"
                    placeholder="e.g. BD, TDS"
                    value={clinicalDetailsFormData.repetition}
                    onChange={(e) => setClinicalDetailsFormData({ ...clinicalDetailsFormData, repetition: e.target.value })}
                    className={ic}
                    {...FORM_FIELD_PROPS}
                  />
                </div>
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
                <p className="mt-1 text-sm text-slate-500">
                  Update medicines here and save once. Typing will not trigger notifications.
                </p>
              </div>

              <PatientMedicines medicines={medicineDraft} onMedicinesChange={setMedicineDraft} />

              <div className="pt-4 flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-2xl border-slate-200 bg-white/80"
                  disabled={isSavingMedicines || !hasMedicineChanges}
                  onClick={() => setMedicineDraft(buildMedicineDraft())}
                >
                  Reset
                </Button>
                <Button
                  type="button"
                  className="rounded-2xl bg-emerald-600 text-white hover:bg-emerald-700"
                  disabled={isSavingMedicines || !hasMedicineChanges}
                  onClick={handleSaveMedicines}
                >
                  {isSavingMedicines ? "Saving..." : "Save Medicines"}
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Clinical Details Form */}
        <div className="hidden">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                <Activity className="w-5 h-5 text-blue-600" /> Update Clinical Details
              </h2>
              <p className="mt-1 text-sm text-slate-500">These values save into the clinical details section above.</p>
            </div>
          </div>

          <form onSubmit={handleSaveClinicalDetails} {...FORM_PROPS} className="space-y-4">
            {/* Present Complaints */}
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700">Present Complaints</label>
              <input
                type="text"
                placeholder="e.g. Fever, Headache since 2 days"
                value={clinicalDetailsFormData.presentComplaints}
                onChange={(e) => setClinicalDetailsFormData({ ...clinicalDetailsFormData, presentComplaints: e.target.value })}
                className={ic}
                {...FORM_FIELD_PROPS}
              />
            </div>

            {/* Vitals Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700">WT (KG)</label>
                <input
                  type="number"
                  placeholder="e.g. 70"
                  step="0.1"
                  value={clinicalDetailsFormData.weight}
                  onChange={(e) => setClinicalDetailsFormData({ ...clinicalDetailsFormData, weight: e.target.value })}
                  className={ic}
                  {...FORM_FIELD_PROPS}
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700">HT (CM)</label>
                <input
                  type="number"
                  placeholder="e.g. 170"
                  step="0.1"
                  value={clinicalDetailsFormData.heightCm}
                  onChange={(e) => setClinicalDetailsFormData({ ...clinicalDetailsFormData, heightCm: e.target.value })}
                  className={ic}
                  {...FORM_FIELD_PROPS}
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700">BP (MMHG)</label>
                <input
                  type="text"
                  placeholder="120/80"
                  value={clinicalDetailsFormData.bp}
                  onChange={(e) => setClinicalDetailsFormData({ ...clinicalDetailsFormData, bp: e.target.value })}
                  className={ic}
                  {...FORM_FIELD_PROPS}
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700">TEMP (°F)</label>
                <input
                  type="number"
                  placeholder="98.6"
                  step="0.1"
                  value={clinicalDetailsFormData.temperature}
                  onChange={(e) => setClinicalDetailsFormData({ ...clinicalDetailsFormData, temperature: e.target.value })}
                  className={ic}
                  {...FORM_FIELD_PROPS}
                />
              </div>
            </div>

            {/* SPO2 & Repetition */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700">SPO2 (%)</label>
                <input
                  type="number"
                  placeholder="e.g. 98"
                  value={clinicalDetailsFormData.spo2}
                  onChange={(e) => setClinicalDetailsFormData({ ...clinicalDetailsFormData, spo2: e.target.value })}
                  className={ic}
                  {...FORM_FIELD_PROPS}
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700">Repetition</label>
                <input
                  type="text"
                  placeholder="e.g., BD, TDS"
                  value={clinicalDetailsFormData.repetition}
                  onChange={(e) => setClinicalDetailsFormData({ ...clinicalDetailsFormData, repetition: e.target.value })}
                  className={ic}
                  {...FORM_FIELD_PROPS}
                />
              </div>
            </div>

            {/* Save Button */}
            <div className="pt-4 flex justify-end">
              <Button type="submit" disabled={isSavingClinical} className="bg-green-600 hover:bg-green-700">
                {isSavingClinical ? "Saving..." : "Save Details"}
              </Button>
            </div>
          </form>
        </div>
      </div>

      <div className="overflow-x-auto rounded-[24px] border border-slate-200 bg-white/90 p-2 shadow-sm backdrop-blur">
        <div className="flex min-w-max gap-2">
          {tabItems.map((tab) => (
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

      {activeTab === "visits" && (
        <div className="space-y-4">
          {visits.length === 0 && <div className="rounded-[24px] border border-dashed border-sky-200 bg-gradient-to-br from-white to-sky-50 py-12 text-center text-sm text-slate-500">No visit records</div>}
          {visits.map(visit => (
            <VisitCard
              key={visit.id}
              visit={visit}
              onEdit={(v) => {
                setSelectedVisit(v)
                setIsEditVisitModalOpen(true)
              }}
            />
          ))}
        </div>
      )}

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

      {activeTab === "payments" && (
        <div className="space-y-3">
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

      {activeTab === "khata" && (
        <div className="space-y-4">
          <div className="rounded-[28px] border border-slate-200 bg-gradient-to-br from-white via-white to-emerald-50/70 p-4 shadow-[0_24px_80px_-42px_rgba(15,23,42,0.35)]">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-sky-600" /> Khata Ledger (Passbook)
              </h3>
              <div className={`px-3 py-1 rounded-xl text-sm font-bold ${(patient.khataBalance || 0) < 0 ? 'bg-red-50 text-red-700' : (patient.khataBalance || 0) > 0 ? 'bg-green-50 text-green-700' : 'bg-slate-50 text-slate-700'}`}>
                Balance: {(patient.khataBalance || 0) < 0 ? `Due ${formatCurrency(Math.abs(patient.khataBalance || 0))}` : formatCurrency(patient.khataBalance || 0)}
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
                    // Combine visits (debits) and payments (credits) into one timeline
                    const entries: { date: string; sortKey: number; desc: string; debit: number; credit: number }[] = []
                    visits.forEach(v => {
                      if (v.totalBill && v.totalBill > 0) {
                        const visitDate = v.createdAt?.toDate?.()
                        entries.push({
                          date: visitDate?.toLocaleDateString() || "-",
                          sortKey: visitDate?.getTime() || 0,
                          desc: `Visit: ${v.diagnosis || "Consultation"}`,
                          debit: v.totalBill,
                          credit: 0,
                        })
                      }
                    })
                    payments.forEach(p => {
                      const paymentDate = p.date ? new Date(`${p.date}T00:00:00`) : p.createdAt?.toDate?.()
                      entries.push({
                        date: p.date || paymentDate?.toLocaleDateString() || "-",
                        sortKey: paymentDate?.getTime() || 0,
                        desc: `Payment: ${p.paymentMethod?.toUpperCase() || ""}${p.description ? ` - ${p.description}` : ""}`,
                        debit: 0,
                        credit: p.amount,
                      })
                    })
                    // Sort by date (newest first)
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
