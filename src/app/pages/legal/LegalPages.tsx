import React from "react"
import { Link } from "react-router"
import { LegalLayout, H, UL, ContactBlock } from "./LegalLayout"
import { LEGAL } from "./legalConfig"

const P = ({ children }: { children: React.ReactNode }) => <p>{children}</p>
const L = ({ to, children }: { to: string; children: React.ReactNode }) => (
  <Link to={to} className="text-link underline">{children}</Link>
)

export function PrivacyPage() {
  return (
    <LegalLayout title="Privacy Policy">
      <P>
        This Privacy Policy explains how {LEGAL.entity} ("we", "us") collects, uses, shares and protects personal data
        when you use {LEGAL.product} at {LEGAL.siteUrl} (the "Service"). We are the data fiduciary for the personal data
        described here and process it in line with India's Digital Personal Data Protection Act, 2023 and the
        Information Technology Act, 2000 and rules made under it.
      </P>

      <H>1. Data we collect</H>
      <UL items={[
        <><strong>Account data:</strong> your name, email address, and your password (held and hashed by Google Firebase Authentication — we never see it). If you sign in with Google we receive your Google name and email. If you sign in with a WhatsApp one-time code we process your phone number.</>,
        <><strong>Profile data:</strong> your role, account status, calculator access, and the business constitution (e.g. proprietorship, company) you choose during onboarding.</>,
        <><strong>Financial data you provide:</strong> the figures you enter into calculators, the results you save, and files you upload (such as balance sheets, up to 10 MB each).</>,
        <><strong>Invite data:</strong> the invite code you redeem and the email it was redeemed with.</>,
        <><strong>Feedback:</strong> reviews, feature requests and bug reports you send, with your email.</>,
        <><strong>Security and technical data:</strong> IP address, request and audit-log entries (for example sign-ups, role changes and file downloads by administrators), used to prevent abuse and keep the Service secure.</>,
        <><strong>Analytics (only if you accept cookies):</strong> page views and interaction data from Google Analytics and Microsoft Clarity. See the <L to="/cookies">Cookie Policy</L>.</>,
      ]} />

      <H>2. Why we use it</H>
      <UL items={[
        "To create and secure your account and provide the calculators, report generation, document parsing and saved history you ask for.",
        "To generate AI-assisted analysis of the figures or document text you choose to analyse.",
        "To operate an invite-only service, prevent abuse (rate limiting) and keep audit records.",
        "To respond to feedback and support requests, and to send invite or account emails.",
        "To understand how the Service is used and improve it — analytics only, and only with your consent.",
        "To comply with legal obligations.",
      ]} />
      <P>We do not sell your personal data and do not use your financial data for advertising.</P>

      <H>3. Legal basis</H>
      <P>
        We process your data on the basis of your consent (given when you create an account or accept cookies) and, where
        the law permits, for legitimate uses such as providing the service you requested, security, and legal compliance.
        You may withdraw consent at any time (see section 7); this does not affect processing already done.
      </P>

      <H>4. Who we share it with</H>
      <P>We use the following service providers (processors), who handle data only to provide their service to us:</P>
      <UL items={[
        "Google Firebase Authentication — sign-in and account credentials.",
        "Supabase — database and server functions that store your profile, saved calculations, uploaded files, feedback and audit logs (project hosted in Tokyo, Japan).",
        "Vercel — website hosting, delivery and cookie-free web analytics.",
        "AI providers reached through our server — Vercel AI Gateway (Google Gemini models), NVIDIA and OpenRouter — which receive the financial figures or document text you ask us to analyse, to return the analysis. Do not submit information you are not authorised to share.",
        "Resend — delivery of invite emails.",
        "A WhatsApp messaging provider — delivery of one-time sign-in codes.",
        "Google Analytics and Microsoft Clarity — analytics, only if you accept cookies.",
      ]} />
      <P>
        Some of these providers process data outside India (for example in the United States and Japan). We disclose
        data to authorities only where legally required. If the Service is ever transferred to another organisation,
        your data may transfer with it and we will tell you.
      </P>

      <H>5. Retention</H>
      <P>
        We keep your account, saved calculations and uploaded files until you delete them or your account. Audit and
        security logs are kept for as long as needed for security and legal compliance. Some copies may remain in provider
        backups for a limited period after deletion.
      </P>

      <H>6. Security</H>
      <P>
        Traffic is encrypted with HTTPS. Database access is restricted to our server functions, and administrator access is
        limited to authorised staff and logged. No system is perfectly secure; if a personal data breach affecting you
        occurs we will notify you and the authorities as the law requires.
      </P>

      <H>7. Your rights</H>
      <P>Subject to applicable law, you may:</P>
      <UL items={[
        <>access or download your data — use <strong>Export my data</strong> in your profile;</>,
        "correct inaccurate data — edit your profile, or write to us;",
        <>erase your data — use <strong>Delete account</strong> in your profile, which removes your login, profile, saved calculations and uploaded files;</>,
        "withdraw consent, including for analytics (see the Cookie Policy);",
        "nominate another person to exercise your rights in the event of your death or incapacity;",
        <>raise a grievance — see <L to="/grievance">Grievance Redressal</L>.</>,
      ]} />
      <P>
        If you are unhappy with our response you may complain to the Data Protection Board of India once it is
        operational for your type of complaint.
      </P>

      <H>8. Children</H>
      <P>The Service is intended for business users aged 18 or over. We do not knowingly collect data from children.</P>

      <H>9. Changes</H>
      <P>
        We may update this policy. The "Last updated" date shows the latest version, and we will give notice of material
        changes through the Service or by email.
      </P>

      <H>10. Contact</H>
      <ContactBlock />
    </LegalLayout>
  )
}

