import { useState, useEffect, useRef } from "react"
import { Link } from "react-router"
import { ArrowRight, Play, Zap, Lock, FolderOpen, FileText, RefreshCw, Globe, Star, ChevronRight } from "lucide-react"

function useCountUp(target: number, duration = 1800, started = false) {
  const [value, setValue] = useState(0)
  useEffect(() => {
    if (!started) return
    let startTime: number | null = null
    const step = (timestamp: number) => {
      if (!startTime) startTime = timestamp
      const progress = Math.min((timestamp - startTime) / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setValue(Math.floor(eased * target))
      if (progress < 1) requestAnimationFrame(step)
    }
    requestAnimationFrame(step)
  }, [started, target, duration])
  return value
}

function useInView(threshold = 0.2) {
  const ref = useRef<HTMLDivElement>(null)
  const [inView, setInView] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setInView(true) },
      { threshold }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [threshold])
  return { ref, inView }
}

function AnimatedStat({ label, prefix = "", suffix = "", value, started }: {
  label: string; prefix?: string; suffix?: string; value: number; started: boolean
}) {
  const current = useCountUp(value, 1600, started)
  const display = value >= 10000000
    ? (current / 10000000).toFixed(2) + " Cr"
    : value >= 100000
    ? (current / 100000).toFixed(1) + "L"
    : current.toString()
  return (
    <div className="bg-[#0D1726] border border-white/8 rounded-xl p-5 flex flex-col gap-1">
      <span className="font-['Geist_Mono'] text-[#10B981] text-2xl font-medium tracking-tight">
        {prefix}{display}{suffix}
      </span>
      <span className="text-[#64748B] text-sm font-['DM_Sans']">{label}</span>
    </div>
  )
}

const STEPS = [
  { n: "01", icon: Lock, title: "Create your account", desc: "Sign up in seconds with your email address" },
  { n: "02", icon: Zap, title: "Enter your financials", desc: "9 inputs: sales, margins, credit terms, ratio data" },
  { n: "03", icon: RefreshCw, title: "See live results", desc: "Risk badges, ratios, insights — recalculated instantly" },
  { n: "04", icon: FileText, title: "Save your history", desc: "Every calculation stored securely in the cloud" },
]

const FEATURES = [
  { icon: Zap, title: "Live recalculation", desc: "Results update on every keystroke — no submit button needed" },
  { icon: Lock, title: "Secure & private", desc: "OTP auth, encrypted data, zero data sharing" },
  { icon: FolderOpen, title: "Full history", desc: "Every calculation saved and reloadable from your dashboard" },
  { icon: FileText, title: "9 ratio calculators", desc: "D/E, Current Ratio, DSCR, EBITDA, ISCR, NWC, and more" },
  { icon: RefreshCw, title: "Tweak & compare", desc: "Reload any past calc, adjust inputs, compare scenarios" },
  { icon: Globe, title: "Built for India", desc: "₹ native formatting with lakhs and crores support" },
]

const TESTIMONIALS = [
  { quote: "Saved us hours every month on ratio reviews. The risk badges alone changed how we present to banks.", name: "Rohan M.", role: "CFO, Mumbai", initials: "RM" },
  { quote: "Finally a calculator that actually explains the math behind each ratio. Our team trusts the output.", name: "Priya S.", role: "Finance Head, Pune", initials: "PS" },
  { quote: "The calculation history is a game-changer for tracking our financial health quarter over quarter.", name: "Arjun K.", role: "CA, Delhi", initials: "AK" },
]

const CALCULATORS = [
  { name: "Debt-to-Equity Ratio", desc: "Measure financial leverage and long-term solvency" },
  { name: "Quasi Debt-to-Equity", desc: "Adjusted D/E including quasi-equity instruments" },
  { name: "Current Ratio", desc: "Short-term liquidity and ability to meet obligations" },
  { name: "DSCR", desc: "Debt Service Coverage for loan eligibility assessment" },
  { name: "EBITDA", desc: "Operating profitability before financing costs" },
  { name: "ISCR", desc: "Interest Service Coverage Ratio for credit risk" },
  { name: "Net Working Capital", desc: "Day-to-day operational liquidity buffer" },
  { name: "Drawing Power", desc: "Revolving credit limit against stock and debtors" },
  { name: "Ageing Analysis", desc: "Debtor/creditor age buckets for receivables health" },
]

