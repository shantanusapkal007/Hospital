"use client"

import { useState } from "react"
import { Plus, Trash2, Edit2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Medicine } from "@/lib/types"
import { useToast } from "@/components/ui/toast"

interface PatientMedicinesProps {
  medicines: Medicine[] | undefined
  onMedicinesChange: (medicines: Medicine[]) => void
  readOnly?: boolean
}

export function PatientMedicines({ medicines = [], onMedicinesChange, readOnly = false }: PatientMedicinesProps) {
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [formData, setFormData] = useState<Medicine | null>(null)
  const { showToast } = useToast()

  const meds = medicines || []

  const handleAdd = () => {
    setEditingIndex(meds.length)
    setFormData({ name: "", dosage: "", frequency: "", days: 0 })
  }

  const handleEdit = (index: number) => {
    setEditingIndex(index)
    setFormData({ ...meds[index] })
  }

  const handleSave = () => {
    if (!formData || !formData.name.trim() || !formData.dosage.trim() || !formData.frequency.trim()) {
      showToast("Please fill in all required fields", "warning")
      return
    }

    const newMeds = [...meds]
    if (editingIndex !== null) {
      if (editingIndex === newMeds.length) {
        newMeds.push(formData)
      } else {
        newMeds[editingIndex] = formData
      }
    }
    
    onMedicinesChange(newMeds)
    setEditingIndex(null)
    setFormData(null)
  }

  const handleDelete = (index: number) => {
    onMedicinesChange(meds.filter((_, i) => i !== index))
  }

  const handleSaveAndAddAnother = () => {
    if (!formData || !formData.name.trim() || !formData.dosage.trim() || !formData.frequency.trim()) {
      showToast("Please fill in all required fields", "warning")
      return
    }

    const newMeds = [...meds]
    if (editingIndex !== null) {
      if (editingIndex === newMeds.length) {
        newMeds.push(formData)
      } else {
        newMeds[editingIndex] = formData
      }
    }
    
    onMedicinesChange(newMeds)
    setEditingIndex(newMeds.length)
    setFormData({ name: "", dosage: "", frequency: "", days: 0 })
  }

  const handleCancel = () => {
    setEditingIndex(null)
    setFormData(null)
  }

  if (readOnly) {
    if (meds.length === 0) {
      return <p className="text-sm text-slate-500">No medicines listed</p>
    }

    return (
      <div className="space-y-3">
        {meds.map((med, idx) => (
          <div key={idx} className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <h4 className="font-semibold text-slate-900">{med.name}</h4>
            <div className="text-sm text-slate-600 mt-2 space-y-1">
              <p><span className="font-medium">Dosage:</span> {med.dosage}</p>
              <p><span className="font-medium">Frequency:</span> {med.frequency}</p>
              <p><span className="font-medium">Duration:</span> {med.days} days</p>
              {med.notes && <p><span className="font-medium">Notes:</span> {med.notes}</p>}
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        {meds.map((med, idx) => (
          <div key={idx} className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h4 className="font-semibold text-slate-900">{med.name}</h4>
                <div className="text-sm text-slate-600 mt-2 space-y-1">
                  <p><span className="font-medium">Dosage:</span> {med.dosage}</p>
                  <p><span className="font-medium">Frequency:</span> {med.frequency}</p>
                  <p><span className="font-medium">Duration:</span> {med.days} days</p>
                  {med.notes && <p><span className="font-medium">Notes:</span> {med.notes}</p>}
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => handleEdit(idx)}
                  className="p-1 hover:bg-blue-200 rounded transition-colors"
                  title="Edit medicine"
                >
                  <Edit2 className="w-4 h-4 text-blue-600" />
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(idx)}
                  className="p-1 hover:bg-red-200 rounded transition-colors"
                  title="Remove medicine"
                >
                  <Trash2 className="w-4 h-4 text-red-600" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {editingIndex !== null && formData && (
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-3">
          <h4 className="font-semibold text-slate-900">
            {editingIndex === meds.length ? "Add Medicine" : "Edit Medicine"}
          </h4>
          
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">Medicine Name *</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., Tab Aspirin 500mg"
              className="w-full h-10 px-3 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Dosage *</label>
              <input
                type="text"
                value={formData.dosage}
                onChange={(e) => setFormData({ ...formData, dosage: e.target.value })}
                placeholder="e.g., 1-0-1"
                className="w-full h-10 px-3 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Frequency *</label>
              <input
                type="text"
                value={formData.frequency}
                onChange={(e) => setFormData({ ...formData, frequency: e.target.value })}
                placeholder="e.g., BD, TDS"
                className="w-full h-10 px-3 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">Duration (days) *</label>
            <input
              type="number"
              value={formData.days}
              onChange={(e) => setFormData({ ...formData, days: parseInt(e.target.value) || 0 })}
              placeholder="e.g., 7"
              className="w-full h-10 px-3 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              min="1"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">Notes (Optional)</label>
            <input
              type="text"
              value={formData.notes || ""}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="e.g., After meals"
              className="w-full h-10 px-3 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex flex-col sm:flex-row gap-2 pt-2">
            <button
              type="button"
              onClick={handleSaveAndAddAnother}
              className="flex-1 px-3 py-2 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors text-sm font-medium whitespace-nowrap"
            >
              Save & Add Another
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="flex-1 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium whitespace-nowrap"
            >
              Save & Close
            </button>
            <button
              type="button"
              onClick={handleCancel}
              className="flex-1 px-3 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition-colors text-sm font-medium"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {editingIndex === null && (
        <button
          type="button"
          onClick={handleAdd}
          className="w-full py-2 px-3 border-2 border-dashed border-blue-300 rounded-lg text-blue-600 font-medium hover:bg-blue-50 transition-colors flex items-center justify-center gap-2"
        >
          <Plus className="w-4 h-4" /> Add Medicine
        </button>
      )}
    </div>
  )
}