export function TermsPage() {
  return (
    <LegalLayout title="Terms of Use">
      <P>
        These Terms are a binding agreement between you and {LEGAL.entity} ("we", "us") for your use of {LEGAL.product}
        ({LEGAL.siteUrl}), including its calculators, document tools and AI features (the "Service"). By creating an
        account or using the Service you agree to these Terms, our <L to="/privacy">Privacy Policy</L>,{" "}
        <L to="/disclaimer">Disclaimer</L> and <L to="/cookies">Cookie Policy</L>. If you do not agree, do not use the Service.
      </P>

      <H>1. Eligibility and access</H>
      <UL items={[
        "You must be at least 18 and able to enter a binding contract. If you use the Service for a business, you confirm you are authorised to bind it.",
        "The Service is in beta and available by invite. We may change, limit or withdraw features and invites at any time.",
        "You are responsible for keeping your login secure and for all activity under your account. Tell us promptly of any unauthorised use.",
      ]} />

      <H>2. Acceptable use</H>
      <P>You agree not to:</P>
      <UL items={[
        "break the law or infringe anyone's rights, including by uploading data you have no right to share;",
        "upload malware, or attempt to probe, disrupt, overload or bypass security or rate limits;",
        "scrape, copy, resell or reverse-engineer the Service except as the law allows;",
        "use the Service to mislead lenders, auditors or authorities, or to produce documents you know to be false;",
        "share your account or invite codes with people we have not approved.",
      ]} />

      <H>3. Your content</H>
      <P>
        You keep ownership of the figures, files and other content you submit ("Your Content"). You give us a limited,
        non-exclusive licence to store, process and display it, and to send it to our service providers (including AI
        providers), solely to operate and improve the Service for you. You are responsible for the accuracy and legality of
        Your Content.
      </P>

      <H>4. Results and AI output</H>
      <P>
        Calculator results, reports and AI analysis are indicative and depend entirely on the inputs you provide. They can
        contain errors or omissions. They are not financial, credit, investment, tax, accounting or legal advice — please read
        the <L to="/disclaimer">Disclaimer</L>. You are solely responsible for decisions you make using the Service.
      </P>

      <H>5. Our intellectual property</H>
      <P>
        The Service, including its software, design, text and branding, belongs to us or our licensors and is protected by
        law. We grant you a limited, revocable, non-transferable right to use it for your own business purposes. Blog items
        that link to third-party sources remain the property of their original authors.
      </P>

      <H>6. Suspension and termination</H>
      <P>
        We may suspend or end your access if you breach these Terms, create risk or legal exposure for us or others, or if we
        discontinue the Service. You may stop using the Service and delete your account at any time from your profile.
        Sections that by nature should survive termination (such as 4, 5, 8, 9 and 10) will survive.
      </P>

      <H>7. Availability</H>
      <P>
        We aim to keep the Service running but do not promise uninterrupted or error-free operation. Planned or unplanned
        downtime, third-party outages and data loss can occur; keep your own copies of important documents.
      </P>

      <H>8. Disclaimer of warranties</H>
      <P>
        To the fullest extent permitted by law, the Service is provided "as is" and "as available", without warranties of any
        kind, express or implied, including accuracy, fitness for a particular purpose and non-infringement.
      </P>

      <H>9. Limitation of liability</H>
      <P>
        To the fullest extent permitted by law, we are not liable for indirect, incidental, special or consequential loss, or
        for loss of profit, revenue, data, goodwill or credit facilities, arising from your use of the Service. Our total
        liability for any claim is limited to the amount you paid us for the Service in the 12 months before the claim (nil
        while the Service is free). Nothing in these Terms excludes liability that cannot be excluded by law.
      </P>

      <H>10. Indemnity</H>
      <P>
        You will indemnify us against claims, losses and costs arising from Your Content, your breach of these Terms, or your
        misuse of the Service.
      </P>

      <H>11. Governing law and disputes</H>
      <P>
        These Terms are governed by the laws of India. Subject to any mandatory rights you have, the courts at{" "}
        {LEGAL.courts} have exclusive jurisdiction. Please contact us first so we can try to resolve any dispute informally.
      </P>

      <H>12. Changes</H>
      <P>
        We may update these Terms. Material changes will be notified through the Service or by email, and continued use after
        the effective date means you accept them.
      </P>

      <H>13. Contact</H>
      <ContactBlock />
    </LegalLayout>
  )
}

