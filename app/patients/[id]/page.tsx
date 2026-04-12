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
import { formatCurrency, getTreatmentType } from "@/lib/utils"
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
    present_complaints: "",
    weight: "",
    height_cm: "",
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

  const buildClinicalDetailsFormData = (nextPatient: Patient | null) => ({
    present_complaints: nextPatient?.present_complaints || "",
    weight: nextPatient?.weight != null ? String(nextPatient.weight) : "",
    height_cm: nextPatient?.height_cm != null ? String(nextPatient.height_cm) : "",
    bp: nextPatient?.bp || "",
    temperature: nextPatient?.temperature != null ? String(nextPatient.temperature) : "",
    spo2: nextPatient?.spo2 != null ? String(nextPatient.spo2) : "",
    repetition: nextPatient?.repetition || "",
    lmp: nextPatient?.lmp || "",
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
    setEditTreatmentType(getTreatmentType(nextPatient.case_number, nextPatient.treatment_type))
    setEditMedicines(nextPatient.current_medicines || [])
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
          setEditTreatmentType(getTreatmentType(p.case_number, p.treatment_type))
          setEditMedicines(p.current_medicines || [])
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
        case_number: fd.get("case_number") as string,
        treatment_type: fd.get("treatment_type") as TreatmentType,
        full_name: `${fd.get("firstName")} ${fd.get("lastName")}`,
        mobile_number: fd.get("mobile") as string,
        alternate_mobile: fd.get("alternate_mobile") as string || "",
        age: parseInt(fd.get("age") as string) || 0,
        gender: editGender as "Male" | "Female" | "Other",
        date_of_birth: fd.get("dob") as string || "",
        blood_group: fd.get("blood_group") as string || "",
        email: fd.get("email") as string || "",
        occupation: fd.get("occupation") as string || "",
        marital_status: fd.get("marital_status") as string || "",
        address: {
          line1: fd.get("addressLine1") as string || "",
          city: fd.get("city") as string || "",
          state: fd.get("state") as string || "",
          pincode: fd.get("pincode") as string || "",
        },
        allergies: fd.get("allergies") as string || "",
        chronic_diseases: fd.get("chronic_diseases") as string || "",
        emergency_contact: fd.get("emergency_contact") as string || "",
        notes: fd.get("notes") as string || "",
        current_medicines: editMedicines,
      };

      if (editGender?.toLowerCase() === "female") {
        updateData.lmp = fd.get("lmp") as string || "";
        updateData.menstrual_cycle_days = parseInt(fd.get("menstrual_cycle_days") as string) || null;
      } else {
        updateData.lmp = null;
        updateData.menstrual_cycle_days = null;
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
        present_complaints: clinicalDetailsFormData.present_complaints.trim(),
        weight: parseOptionalNumber(clinicalDetailsFormData.weight),
        height_cm: parseOptionalNumber(clinicalDetailsFormData.height_cm),
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
      setClinicalDetailsFormData(buildClinicalDetailsFormData(updated))
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
      await updatePatient(patient.id, { current_medicines: nextMedicines })
      const updated = await getPatient(patient.id)
      setPatient(updated)
      setEditMedicines(updated?.current_medicines || [])
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

  const nameParts = patient.full_name?.split(" ") || [""]
  const firstName = nameParts[0] || ""
  const lastName = nameParts.slice(1).join(" ") || ""
  const ic = "w-full h-10 px-3 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
  const patientTreatmentType = getTreatmentType(patient.case_number, patient.treatment_type)
  const savedMedicines = patient.current_medicines || []
  const normalizedSavedMedicines = sanitizeMedicines(savedMedicines)
  const normalizedMedicineDraft = sanitizeMedicines(medicineDraft)
  const hasSavedMedicines = normalizedSavedMedicines.length > 0
  const hasMedicineChanges = normalizedMedicineDraft.length > 0
  const clinicalSummaryItems = [
    { label: "Weight", value: patient.weight != null ? `${patient.weight} kg` : "-" },
    { label: "Height", value: patient.height_cm != null ? `${patient.height_cm} cm` : "-" },
    { label: "Blood Pressure", value: patient.bp || "-" },
    { label: "Temperature", value: patient.temperature != null ? `${patient.temperature} deg F` : "-" },
    { label: "SpO2", value: patient.spo2 != null ? `${patient.spo2}%` : "-" },
    { label: "Repetition", value: patient.repetition || "-" },
  ];
  if (patient.gender?.toLowerCase() === 'female') {
    clinicalSummaryItems.push({ label: "LMP", value: patient.lmp || "-" });
  }
  const previousComplaint = visits.length > 0 ? visits[0].complaints : "";
  const hasClinicalDetails = clinicalSummaryItems.some((item) => item.value !== "-") || Boolean(patient.present_complaints) || Boolean(previousComplaint)
  const hasPatientCareSummary = hasClinicalDetails || hasSavedMedicines

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <Breadcrumb items={[
        { label: "Dashboard", href: "/" },
        { label: "Patients", href: "/patients" },
        { label: patient?.full_name || "Loading..." }
      ]} />
      <Link href="/patients" className="inline-flex items-center text-sm font-medium text-slate-500 hover:text-slate-900 transition-colors">
        <ArrowLeft className="w-4 h-4 mr-1" /> Back to Patients
      </Link>

      {error && <div className="rounded-lg bg-red-50 p-4 text-sm text-red-700">{error}</div>}

      <Modal isOpen={isEditModalOpen} onClose={() => { setIsEditModalOpen(false); resetEditFormState() }} title="Edit Patient">
        <form className="space-y-3 max-h-[70vh] overflow-y-auto pr-2" onSubmit={handleSave} {...FORM_PROPS}>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1"><label className="text-sm font-medium text-slate-700">Case Number</label><input required name="case_number" defaultValue={patient.case_number} className={ic} {...FORM_FIELD_PROPS} /></div>
            <div className="space-y-1"><label className="text-sm font-medium text-slate-700">Mobile</label><input required name="mobile" type="tel" defaultValue={patient.mobile_number} className={ic} {...FORM_FIELD_PROPS} /></div>
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
              <select name="treatment_type" value={editTreatmentType} onChange={(e) => setEditTreatmentType(e.target.value as TreatmentType)} className={ic} required {...FORM_FIELD_PROPS}>
                <option value="Allopathic">Allopathic</option>
                <option value="Homeopathic">Homeopathic</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1"><label className="text-sm font-medium text-slate-700">Blood</label><input name="blood_group" defaultValue={patient.blood_group} className={ic} {...FORM_FIELD_PROPS} /></div>
            <div className="space-y-1"><label className="text-sm font-medium text-slate-700">DOB</label><input name="dob" type="date" defaultValue={patient.date_of_birth} className={ic} {...FORM_FIELD_PROPS} /></div>
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
                  <input name="menstrual_cycle_days" type="number" defaultValue={patient.menstrual_cycle_days ?? ""} className={ic} placeholder="28" {...FORM_FIELD_PROPS} />
                </div>
              </div>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1"><label className="text-sm font-medium text-slate-700">Alt. Mobile</label><input name="alternate_mobile" defaultValue={patient.alternate_mobile} className={ic} {...FORM_FIELD_PROPS} /></div>
            <div className="space-y-1"><label className="text-sm font-medium text-slate-700">Email</label><input name="email" type="email" defaultValue={patient.email} className={ic} {...FORM_FIELD_PROPS} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1"><label className="text-sm font-medium text-slate-700">Emergency</label><input name="emergency_contact" defaultValue={patient.emergency_contact} className={ic} {...FORM_FIELD_PROPS} /></div>
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
              <select name="marital_status" defaultValue={patient.marital_status} className={ic} {...FORM_FIELD_PROPS}>
                <option value="">Select</option><option value="Single">Single</option><option value="Married">Married</option><option value="Divorced">Divorced</option><option value="Widowed">Widowed</option>
              </select>
            </div>
            <div className="space-y-1"><label className="text-sm font-medium text-slate-700">Allergies</label><input name="allergies" defaultValue={patient.allergies} className={ic} {...FORM_FIELD_PROPS} /></div>
          </div>
          <div className="space-y-1"><label className="text-sm font-medium text-slate-700">Chronic Diseases</label><input name="chronic_diseases" defaultValue={patient.chronic_diseases} className={ic} {...FORM_FIELD_PROPS} /></div>
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
              window.open(`https://wa.me/91${patient.mobile_number}?text=Hello ${firstName}, this message is sent from our clinic via +91 ${selectedWhatsAppNumber}.`, '_blank')
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
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
        <div className="flex flex-col md:flex-row gap-6 items-start md:items-center justify-between">
          <div className="flex items-center gap-6">
            {patient.photo ? (
              <div className="relative h-16 w-16 overflow-hidden rounded-full border-2 border-slate-200">
                <Image src={patient.photo} alt={patient.full_name} fill unoptimized sizes="64px" className="object-cover" />
              </div>
            ) : (
              <Avatar fallback={patient.full_name?.substring(0, 2).toUpperCase()} size="xl" />
            )}
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-slate-900">{patient.full_name}</h1>
                <Badge variant="outline" className="text-blue-700 border-blue-200 bg-blue-50">Case: {patient.case_number}</Badge>
                <Badge variant="outline" className={`font-bold ${patientTreatmentType === 'Homeopathic' ? 'border-green-200 text-green-700 bg-green-50' : 'border-blue-200 text-blue-700 bg-blue-50'}`}>
                  {patientTreatmentType}
                </Badge>
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-2 text-sm text-slate-600">
                <span className="flex items-center gap-1"><Phone className="w-4 h-4" /> {patient.mobile_number}</span>
                {patient.alternate_mobile && <span className="flex items-center gap-1"><Phone className="w-4 h-4 text-slate-400" /> {patient.alternate_mobile}</span>}
                {patient.email && <span className="flex items-center gap-1"><Mail className="w-4 h-4" /> {patient.email}</span>}
              </div>
              <div className="flex flex-wrap items-center gap-2 mt-3">
                <Badge variant="secondary">{patient.gender}</Badge>
                <Badge variant="secondary">{patient.age} yrs</Badge>
                {patient.blood_group && <Badge variant="secondary">{patient.blood_group}</Badge>}
                {patient.marital_status && <Badge variant="secondary">{patient.marital_status}</Badge>}
                {patient.occupation && <Badge variant="secondary">{patient.occupation}</Badge>}
                {patient.lmp && <Badge variant="secondary">LMP: {patient.lmp}</Badge>}
                {patient.menstrual_cycle_days && <Badge variant="secondary">Cycle: {patient.menstrual_cycle_days}d</Badge>}
              </div>
              {/* Khata Balance Indicator */}
              {(patient.khata_balance ?? 0) !== 0 && (
                <div className={`mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-bold ${(patient.khata_balance || 0) < 0 ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-green-50 text-green-700 border border-green-200'}`}>
                  <BookOpen className="w-4 h-4" />
                  Khata: {(patient.khata_balance || 0) < 0 ? `Due ${formatCurrency(Math.abs(patient.khata_balance || 0))}` : `Advance ${formatCurrency(patient.khata_balance || 0)}`}
                </div>
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-2 w-full md:w-auto">
            <Button variant="outline" size="sm" className="flex-1 md:flex-none" onClick={() => { resetEditFormState(); setIsEditModalOpen(true) }}>
              <Edit className="w-4 h-4 mr-2" /> Edit
            </Button>
            <Button variant="outline" size="sm" className="flex-1 md:flex-none text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200" onClick={async () => {
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

        {/* Extended Details Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-6 border-t border-slate-100 text-sm">
          {patient.address?.line1 && (
            <div><span className="text-xs font-semibold text-slate-400 uppercase">Address</span><p className="text-slate-700 mt-0.5">{patient.address.line1}{patient.address.city ? `, ${patient.address.city}` : ""}{patient.address.state ? `, ${patient.address.state}` : ""}{patient.address.pincode ? ` - ${patient.address.pincode}` : ""}</p></div>
          )}
          {patient.emergency_contact && (
            <div><span className="text-xs font-semibold text-slate-400 uppercase">Emergency Contact</span><p className="text-slate-700 mt-0.5">{patient.emergency_contact}</p></div>
          )}
          {patient.allergies && (
            <div><span className="text-xs font-semibold text-red-400 uppercase">Allergies</span><p className="text-red-600 font-medium mt-0.5">{patient.allergies}</p></div>
          )}
          {patient.chronic_diseases && (
            <div><span className="text-xs font-semibold text-orange-400 uppercase">Chronic Diseases</span><p className="text-orange-700 font-medium mt-0.5">{patient.chronic_diseases}</p></div>
          )}
          {patient.date_of_birth && (
            <div><span className="text-xs font-semibold text-slate-400 uppercase">Date of Birth</span><p className="text-slate-700 mt-0.5">{patient.date_of_birth}</p></div>
          )}
          {patient.notes && (
            <div className="col-span-2"><span className="text-xs font-semibold text-slate-400 uppercase">Notes</span><p className="text-slate-700 mt-0.5">{patient.notes}</p></div>
          )}
        </div>

        {/* Overall Medicines Section — always visible */}
        {hasPatientCareSummary && (
          <div className="mt-6 pt-6 border-t border-slate-100">
            <div className="flex items-center justify-between gap-3 mb-4">
              <div>
                <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wider flex items-center gap-2">
                  <Activity className="w-4 h-4 text-blue-600" /> Patient Care Summary
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  Saved clinical details and current medicines are grouped together here for quick review.
                </p>
              </div>
              <span className="text-xs text-slate-500">Auto-refreshed after save</span>
            </div>

            <div className="space-y-6 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              {hasClinicalDetails && (
                <div>
                  <h4 className="text-sm font-semibold text-slate-700 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <Activity className="w-4 h-4 text-blue-600" /> Clinical Details
                  </h4>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {clinicalSummaryItems.map((item) => (
                      <div key={item.label} className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{item.label}</p>
                        <p className="mt-1 text-sm font-medium text-slate-900">{item.value}</p>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 rounded-xl border border-slate-200 bg-white px-4 py-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Present Complaints</p>
                    <p className="mt-1 text-sm text-slate-900">{patient.present_complaints || "-"}</p>
                  </div>
                  <div className="mt-4 rounded-xl border border-slate-200 bg-white px-4 py-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Previous Complaint</p>
                    <p className="mt-1 text-sm text-slate-900">{previousComplaint || "-"}</p>
                  </div>
                </div>
              )}

              {hasSavedMedicines && (
                <div className={hasClinicalDetails ? "border-t border-slate-200 pt-6" : ""}>
                  <h4 className="text-sm font-semibold text-slate-700 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <Pill className="w-4 h-4 text-blue-600" /> Current Medicines
                  </h4>
                  <PatientMedicines medicines={normalizedSavedMedicines} readOnly onMedicinesChange={function (medicines: Medicine[]): void {
                    throw new Error("Function not implemented.")
                  } } />
                </div>
              )}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-6 pt-6 border-t border-slate-100">
          <Button variant="outline" className="w-full justify-start text-slate-700" onClick={() => router.push('/appointments')}>
            <Calendar className="w-4 h-4 mr-2 text-blue-600" /> Book Appt
          </Button>
          <Button variant="outline" className="w-full justify-start text-slate-700" onClick={() => router.push('/visits')}>
            <Pill className="w-4 h-4 mr-2 text-green-600" /> New Visit
          </Button>
          <Button variant="outline" className="w-full justify-start text-slate-700" onClick={() => setIsWhatsAppModalOpen(true)}>
            <MessageSquare className="w-4 h-4 mr-2 text-green-500" /> WhatsApp
          </Button>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm mt-6">
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
              <Activity className="w-5 h-5 text-blue-600" /> Update Patient Care
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Enter clinical details and current medicines together, then save each part when you are ready.
            </p>
          </div>

          <div className="space-y-6">
            <form onSubmit={handleSaveClinicalDetails} {...FORM_PROPS} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wider flex items-center gap-2">
                  <Activity className="w-4 h-4 text-blue-600" /> Clinical Details
                </h3>
                <p className="mt-1 text-sm text-slate-500">Track complaints, vitals, and repetition in one place.</p>
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700">Present Complaints</label>
                <input
                  type="text"
                  placeholder="e.g. Fever, Headache since 2 days"
                  value={clinicalDetailsFormData.present_complaints}
                  onChange={(e) => setClinicalDetailsFormData({ ...clinicalDetailsFormData, present_complaints: e.target.value })}
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
                    value={clinicalDetailsFormData.height_cm}
                    onChange={(e) => setClinicalDetailsFormData({ ...clinicalDetailsFormData, height_cm: e.target.value })}
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
                <Button type="submit" disabled={isSavingClinical} className="bg-green-600 hover:bg-green-700">
                  {isSavingClinical ? "Saving..." : "Save Clinical Details"}
                </Button>
              </div>
            </form>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="mb-4">
                <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wider flex items-center gap-2">
                  <Pill className="w-4 h-4 text-blue-600" /> Current Medicines
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
                  disabled={isSavingMedicines || !hasMedicineChanges}
                  onClick={() => setMedicineDraft(buildMedicineDraft())}
                >
                  Reset
                </Button>
                <Button
                  type="button"
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
                value={clinicalDetailsFormData.present_complaints}
                onChange={(e) => setClinicalDetailsFormData({ ...clinicalDetailsFormData, present_complaints: e.target.value })}
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
                  value={clinicalDetailsFormData.height_cm}
                  onChange={(e) => setClinicalDetailsFormData({ ...clinicalDetailsFormData, height_cm: e.target.value })}
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

      <div className="flex border-b border-slate-200 overflow-x-auto">
        {["visits", "appointments", "payments", "khata"].map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors capitalize whitespace-nowrap ${activeTab === tab ? "border-blue-600 text-blue-600" : "border-transparent text-slate-500 hover:text-slate-700"}`}>
            {tab === "khata" ? "Khata Ledger" : tab} ({tab === "visits" ? visits.length : tab === "appointments" ? appointments.length : tab === "payments" ? payments.length : (visits.length + payments.length)})
          </button>
        ))}
      </div>

      {activeTab === "visits" && (
        <div className="space-y-4">
          {visits.length === 0 && <div className="py-12 text-center text-sm text-slate-500 bg-white rounded-xl border border-dashed border-slate-200">No visit records</div>}
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
          {appointments.length === 0 && <div className="py-12 text-center text-sm text-slate-500 bg-white rounded-xl border border-dashed border-slate-200">No appointments</div>}
          {appointments.map(apt => (
            <div key={apt.id} className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-900">{apt.appointment_date} at {apt.time_slot}</p>
                <p className="text-xs text-slate-500 mt-1">{apt.type}</p>
              </div>
              <Badge variant={apt.status === "completed" ? "completed" : apt.status === "cancelled" ? "destructive" : "pending"}>{apt.status}</Badge>
            </div>
          ))}
        </div>
      )}

      {activeTab === "payments" && (
        <div className="space-y-3">
          {payments.length === 0 && <div className="py-12 text-center text-sm text-slate-500 bg-white rounded-xl border border-dashed border-slate-200">No payment records</div>}
          {payments.map(pay => (
            <div key={pay.id} className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-900">{formatCurrency(pay.amount)}</p>
                <p className="text-xs text-slate-500 mt-1">{pay.date} • {pay.payment_method?.toUpperCase()}{pay.description ? ` - ${pay.description}` : ""}</p>
              </div>
              <Badge variant={pay.status === "paid" ? "completed" : "pending"}>{pay.status}</Badge>
            </div>
          ))}
        </div>
      )}

      {activeTab === "khata" && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-blue-600" /> Khata Ledger (Passbook)
              </h3>
              <div className={`px-3 py-1 rounded-lg text-sm font-bold ${(patient.khata_balance || 0) < 0 ? 'bg-red-50 text-red-700' : (patient.khata_balance || 0) > 0 ? 'bg-green-50 text-green-700' : 'bg-slate-50 text-slate-700'}`}>
                Balance: {(patient.khata_balance || 0) < 0 ? `Due ${formatCurrency(Math.abs(patient.khata_balance || 0))}` : formatCurrency(patient.khata_balance || 0)}
              </div>
            </div>
            <div className="border border-slate-200 rounded-lg overflow-hidden">
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
                      if (v.total_bill && v.total_bill > 0) {
                        const visitDate = v.created_at?.toDate?.()
                        entries.push({
                          date: visitDate?.toLocaleDateString() || "-",
                          sortKey: visitDate?.getTime() || 0,
                          desc: `Visit: ${v.diagnosis || "Consultation"}`,
                          debit: v.total_bill,
                          credit: 0,
                        })
                      }
                    })
                    payments.forEach(p => {
                      const paymentDate = p.date ? new Date(`${p.date}T00:00:00`) : p.created_at?.toDate?.()
                      entries.push({
                        date: p.date || paymentDate?.toLocaleDateString() || "-",
                        sortKey: paymentDate?.getTime() || 0,
                        desc: `Payment: ${p.payment_method?.toUpperCase() || ""}${p.description ? ` - ${p.description}` : ""}`,
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
