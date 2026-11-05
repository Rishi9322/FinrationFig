import { useEffect, useState } from "react"
import { Link } from "react-router"
import { Printer, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { Case, SavedCalculation, createCase, deleteCase, getCases, getUserCalculations, updateCalculation } from "../../lib/calculationStorage"
import { CALCULATORS } from "../../lib/calculatorConfig"
import { getCurrentUser } from "../../lib/auth"
import { RiskBadge } from "../components/ui/RiskBadge"
import "../../styles/print.css"

export default function CasesPage() {
  const user = getCurrentUser()
  const [cases, setCases] = useState<Case[]>([])
  const [calcs, setCalcs] = useState<SavedCalculation[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const load = () =>
    Promise.all([getCases(), getUserCalculations(user?.id ?? "")])
      .then(([c, k]) => { setCases(c); setCalcs(k); setSelected((s) => s ?? c[0]?.id ?? null) })
      .catch(() => toast.error("Could not load your cases. Please refresh."))
      .finally(() => setLoading(false))
  useEffect(() => { load() }, [])

  const add = async () => {
    const name = window.prompt("Case / borrower name")?.trim()
    if (!name) return
    try { const c = await createCase(name); setCases([c, ...cases]); setSelected(c.id) }
    catch { toast.error("Could not create case") }
  }
  const remove = async (c: Case) => {
    if (!window.confirm(`Delete "${c.name}"? Its calculations are kept, just unfiled.`)) return
    try { await deleteCase(c.id); setSelected(null); await load() } catch { toast.error("Could not delete case") }
  }
  const unfile = async (k: SavedCalculation) => {
    try { await updateCalculation(k.id, { caseId: null }); setCalcs(calcs.map((x) => x.id === k.id ? { ...x, caseId: null } : x)) }
    catch { toast.error("Could not remove from case") }
  }

  const current = cases.find((c) => c.id === selected)
  const rows = calcs.filter((k) => k.caseId === selected)

  return (
    <div className="min-h-screen bg-background py-8" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <h1 className="text-3xl font-normal text-foreground" style={{ fontFamily: "'Instrument Serif', serif" }}>Cases</h1>
          <button onClick={add} className="bg-primary hover:bg-primary-hover text-white px-4 py-2 rounded-lg text-sm font-medium">New case</button>
        </div>

        {loading ? <p className="text-sm text-muted-foreground">Loading...</p> : cases.length === 0 ? (
          <p className="text-sm text-muted-foreground">No cases yet. Create one, then choose it when you save a calculation result.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-6">
            <ul className="space-y-1">
              {cases.map((c) => (
                <li key={c.id}>
                  <button
                    onClick={() => setSelected(c.id)}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm ${c.id === selected ? "bg-primary/10 text-foreground" : "text-muted-foreground hover:bg-foreground/5"}`}
                  >
                    {c.name} <span className="text-xs opacity-60">({calcs.filter((k) => k.caseId === c.id).length})</span>
                  </button>
                </li>
              ))}
            </ul>

            {current && (
              <div className="print-area bg-card border border-foreground/8 rounded-xl p-6">
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div>
                    <h2 className="text-xl text-foreground">{current.name}</h2>
                    <p className="text-xs text-muted-foreground">Credit assessment summary · {new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</p>
                  </div>
                  <div className="flex gap-2 no-print">
                    <button onClick={() => window.print()} disabled={!rows.length} className="inline-flex items-center gap-1.5 text-xs border border-foreground/15 px-3 py-1.5 rounded-lg disabled:opacity-40">
                      <Printer className="w-3.5 h-3.5" /> Export PDF
                    </button>
                    <button onClick={() => remove(current)} aria-label="Delete case" className="text-muted-foreground hover:text-destructive p-1.5"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </div>
                {rows.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nothing saved here yet. Use "Save to case" on any calculator result.</p>
                ) : (
                  <table className="w-full text-sm">
                    <thead><tr className="text-left text-xs text-muted-foreground border-b border-foreground/10">
                      <th className="py-2">Calculator</th><th>Result</th><th>Risk</th><th>Date</th><th className="no-print" />
                    </tr></thead>
                    <tbody>
                      {rows.map((k) => {
                        const calc = CALCULATORS.find((c) => c.id === k.calculatorType)
                        const r = k.results as { formatted?: string; risk?: any; interpretation?: string }
                        return (
                          <tr key={k.id} className="border-b border-foreground/5 align-top">
                            <td className="py-2 pr-2">
                              <Link to={calc?.path || "/calculators"} state={{ calculation: k }} className="text-foreground hover:text-link">{calc?.name || k.calculatorType}</Link>
                              {r.interpretation && <p className="text-xs text-muted-foreground mt-0.5">{r.interpretation}</p>}
                            </td>
                            <td className="font-['Geist_Mono'] pr-2">{r.formatted}</td>
                            <td className="pr-2">{r.risk && <RiskBadge risk={r.risk} />}</td>
                            <td className="text-xs text-muted-foreground whitespace-nowrap">{new Date(k.createdAt).toLocaleDateString("en-IN")}</td>
                            <td className="no-print text-right"><button onClick={() => unfile(k)} className="text-xs text-muted-foreground hover:text-foreground">Remove</button></td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
