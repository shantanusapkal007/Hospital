"use client"

import { useState, useEffect, useRef, useCallback, startTransition } from "react"
import { Search, Plus, ChevronRight, Camera, Upload } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Avatar } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { formatCurrency, getTreatmentType } from "@/lib/utils"
import { FORM_FIELD_PROPS, FORM_PROPS } from "@/lib/form-defaults"
import { useDebouncedValue } from "@/lib/use-debounced-value"
import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Modal } from "@/components/ui/modal"
import { getPatients, addPatient, searchPatients } from "@/services/patient.service"
import { uploadFileToStorage, validateImageFiles } from "@/services/storage.service"
import { getLatestVisitsForPatients } from "@/services/visit.service"
import type { Patient, TreatmentType, Visit, Medicine } from "@/lib/types"
import { Breadcrumb } from "@/components/ui/breadcrumb-nav"
import { QuickLinks } from "@/components/ui/quick-links"
import { useToast } from "@/components/ui/toast"
import { PatientMedicines } from "@/components/ui/patient-medicines"

const inputClass = "w-full h-10 px-3 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
const labelClass = "text-sm font-medium text-slate-700"
const sectionTitle = "text-xs font-semibold text-slate-400 uppercase tracking-wider mt-4 mb-2 pt-4 border-t border-slate-100"

