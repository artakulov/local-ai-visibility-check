---
name: local-ai-visibility-check
description: Measure whether AI assistants name a local business when someone asks for a provider in its area, and map which sources those answers come from. Use when asked "am I visible in ChatGPT", "AI visibility audit", "does AI recommend my business", "who does AI name instead of me".
---

# AI visibility check for a local business

Run a fixed question set through your web search, score the answers, produce a report.

## Hard rules (before anything else)

1. **An answer without a web search is `not measured`, never a zero.** Set `web_search: false` and leave it out of the denominator. Never describe an unmeasured answer as "not visible".
2. **Headline score = unbranded questions only.** Brand questions ("is X good?") almost always mention the business and would inflate it. Report them separately and say plainly they are not comparable.
3. **Three runs per question, each independent.** Report the spread. A difference smaller than the spread is noise, not movement.
4. **Do not compute the metrics yourself.** `scripts/score.js` does it. Your job is to collect answers faithfully and read the result out. Do not recalculate or round differently in your summary.
5. **A first run is a baseline.** Never use the words growth, decline or improvement on a single snapshot.
6. **Record what you actually are.** If you are a coding agent with web search, you are not the same product as the user's chat assistant: different system prompt, different search stack. Write your own name and model into `input.json` as `measured_with` and tell the user their score is not comparable to a run in a different assistant.
7. **Do not invent names or domains.** Only record business names and source domains that literally appear in the answer you received. If an answer has no citations, record an empty list, not a guess.

## Steps

1. Collect from the user: company name, website, city or neighbourhood, niche, 3-5 services they actually sell, one competitor. Write `input.json`.
   - Use the services they **sell**, not their broad category. "Sub-Zero refrigerator repair" measures something real; "appliance repair" measures a category.
   - For a large metro, use the neighbourhood or district, not the whole city. A business in one district does not compete city-wide.
2. `node scripts/build-prompts.js input.json --out results.json`
3. For each question in `results.json`, run it through your web search **three times**, independently, in the language set in `input.json`. Fill every run slot: `web_search`, `company_named`, `own_site_cited`, `named_businesses`, `cited_domains`.
4. `node scripts/score.js results.json --out report.md`
5. Read the report to the user. Lead with the source map and who gets named instead of them: those are actionable. The score alone is not.

## What to tell the user afterwards

The lever is presence in the sources the assistant actually cited, plus reviews that are recent and specific. Not "SEO text" and not a secret AI format.

Say explicitly what this did not measure: other assistants, any link to sales, and any proof that a change would cause a change in score.
