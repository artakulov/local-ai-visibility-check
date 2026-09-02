#!/usr/bin/env node
/**
 * Scores a filled results.json and writes report.md.
 * Usage: node scripts/score.js results.json [--out report.md]
 *
 * Honesty rules are enforced here, not in the README:
 *  - not_measured is never counted as zero; it leaves the denominator.
 *  - headline score uses unbranded questions only.
 *  - fewer than 3 runs per question => low-reliability flag.
 *  - a single snapshot is a baseline; the word "growth" is not produced.
 */
const fs = require('fs');

const inPath = process.argv[2] || 'results.json';
const outIdx = process.argv.indexOf('--out');
const outPath = outIdx > -1 ? process.argv[outIdx + 1] : 'report.md';
const d = JSON.parse(fs.readFileSync(inPath, 'utf8'));

const AGGREGATORS = new Set(['yelp.com','m.yelp.com','angi.com','homeadvisor.com','bbb.org','houzz.com','expertise.com','thumbtack.com','bestprosintown.com','nextdoor.com','trustpilot.com','yellowpages.com','superpages.com','threebestrated.com','fresha.com','booksy.com','reviews.birdeye.com','consumeraffairs.com','manta.com','chamberofcommerce.com']);
const SEARCH = new Set(['google.com','bing.com','duckduckgo.com','search.yahoo.com']);
const host = (u) => String(u || '').replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0].toLowerCase();
const ownHost = host(d.input && d.input.website);

/** score one run: 1.0 own site cited, 0.5 named only, 0 absent, null not measured */
function scoreRun(r) {
  if (r.web_search === false) return null;
  if (r.company_named === null || r.company_named === undefined) return null;
  if (r.own_site_cited === true) return 1;
  return r.company_named === true ? 0.5 : 0;
}

function avsFor(prompts) {
  let sum = 0, measured = 0, notMeasured = 0;
  for (const p of prompts) for (const r of p.runs) {
    const s = scoreRun(r);
    if (s === null) { notMeasured++; continue; }
    sum += s; measured++;
  }
  return { avs: measured ? +((sum / measured) * 100).toFixed(2) : null, measured, not_measured: notMeasured };
}

function perRunAvs(prompts, runsPerPrompt) {
  const out = [];
  for (let i = 0; i < runsPerPrompt; i++) {
    let sum = 0, m = 0;
    for (const p of prompts) {
      const s = scoreRun(p.runs[i] || {});
      if (s === null) continue;
      sum += s; m++;
    }
    out.push(m ? +((sum / m) * 100).toFixed(2) : null);
  }
  return out;
}

const runsPer = d.runs_per_prompt || (d.prompts[0] ? d.prompts[0].runs.length : 0);
const unbranded = d.prompts.filter((p) => p.type === 'unbranded');
const branded = d.prompts.filter((p) => p.type === 'branded');

const headline = avsFor(unbranded);
const brandedAvs = avsFor(branded);
const spreadRuns = perRunAvs(unbranded, runsPer).filter((x) => x !== null);
const spread = spreadRuns.length > 1 ? +(Math.max(...spreadRuns) - Math.min(...spreadRuns)).toFixed(2) : null;

// competitors named (unbranded only), aggregators excluded from the denominator
const tally = new Map();
let clientMentions = 0;
const norm = (s) => String(s || '').trim().replace(/\s+/g, ' ');
const isClient = (n) => norm(n).toLowerCase() === norm(d.input.company).toLowerCase();
for (const p of unbranded) for (const r of p.runs) {
  if (scoreRun(r) === null) continue; // an unmeasured answer contributes no names
  for (const raw of r.named_businesses || []) {
    const n = norm(raw); if (!n) continue;
    if (isClient(n)) { clientMentions++; continue; }
    tally.set(n, (tally.get(n) || 0) + 1);
  }
}
const competitors = [...tally.entries()].sort((a, b) => b[1] - a[1]);
const totalMentions = clientMentions + competitors.reduce((a, [, c]) => a + c, 0);
const sov = totalMentions ? +((clientMentions / totalMentions) * 100).toFixed(2) : null;

// source map
const dom = new Map();
for (const p of d.prompts) for (const r of p.runs) {
  for (const u of r.cited_domains || []) {
    const h = host(u); if (!h || SEARCH.has(h)) continue;
    dom.set(h, (dom.get(h) || 0) + 1);
  }
}
const sources = [...dom.entries()].sort((a, b) => b[1] - a[1]);
const cls = (h) => (h === ownHost ? 'your site' : AGGREGATORS.has(h) ? 'aggregator / directory' : 'other');
const missing = sources.filter(([h]) => AGGREGATORS.has(h));