export default function PatientsPage() {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [selectedGender, setSelectedGender] = useState("Male")
  const [selectedTreatmentType, setSelectedTreatmentType] = useState<TreatmentType>("Allopathic")
  const [patients, setPatients] = useState<Patient[]>([])
  const [patientVisits, setPatientVisits] = useState<Record<string, Visit | null>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [searchTerm, setSearchTerm] = useState("")
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [regMedicines, setRegMedicines] = useState<Medicine[]>([])
  const debouncedSearchTerm = useDebouncedValue(searchTerm, 120)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()
  const { showToast } = useToast()

  const fetchPatients = useCallback(async () => {
    setLoading(true)
    try {
      const data = debouncedSearchTerm ? await searchPatients(debouncedSearchTerm) : await getPatients()
      startTransition(() => {
        setPatients(data)
        setError("")
      })
      
      // Fetch latest visits in batch instead of N+1 sequential calls
      const patientIds = data.map(p => p.id).filter((id): id is string => !!id)
      if (patientIds.length > 0) {
        const visitsMap = await getLatestVisitsForPatients(patientIds)
        setPatientVisits(visitsMap)
      }
    } catch (e) {
      setError("Failed to load patients")
    } finally {
      setLoading(false)
    }
  }, [debouncedSearchTerm])

  useEffect(() => { fetchPatients() }, [fetchPatients])

  useEffect(() => {
    return () => {
      if (photoPreview) {
        URL.revokeObjectURL(photoPreview)
      }
    }
  }, [photoPreview])

  const resetPatientFormState = () => {
    setSelectedGender("Male")
    setSelectedTreatmentType("Allopathic")
    setPhotoFile(null)
    setPhotoPreview(null)
    setRegMedicines([])
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    try {
      const file = e.target.files?.[0]
      if (!file) return

      validateImageFiles([file], 5)
      setPhotoFile(file)
      setPhotoPreview(URL.createObjectURL(file))
    } catch (error: any) {
      setPhotoFile(null)
      setPhotoPreview(null)
      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }
      showToast(error.message || "Invalid patient photo.", "error")
    }
  }

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsSaving(true)
    const form = e.currentTarget
    const fd = new FormData(form)
    try {
      let photoURL = ""
      if (photoFile) {
        photoURL = await uploadFileToStorage(photoFile, "patient-photos")
      }

      const patientData: any = {
        caseNumber: fd.get("caseNumber") as string,
        treatmentType: fd.get("treatmentType") as TreatmentType,
        fullName: `${fd.get("firstName")} ${fd.get("lastName")}`,
        mobileNumber: fd.get("mobile") as string,
        alternateMobile: fd.get("alternateMobile") as string || "",
        gender: selectedGender as "Male" | "Female" | "Other",
        dateOfBirth: fd.get("dob") as string || "",
        age: parseInt(fd.get("age") as string) || 0,
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
        currentMedicines: regMedicines.filter(m => m.name.trim() !== ""),
        notes: fd.get("notes") as string || "",
      };

      if (photoURL) patientData.photo = photoURL;
      if (selectedGender === "Female") {
        patientData.lmp = fd.get("lmp") as string || "";
        patientData.menstrualCycleDays = parseInt(fd.get("menstrualCycleDays") as string) || null;
      }

      await addPatient(patientData)
      if (typeof form.reset === "function") {
        form.reset()
      }
      setIsAddModalOpen(false)
      resetPatientFormState()
      fetchPatients()
    } catch (e: any) {
      showToast(e.message || "Failed to save patient. Please try again.", "error")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <Breadcrumb />
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-950">Patients</h1>
          <p className="text-sm text-slate-500">Manage registrations, contact details, and patient history.</p>
        </div>
        <Button className="w-full sm:w-auto" onClick={() => setIsAddModalOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Add Patient
        </Button>
      </div>

      <Modal isOpen={isAddModalOpen} onClose={() => { setIsAddModalOpen(false); resetPatientFormState() }} title="Register New Patient">
        <form className="space-y-3 max-h-[70vh] overflow-y-auto pr-2" onSubmit={handleSave} {...FORM_PROPS}>

          {/* Photo Upload */}
          <div className="flex items-center gap-4 pb-3 border-b border-slate-100">
            <div className="relative w-20 h-20 rounded-full bg-slate-100 border-2 border-dashed border-slate-300 flex items-center justify-center overflow-hidden cursor-pointer hover:border-blue-400 transition-colors" onClick={() => fileInputRef.current?.click()}>
              {photoPreview ? (
                <Image src={photoPreview} alt="Preview" fill unoptimized sizes="80px" className="object-cover" />
              ) : (
                <Camera className="w-6 h-6 text-slate-400" />
              )}
            </div>
            <div className="flex-1">
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
              <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                <Upload className="w-4 h-4 mr-2" /> Upload Photo
              </Button>
              <p className="text-xs text-slate-400 mt-1">{photoFile ? photoFile.name : "JPG, PNG up to 5MB"}</p>
            </div>
          </div>

          {/* Basic Info */}
          <h4 className={sectionTitle}>Basic Information</h4>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1"><label className={labelClass}>Case Number *</label><input required name="caseNumber" type="text" className={inputClass} placeholder="CS-1006" {...FORM_FIELD_PROPS} /></div>
            <div className="space-y-1"><label className={labelClass}>Mobile Number *</label><input required name="mobile" type="tel" className={inputClass} placeholder="9876543210" {...FORM_FIELD_PROPS} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1"><label className={labelClass}>First Name *</label><input required name="firstName" type="text" className={inputClass} placeholder="John" {...FORM_FIELD_PROPS} /></div>
            <div className="space-y-1"><label className={labelClass}>Last Name *</label><input required name="lastName" type="text" className={inputClass} placeholder="Doe" {...FORM_FIELD_PROPS} /></div>
          </div>
          <div className="grid grid-cols-4 gap-3">
            <div className="space-y-1"><label className={labelClass}>Age *</label><input required name="age" type="number" className={inputClass} placeholder="30" {...FORM_FIELD_PROPS} /></div>
            <div className="space-y-1">
              <label className={labelClass}>Gender *</label>
              <select value={selectedGender} onChange={(e) => setSelectedGender(e.target.value)} className={inputClass} {...FORM_FIELD_PROPS}>
                <option value="Male">Male</option><option value="Female">Female</option><option value="Other">Other</option>
              </select>
            </div>
            <div className="space-y-1 col-span-2">
              <label className={labelClass}>Treatment Type *</label>
              <select name="treatmentType" value={selectedTreatmentType} onChange={(e) => setSelectedTreatmentType(e.target.value as TreatmentType)} className={inputClass} required {...FORM_FIELD_PROPS}>
                <option value="Allopathic">Allopathic</option>
                <option value="Homeopathic">Homeopathic</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1"><label className={labelClass}>Blood Group</label><input name="bloodGroup" type="text" className={inputClass} placeholder="B+" {...FORM_FIELD_PROPS} /></div>
            <div className="space-y-1"><label className={labelClass}>DOB</label><input name="dob" type="date" className={inputClass} {...FORM_FIELD_PROPS} /></div>
          </div>

          {selectedGender === "Female" && (
            <div className="p-3 bg-pink-50 border border-pink-100 rounded-lg space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-sm font-medium text-pink-800">Last Menstrual Period (LMP)</label>
                  <input name="lmp" type="date" className={inputClass} {...FORM_FIELD_PROPS} />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-pink-800">Cycle Length (days)</label>
                  <input name="menstrualCycleDays" type="number" className={inputClass} placeholder="28" {...FORM_FIELD_PROPS} />
                </div>
              </div>
            </div>
          )}

          {/* Contact */}
          <h4 className={sectionTitle}>Contact Details</h4>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1"><label className={labelClass}>Alternate Mobile</label><input name="alternateMobile" type="tel" className={inputClass} placeholder="Alternate number" {...FORM_FIELD_PROPS} /></div>
            <div className="space-y-1"><label className={labelClass}>Email</label><input name="email" type="email" className={inputClass} placeholder="patient@email.com" {...FORM_FIELD_PROPS} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1"><label className={labelClass}>Emergency Contact</label><input name="emergencyContact" type="tel" className={inputClass} placeholder="Emergency number" {...FORM_FIELD_PROPS} /></div>
            <div className="space-y-1"><label className={labelClass}>Occupation</label><input name="occupation" type="text" className={inputClass} placeholder="e.g. Teacher" {...FORM_FIELD_PROPS} /></div>
          </div>

          {/* Address */}
          <h4 className={sectionTitle}>Address</h4>
          <div className="space-y-1"><label className={labelClass}>Address Line</label><input name="addressLine1" type="text" className={inputClass} placeholder="House/Street/Area" {...FORM_FIELD_PROPS} /></div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1"><label className={labelClass}>City</label><input name="city" type="text" className={inputClass} placeholder="City" {...FORM_FIELD_PROPS} /></div>
            <div className="space-y-1"><label className={labelClass}>State</label><input name="state" type="text" className={inputClass} placeholder="Maharashtra" {...FORM_FIELD_PROPS} /></div>
            <div className="space-y-1"><label className={labelClass}>Pincode</label><input name="pincode" type="text" className={inputClass} placeholder="411001" {...FORM_FIELD_PROPS} /></div>
          </div>

          {/* Personal */}
          <h4 className={sectionTitle}>Personal & Medical</h4>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className={labelClass}>Marital Status</label>
              <select name="maritalStatus" className={inputClass} {...FORM_FIELD_PROPS}>
                <option value="">Select</option><option value="Single">Single</option><option value="Married">Married</option><option value="Divorced">Divorced</option><option value="Widowed">Widowed</option>
              </select>
            </div>
            <div className="space-y-1"><label className={labelClass}>Allergies</label><input name="allergies" type="text" className={inputClass} placeholder="e.g. Penicillin" {...FORM_FIELD_PROPS} /></div>
          </div>
          <div className="space-y-1"><label className={labelClass}>Chronic Diseases</label><input name="chronicDiseases" type="text" className={inputClass} placeholder="e.g. Diabetes, Hypertension" {...FORM_FIELD_PROPS} /></div>
          <div className="space-y-1"><label className={labelClass}>Notes</label><textarea name="notes" className="w-full p-3 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" rows={2} placeholder="Any additional notes..." {...FORM_FIELD_PROPS} /></div>

          {/* Current Medicines */}
          <div className="pt-3 border-t border-slate-100">
            <label className={labelClass + " block mb-3"}>Current Medicines</label>
            <PatientMedicines medicines={regMedicines} onMedicinesChange={setRegMedicines} />
          </div>

          <div className="pt-4 flex justify-end gap-2 sticky bottom-0 bg-white pb-1">
            <Button type="button" variant="outline" onClick={() => { setIsAddModalOpen(false); resetPatientFormState() }} disabled={isSaving}>Cancel</Button>
            <Button type="submit" disabled={isSaving}>{isSaving ? "Saving..." : "Register Patient"}</Button>
          </div>
        </form>
      </Modal>

      <div className="app-section p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input type="text" placeholder="Search by name, mobile, or case number..."
            value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full h-10 pl-10 pr-4 rounded-lg border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" {...FORM_FIELD_PROPS} />
        </div>
        <p className="mt-3 text-sm text-slate-500">{loading ? "Loading patients..." : `${patients.length} patients found`}</p>
      </div>

      {error && <div className="p-4 bg-red-50 text-red-700 rounded-lg text-sm">{error}</div>}

      {/* Desktop Table View */}
      <div className="hidden lg:block bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
            <tr>
              <th className="px-4 py-3">Case #</th>
              <th className="px-4 py-3">Patient</th>
              <th className="px-4 py-3">Mobile</th>
              <th className="px-4 py-3">Age/Gen</th>
              <th className="px-4 py-3">Blood</th>
              <th className="px-4 py-3">City</th>
              <th className="px-4 py-3">Latest Visit Details</th>
              <th className="px-4 py-3">Medicines</th>
              <th className="px-4 py-3">Khata</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {patients.map((patient) => {
              const treatmentType = getTreatmentType(patient.caseNumber, patient.treatmentType)
              const latestVisit = patient.id ? patientVisits[patient.id] : null

              return (
                <tr key={patient.id} onClick={() => router.push(`/patients/${patient.id}`)} className="hover:bg-slate-50 transition-colors cursor-pointer group">
                  <td className="px-4 py-3 text-blue-600">
                    <span className="font-bold">{patient.caseNumber}</span>
                    <Badge variant="outline" className={`ml-2 text-[10px] px-1.5 py-0 font-bold ${treatmentType === 'Homeopathic' ? 'border-green-200 text-green-700 bg-green-50' : 'border-blue-200 text-blue-700 bg-blue-50'}`}>
                      {treatmentType.substring(0, 5)}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                    {patient.photo ? (
                      <div className="relative h-8 w-8 overflow-hidden rounded-full border border-slate-200">
                        <Image src={patient.photo} alt="" fill unoptimized sizes="32px" className="object-cover" />
                      </div>
                    ) : (
                      <Avatar fallback={patient.fullName?.substring(0, 2).toUpperCase()} size="sm" />
                    )}
                      <div className="min-w-0">
                        <span className="font-medium text-slate-900 group-hover:text-blue-600 transition-colors block">{patient.fullName}</span>
                        {patient.allergies && <span className="text-xs text-red-500">Allergy: {patient.allergies}</span>}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{patient.mobileNumber}</td>
                  <td className="px-4 py-3 text-slate-600">{patient.age}{patient.gender?.[0] ? `/${patient.gender[0]}` : ""}</td>
                  <td className="px-4 py-3 text-slate-600">{patient.bloodGroup || "-"}</td>
                  <td className="px-4 py-3 text-slate-600">{patient.address?.city || "-"}</td>
                  <td className="px-4 py-3 text-xs">
                    {latestVisit ? (
                      <div className="space-y-1">
                        {latestVisit.complaints && <p className="text-slate-700"><span className="font-semibold">Complaints:</span> {latestVisit.complaints}</p>}
                        {latestVisit.diagnosis && <p className="text-slate-700"><span className="font-semibold">Diagnosis:</span> {latestVisit.diagnosis}</p>}
                        {latestVisit.vitals?.bp && <p className="text-slate-700"><span className="font-semibold">BP:</span> {latestVisit.vitals.bp}</p>}
                      </div>
                    ) : (
                      <span className="text-slate-400">No visit records</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {latestVisit && latestVisit.prescriptions && latestVisit.prescriptions.length > 0 ? (
                      <div className="space-y-1">
                        {latestVisit.prescriptions.slice(0, 2).map((med, idx) => (
                          <div key={idx} className="text-slate-700">
                            <p className="font-medium">{med.name}</p>
                            <p className="text-slate-500">{med.dosage} - {med.frequency}</p>
                          </div>
                        ))}
                        {latestVisit.prescriptions.length > 2 && (
                          <p className="text-blue-600 font-medium">+{latestVisit.prescriptions.length - 2} more</p>
                        )}
                      </div>
                    ) : (
                      <span className="text-slate-400">No medicines</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {(patient.khataBalance ?? 0) !== 0 ? (
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${(patient.khataBalance || 0) < 0 ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>
                        {(patient.khataBalance || 0) < 0 ? `Due ${formatCurrency(Math.abs(patient.khataBalance || 0))}` : `Advance ${formatCurrency(patient.khataBalance || 0)}`}
                      </span>
                    ) : <span className="text-xs text-slate-400">Clear</span>}
                  </td>
                </tr>
              )
            })}
            {!loading && patients.length === 0 && (
              <tr><td colSpan={9} className="px-6 py-12 text-center text-sm text-slate-500">No patients found. Add your first patient!</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile Card View */}
      <div className="lg:hidden space-y-3">
        {patients.map((patient) => {
          const treatmentType = getTreatmentType(patient.caseNumber, patient.treatmentType)
          const latestVisit = patient.id ? patientVisits[patient.id] : null

          return (
            <Link key={patient.id} href={`/patients/${patient.id}`} className="block bg-white rounded-2xl border border-slate-200 p-4 shadow-sm transition-[transform,box-shadow,border-color] duration-150 hover:-translate-y-0.5 hover:border-slate-300">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                {patient.photo ? (
                  <div className="relative h-10 w-10 overflow-hidden rounded-full border border-slate-200">
                    <Image src={patient.photo} alt="" fill unoptimized sizes="40px" className="object-cover" />
                  </div>
                ) : (
                  <Avatar fallback={patient.fullName?.substring(0, 2).toUpperCase()} size="md" />
                )}
                  <div>
                    <h3 className="font-medium text-slate-900">{patient.fullName}</h3>
                    <p className="text-sm text-slate-500 mt-0.5">{patient.mobileNumber}</p>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-slate-400" />
              </div>
              <div className="mt-3 flex items-center justify-between text-sm text-slate-600">
                <span>{patient.age} yrs | {patient.gender}{patient.bloodGroup ? ` | ${patient.bloodGroup}` : ""}</span>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className={`text-[10px] px-1.5 py-0 font-bold ${treatmentType === 'Homeopathic' ? 'border-green-200 text-green-700 bg-green-50' : 'border-blue-200 text-blue-700 bg-blue-50'}`}>
                    {treatmentType}
                  </Badge>
                  <span className="text-blue-600 font-bold">{patient.caseNumber}</span>
                </div>
              </div>
              
              {/* Latest Visit Details */}
              {latestVisit && (
                <div className="mt-3 p-3 bg-slate-50 rounded-lg text-xs space-y-2 border border-slate-100">
                  {latestVisit.complaints && (
                    <p><span className="font-semibold text-slate-700">Complaints:</span> <span className="text-slate-600">{latestVisit.complaints}</span></p>
                  )}
                  {latestVisit.diagnosis && (
                    <p><span className="font-semibold text-slate-700">Diagnosis:</span> <span className="text-slate-600">{latestVisit.diagnosis}</span></p>
                  )}
                  {latestVisit.vitals?.bp && (
                    <p><span className="font-semibold text-slate-700">BP:</span> <span className="text-slate-600">{latestVisit.vitals.bp}</span></p>
                  )}
                  {latestVisit.prescriptions && latestVisit.prescriptions.length > 0 && (
                    <div className="pt-2 border-t border-slate-200">
                      <p className="font-semibold text-slate-700 mb-1">Medicines:</p>
                      <div className="space-y-1">
                        {latestVisit.prescriptions.slice(0, 2).map((med, idx) => (
                          <p key={idx} className="text-slate-600">
                            <span className="font-medium">{med.name}</span>
                            <br />
                            <span className="text-slate-500">{med.dosage} - {med.frequency}</span>
                          </p>
                        ))}
                        {latestVisit.prescriptions.length > 2 && (
                          <p className="text-blue-600 font-medium">+{latestVisit.prescriptions.length - 2} more medicines</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
              
              {(patient.khataBalance ?? 0) !== 0 && (
                <div className="mt-3">
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${(patient.khataBalance || 0) < 0 ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>
                    Khata: {(patient.khataBalance || 0) < 0 ? `Due ${formatCurrency(Math.abs(patient.khataBalance || 0))}` : `Advance ${formatCurrency(patient.khataBalance || 0)}`}
                  </span>
                </div>
              )}

              {/* Quick Links */}
              <div className="mt-4 pt-4 border-t border-slate-100">
                <QuickLinks patientId={patient.id} compact={true} />
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}