export function DisclaimerPage() {
  return (
    <LegalLayout title="Disclaimer">
      <P>
        {LEGAL.product} is a software tool operated by {LEGAL.entity}. Please read this Disclaimer together with the{" "}
        <L to="/terms">Terms of Use</L>.
      </P>

      <H>Not professional advice</H>
      <P>
        Nothing on {LEGAL.product} — calculators, ratios, scores, CMA reports, valuations, document extracts or AI-generated
        analysis — is financial, credit, investment, tax, accounting, audit or legal advice, or an offer, recommendation or
        solicitation of any kind. For formal advice, consult a qualified Chartered Accountant, banker, valuer or other
        professional.
      </P>

      <H>Indicative results only</H>
      <UL items={[
        "Outputs are only as good as the data you enter or upload. Typing errors, wrong units and mis-read documents change the answer.",
        "Document parsing and OCR may misread figures. Always check extracted values against the source.",
        "Valuation outputs are indicative estimates and are not a formal valuation.",
        "Benchmarks, thresholds and ratings are general guides; they may not match your lender's own policy.",
      ]} />

      <H>AI-generated content</H>
      <P>
        AI analysis is produced by third-party language models and can be wrong, incomplete or out of date. It must be reviewed
        by a person before being relied on.
      </P>

      <H>No lender or regulator endorsement</H>
      <P>
        Report formats such as CMA data follow commonly used structures but are not endorsed, certified or approved by the
        Reserve Bank of India, any bank, NBFC or other regulator or institution. Lenders may require their own formats and
        may reach different conclusions. Using {LEGAL.product} does not guarantee any loan, limit, rating or approval.
      </P>

      <H>Third-party content</H>
      <P>
        Blog items link to articles written by others, with credit to their sources. We do not control or endorse third-party
        content or sites.
      </P>

      <H>Limitation</H>
      <P>
        To the extent permitted by law, we accept no responsibility for loss arising from reliance on the Service. You use it
        at your own risk and judgement.
      </P>
      <ContactBlock />
    </LegalLayout>
  )
}

