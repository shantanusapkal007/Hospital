"use client"

import { Edit, Printer } from "lucide-react"
import { Visit } from "@/lib/types"
import { Badge } from "@/components/ui/badge"
import { formatCurrency } from "@/lib/utils"

interface VisitCardProps {
  visit: Visit
  onEdit?: (visit: Visit) => void
  onPrint?: (visit: Visit) => void
}

export function VisitCard({ visit, onEdit, onPrint }: VisitCardProps) {
  const visitDate = visit.createdAt?.toDate
    ? visit.createdAt.toDate().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
    : "-"

  return (
    <div className="bg-white rounded-[24px] border border-slate-200 p-5 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-base font-semibold text-slate-900">
            {visit.diagnosis || "Consultation"}
          </h3>
          <p className="text-sm text-slate-500 mt-0.5">{visitDate}</p>
        </div>
        <div className="flex items-center gap-1">
          {onPrint && (
            <button
              onClick={() => onPrint(visit)}
              className="p-2 hover:bg-sky-50 rounded-xl transition-colors group"
              title="Print prescription"
            >
              <Printer className="w-4 h-4 text-slate-400 group-hover:text-sky-600 transition-colors" />
            </button>
          )}
          {onEdit && (
            <button
              onClick={() => onEdit(visit)}
              className="p-2 hover:bg-slate-100 rounded-xl transition-colors group"
              title="Edit visit"
            >
              <Edit className="w-4 h-4 text-slate-400 group-hover:text-slate-700 transition-colors" />
            </button>
          )}
        </div>
      </div>

      <div className="space-y-3">
        {visit.complaints && (
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Complaints</p>
            <p className="text-sm text-slate-700 mt-1">{visit.complaints}</p>
          </div>
        )}

        {visit.examinationFindings && (
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Examination</p>
            <p className="text-sm text-slate-700 mt-1">{visit.examinationFindings}</p>
          </div>
        )}

        {visit.vitals && Object.values(visit.vitals).some(v => v) && (
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Vitals</p>
            <div className="flex flex-wrap gap-2">
              {visit.vitals.bp && <Badge variant="secondary">BP: {visit.vitals.bp}</Badge>}
              {visit.vitals.temperature && <Badge variant="secondary">Temp: {visit.vitals.temperature}°F</Badge>}
              {visit.vitals.pulse && <Badge variant="secondary">Pulse: {visit.vitals.pulse} bpm</Badge>}
              {visit.vitals.weight && <Badge variant="secondary">Wt: {visit.vitals.weight} kg</Badge>}
              {visit.vitals.spo2 && <Badge variant="secondary">SpO2: {visit.vitals.spo2}%</Badge>}
              {visit.vitals.height && <Badge variant="secondary">Ht: {visit.vitals.height} cm</Badge>}
              {visit.vitals.respiratoryRate && <Badge variant="secondary">RR: {visit.vitals.respiratoryRate}</Badge>}
            </div>
          </div>
        )}

        {visit.prescriptions && visit.prescriptions.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
              Rx — {visit.prescriptions.length} medicine{visit.prescriptions.length > 1 ? "s" : ""}
            </p>
            <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-emerald-100/60 text-[10px] uppercase text-emerald-700 font-semibold">
                  <tr>
                    <th className="px-3 py-1.5 text-left">Medicine</th>
                    <th className="px-3 py-1.5 text-center">Dose</th>
                    <th className="px-3 py-1.5 text-center">Freq</th>
                    <th className="px-3 py-1.5 text-center">Days</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-emerald-100/60">
                  {visit.prescriptions.map((med, idx) => (
                    <tr key={idx} className="bg-white/70">
                      <td className="px-3 py-2">
                        <p className="font-medium text-slate-800 text-sm">{med.name}</p>
                        {med.notes && <p className="text-[10px] text-slate-500 italic mt-0.5">{med.notes}</p>}
                      </td>
                      <td className="px-3 py-2 text-center text-slate-600 text-sm">{med.dosage}</td>
                      <td className="px-3 py-2 text-center text-slate-600 text-sm">{med.frequency}</td>
                      <td className="px-3 py-2 text-center text-slate-600 text-sm">{med.days}d</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {visit.advice && (
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Advice</p>
            <p className="text-sm text-slate-700 mt-1">{visit.advice}</p>
          </div>
        )}

        {visit.labTests && (
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Lab Tests</p>
            <p className="text-sm text-slate-700 mt-1">{visit.labTests}</p>
          </div>
        )}

        {(visit.followUpDate || visit.totalBill) && (
          <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-3 flex-wrap">
            {visit.followUpDate && (
              <p className="text-sm text-sky-600 font-medium">
                Follow-up: {new Date(visit.followUpDate).toLocaleDateString("en-IN")}
              </p>
            )}
            {visit.totalBill ? (
              <p className="text-sm font-semibold text-slate-900">
                Bill: {formatCurrency(visit.totalBill)}
              </p>
            ) : null}
          </div>
        )}
      </div>
    </div>
  )
}
