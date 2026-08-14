# CONTENT-STYLE.md — Text Content Ruleset

Binding for all new text content on this project: articles, product copy, bios, any published
prose. Applies going forward only — do not rewrite existing published content to match unless
asked. Read alongside `AGENTS.md` and `CLAUDE.md`. Every AI tool working on this project must
follow this when generating prose.

## Why this exists

Published content needs to survive scrutiny from real, knowledgeable communities in its niche
(a subreddit, a forum, industry readers) without getting flagged as "AI slop." That's a
content-quality bar (real facts, real citations, no hallucinated sources) and a *style* bar —
certain structural habits are strong statistical tells for LLM-generated text, independent of
whether the facts are right. This doc is the style half. See `CLAUDE.md`'s SEO & Content
Playbook for the ranking-mechanics half — they work together, neither replaces the other.

## Structural tells to avoid

**Em dashes.** Cap at roughly one per 150-200 words. Reach for a comma, a period, or a
parenthetical instead of defaulting to the dash. Two dashes in one sentence is a hard no.

**Rule-of-three lists.** "X, Y, and Z" repeated sentence after sentence is the single most
recognizable LLM tic. Vary it: sometimes two items, sometimes four, sometimes just one example
instead of a list at all.

**Symmetric paragraph/sentence structure.** If every paragraph in a section is the same length
and shape, or every sentence in a paragraph follows the same subject-verb-object rhythm, it
reads as generated. Mix short, blunt sentences with longer ones. Let a paragraph run four
sentences and the next one run one.

**Repetitive openers.** Don't start consecutive sentences with the same word, and avoid the
stock paragraph-starters entirely: "Additionally," "Moreover," "Furthermore," "It's worth
noting," "In conclusion," "That said." If a transition is needed, write a specific one tied to
the actual content, not a generic connector.

**False-contrast framing.** Ban "It's not just X, it's Y" and "isn't just about X — it's about
Y." These constructions manufacture drama that isn't there.

**Hedge and hype clichés.** Cut on sight: "delve into," "unlock," "landscape," "tapestry,"
"testament to," "boasts," "plays a crucial/pivotal role," "navigate," "underscore(s)," "in the
world of X," "when it comes to," "at the end of the day," "in today's ever-evolving." These are
filler that reads as generated regardless of context.

**Formulaic conclusions.** Don't close a piece by restating the intro in different words. End
on a specific fact, a genuine open question, or a direct link forward — not a summary.

## What to do instead

**Vary sentence length on purpose (burstiness).** Uniform medium-length sentences are the
clearest statistical signal of generated text. A five-word sentence next to a thirty-word one
reads human.

**Lead with specifics, not generalities.** A name, a date, an exact number does more work than
an adjective. "Founded in 1969" beats "founded some time ago"; "the $1.1M campaign" beats "a
major campaign."

**Let some friction show.** A genuine aside, an acknowledged uncertainty, an occasional
rhetorical question used sparingly — these break the too-smooth cadence that trips detectors
and, more importantly, that experienced readers recognize on sight.

**No bullet-point padding in article bodies**, unless the platform genuinely needs them
(check what the rendering layer actually supports before assuming markup is fine — forcing
real prose instead of AI-style listicle chunking is often a deliberate constraint worth
keeping, not just a limitation).

## Sourcing rules (non-negotiable, separate from style)

- Every factual claim that isn't common knowledge needs a real, checkable source.
- Never fabricate a URL, a study, a statistic, or a data point. If a fact can't be verified,
  cut it or flag it as unverified rather than inventing a citation.
- Prefer primary sources (official sites, institutional sources, peer-reviewed material) over
  secondary blogs.
- If citing an aggregator (e.g. Wikipedia) as a starting point, trace the claim to its own
  cited source where possible and cite that instead — the aggregator is an acceptable fallback,
  but a primary source is stronger for a knowledgeable audience.

## Internal linking rules

- Any entity mentioned (person, product, related topic) that has a live page on this site must
  be hotlinked on first mention.
- Do not link a name that doesn't have a live page — name it in plain text instead. Check
  before linking; don't assume a page exists.
- [Fill in this project's actual link syntax/renderer constraints once known — e.g. whether
  inline markdown links render as-is or need a renderer change first.]

## AI-generated imagery captions

Any AI-generated image gets a visible attribution/AI-generated caption per this project's
actual policy — fill in the exact wording once decided. Never republish AI-recreated
copyrighted material (movie posters, brand marks, etc.) without rights to do so.

---
*Template — adapt the bracketed sections to the real project, then delete this line. Update
this file directly whenever the project owner gives new style feedback; don't let the rules
drift back into memory-only.*
