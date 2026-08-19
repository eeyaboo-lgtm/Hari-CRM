# Hari-CRM — UI/Feature Review & Improvement Suggestions
*Reviewed 2026-08-19, based on the live codebase: 8 modules (Dashboard, Calendar, Health, Finance, Business, Vision, Memberships, Settings), household/PIN auth, real Supabase data.*

## 1. Three necessary changes

**Health has zero fitness/activity tracking.** Health today only covers Conditions, Allergies, Appointments, Insurance — no workouts, meals, meds, or body metrics. For a "life dashboard" this is the single biggest gap: the health pillar handles *problems* (conditions, allergies) but nothing about staying well. Fixing this isn't a nice-to-have polish item, it's a missing pillar.

**Dashboard "Quick add" button still does nothing.** Flagged since session #6, never wired to a handler. A dead button on the page you open first, every day, quietly teaches you not to trust the other buttons either. Cheapest fix: a small modal linking into each module's real add form.

**No restore path for the admin backup.** The admin household-overview feature can export a JSON backup, but there's no import/restore flow. For a household storing real financial and health data, "we back it up but can't put it back" is a genuine risk, not a rounding-error gap.

## 2. Four more suggestions

**Global search / Cmd+K.** With 8 modules and growing rows (bills, appointments, conditions, business projects, memberships), there's no way to jump straight to "when is the ENBD loan due" without opening Finance and scrolling. A simple command palette searching titles/notes across tables pays for itself fast.

**Smart alerts, not just dashboards.** Finance already computes budget status, upcoming payments, and the Spending Plan — none of it currently *tells* anyone anything, it only waits to be looked at. Push/email nudges (budget about to go negative, subscription renewing at an elevated price, insurance lapsing in 30 days) turn a passive page into something people actually rely on. (Already sketched as "Rocket Money-style alerts" in BACKLOG.md Phase 2 — worth prioritizing.)

**Receipts & documents on every record, not just Insurance.** Health Insurance already supports file uploads; extend the same attach-a-photo pattern to Finance expenses/loans and to a new supplement/medication list, so warranty cards, receipts, and prescription photos live next to the record they belong to instead of a separate vault nobody opens.

**Shareable read-only snapshots.** A generated link (or PDF) for "this month's Spending Plan" to hand an accountant, or "current conditions & meds" before a doctor's visit — reuses data that already exists, just needs an export view with nothing sensitive beyond what's selected.

## 3. Fitness & health tracking — what disciplined/athletic people actually track

Elite and highly consistent amateur athletes track a small, repeatable set of things — not everything, just the things that predict whether they'll hit their goals:

- **Calorie & macro counter** — protein/carbs/fat, not just calories; quick-add favorites for repeat meals so daily logging takes under a minute.
- **Diet profile & intolerances** — extend the existing Allergy history into a dietary-restriction profile (gluten, lactose, shellfish, etc.) that everything else (recipes, meal plans) respects automatically instead of asking each time.
- **Recipe library with nutrition data**, filterable by that intolerance profile, feeding a weekly meal plan.
- **Meal prep → shopping list**, generated from the week's planned meals, landing in Calendar/Finance so grocery spend is visible, not a separate untracked cash leak.
- **Supplement & medication tracker** — dose, timing, refill reminders. This is currently a total gap (Health has conditions/allergies but no meds list at all), and it's exactly the kind of discipline serious athletes and anyone on a real prescription can't skip.
- **Workout log** — type, duration, sets/reps or distance/pace, with a simple weekly-volume/streak view. Doesn't need to compete with Strava; it just needs to exist so effort is visible over time.
- **Recovery basics** — sleep hours, resting heart rate, hydration, body-weight trend. Even manual daily entry (no wearable required) is what most serious athletes actually log by hand day to day — the wearable is a bonus, not the requirement.

## 4. Three ideas I'd rate hardest to live without

**A "Today" briefing — one screen, everything due today.** Bills due, appointments, planned workouts, meds to take, calendar events, all in one place. Once data lives across 8 modules, the whole point of a life dashboard collapses unless there's a single morning entry point — otherwise people drift back to checking modules individually and stop opening the app. This is the highest-leverage single addition because it's the retention hook: it's the difference between "a place I could look" and "the first thing I check."

**Medication & supplement adherence with reminders.** A household already tracking real loans and insurance is a household with real obligations — missing a dose has actual consequences, and there's currently nowhere in the app to even list what someone takes. A simple daily checklist with time-based reminders is the kind of feature people stop noticing they need, right up until it saves them from missing something that matters.

**Proactive renewal/bill "safety net" alerts.** The app already has every number it needs (Spending Plan, upcoming payments, subscription renewal dates) — it just never speaks up. A push/email 3–7 days before something renews at an elevated price, a policy lapses, or a payment is due converts a spreadsheet-shaped app into something with your back. This is the difference between a dashboard and an assistant.

## 5. Free third-party integrations worth adding

- **Open Food Facts API** — free, no API key, barcode + nutrition lookup. Powers the calorie counter above without any per-user cost.
- **Spoonacular (free tier, 50 requests/day)** — recipe search + nutrition data, filterable by the diet/intolerance profile; 50/day is plenty for a household's occasional meal-plan lookups.
- **Frankfurter.app** — free, no key, ECB-backed daily FX rates. `fx_rates` is currently hand-seeded; this would auto-refresh AED/LKR/USD (and any future currency) instead of needing manual updates.
- **Open-Meteo** — free, no key, unlimited for non-commercial use. A small weather widget helps with planning workouts, appointments, and trips right from the Dashboard.
- **Google Calendar sync** — already scaffolded and shown as "pending verification" in Calendar; free once the OAuth consent screen is verified. Keeps the shared household calendar in sync with everyone's phone calendar/reminders at no cost.

---
*None of this is built yet — this is a menu, not a commitment. Tell me which of these you want queued into `BACKLOG.md` and I'll add them in priority order.*
