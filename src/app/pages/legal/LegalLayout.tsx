import React from "react"
import { Link } from "react-router"
import { LEGAL, LEGAL_PAGES } from "./legalConfig"

export function LegalLayout({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-background text-foreground" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      <header className="border-b border-foreground/8 px-6 py-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <Link to="/" className="text-lg font-medium" style={{ fontFamily: "'Instrument Serif', serif" }}>
            {LEGAL.product}
          </Link>
          <Link to="/" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            ← Back to home
          </Link>
        </div>
      </header>

      <article className="max-w-3xl mx-auto px-6 py-12">
        <h1 className="text-4xl font-normal mb-2" style={{ fontFamily: "'Instrument Serif', serif" }}>
          {title}
        </h1>
        <p className="text-sm text-muted-foreground mb-10">Last updated: {LEGAL.lastUpdated}</p>
        <div className="space-y-4 text-[15px] leading-relaxed text-foreground/90">{children}</div>
      </article>

      <footer className="border-t border-foreground/8 px-6 py-8">
        <nav aria-label="Legal" className="max-w-3xl mx-auto flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
          {LEGAL_PAGES.map((p) => (
            <Link key={p.path} to={p.path} className="hover:text-foreground transition-colors">
              {p.label}
            </Link>
          ))}
        </nav>
      </footer>
    </main>
  )
}

export function H({ children }: { children: React.ReactNode }) {
  return <h2 className="text-xl font-medium pt-6" style={{ fontFamily: "'Instrument Serif', serif" }}>{children}</h2>
}

export function UL({ items }: { items: React.ReactNode[] }) {
  return (
    <ul className="list-disc pl-6 space-y-1.5">
      {items.map((item, i) => <li key={i}>{item}</li>)}
    </ul>
  )
}

export function ContactBlock() {
  return (
    <address className="not-italic border border-foreground/10 rounded-lg p-4 text-sm bg-card">
      <strong>{LEGAL.entity}</strong>
      <br />
      {LEGAL.location}
      <br />
      Email: <a className="text-link underline" href={`mailto:${LEGAL.email}`}>{LEGAL.email}</a>
      <br />
      Phone: {LEGAL.phone}
      <br />
      Website: <a className="text-link underline" href={LEGAL.entityWebsite} rel="noopener noreferrer">{LEGAL.entityWebsite}</a>
    </address>
  )
}
