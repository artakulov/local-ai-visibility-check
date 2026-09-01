#!/usr/bin/env node
/**
 * Builds the question set and an empty results file.
 * Usage: node scripts/build-prompts.js input.json [--out results.json]
 */
const fs = require('fs');

const inPath = process.argv[2] || 'input.json';
const outIdx = process.argv.indexOf('--out');
const outPath = outIdx > -1 ? process.argv[outIdx + 1] : 'results.json';

const cfg = JSON.parse(fs.readFileSync(inPath, 'utf8'));
const need = ['company', 'location', 'niche'];
for (const k of need) {
  if (!cfg[k]) { console.error(`input.json: missing required field "${k}"`); process.exit(1); }
}
const services = Array.isArray(cfg.services) ? cfg.services.filter(Boolean) : [];
const runs = Number(cfg.runs_per_prompt) || 3;
const L = cfg.location, N = cfg.niche, C = cfg.company;

const prompts = [];
const add = (type, text) => prompts.push({ id: `p${String(prompts.length + 1).padStart(2, '0')}`, type, text });

// unbranded: generic discovery
add('unbranded', `Who is the best ${N} company in ${L}? Give specific company names.`);
add('unbranded', `What are the top-rated ${N} providers in ${L}?`);
add('unbranded', `Can you recommend a reliable ${N} company in ${L}?`);
// unbranded: consumer scenario
add('unbranded', `I need ${N} in ${L}. Which local businesses should I consider?`);
add('unbranded', `I care about quality and reviews. Which ${N} company in ${L} would you recommend?`);
// unbranded: service specific
for (const s of services.slice(0, 5)) {
  add('unbranded', `Who is the best company for ${s} in ${L}? Give specific company names.`);
}
for (const s of services.slice(0, 3)) {
  add('unbranded', `I need ${s} in ${L} - which company should I call?`);
}
// branded
add('branded', `Is ${C} a good choice for ${N} in ${L}?`);
add('branded', `What do customers say about ${C} in ${L}?`);
add('branded', `Would you recommend ${C} for ${N} in ${L}?`);
// comparative
if (cfg.competitor) {
  add('comparative', `${C} vs ${cfg.competitor} for ${N} in ${L} - which is better?`);
  add('comparative', `How does ${C} compare to ${cfg.competitor} in ${L}?`);
}

const results = {
  input: cfg,
  runs_per_prompt: runs,
  generated_at: new Date().toISOString(),
  prompts: prompts.map((p) => ({
    ...p,
    runs: Array.from({ length: runs }, () => ({
      web_search: null,
      company_named: null,
      own_site_cited: null,
      named_businesses: [],
      cited_domains: [],
    })),
  })),
};

fs.writeFileSync(outPath, JSON.stringify(results, null, 2));

const counts = prompts.reduce((a, p) => ((a[p.type] = (a[p.type] || 0) + 1), a), {});
console.log(`\n${prompts.length} questions (${JSON.stringify(counts)}), ${runs} runs each = ${prompts.length * runs} answers to collect.\n`);
for (const p of prompts) console.log(`[${p.type}] ${p.id}  ${p.text}`);
console.log(`\nEmpty results file written to ${outPath}`);
console.log(`Rules: same language every time, ask each question in a NEW chat, ${runs} times.`);
console.log(`If the assistant answered WITHOUT searching the web, set web_search=false. That is "not measured", not a zero.\n`);