export default function HomePage() {
  const [scrolled, setScrolled] = useState(false)
  const { ref: statsRef, inView: statsInView } = useInView(0.3)
  const { ref: howRef, inView: howInView } = useInView(0.15)
  const { ref: featRef, inView: featInView } = useInView(0.1)
  const { ref: testiRef, inView: testiInView } = useInView(0.1)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  return (
    <div
      className="min-h-screen bg-[#050A14] text-[#F1F5F9] overflow-x-hidden"
      style={{ fontFamily: "'DM Sans', sans-serif" }}
    >
      {/* Sticky Navbar */}
      <header
        className={`fixed top-0 left-0 right-0 z-50 h-16 flex items-center transition-all duration-300 ${
          scrolled ? "bg-[#050A14]/90 backdrop-blur-md border-b border-white/8 shadow-lg" : ""
        }`}
      >
        <div className="max-w-7xl mx-auto px-6 lg:px-8 w-full flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img src="/logoo.png" alt="FinRatio" className="h-10 w-auto sm:h-12" />
            <span className="text-[10px] font-['Geist_Mono'] bg-[#2563EB]/20 text-[#2563EB] border border-[#2563EB]/30 rounded px-1.5 py-0.5 leading-none">
              β
            </span>
          </div>
          <nav className="flex items-center gap-3">
            <Link
              to="/auth/signin"
              className="text-sm text-[#64748B] hover:text-white transition-colors px-4 py-2 rounded-lg hover:bg-white/5"
            >
              Sign In
            </Link>
            <Link
              to="/auth/signup"
              className="text-sm bg-[#2563EB] hover:bg-[#1d4ed8] text-white px-5 py-2 rounded-lg font-medium transition-colors"
            >
              Get Started
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="relative min-h-screen flex flex-col items-center justify-center pt-16 px-6">
        {/* Radial glow */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: "radial-gradient(ellipse at 50% 35%, rgba(37,99,235,0.13) 0%, transparent 68%)",
          }}
        />
        {/* Grid overlay */}
        <div
          className="absolute inset-0 pointer-events-none opacity-[0.03]"
          style={{
            backgroundImage: "linear-gradient(rgba(255,255,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px)",
            backgroundSize: "60px 60px",
          }}
        />

        <div className="relative z-10 text-center max-w-4xl mx-auto">
          {/* Eyebrow */}
          <div className="inline-flex items-center gap-2 bg-[#2563EB]/10 border border-[#2563EB]/25 rounded-full px-4 py-1.5 mb-8">
            <Zap className="w-3.5 h-3.5 text-[#2563EB]" />
            <span className="text-xs font-['Geist_Mono'] text-[#2563EB] tracking-wide">
              Financial Intelligence for Indian SMEs
            </span>
          </div>

          {/* Headline */}
          <h1
            className="text-5xl sm:text-6xl lg:text-7xl font-normal leading-[1.08] tracking-tight mb-6 text-white"
            style={{ fontFamily: "'Instrument Serif', serif" }}
          >
            Understand Your
            <br />
            <em className="not-italic text-transparent bg-clip-text"
              style={{ backgroundImage: "linear-gradient(135deg, #2563EB 0%, #10B981 100%)" }}
            >
              Financial Health
            </em>
            <br />
            Instantly
          </h1>

          <p className="text-lg text-[#64748B] max-w-xl mx-auto mb-10 leading-relaxed">
            9 professional-grade financial ratio calculators with real-time risk assessment,
            Indian currency formatting, and secure history — built for credit teams and CFOs.
          </p>

          {/* CTA row */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-14">
            <Link
              to="/auth/signup"
              className="inline-flex items-center gap-2 bg-[#2563EB] hover:bg-[#1d4ed8] text-white px-8 py-3.5 rounded-xl font-medium text-base transition-all hover:-translate-y-0.5 shadow-lg shadow-[#2563EB]/25"
            >
              Get Started Free
              <ArrowRight className="w-4 h-4" />
            </Link>
            <a
              href="#how-it-works"
              className="inline-flex items-center gap-2 text-[#64748B] hover:text-white px-6 py-3.5 rounded-xl border border-white/10 hover:border-white/20 transition-all text-base"
            >
              <Play className="w-4 h-4" />
              See how it works
            </a>
          </div>

          {/* Social proof */}
          <div className="flex items-center justify-center gap-3">
            <div className="flex -space-x-2">
              {["RK", "PS", "AM", "VG"].map((init, i) => (
                <div
                  key={i}
                  className="w-8 h-8 rounded-full border-2 border-[#050A14] flex items-center justify-center text-[10px] font-medium text-white"
                  style={{
                    background: ["#1d4ed8", "#0f766e", "#7c3aed", "#b45309"][i],
                  }}
                >
                  {init}
                </div>
              ))}
            </div>
            <div className="flex items-center gap-1.5">
              <div className="flex text-[#10B981]">
                {[...Array(5)].map((_, i) => <Star key={i} className="w-3.5 h-3.5 fill-current" />)}
              </div>
              <span className="text-sm text-[#64748B]">Trusted by 500+ finance teams</span>
            </div>
          </div>
        </div>

        {/* Floating mockup card */}
        <div className="relative z-10 mt-20 w-full max-w-3xl mx-auto">
          <div
            className="rounded-2xl border border-white/8 overflow-hidden shadow-2xl"
            style={{ background: "#0D1726" }}
          >
            {/* Window chrome */}
            <div className="flex items-center gap-2 px-5 py-3.5 border-b border-white/8">
              <div className="w-3 h-3 rounded-full bg-[#ef4444]/60" />
              <div className="w-3 h-3 rounded-full bg-[#f59e0b]/60" />
              <div className="w-3 h-3 rounded-full bg-[#10B981]/60" />
              <span className="ml-3 text-xs font-['Geist_Mono'] text-[#64748B]">finratio.app / calculators / dscr</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2">
              {/* Input panel */}
              <div className="p-6 border-r border-white/8">
                <p className="text-xs font-['Geist_Mono'] text-[#64748B] uppercase tracking-widest mb-4">Inputs</p>
                {[
                  ["Business Type", "Manufacturer"],
                  ["Net Annual Sales", "₹5,00,00,000"],
                  ["Net Profit After Tax", "₹42,00,000"],
                  ["Total Debt Repayment", "₹38,00,000"],
                  ["Depreciation", "₹8,00,000"],
                ].map(([label, val]) => (
                  <div key={label} className="mb-3">
                    <p className="text-xs text-[#64748B] mb-1">{label}</p>
                    <div className="bg-[#050A14] rounded-lg px-3 py-2 text-sm font-['Geist_Mono'] text-[#F1F5F9] border border-white/8">
                      {val}
                    </div>
                  </div>
                ))}
              </div>
              {/* Result panel */}
              <div className="p-6">
                <p className="text-xs font-['Geist_Mono'] text-[#64748B] uppercase tracking-widest mb-4">Results</p>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-[#64748B]">DSCR</span>
                    <div className="flex items-center gap-2">
                      <span className="font-['Geist_Mono'] text-[#10B981] font-medium">1.32</span>
                      <span className="text-[10px] bg-[#10B981]/15 text-[#10B981] border border-[#10B981]/25 rounded-full px-2 py-0.5">Low Risk</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-[#64748B]">Annual Repayment</span>
                    <span className="font-['Geist_Mono'] text-[#F1F5F9] text-sm">₹38,00,000</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-[#64748B]">Cash Accrual</span>
                    <span className="font-['Geist_Mono'] text-[#F1F5F9] text-sm">₹50,00,000</span>
                  </div>
                  <div className="mt-4 p-3 rounded-lg bg-[#10B981]/8 border border-[#10B981]/20">
                    <p className="text-xs text-[#10B981] leading-relaxed">
                      DSCR of 1.32 indicates adequate debt repayment capacity. Business generates sufficient cash flow to service debt obligations comfortably.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="py-28 px-6" ref={howRef}>
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-xs font-['Geist_Mono'] text-[#2563EB] uppercase tracking-widest mb-3">How It Works</p>
            <h2
              className="text-4xl lg:text-5xl font-normal text-white"
              style={{ fontFamily: "'Instrument Serif', serif" }}
            >
              From inputs to insight
              <br />
              <em className="not-italic text-[#64748B]">in four steps</em>
            </h2>
          </div>

          <div className="relative grid grid-cols-1 md:grid-cols-4 gap-0">
            {/* Connecting line on desktop */}
            <div className="hidden md:block absolute top-10 left-[12.5%] right-[12.5%] border-t-2 border-dashed border-white/10 z-0" />

            {STEPS.map((step, i) => {
              const Icon = step.icon
              return (
                <div
                  key={step.n}
                  className="relative z-10 flex flex-col items-center text-center px-4 transition-all duration-500"
                  style={{
                    opacity: howInView ? 1 : 0,
                    transform: howInView ? "translateY(0)" : "translateY(24px)",
                    transitionDelay: `${i * 100}ms`,
                  }}
                >
                  <div className="w-20 h-20 rounded-2xl bg-[#0D1726] border border-white/8 flex items-center justify-center mb-5 shadow-lg">
                    <Icon className="w-7 h-7 text-[#2563EB]" />
                  </div>
                  <span className="font-['Geist_Mono'] text-xs text-[#2563EB] mb-2 tracking-widest">{step.n}</span>
                  <h3 className="font-medium text-white mb-2 text-base">{step.title}</h3>
                  <p className="text-sm text-[#64748B] leading-relaxed">{step.desc}</p>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* Live Stats Demo */}
      <section className="py-24 px-6 border-y border-white/8" ref={statsRef}
        style={{ background: "linear-gradient(180deg, #050A14 0%, #080f1f 100%)" }}
      >
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div>
              <p className="text-xs font-['Geist_Mono'] text-[#2563EB] uppercase tracking-widest mb-3">Live Preview</p>
              <h2
                className="text-4xl lg:text-5xl font-normal text-white mb-5 leading-tight"
                style={{ fontFamily: "'Instrument Serif', serif" }}
              >
                See your numbers
                <br />
                <em className="not-italic text-[#64748B]">come alive</em>
              </h2>
              <p className="text-[#64748B] leading-relaxed mb-8">
                Every input field recalculates the full ratio suite in real time.
                Risk badges update automatically — Low, Moderate, or High — with
                plain-language interpretation for each result.
              </p>
              <Link
                to="/auth/signup"
                className="inline-flex items-center gap-2 text-[#2563EB] hover:text-white border border-[#2563EB]/40 hover:border-[#2563EB] hover:bg-[#2563EB] px-6 py-3 rounded-xl text-sm font-medium transition-all"
              >
                Try With Your Numbers
                <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <AnimatedStat label="Current Ratio" suffix="×" value={232} started={statsInView} />
              <AnimatedStat label="DSCR Score" suffix="×" value={132} started={statsInView} />
              <AnimatedStat label="Net Working Capital" prefix="₹" value={4200000} started={statsInView} />
              <AnimatedStat label="EBITDA Margin" suffix="%" value={18} started={statsInView} />
              <AnimatedStat label="D/E Ratio" suffix="×" value={145} started={statsInView} />
              <AnimatedStat label="ISCR" suffix="×" value={287} started={statsInView} />
            </div>
          </div>
        </div>
      </section>

      {/* Calculators Grid */}
      <section className="py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-xs font-['Geist_Mono'] text-[#2563EB] uppercase tracking-widest mb-3">The Suite</p>
            <h2
              className="text-4xl lg:text-5xl font-normal text-white"
              style={{ fontFamily: "'Instrument Serif', serif" }}
            >
              9 calculators,
              <br />
              <em className="not-italic text-[#64748B]">one platform</em>
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {CALCULATORS.map((calc, i) => (
              <div
                key={calc.name}
                className="group bg-[#0D1726] border border-white/8 rounded-xl p-5 hover:border-[#2563EB]/40 transition-all duration-200 hover:-translate-y-0.5"
              >
                <div className="flex items-start justify-between mb-2">
                  <h3 className="font-medium text-white text-sm">{calc.name}</h3>
                  <span className="font-['Geist_Mono'] text-[10px] text-[#2563EB]/60 mt-0.5">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                </div>
                <p className="text-xs text-[#64748B] leading-relaxed">{calc.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-24 px-6 border-t border-white/8" ref={featRef}
        style={{ background: "linear-gradient(180deg, #050A14 0%, #07111f 100%)" }}
      >
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-xs font-['Geist_Mono'] text-[#2563EB] uppercase tracking-widest mb-3">Features</p>
            <h2
              className="text-4xl lg:text-5xl font-normal text-white"
              style={{ fontFamily: "'Instrument Serif', serif" }}
            >
              Everything a finance
              <br />
              <em className="not-italic text-[#64748B]">team needs</em>
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {FEATURES.map((feat, i) => {
              const Icon = feat.icon
              return (
                <div
                  key={feat.title}
                  className="group bg-[#0D1726] border border-white/8 rounded-xl p-6 hover:border-[#2563EB]/35 hover:-translate-y-1 transition-all duration-200"
                  style={{
                    opacity: featInView ? 1 : 0,
                    transform: featInView ? "translateY(0)" : "translateY(20px)",
                    transition: `opacity 0.5s ease ${i * 80}ms, transform 0.5s ease ${i * 80}ms, border-color 0.2s, box-shadow 0.2s`,
                  }}
                >
                  <div className="w-10 h-10 rounded-lg bg-[#2563EB]/10 border border-[#2563EB]/20 flex items-center justify-center mb-4">
                    <Icon className="w-5 h-5 text-[#2563EB]" />
                  </div>
                  <h3 className="font-medium text-white mb-2">{feat.title}</h3>
                  <p className="text-sm text-[#64748B] leading-relaxed">{feat.desc}</p>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-24 px-6 border-t border-white/8" ref={testiRef}>
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-xs font-['Geist_Mono'] text-[#2563EB] uppercase tracking-widest mb-3">Testimonials</p>
            <h2
              className="text-4xl lg:text-5xl font-normal text-white"
              style={{ fontFamily: "'Instrument Serif', serif" }}
            >
              Finance teams
              <br />
              <em className="not-italic text-[#64748B]">love FinRatio</em>
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {TESTIMONIALS.map((t, i) => (
              <div
                key={t.name}
                className="bg-[#0D1726] border border-white/8 rounded-xl p-6 flex flex-col gap-4"
                style={{
                  opacity: testiInView ? 1 : 0,
                  transform: testiInView ? "translateY(0)" : "translateY(20px)",
                  transition: `opacity 0.5s ease ${i * 100}ms, transform 0.5s ease ${i * 100}ms`,
                }}
              >
                <div className="flex text-[#10B981]">
                  {[...Array(5)].map((_, j) => <Star key={j} className="w-4 h-4 fill-current" />)}
                </div>
                <p className="text-[#F1F5F9] text-sm leading-relaxed flex-1">"{t.quote}"</p>
                <div className="flex items-center gap-3 pt-2 border-t border-white/8">
                  <div className="w-9 h-9 rounded-full bg-[#2563EB]/20 border border-[#2563EB]/30 flex items-center justify-center text-xs font-medium text-[#2563EB]">
                    {t.initials}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white">{t.name}</p>
                    <p className="text-xs text-[#64748B]">{t.role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Banner */}
      <section className="py-24 px-6 relative overflow-hidden">
        <div
          className="absolute inset-0"
          style={{ background: "linear-gradient(135deg, #1e3a8a 0%, #050A14 60%)" }}
        />
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: "linear-gradient(rgba(255,255,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        />
        <div className="relative z-10 max-w-3xl mx-auto text-center">
          <h2
            className="text-4xl lg:text-6xl font-normal text-white mb-4 leading-tight"
            style={{ fontFamily: "'Instrument Serif', serif" }}
          >
            Start your first calculation
            <br />
            <em className="not-italic text-[#64748B]">— free</em>
          </h2>
          <p className="text-[#64748B] mb-10 text-lg">No credit card. No setup. Just results.</p>
          <Link
            to="/auth/signup"
            className="inline-flex items-center gap-2 bg-white hover:bg-[#F1F5F9] text-[#050A14] px-10 py-4 rounded-xl font-semibold text-base transition-all hover:-translate-y-0.5 shadow-xl"
          >
            Get Started Now
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/8 py-10 px-6">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span
                className="text-lg font-medium text-white"
                style={{ fontFamily: "'Instrument Serif', serif" }}
              >
                FinRatio
              </span>
              <span className="text-[10px] font-['Geist_Mono'] bg-[#2563EB]/20 text-[#2563EB] border border-[#2563EB]/30 rounded px-1.5 py-0.5">β</span>
            </div>
            <p className="text-xs text-[#64748B]">Financial Intelligence for Indian Business</p>
          </div>
          <nav className="flex items-center gap-6 text-sm text-[#64748B]">
            <a href="#" className="hover:text-white transition-colors">Home</a>
            <a href="#how-it-works" className="hover:text-white transition-colors">How It Works</a>
            <Link to="/auth/signin" className="hover:text-white transition-colors">Sign In</Link>
            <Link to="/auth/signup" className="hover:text-white transition-colors">Sign Up</Link>
          </nav>
          <p className="text-xs text-[#64748B]">© 2026 FinRatio. All rights reserved.</p>
        </div>
      </footer>
    </div>
  )
}