export function CookiePolicyPage() {
  function resetChoice() {
    try { localStorage.removeItem("finratio-cookie-consent") } catch { /* private mode */ }
    window.location.reload()
  }

  return (
    <LegalLayout title="Cookie Policy">
      <P>
        This page explains the cookies and similar browser storage {LEGAL.product} uses. Analytics are optional and stay off
        until you accept them.
      </P>

      <H>Essential (always on)</H>
      <UL items={[
        <>Sign-in session — Firebase Authentication keeps you signed in using browser storage; a WhatsApp sign-in stores a session token in local storage (<code>finratio_phone_token</code>).</>,
        <>Your preferences — colour theme, sidebar state (<code>sidebar_state</code> cookie) and your cookie choice (<code>finratio-cookie-consent</code>).</>,
      ]} />
      <P>These are needed for the Service to work and do not track you across sites.</P>

      <H>Analytics (only if you accept)</H>
      <UL items={[
        <><strong>Google Analytics 4</strong> (cookies such as <code>_ga</code>, <code>_ga_*</code>) — counts visits and shows how pages are used.</>,
        <><strong>Microsoft Clarity</strong> (cookies such as <code>_clck</code>, <code>_clsk</code>) — aggregate usage patterns such as clicks, scrolling and heatmaps.</>,
      ]} />
      <P>
        We also use Vercel Web Analytics, which counts page views without cookies and without identifying you personally.
      </P>

      <H>Your choice</H>
      <P>
        If you decline, no analytics cookies are set. If you accept and later change your mind, reset your choice below, decline
        when asked again, and clear cookies for this site in your browser settings to remove any already set.
      </P>
      <button
        type="button"
        onClick={resetChoice}
        className="px-4 py-2 rounded-lg border border-foreground/15 text-sm hover:bg-foreground/5 transition-colors"
      >
        Reset cookie choice
      </button>

      <P>More on how we handle personal data is in the <L to="/privacy">Privacy Policy</L>.</P>
      <ContactBlock />
    </LegalLayout>
  )
}

export function GrievancePage() {
  return (
    <LegalLayout title="Grievance Redressal">
      <P>
        If you have a complaint about the Service — including how your personal data is handled, content on the Service, or
        any breach of our policies — contact our Grievance Officer.
      </P>

      <H>Grievance Officer</H>
      <address className="not-italic border border-foreground/10 rounded-lg p-4 text-sm bg-card">
        <strong>Grievance Officer</strong>, {LEGAL.entity}
        <br />
        {LEGAL.location}
        <br />
        Email: <a className="text-link underline" href={`mailto:${LEGAL.email}`}>{LEGAL.email}</a>
        <br />
        Phone: {LEGAL.phone}
      </address>

      <H>How to complain</H>
      <UL items={[
        <>Email us at the address above with the subject line "Grievance", your registered email, and a description of the issue.</>,
        "Include any links, screenshots or documents that help us understand the problem.",
      ]} />

      <H>What to expect</H>
      <UL items={[
        `We will acknowledge your complaint within ${LEGAL.grievanceAckHours} hours.`,
        `We will aim to resolve it within ${LEGAL.grievanceResolveDays} days of receipt and tell you the outcome.`,
        "For data-protection requests (access, correction, erasure, withdrawal of consent) you can also act directly from your profile page.",
      ]} />
      <P>
        If we cannot resolve your concern you may approach the Data Protection Board of India or another authority with
        jurisdiction, as the law allows. See also our <L to="/privacy">Privacy Policy</L> and <L to="/terms">Terms of Use</L>.
      </P>
    </LegalLayout>
  )
}
