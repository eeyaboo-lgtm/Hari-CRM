import { LegalPageLayout, Section } from "@/components/LegalPageLayout";

const NAV = [
  { id: "getting-in", label: "Getting in" },
  { id: "joining-household", label: "Joining a household" },
  { id: "profiles-pins", label: "Profiles & PINs" },
  { id: "dashboard", label: "Dashboard" },
  { id: "calendar", label: "Calendar" },
  { id: "health", label: "Health & Insurance" },
  { id: "finance", label: "Finance" },
  { id: "sharing", label: "Sharing controls" },
  { id: "business-vision", label: "Business & Vision" },
  { id: "settings", label: "Settings" },
  { id: "backups", label: "Backups" },
  { id: "troubleshooting", label: "Troubleshooting" },
];

export const metadata = {
  title: "Instructions for Use | Hari-CRM",
  description: "A detailed walkthrough of how to use Hari-CRM.",
};

export default function InstructionsPage() {
  return (
    <LegalPageLayout kicker="Legal" title="Instructions for Use" lastUpdated="19 August 2026" nav={NAV}>
      <Section id="getting-in" title="Getting in">
        <p>
          You need an invitation to use Hari-CRM — either an invite code from a household head, or a household
          set up directly by the admin. On the sign-in screen, use "Sign in with Google" for a one-click login,
          or email + password if you'd rather keep it separate from your Google account. Forgot your password?
          Use the "Forgot?" link on the sign-in screen.
        </p>
      </Section>

      <Section id="joining-household" title="Joining a household">
        <p>
          If someone shares an invite code with you (household heads generate these from Settings → "Invite a
          member"), open the link they send you, or go to the Join page and enter the code. If you're not
          signed in yet, you'll be prompted to sign in with Google or create an email/password account first —
          then the code is applied automatically and you land in that household.
        </p>
        <p>
          Each invite code can be set to expire or to allow a limited number of uses, and a household head can
          revoke a code at any time from Settings if it was shared by mistake.
        </p>
      </Section>

      <Section id="profiles-pins" title="Profiles & PINs">
        <p>
          Some households share one login between members (like a couple sharing one Google account) — in that
          case, each person gets their own on-device profile with an optional 4–6 digit PIN, picked from a
          Netflix-style "who's using this" screen every time the app is opened on that browser. If you signed in
          with your own Google or email account instead, you skip straight to your own data — no PIN screen.
        </p>
        <p>
          PINs are set from the profile-picker screen the first time, and can be changed later from Settings.
          They're hashed before being stored, so nobody — including the admin — can read your PIN back.
        </p>
      </Section>

      <Section id="dashboard" title="Dashboard">
        <p>
          Your home screen: a snapshot of this month's spending, bills due in the next two weeks, quick-launch
          shortcuts you can customize, and a spending-trend chart. It's a summary view — the real data lives in
          each section below.
        </p>
      </Section>

      <Section id="calendar" title="Calendar">
        <p>
          A shared household calendar. Bills and loan/subscription payments you've logged in Finance show up
          here automatically on their due date — no extra data entry. Click any date to see what's happening
          that day and add an appointment, business event, or other entry; anything you add here is visible to
          the whole household and any member can edit or remove it. Google Calendar sync is planned but locked
          until the app has a verified domain (see the sync card on the Calendar page for status).
        </p>
      </Section>

      <Section id="health" title="Health & Insurance">
        <p>
          Log conditions, allergy history (with a status of confirmed/suspected/tested-safe), appointments, and
          insurance policies per household member, including uploaded policy documents or insurance cards.
          Everything here defaults to private to the person who entered it — see "Sharing controls" below to
          change that.
        </p>
      </Section>

      <Section id="finance" title="Finance">
        <p>
          Accounts, cards, loans (with automatic EMI calculation), subscriptions, income, expenses, and
          multi-item payment schemes (e.g. school fees split across terms), each with support for multiple
          currencies. Set a monthly budget to get a live under/near/over-budget status indicator. Everything you
          add here is what powers the Dashboard's bill reminders and the Calendar's payment overlay.
        </p>
      </Section>

      <Section id="sharing" title="Sharing controls">
        <p>
          Most entries across Health and Finance have a visibility setting, controlled by whoever created the
          entry: <strong className="text-gray-300">private</strong> (only you can see or edit it),{" "}
          <strong className="text-gray-300">shared</strong> (the rest of your household can see it, but only you
          can edit or delete it), or <strong className="text-gray-300">joint</strong> (anyone in the household
          can see, edit, or delete it). This is how a household head keeps something like their individual salary
          or personal loan private while still sharing joint expenses or the family calendar.
        </p>
      </Section>

      <Section id="business-vision" title="Business & Vision">
        <p>
          Business Projects tracks side projects and ventures with their own status/notes. Vision & Mood Board is
          a personal goals space — add goals, track progress, and build a visual mood board for what you're
          working toward.
        </p>
      </Section>

      <Section id="settings" title="Settings">
        <p>
          Manage your profile, PIN, and two-factor authentication. Household heads generate and revoke invite
          codes here too.
        </p>
      </Section>

      <Section id="backups" title="Backups">
        <p>
          From Settings, a household head can download a complete JSON export of their household's data —
          useful before a reset, or simply as your own portable copy. Keep a recent export somewhere safe if you
          want extra peace of mind beyond what's already stored in the database.
        </p>
      </Section>

      <Section id="troubleshooting" title="Troubleshooting">
        <p>
          <strong className="text-gray-300">Wrong household showing up on a shared device?</strong> Use "Not
          your household? Log out" on the profile-picker screen, then sign in with the correct account.
        </p>
        <p>
          <strong className="text-gray-300">Forgot your PIN?</strong> Sign out and back in with your full
          account credentials, then reset it from Settings.
        </p>
        <p>
          <strong className="text-gray-300">Something looks wrong or missing?</strong> Data syncs live to the
          household database — a refresh usually resolves a stale view. If a problem persists, contact the app's
          owner directly.
        </p>
      </Section>
    </LegalPageLayout>
  );
}
