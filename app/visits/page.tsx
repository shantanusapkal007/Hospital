"use client"

import { useState, useEffect, useRef, startTransition } from "react"
import { Pill, Plus, Activity, Thermometer, Heart, Wind, ImagePlus, Loader2, XCircle, Printer } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Modal } from "@/components/ui/modal"
import { VisitImageGallery } from "@/components/visits/visit-image-gallery"
import { FORM_FIELD_PROPS, FORM_PROPS } from "@/lib/form-defaults"
import { useDebouncedValue } from "@/lib/use-debounced-value"
import Image from "next/image"
import { getVisits, addVisit, updateVisitImages } from "@/services/visit.service"
import { searchPatients, addPatient, getNextPatientCaseNumber, getPatient } from "@/services/patient.service"
import { uploadFilesToStorage, validateImageFiles } from "@/services/storage.service"
import type { Visit, Patient, Medicine } from "@/lib/types"
import { useToast } from "@/components/ui/toast"

const ic = "w-full h-10 px-3 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
const lbl = "text-sm font-medium text-slate-700"
const secHead = "text-xs font-semibold text-slate-400 uppercase tracking-wider mt-2 mb-1 pt-3 border-t border-slate-100"

function parseOptionalInteger(value: FormDataEntryValue | null) {
  const input = String(value ?? "").trim()
  if (!input) return undefined

  const parsed = Number.parseInt(input, 10)
  return Number.isFinite(parsed) ? parsed : undefined
}

function parseOptionalFloat(value: FormDataEntryValue | null) {
  const input = String(value ?? "").trim()
  if (!input) return undefined

  const parsed = Number.parseFloat(input)
  return Number.isFinite(parsed) ? parsed : undefined
}

