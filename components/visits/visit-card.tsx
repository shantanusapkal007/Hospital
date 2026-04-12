"use client"

import { Edit } from "lucide-react"
import { Visit } from "@/lib/types"
import { Badge } from "@/components/ui/badge"
import { formatCurrency } from "@/lib/utils"

interface VisitCardProps {
  visit: Visit
  onEdit?: (visit: Visit) => void
}

export function VisitCard({ visit, onEdit }: VisitCardProps) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">
            {visit.diagnosis || "Consultation"}
          </h3>
          <p className="text-sm text-slate-500 mt-1">
            {visit.createdAt?.toDate ? visit.createdAt.toDate().toLocaleDateString() : "-"}
          </p>
        </div>
        {onEdit && (
          <button
            onClick={() => onEdit(visit)}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
            title="Edit visit"
          >
            <Edit className="w-4 h-4 text-slate-600" />
          </button>
        )}
      </div>

      <div className="space-y-3">
        {visit.complaints && (
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase">Complaints</p>
            <p className="text-sm text-slate-700 mt-1">{visit.complaints}</p>
          </div>
        )}

        {visit.examinationFindings && (
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase">Examination</p>
            <p className="text-sm text-slate-700 mt-1">{visit.examinationFindings}</p>
          </div>
        )}

        {visit.vitals && Object.values(visit.vitals).some(v => v) && (
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase">Vitals</p>
            <div className="flex flex-wrap gap-2 mt-2">
              {visit.vitals.bp && <Badge variant="secondary">BP: {visit.vitals.bp}</Badge>}
              {visit.vitals.temperature && <Badge variant="secondary">Temp: {visit.vitals.temperature}°F</Badge>}
              {visit.vitals.pulse && <Badge variant="secondary">Pulse: {visit.vitals.pulse} bpm</Badge>}
              {visit.vitals.weight && <Badge variant="secondary">Weight: {visit.vitals.weight} kg</Badge>}
              {visit.vitals.spo2 && <Badge variant="secondary">SpO2: {visit.vitals.spo2}%</Badge>}
            </div>
          </div>
        )}

        {visit.prescriptions && visit.prescriptions.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase">Medicines</p>
            <div className="space-y-2 mt-2">
              {visit.prescriptions.map((med, idx) => (
                <div key={idx} className="text-sm bg-slate-50 p-2 rounded">
                  <p className="font-medium text-slate-900">{med.name}</p>
                  <p className="text-xs text-slate-600">{med.dosage} - {med.frequency} for {med.days} days</p>
                  {med.notes && <p className="text-xs text-slate-500 italic">{med.notes}</p>}
                </div>
              ))}
            </div>
          </div>
        )}

        {visit.labTests && (
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase">Lab Tests</p>
            <p className="text-sm text-slate-700 mt-1">{visit.labTests}</p>
          </div>
        )}

        {visit.advice && (
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase">Advice</p>
            <p className="text-sm text-slate-700 mt-1">{visit.advice}</p>
          </div>
        )}

        {visit.totalBill && (
          <div className="pt-3 border-t border-slate-100">
            <p className="text-sm font-semibold text-slate-900">
              Total Bill: {formatCurrency(visit.totalBill)}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