const warnings = [];
if (runsPer < 3) warnings.push(`Only ${runsPer} run(s) per question. AI answers fluctuate; 3 runs is the minimum for a reading you can act on. Treat this report as low reliability.`);
if (headline.avs === null) warnings.push('No unbranded answer could be scored. Nothing to report yet.');
const totalCells = d.prompts.length * runsPer;
const filled = d.prompts.reduce((a, p) => a + p.runs.filter((r) => r.company_named !== null && r.company_named !== undefined || r.web_search === false).length, 0);
if (filled < totalCells) warnings.push(`${totalCells - filled} of ${totalCells} answer slots are still empty. Numbers below cover only what was filled in.`);

const pct = (v) => (v === null ? 'not measured' : `${v}%`);
const L = [];
L.push(`# AI visibility snapshot: ${d.input.company}`);
L.push('');
L.push(`Location: ${d.input.location} · Niche: ${d.input.niche} · Generated: ${new Date().toISOString().slice(0, 10)}`);
L.push('');
L.push('> **This is a baseline, not a trend.** A single snapshot cannot show growth or decline. Run it again on the SAME questions in a few weeks to get a comparison.');
L.push('');
if (warnings.length) { L.push('## Read this first'); L.push(''); for (const w of warnings) L.push(`- ${w}`); L.push(''); }
L.push('## 1. Your score');
L.push('');
L.push('| Metric | Value |');
L.push('|---|---|');
L.push(`| **Discovery score** (unbranded questions) | **${pct(headline.avs)}** |`);
L.push(`| Answers scored | ${headline.measured} |`);
L.push(`| Not measured (no web search) | ${headline.not_measured} |`);
L.push(`| Spread between runs | ${spread === null ? 'n/a' : spread + ' points'} |`);
L.push(`| Brand-question score (separate, not comparable) | ${pct(brandedAvs.avs)} |`);
L.push('');
L.push('Scoring: your site cited = 1.0, named without a link = 0.5, absent = 0. Answers given without a web search are excluded from the denominator, never counted as zero.');
L.push('');
if (spread !== null) L.push(`Your runs varied by ${spread} points. Any future change smaller than that is noise, not movement.`);
L.push('');
L.push(`A high brand score with a low discovery score is the normal pattern: the assistant can describe you when asked by name, but does not bring you up when someone is looking for a provider. Those are two different problems.`);
L.push('');
L.push('## 2. Who gets named instead of you');
L.push('');
L.push(`Your share of mentions: **${sov === null ? 'not measured' : sov + '%'}**${totalMentions ? ` (${clientMentions} of ${totalMentions} business mentions)` : ''}. Directories and review platforms are sources, not competitors, so they are not counted here.`);
L.push('');
if (competitors.length) {
  L.push('| Business | Times named |'); L.push('|---|---:|');
  for (const [n, c] of competitors.slice(0, 15)) L.push(`| ${n} | ${c} |`);
} else L.push('_No competitor names were recorded._');
L.push('');
L.push('## 3. Where the answers come from');
L.push('');
L.push('This is the map of sources for YOUR niche and YOUR area. It is the answer to "where do I need to be". Do not copy a list from an article: these differ sharply by niche.');
L.push('');
if (sources.length) {
  L.push('| Domain | Citations | Type |'); L.push('|---|---:|---|');
  for (const [h, c] of sources.slice(0, 20)) L.push(`| ${h} | ${c} | ${cls(h)} |`);
} else L.push('_No cited sources were recorded._');
L.push('');
if (missing.length) {
  L.push('**Directories the assistant actually cited here:** ' + missing.slice(0, 10).map(([h]) => h).join(', ') + '.');
  L.push('');
  L.push('Check each one by hand: do you have a profile, is it claimed, is the address and phone correct, are there recent reviews. Being absent from a source the assistant reads is the most common reason a business never gets named.');
  L.push('');
}
L.push('## 4. What this report cannot tell you');
L.push('');
L.push('- Whether any of this produced a customer. There is no reliable attribution from an assistant answer to a sale.');
L.push('- Google AI Overviews, Perplexity or Gemini. This snapshot covers only the assistant you ran it in; each has a different source map.');
L.push('- Whether a change you make caused a change in the score. That needs a control page and repeat measurements.');
L.push('- Nobody, including any vendor, can guarantee that an assistant will mention you.');
L.push('');
L.push('---');
L.push('');
L.push('Method and scoring: [local-ai-visibility-check](https://github.com/artakulov/local-ai-visibility-check) · CC BY 4.0 · built by [Lira Agency](https://lira.agency)');
fs.writeFileSync(outPath, L.join('\n') + '\n');

console.log(`Discovery score (unbranded): ${pct(headline.avs)}  |  measured ${headline.measured}, not measured ${headline.not_measured}`);
if (spread !== null) console.log(`Spread between runs: ${spread} points`);
console.log(`Share of mentions: ${sov === null ? 'not measured' : sov + '%'}`);
for (const w of warnings) console.log(`! ${w}`);
console.log(`\nReport written to ${outPath}`);
