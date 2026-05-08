Here's a comprehensive prompt for building the FinRatio landing page with a storyboard-style design:

---

**FinRatio — Landing Page with Storyboard Design Prompt**

Build a **single-page marketing/landing page** for **FinRatio** — a PID (Purchase Invoice Discounting) calculator SaaS for businesses. The page should feel like a **financial intelligence tool**, not a generic SaaS template. Use **Next.js 14** with **Tailwind CSS** and **Framer Motion** for animations.

---

### 🎨 Design Direction
- **Aesthetic**: Dark, premium, editorial — think Bloomberg Terminal meets Linear.app
- **Color Palette**:
  - Background: `#050A14` (deep navy black)
  - Surface: `#0D1726` (card surface)
  - Primary accent: `#2563EB` (electric blue)
  - Secondary accent: `#10B981` (profit green)
  - Text primary: `#F1F5F9`
  - Text muted: `#64748B`
  - Border: `rgba(255,255,255,0.08)`
- **Typography**:
  - Display: `Instrument Serif` (Google Fonts) — for hero headlines
  - Body/UI: `DM Sans` — clean, modern
- **Motion**: Subtle scroll-triggered fade-ups via Framer Motion (`viewport: { once: true }`). Stagger delays on card grids.

---

### 📐 Section-by-Section Storyboard

#### **Section 1 — Sticky Navbar**
- Left: `FinRatio` wordmark in white, small `β` badge in blue
- Right: `Sign In` (ghost button) + `Get Started` (solid blue button)
- On scroll: glassmorphism blur background activates (`backdrop-blur-md bg-[#050A14]/80`)
- Height: 64px, full width, `z-50`

---

#### **Section 2 — Hero**
- Layout: Centered, full viewport height
- **Eyebrow**: Small pill badge — `⚡ PID Calculator for Modern Businesses` — blue tinted background
- **Headline** (2 lines, Instrument Serif, 72px desktop):
  > *"Turn Purchase Invoices*
  > *Into Working Capital"*
- **Subheadline** (DM Sans, 18px, muted): `Calculate your PID benefit, project additional profit, and export a boardroom-ready report — in under 60 seconds.`
- **CTA Row**: `Get Started Free` (solid blue, large) + `Watch Demo →` (ghost, with play icon)
- **Social Proof Strip** below CTA: `★★★★★ Trusted by 500+ finance teams` with 4 avatar stacks (placeholder circles)
- **Hero Visual** (below or behind text): Animated mockup of the calculator split-screen UI — a subtle floating card showing live result numbers ticking up. Use CSS `@keyframes` to animate number counting.
- Background: faint radial gradient glow centered behind headline — `radial-gradient(ellipse at 50% 30%, rgba(37,99,235,0.12) 0%, transparent 70%)`

---

#### **Section 3 — How It Works (Storyboard / Journey Strip)**
- Label: `HOW IT WORKS` in small uppercase tracking-widest muted text
- **Headline**: `From inputs to insight in 4 steps`
- Layout: **Horizontal step strip** with connecting dotted line between steps on desktop; vertical stack on mobile
- 4 Steps (each is a numbered card):

| Step | Icon | Title | Description |
|------|------|-------|-------------|
| 01 | 🔐 | Create your account | Sign up in seconds with email or Google |
| 02 | 🧮 | Enter your financials | 9 inputs: sales, margins, credit terms, PID details |
| 03 | ⚡ | See live results | Gap days, PID rotation, profit impact — recalculated instantly |
| 04 | 📄 | Export your report | Download a branded PDF ready for your CFO or bank |

- Each card: dark surface, blue step number, bold title, muted description, subtle top-border accent
- **Connecting line**: `border-t-2 border-dashed border-white/10` running between cards on desktop

---

#### **Section 4 — Live Calculator Preview (Interactive Demo)**
- Label: `LIVE PREVIEW`
- **Headline**: `See it calculate in real time`
- Layout: **Split screen mockup** — left input panel, right results panel (non-functional visual demo, no backend needed)
- Left panel (dark card): Show 4–5 labelled input fields as styled `<div>` elements (not real `<input>`), with sample values pre-filled:
  - Business Type: `Manufacturer`
  - Annual Sales: `₹5,00,00,000`
  - Gross Margin: `18%`
  - PID Limit: `₹50,00,000`
  - PID Cost: `12% p.a.`
- Right panel: 6 animated result cards with **green numbers ticking up on scroll entry**:
  - Gap Days: `42`
  - PID Rotation: `8.7×`
  - Sales Generated: `₹4.35 Cr`
  - Additional Profit: `₹78.3L`
  - Net Benefit: `₹52.1L`
- Animation: Framer Motion `useInView` triggers count-up effect on each number
- CTA below: `Try With Your Numbers →`

---

#### **Section 5 — Features Grid**
- **Headline**: `Everything a finance team needs`
- Layout: **3-column grid** (2-col on tablet, 1-col mobile)
- 6 Feature Cards (dark surface, icon top-left, bold title, muted description):

| Icon | Title | Description |
|------|-------|-------------|
| ⚡ | Live recalculation | Results update on every keystroke — no submit button needed |
| 🔒 | Secure & private | JWT sessions, encrypted data, no sharing |
| 📁 | Full history | Every calculation saved and reloadable |
| 📄 | PDF export | Branded FinRatio report with one click |
| 🔄 | Tweak & compare | Reload any past calc, adjust inputs, compare scenarios |
| 🧠 | Built for India | INR-native, PID-aware, designed for Indian SMEs |

- Hover state: card border shifts from `white/8` to `blue/40`, subtle `translateY(-4px)` lift

---

#### **Section 6 — Social Proof / Testimonials**
- **Headline**: `Finance teams love FinRatio`
- Layout: 3-column card grid
- 3 Testimonial Cards:
  - *"Saved us hours every month on PID reviews."* — Rohan M., CFO, Mumbai
  - *"The PDF export alone is worth it. Banks love the format."* — Priya S., Finance Head, Pune
  - *"Finally a calculator that actually explains the math."* — Arjun K., CA, Delhi
- Each card: avatar initial circle, name, role, star rating, quote

---

#### **Section 7 — CTA Banner**
- Full-width dark blue gradient section (`from-blue-950 to-[#050A14]`)
- **Headline** (Instrument Serif, large): `Start your first calculation — free`
- **Subtext**: `No credit card. No setup. Just results.`
- **Button**: `Get Started Now →` (large, white bg, dark text)
- Background: subtle grid pattern overlay (`bg-grid-white/[0.04]`)

---

#### **Section 8 — Footer**
- Left: `FinRatio` logo + tagline `PID Intelligence for Indian Business`
- Center: Links — Home, Features, Sign In, Sign Up
- Right: `© 2025 FinRatio. All rights reserved.`
- Top border: `border-t border-white/8`

---

### ⚙️ Technical Notes
- Use `next/font` to load `Instrument_Serif` and `DM_Sans`
- Use `framer-motion` for all scroll animations (`initial={{ opacity:0, y:24 }}`, `animate={{ opacity:1, y:0 }}`)
- All CTAs should link to `/auth/signup`
- `Sign In` links to `/auth/signin`
- Page should be fully responsive (mobile-first)
- Use `clsx` or `cn()` utility for conditional class merging
- No external UI libraries — pure Tailwind only

---

Use this with **Claude**, **v0**, **Cursor**, or **Bolt** to generate the complete landing page in one pass.