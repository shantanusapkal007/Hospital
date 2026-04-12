"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Search, Users, Pill, Calendar, IndianRupee, BookOpen, Home, ArrowRight } from "lucide-react"
import { searchPatients } from "@/services/patient.service"
import type { Patient } from "@/lib/types"

interface CommandItem {
  id: string
  title: string
  description?: string
  icon: React.ReactNode
  action: () => void
  category: string
}

export function CommandPalette() {
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [patients, setPatients] = useState<Patient[]>([])
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Global keyboard shortcut Cmd+K or Ctrl+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault()
        setIsOpen((prev) => !prev)
        setSearchTerm("")
        setSelectedIndex(0)
      }
      if (e.key === "Escape" && isOpen) {
        setIsOpen(false)
        setSelectedIndex(0)
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [isOpen])

  // Focus input when opened
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isOpen])

  // Search patients
  useEffect(() => {
    const searchAsync = async () => {
      if (searchTerm.length > 0) {
        try {
          const results = await searchPatients(searchTerm)
          setPatients(results.slice(0, 5)) // Limit to 5 results
        } catch (err) {
          setPatients([])
        }
      } else {
        setPatients([])
      }
    }

    const timer = setTimeout(searchAsync, 300)
    return () => clearTimeout(timer)
  }, [searchTerm])

  // Build command items
  const staticCommands = useMemo<CommandItem[]>(() => [
    {
      id: "dashboard",
      title: "Go to Dashboard",
      icon: <Home className="w-4 h-4" />,
      action: () => { router.push("/"); setIsOpen(false) },
      category: "Navigation"
    },
    {
      id: "patients",
      title: "Go to Patients",
      icon: <Users className="w-4 h-4" />,
      action: () => { router.push("/patients"); setIsOpen(false) },
      category: "Navigation"
    },
    {
      id: "visits",
      title: "Go to Visits",
      icon: <Pill className="w-4 h-4" />,
      action: () => { router.push("/visits"); setIsOpen(false) },
      category: "Navigation"
    },
    {
      id: "appointments",
      title: "Go to Appointments",
      icon: <Calendar className="w-4 h-4" />,
      action: () => { router.push("/appointments"); setIsOpen(false) },
      category: "Navigation"
    },
    {
      id: "billing",
      title: "Go to Billing",
      icon: <IndianRupee className="w-4 h-4" />,
      action: () => { router.push("/payments"); setIsOpen(false) },
      category: "Navigation"
    },
    {
      id: "khata",
      title: "Go to Khata",
      icon: <BookOpen className="w-4 h-4" />,
      action: () => { router.push("/khata"); setIsOpen(false) },
      category: "Navigation"
    },
  ], [router])

  const patientCommands = useMemo<CommandItem[]>(() => patients.map(p => ({
    id: `patient-${p.id}`,
    title: p.fullName,
    description: `Case: ${p.caseNumber} | ${p.mobileNumber}`,
    icon: <Users className="w-4 h-4" />,
    action: () => { router.push(`/patients/${p.id}`); setIsOpen(false) },
    category: "Patients"
  })), [patients, router])

  // Filter commands based on search
  const filteredCommands = useMemo(() => [
    ...staticCommands.filter(cmd =>
      cmd.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      cmd.category.toLowerCase().includes(searchTerm.toLowerCase())
    ),
    ...patientCommands
  ], [patientCommands, searchTerm, staticCommands])

  const activeIndex = filteredCommands.length === 0
    ? 0
    : Math.min(selectedIndex, filteredCommands.length - 1)

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return

      if (e.key === "ArrowDown") {
        e.preventDefault()
        if (filteredCommands.length === 0) return
        setSelectedIndex(i => (i + 1) % filteredCommands.length)
      }
      if (e.key === "ArrowUp") {
        e.preventDefault()
        if (filteredCommands.length === 0) return
        setSelectedIndex(i => (i - 1 + filteredCommands.length) % filteredCommands.length)
      }
      if (e.key === "Enter") {
        e.preventDefault()
        if (filteredCommands[activeIndex]) {
          filteredCommands[activeIndex].action()
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [activeIndex, filteredCommands, isOpen])

  if (!isOpen) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
        onClick={() => setIsOpen(false)}
      />

      {/* Command Palette */}
      <div className="fixed top-1/4 left-1/2 -translate-x-1/2 w-full max-w-2xl z-50">
        <div
          ref={containerRef}
          className="bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden"
        >
          {/* Search Input */}
          <div className="border-b border-slate-200 px-4 py-3">
            <div className="flex items-center gap-3">
              <Search className="w-5 h-5 text-slate-400" />
              <input
                ref={inputRef}
                type="text"
                placeholder="Search patients or commands... (Esc to close)"
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value)
                  setSelectedIndex(0)
                }}
                className="flex-1 bg-transparent outline-none text-sm text-slate-900 placeholder-slate-500"
              />
            </div>
          </div>

          {/* Results */}
          <div className="max-h-96 overflow-y-auto">
            {filteredCommands.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-slate-500">
                No results found
              </div>
            ) : (
              <div className="py-2">
                {filteredCommands.map((cmd, index) => (
                  <div key={cmd.id}>
                    {index > 0 && filteredCommands[index - 1].category !== cmd.category && (
                      <div className="px-4 py-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                        {cmd.category}
                      </div>
                    )}
                    <button
                      onClick={() => cmd.action()}
                      className={`w-full px-4 py-2 text-left text-sm transition-colors ${
                        activeIndex === index
                          ? "bg-blue-50 text-blue-900"
                          : "text-slate-900 hover:bg-slate-50"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className={`${activeIndex === index ? "text-blue-600" : "text-slate-400"}`}>
                          {cmd.icon}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{cmd.title}</p>
                          {cmd.description && (
                            <p className="text-xs text-slate-500 truncate">{cmd.description}</p>
                          )}
                        </div>
                        {activeIndex === index && (
                          <ArrowRight className="w-4 h-4 text-blue-600 flex-shrink-0" />
                        )}
                      </div>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-slate-200 px-4 py-2 bg-slate-50 text-xs text-slate-500 flex items-center justify-between">
            <span>
              {filteredCommands.length > 0 && `${activeIndex + 1} of ${filteredCommands.length}`}
            </span>
            <span className="flex items-center gap-2">
              <kbd className="px-2 py-1 bg-white border border-slate-200 rounded text-xs">↑↓</kbd>
              <kbd className="px-2 py-1 bg-white border border-slate-200 rounded text-xs">Enter</kbd>
              <kbd className="px-2 py-1 bg-white border border-slate-200 rounded text-xs">Esc</kbd>
            </span>
          </div>
        </div>
      </div>
    </>
  )
}
