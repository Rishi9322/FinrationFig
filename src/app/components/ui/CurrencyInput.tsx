import { useState } from "react"

interface CurrencyInputProps {
  label: string
  value: string
  onChange: (value: string) => void
  error?: string
  placeholder?: string
  helperText?: string
}

export function CurrencyInput({
  label,
  value,
  onChange,
  error,
  placeholder = "0",
  helperText,
}: CurrencyInputProps) {
  const [isFocused, setIsFocused] = useState(false)

  const displayValue = isFocused ? value : value ? formatDisplay(value) : ""

  function formatDisplay(val: string): string {
    const num = parseFloat(val)
    if (isNaN(num)) return val
    return new Intl.NumberFormat("en-IN").format(num)
  }

  return (
    <div className="space-y-1.5" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      <label className="block text-sm font-medium text-[#F1F5F9]">{label}</label>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8] text-sm font-['Geist_Mono']">₹</span>
        <input
          id={label}
          type="text"
          value={displayValue}
          onChange={(e) => {
            const val = e.target.value.replace(/[^0-9.]/g, "")
            onChange(val)
          }}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder={placeholder}
          className={`w-full pl-8 pr-4 py-2.5 bg-[#050A14] border rounded-lg text-[#F1F5F9] text-sm font-['Geist_Mono'] placeholder:text-[#94A3B8]/50 focus:outline-none transition-colors ${
            error
              ? "border-[#ef4444]/50 focus:border-[#ef4444]"
              : "border-white/10 focus:border-[#2563EB]/60 focus:ring-1 focus:ring-[#2563EB]/20"
          }`}
        />
      </div>
      {helperText && !error && <p className="text-xs text-[#94A3B8]">{helperText}</p>}
      {error && <p className="text-xs text-[#ef4444]">{error}</p>}
    </div>
  )
}
