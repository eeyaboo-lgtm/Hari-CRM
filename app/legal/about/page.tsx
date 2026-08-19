import { LegalPageLayout, Section } from "@/components/LegalPageLayout";

const NAV = [
  { id: "what-it-is", label: "What Hari-CRM is" },
  { id: "whats-inside", label: "What's inside" },
  { id: "who-its-for", label: "Who it's for" },
  { id: "roadmap", label: "What's still being built" },
  { id: "contact", label: "Contact" },
];

export const metadata = {
  title: "About | Hari-CRM",
  description: "What Hari-CRM is and who it's built for.",
};

export default function AboutPage() {
  return (
    <LegalPageLayout kicker="Legal" title="About Hari-CRM" lastUpdated="19 August 2026" nav={NAV}>
      <Section id="what-it-is" title="What Hari-CRM is">
        <p>
          Hari-CRM is a private life-organizer for a household — one place for health records, finances,
          business projects, a shared calendar, and personal goals, instead of scattered spreadsheets, notes
          apps, and bank statements. It started as a personal project and is now being opened up, carefully, to
          a small number of other households as test users.
        </p>
      </Section>

      <Section id="whats-inside" title="What's inside">
        <p>
          <strong className="text-gray-300">Health &amp; Insurance</strong> — conditions, allergy history,
          appointments, and insurance policy details per household member.
        </p>
        <p>
          <strong className="text-gray-300">Finance</strong> — accounts, cards, loans, subscriptions, income,
          expenses, and payment schemes, with EMI and budget-status math built in.
        </p>
        <p>
          <strong className="text-gray-300">Calendar</strong> — a shared household calendar that automatically
          surfaces upcoming bills alongside appointments and events anyone in the household adds.
        </p>
        <p>
          <strong className="text-gray-300">Business Projects &amp; Vision</strong> — tracking for side
          projects, ideas, and personal/household goals.
        </p>
      </Section>

      <Section id="who-its-for" title="Who it's for">
        <p>
          Hari-CRM is invite-only — there's no public signup. A household head can invite others to join their
          household with their own Google or email login (each person's data stays attributed to them, with
          fine control over what's shared within the household versus kept private), and the app's admin can set
          up entirely new, fully isolated households for other families or individuals to trial.
        </p>
      </Section>

      <Section id="roadmap" title="What's still being built">
        <p>
          Google Calendar two-way sync is wired up but locked until the app has a verified domain and passes
          Google's OAuth review. A few other pieces are still being refined as more households come on board.
          Being upfront about what's finished versus in progress matters more here than looking feature-complete.
        </p>
      </Section>

      <Section id="contact" title="Contact">
        <p>Questions, feedback, or a data request — reach out to the app's owner directly.</p>
      </Section>
    </LegalPageLayout>
  );
}
