import { LegalPageLayout, Section } from "@/components/LegalPageLayout";

const NAV = [
  { id: "acceptance", label: "Acceptance of terms" },
  { id: "about", label: "About the app" },
  { id: "accounts", label: "Accounts & invites" },
  { id: "acceptable-use", label: "Acceptable use" },
  { id: "your-content", label: "Your content" },
  { id: "not-professional-advice", label: "Not professional advice" },
  { id: "availability", label: "Availability" },
  { id: "liability", label: "Limitation of liability" },
  { id: "termination", label: "Termination" },
  { id: "changes", label: "Changes to these terms" },
];

export const metadata = {
  title: "Terms of Use | Hari-CRM",
  description: "The terms governing use of Hari-CRM.",
};

export default function TermsPage() {
  return (
    <LegalPageLayout kicker="Legal" title="Terms of Use" lastUpdated="19 August 2026" nav={NAV}>
      <Section id="acceptance" title="Acceptance of terms">
        <p>
          By signing in to Hari-CRM, you agree to these Terms of Use. If you don't agree, don't use the app.
          Terms may be updated from time to time; continued use after a change means you accept the update.
        </p>
      </Section>

      <Section id="about" title="About the app">
        <p>
          Hari-CRM is a private, invite-only personal-organizer app for a household: health & insurance records,
          finances, business project tracking, a shared calendar, and personal goals. It's built and operated
          independently, not as a commercial product with a support team or SLA — it's provided as-is, for the
          household(s) it's shared with.
        </p>
      </Section>

      <Section id="accounts" title="Accounts & invites">
        <p>
          Access is by invitation only — either a household head shares an invite code with someone joining
          their household, or the admin sets up a new household directly. Each person is responsible for keeping
          their own login credentials (and any profile PIN) confidential, and for anything entered under their
          account.
        </p>
        <p>
          A household head can control which of their financial line items (like salary, individual loans, or
          card balances) are visible to the rest of their household versus kept private to themselves — that
          choice is made per item, in the app, at the time it's entered or edited.
        </p>
      </Section>

      <Section id="acceptable-use" title="Acceptable use">
        <p>You agree not to:</p>
        <p>
          Attempt to access another household's data, bypass the invite system, or probe the app for security
          weaknesses against live household data. Use the app for any unlawful purpose. Share your login or
          invite code with anyone outside the household it was issued to, without the household head's
          knowledge.
        </p>
      </Section>

      <Section id="your-content" title="Your content">
        <p>
          You own what you enter into Hari-CRM. We don't claim any rights over your health records, financial
          data, notes, or anything else you add — we store and display it back to you (and whoever in your
          household you've chosen to share it with), and nothing more.
        </p>
      </Section>

      <Section id="not-professional-advice" title="Not professional advice">
        <p>
          Nothing in Hari-CRM — including budget projections, EMI calculations, or any other on-screen figure —
          is financial, medical, legal, or insurance advice. It's a personal record-keeping and organization
          tool. Decisions about your money, health, or insurance coverage should be made with a qualified
          professional, using this app's figures as a personal reference at most.
        </p>
      </Section>

      <Section id="availability" title="Availability">
        <p>
          The app runs on standard hosting infrastructure and, like any small independently-run service, may
          have occasional downtime, slow deploys, or maintenance windows. There's no uptime guarantee. Export
          your data periodically (Settings → Backup) if continuous availability matters to you.
        </p>
      </Section>

      <Section id="liability" title="Limitation of liability">
        <p>
          To the fullest extent permitted by law, Hari-CRM and its operator aren't liable for indirect,
          incidental, or consequential damages arising from your use of the app, including decisions made based
          on its content, or data loss beyond what a reasonable backup practice would have prevented.
        </p>
      </Section>

      <Section id="termination" title="Termination">
        <p>
          A household head can remove a member from their household at any time. The admin can suspend or remove
          a household's access if these terms are violated, or on request from the household itself (e.g. to
          delete an account). On request, a household's data can be exported before removal.
        </p>
      </Section>

      <Section id="changes" title="Changes to these terms">
        <p>
          We'll update the "last updated" date above whenever these terms change. Questions can be sent to the
          app's owner directly.
        </p>
      </Section>
    </LegalPageLayout>
  );
}
