"use client"

import { useState, useEffect, startTransition } from "react"
import { MessageSquare, IndianRupee, Plus, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Modal } from "@/components/ui/modal"
import { FORM_FIELD_PROPS, FORM_PROPS } from "@/lib/form-defaults"
import { useDebouncedValue } from "@/lib/use-debounced-value"
import { formatCurrency } from "@/lib/utils"
import { getPayments, addPayment, getPaymentStats } from "@/services/payment.service"
import { searchPatients, getPatient } from "@/services/patient.service"
import type { Payment, Patient, PaymentMethod, PaymentStatus } from "@/lib/types"
import { useToast } from "@/components/ui/toast"

export default function PaymentsPage() {
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [payments, setPayments] = useState<Payment[]>([])
  const [stats, setStats] = useState({ total: 0, count: 0, pending: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [isSendingWhatsApp, setIsSendingWhatsApp] = useState<string | null>(null)

  const [patientSearch, setPatientSearch] = useState("")
  const [patientResults, setPatientResults] = useState<Patient[]>([])
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null)
  const debouncedPatientSearch = useDebouncedValue(patientSearch, 120)
  const { showToast } = useToast()

  const resetPaymentState = () => {
    setSelectedPatient(null)
    setPatientSearch("")
    setPatientResults([])
  }

  const fetchPayments = async () => {
    setLoading(true)
    try {
      const data = await getPayments()
      setPayments(data)
      const st = await getPaymentStats()
      setStats(st)
      setError("")
    } catch (e) {
      setError("Failed to load payments.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchPayments() }, [])

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

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!selectedPatient) { showToast("Please select a patient", "warning"); return }
    setIsSaving(true)
    const form = e.currentTarget
    const fd = new FormData(form)
    try {
      const amount = parseInt(fd.get("amount") as string)
      if (!Number.isFinite(amount) || amount <= 0) {
        throw new Error("Enter a valid payment amount.")
      }

      await addPayment({
        patientId: selectedPatient.id!,
        patientName: selectedPatient.fullName,
        amount,
        paymentMethod: fd.get("method") as PaymentMethod,
        status: "paid" as PaymentStatus,
        description: fd.get("description") as string || "",
        date: new Date().toISOString().split("T")[0],
      })
      if (typeof form.reset === "function") {
        form.reset()
      }
      setIsPaymentModalOpen(false)
      resetPaymentState()
      fetchPayments()
    } catch (e: any) {
      showToast(e.message || "Failed to record payment.", "error")
    } finally {
      setIsSaving(false)
    }
  }

  const handleSendWhatsAppBill = async (pay: Payment) => {
    setIsSendingWhatsApp(pay.id!)
    try {
      const patient = await getPatient(pay.patientId)
      let phone = patient?.mobileNumber || ""

      if (!phone || phone === "0000000000") {
        showToast("No phone number on file for this patient.", "error")
        return
      }
      
      phone = phone.replace(/\D/g, '')

      if (!phone || phone.length < 10) {
        showToast("Invalid phone number.", "error")
        return
      }

      phone = phone.slice(-10)

      const message = `*SURADKAR HOSPITAL*
------------------------
*Payment Receipt*
Receipt No: ${pay.id?.substring(0, 6).toUpperCase()}
Patient: ${pay.patientName}
Date: ${pay.date}
Amount: Rs. ${pay.amount}
Mode: ${pay.paymentMethod.toUpperCase()}
Description: ${pay.description || 'Consultation / Treatment'}
------------------------
Thank you for your visit!`

      const url = `https://wa.me/91${phone}?text=${encodeURIComponent(message)}`
      window.open(url, '_blank')
    } catch (err) {
      showToast("Failed to load patient details.", "error")
    } finally {
      setIsSendingWhatsApp(null)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-950">Billing & Payments</h1>
          <p className="text-sm text-slate-500">Track collections, send WhatsApp bills, and view pending balances.</p>
        </div>
        <div className="flex gap-2">
          <Button className="w-full sm:w-auto" onClick={() => setIsPaymentModalOpen(true)}>
            <Plus className="w-4 h-4 mr-2" /> Record Payment
          </Button>
        </div>
      </div>

      <Modal isOpen={isPaymentModalOpen} onClose={() => { setIsPaymentModalOpen(false); resetPaymentState() }} title="Record Payment">
        <form className="space-y-4" onSubmit={handleSave} {...FORM_PROPS}>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700">Patient Name</label>
            <input type="text" value={selectedPatient ? selectedPatient.fullName : patientSearch}
              onChange={(e) => { setPatientSearch(e.target.value); setSelectedPatient(null) }}
              className="w-full h-10 px-3 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Search patient..." {...FORM_FIELD_PROPS} />
            {patientResults.length > 0 && !selectedPatient && (
              <div className="border border-slate-200 rounded-lg max-h-32 overflow-y-auto bg-white shadow-lg">
                {patientResults.map(p => (
                  <button type="button" key={p.id} onClick={() => { setSelectedPatient(p); setPatientSearch(""); setPatientResults([]) }}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50">{p.fullName}</button>
                ))}
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">Amount (Rs.)</label>
              <input required name="amount" type="number" className="w-full h-10 px-3 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="500" {...FORM_FIELD_PROPS} />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">Mode</label>
              <select name="method" className="w-full h-10 px-3 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" {...FORM_FIELD_PROPS}>
                <option value="upi">UPI</option>
                <option value="cash">Cash</option>
                <option value="card">Card</option>
              </select>
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700">Description</label>
            <input name="description" type="text" className="w-full h-10 px-3 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Consultation fee" {...FORM_FIELD_PROPS} />
          </div>
          <div className="pt-4 flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => { setIsPaymentModalOpen(false); resetPaymentState() }} disabled={isSaving}>Cancel</Button>
            <Button type="submit" disabled={isSaving}>{isSaving ? "Recording..." : "Record Payment"}</Button>
          </div>
        </form>
      </Modal>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-6 flex flex-col gap-2">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-green-50 flex items-center justify-center">
                <IndianRupee className="w-5 h-5 text-green-600" />
              </div>
              <span className="text-sm font-medium text-slate-500">Total Collected</span>
            </div>
            <h3 className="text-3xl font-bold text-slate-900 mt-2">{formatCurrency(stats.total)}</h3>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 flex flex-col gap-2">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center">
                <span className="text-blue-600 font-bold text-lg">#</span>
              </div>
              <span className="text-sm font-medium text-slate-500">Transactions</span>
            </div>
            <h3 className="text-3xl font-bold text-slate-900 mt-2">{stats.count}</h3>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 flex flex-col gap-2">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-amber-50 flex items-center justify-center">
                <IndianRupee className="w-5 h-5 text-amber-600" />
              </div>
              <span className="text-sm font-medium text-slate-500">Pending</span>
            </div>
            <h3 className="text-3xl font-bold text-slate-900 mt-2">{formatCurrency(stats.pending)}</h3>
      </CardContent>
        </Card>
      </div>

      {error && <div className="rounded-lg bg-red-50 p-4 text-sm text-red-700">{error}</div>}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {loading ? (
          <div className="p-12 text-center text-slate-500">Loading payments...</div>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
              <tr>
                <th className="px-6 py-4">Receipt</th>
                <th className="px-6 py-4">Patient</th>
                <th className="px-6 py-4">Amount</th>
                <th className="px-6 py-4">Mode</th>
                <th className="px-6 py-4">Date</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {payments.map(pay => (
                <tr key={pay.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 font-medium text-slate-900 uppercase">{pay.id?.substring(0, 6)}</td>
                  <td className="px-6 py-4 text-slate-600">{pay.patientName}</td>
                  <td className="px-6 py-4 font-medium text-slate-900">{formatCurrency(pay.amount)}</td>
                  <td className="px-6 py-4"><span className="px-2 py-1 bg-blue-50 text-blue-700 rounded-md text-xs font-medium uppercase">{pay.paymentMethod}</span></td>
                  <td className="px-6 py-4 text-slate-500">{pay.date}</td>
                  <td className="px-6 py-4 text-right">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => handleSendWhatsAppBill(pay)}
                      disabled={isSendingWhatsApp === pay.id}
                      className="text-green-600 border-green-200 hover:bg-green-50 hover:text-green-700"
                    >
                      {isSendingWhatsApp === pay.id ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <MessageSquare className="w-4 h-4 mr-2" />
                      )}
                      WhatsApp
                    </Button>
                  </td>
                </tr>
              ))}
              {payments.length === 0 && (
                <tr><td colSpan={5} className="text-center py-8 text-slate-500">No payment records found.</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
