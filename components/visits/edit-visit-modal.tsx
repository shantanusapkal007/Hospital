"use client"

import { useState } from "react"
import { Trash2, Plus, AlertCircle, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Modal } from "@/components/ui/modal"
import { FORM_FIELD_PROPS, FORM_PROPS } from "@/lib/form-defaults"
import { updateVisit, getVisit } from "@/services/visit.service"
import { calculateEDD, validateMedicines } from "@/lib/visit-validators"
import type { Visit, Medicine } from "@/lib/types"

interface EditVisitModalProps {
  isOpen: boolean
  visit: Visit
  userId: string
  onClose: () => void
  onSaved: (updatedVisit: Visit) => void
}

export function EditVisitModal({ isOpen, visit, userId, onClose, onSaved }: EditVisitModalProps) {
  const [isSaving, setIsSaving] = useState(false)
  const [medicines, setMedicines] = useState<Medicine[]>(visit.prescriptions || [])
  const [showEDD, setShowEDD] = useState(false)
  const [errors, setErrors] = useState<string[]>([])

  const ic = "w-full h-10 px-3 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
  const secHead = "text-xs font-semibold text-slate-400 uppercase tracking-wider mt-4 mb-2 pt-3 border-t border-slate-100"

  const addMedicine = () => {
    setMedicines([...medicines, { name: "", dosage: "", frequency: "", days: 3 }])
  }

  const updateMedicine = (idx: number, field: keyof Medicine, val: string | number) => {
    const newMeds = [...medicines]
    newMeds[idx] = { ...newMeds[idx], [field]: val as any }
    setMedicines(newMeds)
  }

  const removeMedicine = (idx: number) => {
    setMedicines(medicines.filter((_, i) => i !== idx))
  }

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setErrors([])
    setIsSaving(true)

    const form = e.currentTarget
    const fd = new FormData(form)

    try {
      const diagnosis = (fd.get("diagnosis") as string)?.trim()
      const complaints = (fd.get("complaints") as string)?.trim()
      const notes = (fd.get("notes") as string)?.trim()
      const advice = (fd.get("advice") as string)?.trim()
      const lmp = fd.get("lmp") as string
      const followUpDate = fd.get("followUpDate") as string || ""

      // Validate required fields
      if (!complaints) {
        setErrors(["Complaints are required"])
        setIsSaving(false)
        return
      }

      if (!diagnosis) {
        setErrors(["Diagnosis is required"])
        setIsSaving(false)
        return
      }

      // Validate medicines
      const medicinesValidation = validateMedicines(medicines.length > 0 ? medicines : undefined)
      if (!medicinesValidation.valid) {
        setErrors(medicinesValidation.errors)
        setIsSaving(false)
        return
      }

      // Validate LMP
      if (lmp) {
        const lmpDate = new Date(lmp)
        const today = new Date()
        if (lmpDate > today) {
          setErrors(["LMP cannot be in the future"])
          setIsSaving(false)
          return
        }
      }

      // Validate follow-up date
      if (followUpDate) {
        const followUpDateObj = new Date(followUpDate)
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        if (followUpDateObj < today) {
          setErrors(["Follow-up date must be in the future"])
          setIsSaving(false)
          return
        }
      }

      const updateData: Partial<Visit> = {
        complaints,
        diagnosis,
        advice,
        prescriptions: medicines.length > 0 ? medicines : [],
        followUpDate: followUpDate || undefined,
      }

      await updateVisit(visit.id!, updateData, userId)

      // Fetch the real saved visit data from Database
      const savedVisit = await getVisit(visit.id!)
      if (savedVisit) {
        onSaved(savedVisit)
      }
      onClose()
    } catch (error: any) {
      setErrors([error.message || "Failed to update visit"])
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Edit Visit">
      <form className="space-y-4 max-h-[70vh] overflow-y-auto pr-2" onSubmit={handleSave} {...FORM_PROPS}>
        {/* Error Messages */}
        {errors.length > 0 && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg space-y-1">
            {errors.map((error, idx) => (
              <div key={idx} className="flex gap-2 text-sm text-red-700">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            ))}
          </div>
        )}

        {/* Complaints & Diagnosis */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700">Complaints</label>
          <textarea
            name="complaints"
            defaultValue={visit.complaints}
            className="w-full p-3 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            rows={2}
            required
            {...FORM_FIELD_PROPS}
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700">Diagnosis</label>
          <textarea
            name="diagnosis"
            defaultValue={visit.diagnosis}
            className="w-full p-3 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            rows={2}
            required
            {...FORM_FIELD_PROPS}
          />
        </div>

        {/* Medicines */}
        <div className="space-y-3">
          <h3 className={secHead}>Medicines</h3>
          {medicines.length === 0 ? (
            <div className="text-sm text-slate-500 italic">No medicines added yet</div>
          ) : (
            <div className="space-y-3 bg-slate-50 p-3 rounded-lg border border-slate-200">
              {medicines.map((med, idx) => (
                <div key={idx} className="bg-white p-3 rounded-lg border border-slate-200 space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs font-medium text-slate-600">Medicine Name</label>
                      <input
                        type="text"
                        value={med.name}
                        onChange={(e) => updateMedicine(idx, "name", e.target.value)}
                        placeholder="e.g., Tab Paracetamol 500mg"
                        className={ic}
                        required
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-slate-600">Dosage</label>
                      <input
                        type="text"
                        value={med.dosage}
                        onChange={(e) => updateMedicine(idx, "dosage", e.target.value)}
                        placeholder="e.g., 1-0-1"
                        className={ic}
                        required
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs font-medium text-slate-600">Frequency</label>
                      <input
                        type="text"
                        value={med.frequency}
                        onChange={(e) => updateMedicine(idx, "frequency", e.target.value)}
                        placeholder="e.g., BD, TDS"
                        className={ic}
                        required
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-slate-600">Days</label>
                      <input
                        type="number"
                        value={med.days}
                        onChange={(e) => updateMedicine(idx, "days", Number(e.target.value))}
                        className={ic}
                        min="1"
                        required
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-600">Notes (Optional)</label>
                    <input
                      type="text"
                      value={med.notes || ""}
                      onChange={(e) => updateMedicine(idx, "notes", e.target.value)}
                      placeholder="e.g., After meals"
                      className={ic}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => removeMedicine(idx)}
                    className="flex items-center gap-2 text-sm text-red-600 hover:text-red-700 hover:bg-red-50 px-2 py-1 rounded transition-colors"
                  >
                    <Trash2 className="w-4 h-4" /> Remove
                  </button>
                </div>
              ))}
            </div>
          )}
          <button
            type="button"
            onClick={addMedicine}
            className="flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 px-3 py-2 rounded transition-colors"
          >
            <Plus className="w-4 h-4" /> Add Medicine
          </button>
        </div>

        {/* Advice */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700">Advice</label>
          <textarea
            name="advice"
            defaultValue={visit.advice}
            className="w-full p-3 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            rows={2}
            placeholder="Patient advice, lifestyle changes, etc."
            {...FORM_FIELD_PROPS}
          />
        </div>

        {/* Follow-up Date */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700">Follow-up Date</label>
          <input
            type="date"
            name="followUpDate"
            defaultValue={visit.followUpDate || ""}
            className={ic}
            {...FORM_FIELD_PROPS}
          />
        </div>

        {/* Action Buttons */}
        <div className="pt-4 flex justify-end gap-2 sticky bottom-0 bg-white pb-1 border-t border-slate-100">
          <Button type="button" variant="outline" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSaving}>
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving...
              </>
            ) : (
              "Save Changes"
            )}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
