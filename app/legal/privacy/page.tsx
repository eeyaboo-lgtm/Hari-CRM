import { LegalPageLayout, Section } from "@/components/LegalPageLayout";

const NAV = [
  { id: "who-we-are", label: "Who we are" },
  { id: "what-we-collect", label: "What we collect" },
  { id: "sensitive-data", label: "Health & financial data" },
  { id: "household-model", label: "Household data model" },
  { id: "cookies", label: "Cookies" },
  { id: "third-parties", label: "Third-party processors" },
  { id: "security", label: "Security" },
  { id: "backups", label: "Backups & data portability" },
  { id: "children", label: "Children" },
  { id: "rights", label: "Your rights" },
  { id: "changes", label: "Changes to this policy" },
];

export const metadata = {
  title: "Privacy Policy | Hari-CRM",
  description: "How Hari-CRM collects, uses, and protects household data.",
};

export default function PrivacyPolicyPage() {
  return (
    <LegalPageLayout kicker="Legal" title="Privacy Policy" lastUpdated="19 August 2026" nav={NAV}>
      <Section id="who-we-are" title="Who we are">
        <p>
          Hari-CRM is a private, invite-only life-organizer app — health records, finances, business projects,
          and personal goals, walled off per household. It isn't a public product with a marketing site or
          self-serve signups; access is by invitation from a household head, or by the app's admin. This policy
          explains what we collect from the people who use it, why, and what choices they have.
        </p>
        <p>Questions about this policy can be sent to the app's owner directly.</p>
      </Section>

      <Section id="what-we-collect" title="What we collect">
        <p>
          <strong className="text-gray-300">Account information.</strong> When you sign in with Google, we
          receive your name, email address, and profile photo from Google — used only to create and identify
          your account. If you sign in with email and password instead, we store your email and a securely
          hashed password (never the password itself). If your household uses a shared login with individual
          profile PINs, those PINs are hashed before they're stored — nobody, including the admin, can read
          them back.
        </p>
        <p>
          <strong className="text-gray-300">Content you add.</strong> Anything you type into the app —
          appointments, notes, transaction records, project details, goals — is stored so the app can show it
          back to you (and, where you've chosen to share it, to your household). This is the core of what the
          app does; there's no way to use it without storing what you enter.
        </p>
        <p>
          <strong className="text-gray-300">Server logs.</strong> Our hosting provider automatically logs basic
          technical request data (IP address, timestamp, page requested) for security and reliability — the same
          as virtually every web application. This isn't used to profile or track individuals.
        </p>
      </Section>

      <Section id="sensitive-data" title="Health & financial data">
        <p>
          Hari-CRM is built to hold data that's more sensitive than a typical app: health conditions, allergies,
          appointments, insurance details, uploaded medical/insurance documents, income, loans, card balances,
          and other financial records. This data exists only because you or another household member chose to
          enter it, and it is never used for advertising, profiling, or sold to any third party — there's no
          business model here that involves monetizing your data.
        </p>
        <p>
          Uploaded documents (insurance cards, policy PDFs, and similar) are stored in a private storage bucket,
          not a publicly-reachable URL — only someone with the right database permissions for that specific file
          can retrieve it.
        </p>
      </Section>

      <Section id="household-model" title="Household data model">
        <p>
          Each household is isolated from every other household at the database level (row-level security) —
          members of one household cannot query or see another household's records, full stop.
        </p>
        <p>
          Within a household, the person who entered a record chooses whether to keep it private (visible only
          to them), share it read-only with the rest of the household, or make it jointly editable. Financial
          items like salary, individual loans, and card balances default to private and stay that way unless the
          entering member changes that.
        </p>
      </Section>

      <Section id="cookies" title="Cookies">
        <p>
          Hari-CRM sets one strictly-necessary cookie to keep you signed in (issued by our authentication
          provider, Supabase) and a small local note recording your cookie-banner choice. Neither is used for
          tracking or advertising. We don't currently run analytics or advertising of any kind, so no optional
          cookies exist today — see the full breakdown on our{" "}
          <a href="#" className="text-accent-blue hover:underline">
            cookie notice
          </a>{" "}
          below the banner on first visit. If that ever changes, this page and the banner will be updated first,
          and any new non-essential cookie will be opt-in.
        </p>
      </Section>

      <Section id="third-parties" title="Third-party processors">
        <p>
          A short, complete list — we don't use hidden trackers or ad networks:
        </p>
        <p>
          <strong className="text-gray-300">Supabase</strong> hosts the database, authentication, and file
          storage. <strong className="text-gray-300">Render</strong> hosts the application itself.{" "}
          <strong className="text-gray-300">Google</strong> provides the optional "Sign in with Google" option,
          under Google's own privacy policy for that exchange. None of these providers use your Hari-CRM data
          for their own purposes — they process it on our behalf, under their standard hosting/processor terms.
        </p>
      </Section>

      <Section id="security" title="Security">
        <p>
          Passwords are hashed, never stored in plain text. All traffic runs over HTTPS. Database access is
          governed by row-level security policies enforced by the database itself, not just application code —
          so even a bug in the app's UI can't normally expose one household's data to another. Two-factor
          authentication is available and recommended from Settings.
        </p>
        <p>
          No system is perfectly secure, and this is a small, independently-run app rather than an
          enterprise product with a dedicated security team — if you notice something that looks like a
          vulnerability, please report it directly rather than testing it against another household's data.
        </p>
      </Section>

      <Section id="backups" title="Backups & data portability">
        <p>
          A household's data can be exported as a JSON file from Settings, so you're never locked in and always
          have a portable copy of what you've entered. This is also what protects your data during a reset or a
          future move to different hosting.
        </p>
      </Section>

      <Section id="children" title="Children">
        <p>
          Hari-CRM isn't directed at children and isn't designed for use by anyone under 18. Household heads may
          log information about their children (e.g. a child's appointment or allergy) as part of managing their
          own household's records — that's the household head's data entry, not a child's own account.
        </p>
      </Section>

      <Section id="rights" title="Your rights">
        <p>
          You can see, edit, or delete almost everything you've entered directly in the app. For anything you
          can't — including a full account deletion, or a copy of exactly what's stored about you — contact the
          household head, or reach out to us directly, and it'll be handled personally since this is a small,
          directly-operated app rather than a large organization with a formal request process.
        </p>
      </Section>

      <Section id="changes" title="Changes to this policy">
        <p>
          We'll update the "last updated" date above whenever what we collect or how we use it changes —
          especially before anything like analytics or new integrations goes live.
        </p>
      </Section>
    </LegalPageLayout>
  );
}
