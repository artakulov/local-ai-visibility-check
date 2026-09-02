# local-ai-visibility-check

Find out whether AI assistants name your local business when someone asks for a provider in your area, and where those answers come from.

Free. No API keys, no paid tools, no account. You need an AI assistant you already use.

Built and used by [Lira Agency](https://lira.agency) on our own local SEO clients. This is a simplified, public version of our internal audit.

## What it does

1. Builds a fixed set of questions for your niche and area (discovery, service-specific, brand, comparative).
2. You ask them, three times each, in the assistant of your choice.
3. Scores the answers, tells you who gets named instead of you, and maps which websites the assistant used as sources.

That source map is the point. It is the answer to "where do I need to be", specific to your niche and area, rather than a generic list of directories from a blog post.

## What it does NOT do

Read this before trusting any number it prints.

- **No sales attribution.** It cannot tell you whether an assistant answer produced a customer. Nobody can, reliably.
- **One assistant at a time.** Google AI Overviews, Perplexity and Gemini each have a different source map. This measures the one you ran it in.
- **No trend from one run.** A single snapshot is a baseline. Growth and decline only exist between two comparable runs on the same questions.
- **No proof of cause.** If your score moves after you change something, that is a correlation. Establishing cause needs a control page and repeat measurement.
- **No guarantees.** No vendor can guarantee that an assistant will mention you. Anyone selling that guarantee is lying to you.

## Honesty rules, enforced in code

These live in `scripts/score.js`, not in this README, because rules that live only in a README get ignored.

- An answer given **without a web search is "not measured", never a zero.** It leaves the denominator. A tool that counts unknowns as zeros makes your situation look worse than it is, which is convenient for whoever is selling you something.
- The **headline score uses unbranded questions only.** Ask an assistant "is Acme good?" and it will almost always mention Acme. Mixing brand questions into the main score inflates it.
- **Fewer than 3 runs per question raises a low-reliability flag.** Answers fluctuate between identical runs.
- The report **reports the spread between runs** and states plainly that a change smaller than the spread is noise.
- A single run **never produces the word "growth".**

## Quick start

```bash
git clone https://github.com/artakulov/local-ai-visibility-check.git
cd local-ai-visibility-check
cp templates/input.example.json input.json   # edit it: your company, area, niche, services
node scripts/build-prompts.js input.json --out results.json
```

Ask each printed question in your assistant, **three times, each in a new chat**, always in the same language. For every answer fill one run slot in `results.json`:

| Field | Meaning |
|---|---|
| `web_search` | `true` if the assistant actually searched the web, `false` if it answered from memory |
| `company_named` | `true` if your business is named in the answer |
| `own_site_cited` | `true` if your own website is among the cited sources |
| `named_businesses` | every business name in the answer, yours included |
| `cited_domains` | every source domain the answer links to |

Then:

```bash
node scripts/score.js results.json --out report.md
```

### Running it with a coding agent

If you use Claude Code, Codex CLI or Cursor, `SKILL.md` lets the agent run the whole thing for you: it asks the questions with its own web search, fills `results.json` and produces the report. Point your agent at `SKILL.md`.

Note which assistant you used. A coding agent with web search is **not** the same product as the chat assistant your customers use: different system prompt, different search stack, different answers. Keep them as separate baselines and do not compare their scores to each other.

### No terminal? Use the prompt pack

[`prompt-pack.md`](prompt-pack.md) is the same method on one page, done by hand with a scoring table. No installation. Russian version: [`prompt-pack.ru.md`](prompt-pack.ru.md).

## Scoring

Per answer: **1.0** your site is cited, **0.5** you are named without a link, **0** you are absent, **not measured** if there was no web search.

Score = sum of points / number of measured answers, as a percentage, unbranded questions only.

## Interpreting the result

**High brand score, low discovery score** is the most common pattern and it is not a contradiction. The assistant can describe you when asked by name, but does not bring you up when someone is looking for a provider. Being known and being found are different problems.

**A zero is information, not a verdict.** In our own measurements businesses with strong reviews and long histories score zero because they are absent from the handful of sources the assistant reads for that niche.

## License

MIT. Use it, fork it, run it for clients. Attribution appreciated, not required.