export default function VisitsPage() {
  const [medicines, setMedicines] = useState<Medicine[]>([])

  const RX_TEMPLATES: Record<string, Medicine[]> = {
    Fever: [
      { name: "Tab Paracetamol 500mg", dosage: "1-0-1", frequency: "BD", days: 3 },
      { name: "Tab Pantoprazole 40mg", dosage: "1-0-0", frequency: "OD AC", days: 3 }
    ],
    Cold: [
      { name: "Tab Cetirizine 10mg", dosage: "0-0-1", frequency: "HS", days: 5 },
      { name: "Syp Cough Expectorant", dosage: "5ml", frequency: "TDS", days: 5 }
    ],
    Diabetes: [
      { name: "Tab Metformin 500mg", dosage: "1-0-1", frequency: "BD", days: 30 }
    ],
    BP: [
      { name: "Tab Amlodipine 5mg", dosage: "1-0-0", frequency: "OD", days: 30 }
    ]
  }

  const addMedicine = () => setMedicines([...medicines, { name: "", dosage: "", frequency: "", days: 3 }])
  const updateMedicine = (idx: number, field: keyof Medicine, val: string | number) => { 
    const newMeds = [...medicines]; 
    newMeds[idx] = { ...newMeds[idx], [field]: val as never }; 
    setMedicines(newMeds); 
  }
  const removeMedicine = (idx: number) => setMedicines(medicines.filter((_, i) => i !== idx))
  const applyTemplate = (temp: Medicine[]) => setMedicines(temp.map(m => ({ ...m })))

  const setQuickFollowUp = (days: number) => {
    const d = new Date()
    d.setDate(d.getDate() + days)
    const el = document.getElementsByName("followUpDate")[0] as HTMLInputElement
    if (el) el.value = d.toISOString().split("T")[0]
  }

  const handlePrint = (visit: Visit) => {
    const printContent = `
      <html><head><title>Prescription</title>
      <style>
        body { font-family: sans-serif; padding: 40px; color: #0f172a; }
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
        .section { margin-top: 30px; font-size: 14px;}
      </style>
      </head><body>
        <div class="header">
          <h1>${process.env.NEXT_PUBLIC_APP_NAME || 'OPD Clinic'}</h1>
          <h3>Dr. Consultant Physician • MBBS, MD</h3>
        </div>
        <div class="pat-info">
          <div><strong>Patient:</strong> ${visit.patientName}</div>
          <div><strong>Date:</strong> ${visit.createdAt?.toDate ? visit.createdAt.toDate().toLocaleDateString() : new Date().toLocaleDateString()}</div>
        </div>
        <div class="rx-title">Rx</div>
        <table>
          <thead><tr><th>Medicine</th><th>Dose</th><th>Frequency</th><th>Duration</th></tr></thead>
          <tbody>
            ${visit.prescriptions?.map(p => `<tr><td><strong>${p.name}</strong>${p.notes ? `<span class="notes">${p.notes}</span>` : ''}</td><td>${p.dosage}</td><td>${p.frequency}</td><td>${p.days} Days</td></tr>`).join('')}
          </tbody>
        </table>
        
        ${visit.advice ? `<div class="section"><strong>Advice & Instructions:</strong> <p>${visit.advice}</p></div>` : ''}
        ${visit.followUpDate ? `<div><strong>Follow Up:</strong> ${new Date(visit.followUpDate).toLocaleDateString()}</div>` : ''}

        <div class="footer"><div class="sig">Doctor Signature</div></div>
      </body></html>
    `;
    const printWin = window.open('', '', 'width=800,height=600');
    if (printWin) {
      printWin.document.write(printContent);
      printWin.document.close();
      printWin.focus();
      printWin.print();
      printWin.close();
    }
  }
  const [isVisitModalOpen, setIsVisitModalOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [visits, setVisits] = useState<Visit[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const { showToast } = useToast()

  const [patientSearch, setPatientSearch] = useState("")
  const [patientResults, setPatientResults] = useState<Patient[]>([])
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null)
  const [isQuickAddPatient, setIsQuickAddPatient] = useState(false)
  const [nextCaseNumber, setNextCaseNumber] = useState("")
  const debouncedPatientSearch = useDebouncedValue(patientSearch, 120)
  const [visitImageFiles, setVisitImageFiles] = useState<File[]>([])
  const [visitImagePreviews, setVisitImagePreviews] = useState<string[]>([])
  const [uploadedVisitImageUrls, setUploadedVisitImageUrls] = useState<string[]>([])
  const [isUploadingImages, setIsUploadingImages] = useState(false)
  const [visitImageUploadProgress, setVisitImageUploadProgress] = useState(0)
  const [uploadError, setUploadError] = useState("")

  const imageInputRef = useRef<HTMLInputElement>(null)
  const visitImageUploadPromiseRef = useRef<Promise<string[]> | null>(null)
  const visitImageUploadTokenRef = useRef(0)

  const fetchVisits = async () => {
    setLoading(true)
    try {
      const data = await getVisits()
      setVisits(data)
      setError("")
    } catch (e) {
      setError("Failed to load visits.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchVisits() }, [])

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

  useEffect(() => {
    return () => {
      visitImagePreviews.forEach((preview) => URL.revokeObjectURL(preview))
    }
  }, [visitImagePreviews])

  const revokeVisitImagePreviews = (previews: string[]) => {
    previews.forEach((preview) => URL.revokeObjectURL(preview))
  }

  const uploadVisitImages = (files: File[]) => {
    if (files.length === 0) {
      visitImageUploadPromiseRef.current = null
      setUploadedVisitImageUrls([])
      setVisitImageUploadProgress(0)
      setIsUploadingImages(false)
      return Promise.resolve<string[]>([])
    }

    const uploadToken = visitImageUploadTokenRef.current + 1
    visitImageUploadTokenRef.current = uploadToken
    setUploadedVisitImageUrls([])
    setVisitImageUploadProgress(0)
    setIsUploadingImages(true)
    setUploadError("")

    let uploadPromise: Promise<string[]>
    uploadPromise = uploadFilesToStorage(files, "visit-images", (progress) => {
      if (visitImageUploadTokenRef.current !== uploadToken) return
      setVisitImageUploadProgress(progress)
    })
      .then((urls) => {
        if (visitImageUploadTokenRef.current === uploadToken) {
          setUploadedVisitImageUrls(urls)
          setVisitImageUploadProgress(100)
        }
        return urls
      })
      .catch(() => {
        if (visitImageUploadTokenRef.current === uploadToken) {
          setUploadedVisitImageUrls([])
          setUploadError("Failed to upload visit images. Please try again.")
        }
        throw new Error("Failed to upload visit images.")
      })
      .finally(() => {
        if (visitImageUploadTokenRef.current === uploadToken) {
          setIsUploadingImages(false)
        }

        if (visitImageUploadPromiseRef.current === uploadPromise) {
          visitImageUploadPromiseRef.current = null
        }
      })

    visitImageUploadPromiseRef.current = uploadPromise
    return uploadPromise
  }

  const resetVisitFormState = () => {
    visitImageUploadTokenRef.current += 1
    visitImageUploadPromiseRef.current = null
    setSelectedPatient(null)
    setPatientSearch("")
    setPatientResults([])
    setIsQuickAddPatient(false)
    setNextCaseNumber("")
    setVisitImageFiles([])
    setUploadedVisitImageUrls([])
    setVisitImageUploadProgress(0)
    setIsUploadingImages(false)
    revokeVisitImagePreviews(visitImagePreviews)
    setVisitImagePreviews([])
    setUploadError("")
    setMedicines([])
    if (imageInputRef.current) {
      imageInputRef.current.value = ""
    }
  }

  const handleVisitImagesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    try {
      const files = Array.from(e.target.files ?? [])
      if (files.length === 0) return

      validateImageFiles(files, 10)
      revokeVisitImagePreviews(visitImagePreviews)
      setVisitImageFiles(files)
      setVisitImagePreviews(files.map((file) => URL.createObjectURL(file)))
      setUploadError("")
      uploadVisitImages(files).catch(() => undefined)
    } catch (error: any) {
      visitImageUploadTokenRef.current += 1
      visitImageUploadPromiseRef.current = null
      setVisitImageFiles([])
      setUploadedVisitImageUrls([])
      setVisitImageUploadProgress(0)
      setIsUploadingImages(false)
      revokeVisitImagePreviews(visitImagePreviews)
      setVisitImagePreviews([])
      setUploadError(error.message || "Invalid visit images.")
      if (imageInputRef.current) {
        imageInputRef.current.value = ""
      }
    }
  }

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!selectedPatient) { showToast("Please select a patient", "warning"); return }

    setIsSaving(true)
    setUploadError("")

    const form = e.currentTarget
    const fd = new FormData(form)
    
    const prescriptionsToSave = medicines.filter(m => m.name.trim() !== "");

    try {
      if (!(fd.get("complaints") as string)?.trim()) {
        throw new Error("Chief complaints are required.")
      }

      let visitImages = uploadedVisitImageUrls
      const vitals = {
        bp: (fd.get("bp") as string || "").trim(),
        weight: parseOptionalInteger(fd.get("weight")),
        height: parseOptionalInteger(fd.get("height")),
        temperature: parseOptionalFloat(fd.get("temperature")),
        pulse: parseOptionalInteger(fd.get("pulse")),
        spo2: parseOptionalInteger(fd.get("spo2")),
        respiratoryRate: parseOptionalInteger(fd.get("respiratoryRate")),
      }

      const cleanedVitals = Object.fromEntries(
        Object.entries(vitals).filter(([, value]) => value !== undefined && value !== "")
      )

      if (visitImageFiles.length > 0) {
        try {
          validateImageFiles(visitImageFiles, 10)
          if (visitImages.length !== visitImageFiles.length) {
            const pendingUpload = visitImageUploadPromiseRef.current ?? uploadVisitImages(visitImageFiles)
            visitImages = await pendingUpload
          }
        } catch {
          throw new Error("Failed to upload visit images.")
        }
      }

      const newVisitId = await addVisit({
        patientId: selectedPatient.id!,
        patientName: selectedPatient.fullName,
        visitImages: visitImages,
        complaints: fd.get("complaints") as string || "",
        historyOfPresentIllness: fd.get("hpi") as string || "",
        pastHistory: fd.get("pastHistory") as string || "",
        familyHistory: fd.get("familyHistory") as string || "",
        examinationFindings: fd.get("examination") as string || "",
        diagnosis: fd.get("diagnosis") as string || "",
        totalBill: parseInt(fd.get("totalBill") as string) || 0,
        labTests: fd.get("labTests") as string || "",
        investigationsAdvised: fd.get("investigations") as string || "",
        advice: fd.get("advice") as string || "",
        referral: fd.get("referral") as string || "",
        followUpDate: fd.get("followUpDate") as string || "",
        paymentStatus: (fd.get("paymentStatus") as "paid" | "unpaid") || "unpaid",
        prescriptions: prescriptionsToSave,
        vitals: cleanedVitals,
      })



      if (typeof form.reset === "function") {
        form.reset()
      }
      setIsVisitModalOpen(false)
      resetVisitFormState()
      fetchVisits()
    } catch (e: any) {
      showToast(e.message || "Failed to record visit.", "error")
    } finally {
      setIsUploadingImages(false)
      setIsSaving(false)
    }
  }

  return (
    <div className="space-y-6 h-full flex flex-col">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Visits & Case Records</h1>
          <p className="text-sm text-slate-500">Manage patient visit history and prescriptions</p>
        </div>
        <Button className="w-full sm:w-auto" onClick={() => setIsVisitModalOpen(true)}>
          <Plus className="w-4 h-4 mr-2" /> New Visit
        </Button>
      </div>

      <Modal
        isOpen={isVisitModalOpen}
        onClose={() => { setIsVisitModalOpen(false); resetVisitFormState() }}
        title="Record New Visit (Case Paper)"
      >
        <form className="space-y-3 max-h-[75vh] overflow-y-auto pr-2" onSubmit={handleSave} {...FORM_PROPS}>

          {/* Patient Selection */}
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
                <label className={lbl}>Patient Name *</label>
                {!selectedPatient && (
                  <button type="button" onClick={() => setIsQuickAddPatient(true)} className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center"><Plus className="w-3 h-3 mr-1" /> New Patient</button>
                )}
              </div>
              <input
                type="text"
                value={selectedPatient ? selectedPatient.fullName : patientSearch}
                onChange={(e) => { setPatientSearch(e.target.value); setSelectedPatient(null) }}
                className={ic}
                placeholder="Search patient..."
                {...FORM_FIELD_PROPS}
              />
              {patientResults.length > 0 && !selectedPatient && (
                <div className="border border-slate-200 rounded-lg max-h-32 overflow-y-auto bg-white shadow-lg">
                  {patientResults.map((patient) => (
                    <button
                      type="button"
                      key={patient.id}
                      onClick={() => { setSelectedPatient(patient); setPatientSearch(""); setPatientResults([]) }}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50"
                    >
                      {patient.fullName} - {patient.mobileNumber}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Vitals Section */}
          <h4 className={secHead}>Vitals</h4>
          <div className="grid grid-cols-4 gap-3">
            <div className="space-y-1"><label className={lbl}>BP</label><input name="bp" className={ic} placeholder="120/80" {...FORM_FIELD_PROPS} /></div>
            <div className="space-y-1"><label className={lbl}>Pulse (bpm)</label><input name="pulse" type="number" className={ic} placeholder="72" {...FORM_FIELD_PROPS} /></div>
            <div className="space-y-1"><label className={lbl}>Temp (F)</label><input name="temperature" type="number" step="0.1" className={ic} placeholder="98.6" {...FORM_FIELD_PROPS} /></div>
            <div className="space-y-1"><label className={lbl}>SpO2 (%)</label><input name="spo2" type="number" className={ic} placeholder="98" {...FORM_FIELD_PROPS} /></div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1"><label className={lbl}>Weight (kg)</label><input name="weight" type="number" className={ic} placeholder="70" {...FORM_FIELD_PROPS} /></div>
            <div className="space-y-1"><label className={lbl}>Height (cm)</label><input name="height" type="number" className={ic} placeholder="170" {...FORM_FIELD_PROPS} /></div>
            <div className="space-y-1"><label className={lbl}>Resp Rate</label><input name="respiratoryRate" type="number" className={ic} placeholder="16" {...FORM_FIELD_PROPS} /></div>
          </div>

          {/* Clinical History */}
          <h4 className={secHead}>History & Complaints</h4>
          <div className="space-y-1"><label className={lbl}>Chief Complaints *</label><textarea required name="complaints" className="w-full p-3 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" rows={2} placeholder="Fever since 3 days, headache, body ache..." {...FORM_FIELD_PROPS} /></div>
          <div className="space-y-1"><label className={lbl}>History of Present Illness</label><textarea name="hpi" className="w-full p-3 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" rows={2} placeholder="Detailed history of current illness..." {...FORM_FIELD_PROPS} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1"><label className={lbl}>Past History</label><input name="pastHistory" className={ic} placeholder="Previous surgeries, illnesses..." {...FORM_FIELD_PROPS} /></div>
            <div className="space-y-1"><label className={lbl}>Family History</label><input name="familyHistory" className={ic} placeholder="Diabetes in family, etc" {...FORM_FIELD_PROPS} /></div>
          </div>

          {/* Examination & Diagnosis */}
          <h4 className={secHead}>Examination & Diagnosis</h4>
          <div className="space-y-1"><label className={lbl}>Examination Findings</label><textarea name="examination" className="w-full p-3 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" rows={2} placeholder="On examination: Throat congested, abdomen soft..." {...FORM_FIELD_PROPS} /></div>
          <div className="space-y-1"><label className={lbl}>Diagnosis *</label><input required name="diagnosis" className={ic} placeholder="Acute Viral Fever" {...FORM_FIELD_PROPS} /></div>

          {/* Structured Prescription */}
          <div className="flex items-center justify-between border-t border-slate-100 mt-2 mb-1 pt-3">
             <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Prescription (Rx)</h4>
             <div className="flex gap-2">
                {Object.keys(RX_TEMPLATES).map(k => (
                  <button type="button" key={k} onClick={() => applyTemplate(RX_TEMPLATES[k])} className="text-[10px] font-medium bg-slate-100 hover:bg-slate-200 text-slate-600 px-2 py-0.5 rounded uppercase">{k}</button>
                ))}
             </div>
          </div>
          <div className="space-y-2 border border-slate-200 rounded-lg overflow-hidden bg-slate-50 p-2">
             {medicines.length === 0 && <p className="text-xs text-center text-slate-400 py-2">No medicines added. Select a template or add manually.</p>}
             {medicines.map((med, idx) => (
                <div key={idx} className="flex gap-2 items-start bg-white p-2 rounded shadow-sm border border-slate-100">
                   <div className="flex-1 space-y-2">
                      <div className="grid grid-cols-12 gap-2">
                         <input className="col-span-12 sm:col-span-5 h-8 px-2 border border-slate-200 rounded text-sm focus:ring-1 focus:ring-blue-500" placeholder="Medicine Name" value={med.name} onChange={e => updateMedicine(idx, 'name', e.target.value)} />
                         <input className="col-span-4 sm:col-span-2 h-8 px-2 border border-slate-200 rounded text-sm focus:ring-1 focus:ring-blue-500" placeholder="Dose (1-0-1)" value={med.dosage} onChange={e => updateMedicine(idx, 'dosage', e.target.value)} />
                         <input className="col-span-4 sm:col-span-2 h-8 px-2 border border-slate-200 rounded text-sm focus:ring-1 focus:ring-blue-500" placeholder="Freq (BD)" value={med.frequency} onChange={e => updateMedicine(idx, 'frequency', e.target.value)} />
                         <div className="col-span-4 sm:col-span-3 flex items-center gap-1"><input type="number" className="w-full h-8 px-2 border border-slate-200 rounded text-sm focus:ring-1 focus:ring-blue-500" placeholder="Days" value={med.days || ""} onChange={e => updateMedicine(idx, 'days', parseInt(e.target.value) || 0)} /><span className="text-xs text-slate-500">d</span></div>
                      </div>
                      <input className="w-full h-8 px-2 border border-slate-200 rounded text-xs focus:ring-1 focus:ring-blue-500" placeholder="Notes (e.g., After food)" value={med.notes || ""} onChange={e => updateMedicine(idx, 'notes', e.target.value)} />
                   </div>
                   <button type="button" onClick={() => removeMedicine(idx)} className="text-slate-300 hover:text-red-500 p-1"><XCircle className="w-5 h-5" /></button>
                </div>
             ))}
             <Button type="button" variant="ghost" size="sm" onClick={addMedicine} className="w-full text-blue-600 text-xs mt-1 border border-dashed border-blue-200 bg-blue-50/50 hover:bg-blue-50 focus:ring-0"><Plus className="w-3 h-3 mr-1"/> Add Medicine</Button>
          </div>

          {/* Investigations */}
          <h4 className={secHead}>Investigations & Lab</h4>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1"><label className={lbl}>Lab Tests Done</label><input name="labTests" className={ic} placeholder="CBC, Urine, X-ray..." {...FORM_FIELD_PROPS} /></div>
            <div className="space-y-1"><label className={lbl}>Investigations Advised</label><input name="investigations" className={ic} placeholder="MRI, Blood Sugar..." {...FORM_FIELD_PROPS} /></div>
          </div>

          {/* Visit Images */}
          <h4 className={secHead}>Visit Images</h4>
          <div className="space-y-2">
            <input ref={imageInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleVisitImagesChange} />
            <div className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-medium text-slate-700">Attach case images</p>
                <p className="text-xs text-slate-500">
                  {visitImageFiles.length === 0
                    ? "Upload multiple images before saving this visit."
                    : isUploadingImages
                      ? `${visitImageFiles.length} image${visitImageFiles.length > 1 ? "s" : ""} uploading in background`
                      : uploadedVisitImageUrls.length === visitImageFiles.length
                        ? `${visitImageFiles.length} image${visitImageFiles.length > 1 ? "s" : ""} ready`
                        : `${visitImageFiles.length} image${visitImageFiles.length > 1 ? "s" : ""} selected`}
                </p>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={() => imageInputRef.current?.click()}>
                <ImagePlus className="w-4 h-4 mr-2" /> Choose Images
              </Button>
            </div>
            {visitImagePreviews.length > 0 && (
              <div className="grid grid-cols-3 gap-2">
                {visitImagePreviews.map((preview, index) => (
                  <div key={`${preview}-${index}`} className="relative h-24 overflow-hidden rounded-lg border border-slate-200 bg-white">
                    <Image src={preview} alt={`Visit preview ${index + 1}`} fill unoptimized sizes="(max-width: 640px) 33vw, 160px" className="object-cover" />
                  </div>
                ))}
              </div>
            )}
            {isUploadingImages && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs font-medium text-blue-600">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Uploading {visitImageFiles.length} visit image{visitImageFiles.length > 1 ? "s" : ""}... {visitImageUploadProgress}%
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-slate-200">
                  <div
                    className="h-full rounded-full bg-blue-500 transition-[width] duration-150"
                    style={{ width: `${visitImageUploadProgress}%` }}
                  />
                </div>
              </div>
            )}
            {uploadError && <p className="text-xs font-medium text-red-600">{uploadError}</p>}
          </div>

          {/* Advice & Follow Up */}
          <h4 className={secHead}>Advice & Follow-up</h4>
          <div className="space-y-1"><label className={lbl}>Advice / Instructions</label><textarea name="advice" className="w-full p-3 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" rows={2} placeholder="Take rest, drink fluids, avoid oily food..." {...FORM_FIELD_PROPS} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
               <div className="flex items-center justify-between"><label className={lbl}>Follow-up Date</label><div className="flex gap-1">{[3,5,7].map(d => <button type="button" key={d} onClick={() => setQuickFollowUp(d)} className="text-[10px] bg-slate-100 hover:bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded focus:outline-none">+{d}d</button>)}</div></div>
               <input name="followUpDate" type="date" className={ic} {...FORM_FIELD_PROPS} />
            </div>
            <div className="space-y-1"><label className={lbl}>Referral (if any)</label><input name="referral" className={ic} placeholder="Dr. XYZ, Cardiologist" {...FORM_FIELD_PROPS} /></div>
          </div>

          {/* Billing */}
          <div className="p-3 bg-red-50 border border-red-100 rounded-lg mt-2 space-y-3">
            <label className="text-sm font-semibold text-red-800 block">Billing Details</label>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-red-800">Total Bill (Rs.)</label>
                <input name="totalBill" type="number" className="w-full h-10 px-3 rounded border border-red-200 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 bg-white" placeholder="500" {...FORM_FIELD_PROPS} />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-red-800">Payment Status</label>
                <select name="paymentStatus" defaultValue="unpaid" className="w-full h-10 px-3 rounded border border-red-200 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 bg-white" {...FORM_FIELD_PROPS}>
                  <option value="unpaid">Unpaid (Add to Khata)</option>
                  <option value="paid">Paid (Instantly)</option>
                </select>
              </div>
            </div>
          </div>

          <div className="pt-4 flex justify-end gap-2 sticky bottom-0 bg-white pb-1">
            <Button type="button" variant="outline" onClick={() => { setIsVisitModalOpen(false); resetVisitFormState() }} disabled={isSaving}>Cancel</Button>
            <Button type="submit" disabled={isSaving}>{isUploadingImages ? `Uploading ${visitImageUploadProgress}%...` : isSaving ? "Saving..." : "Save Visit"}</Button>
          </div>
        </form>
      </Modal>

      {loading ? (
        <div className="py-20 text-center text-slate-500 flex-1">Loading visits...</div>
      ) : visits.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center py-20 bg-white rounded-xl border border-slate-200 border-dashed">
          <div className="w-16 h-16 rounded-full bg-blue-50 flex items-center justify-center mb-4">
            <Pill className="w-8 h-8 text-blue-600" />
          </div>
          <h3 className="text-lg font-semibold text-slate-900 mb-2">No visits recorded</h3>
          <p className="text-sm text-slate-500 max-w-sm text-center mb-6">
            Start by selecting a patient and recording their visit details, vitals, and medicines.
          </p>
          <Button onClick={() => setIsVisitModalOpen(true)}>Record New Visit</Button>
        </div>
      ) : (
        <div className="space-y-4">
          {error && <div className="rounded-lg bg-red-50 p-4 text-sm text-red-700">{error}</div>}
          {visits.map((visit) => (
            <div key={visit.id} className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">{visit.patientName}</h3>
                  <p className="text-xs text-slate-500">{visit.createdAt?.toDate ? visit.createdAt.toDate().toLocaleDateString() : ''}</p>
                </div>
                {visit.totalBill !== undefined && visit.totalBill > 0 && (
                  <span className="text-sm font-bold text-red-600 bg-red-50 px-3 py-1 rounded-lg">Rs.{visit.totalBill}</span>
                )}
              </div>

              {/* Vitals Row */}
              {visit.vitals && (
                <div className="flex flex-wrap gap-3 p-3 bg-slate-50 rounded-lg mb-4 text-sm text-slate-700">
                  {visit.vitals.bp && <span className="flex items-center gap-1"><Activity className="w-3.5 h-3.5 text-red-400" />BP: {visit.vitals.bp}</span>}
                  {visit.vitals.pulse && <span className="flex items-center gap-1"><Heart className="w-3.5 h-3.5 text-pink-400" />Pulse: {visit.vitals.pulse}</span>}
                  {visit.vitals.temperature && <span className="flex items-center gap-1"><Thermometer className="w-3.5 h-3.5 text-orange-400" />Temp: {visit.vitals.temperature}F</span>}
                  {visit.vitals.spo2 && <span>SpO2: {visit.vitals.spo2}%</span>}
                  {visit.vitals.weight && <span>Wt: {visit.vitals.weight}kg</span>}
                  {visit.vitals.height && <span>Ht: {visit.vitals.height}cm</span>}
                  {visit.vitals.respiratoryRate && <span className="flex items-center gap-1"><Wind className="w-3.5 h-3.5 text-blue-400" />RR: {visit.vitals.respiratoryRate}</span>}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                {visit.complaints && (
                  <div><h4 className="text-xs font-semibold text-slate-400 uppercase">Chief Complaints</h4><p className="text-slate-800 mt-0.5">{visit.complaints}</p></div>
                )}
                {visit.historyOfPresentIllness && (
                  <div><h4 className="text-xs font-semibold text-slate-400 uppercase">HPI</h4><p className="text-slate-800 mt-0.5">{visit.historyOfPresentIllness}</p></div>
                )}
                {visit.examinationFindings && (
                  <div><h4 className="text-xs font-semibold text-slate-400 uppercase">Examination</h4><p className="text-slate-800 mt-0.5">{visit.examinationFindings}</p></div>
                )}
                <div><h4 className="text-xs font-semibold text-slate-400 uppercase">Diagnosis</h4><p className="text-slate-900 font-medium mt-0.5">{visit.diagnosis}</p></div>
              </div>

              {visit.prescriptions?.length > 0 && (
                <div className="mt-4 pt-3 border-t border-slate-200 print-rx">
                  <h4 className="text-xs font-semibold text-slate-400 uppercase mb-3 flex items-center justify-between">
                     <span>Rx (Prescription)</span>
                     <Button variant="ghost" size="sm" className="h-6 text-[10px] hidden sm:flex border border-slate-200" onClick={() => handlePrint(visit)}><Printer className="w-3 h-3 mr-1"/> Print PDF</Button>
                  </h4>
                  <div className="overflow-x-auto border border-slate-100 rounded-lg">
                    <table className="w-full text-sm text-left">
                      <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                        <tr>
                          <th className="px-3 py-2 font-semibold">Medicine</th>
                          <th className="px-3 py-2 font-semibold text-center">Dose</th>
                          <th className="px-3 py-2 font-semibold text-center">Freq</th>
                          <th className="px-3 py-2 font-semibold text-center">Duration</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {visit.prescriptions.map((px, i) => (
                          <tr key={i} className="bg-white">
                            <td className="px-3 py-2 font-medium text-slate-800">
                               {px.name}
                               {px.notes && <span className="block text-[10px] font-normal text-slate-500 mt-0.5">{px.notes}</span>}
                            </td>
                            <td className="px-3 py-2 text-center text-slate-600">{px.dosage}</td>
                            <td className="px-3 py-2 text-center text-slate-600">{px.frequency}</td>
                            <td className="px-3 py-2 text-center text-slate-600">{px.days} days</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {(visit.labTests || visit.investigationsAdvised || visit.advice || visit.referral || visit.followUpDate) && (
                <div className="mt-3 pt-3 border-t border-slate-100 grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                  {visit.labTests && <div><span className="text-xs font-semibold text-slate-400 uppercase block">Lab Tests</span><span className="text-slate-700">{visit.labTests}</span></div>}
                  {visit.investigationsAdvised && <div><span className="text-xs font-semibold text-slate-400 uppercase block">Investigations</span><span className="text-slate-700">{visit.investigationsAdvised}</span></div>}
                  {visit.advice && <div><span className="text-xs font-semibold text-slate-400 uppercase block">Advice</span><span className="text-slate-700">{visit.advice}</span></div>}
                  {visit.referral && <div><span className="text-xs font-semibold text-slate-400 uppercase block">Referral</span><span className="text-slate-700">{visit.referral}</span></div>}
                  {visit.followUpDate && <div><span className="text-xs font-semibold text-slate-400 uppercase block">Follow-up</span><span className="text-blue-600 font-medium">{visit.followUpDate}</span></div>}
                </div>
              )}

              <VisitImageGallery images={visit.visitImages} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
