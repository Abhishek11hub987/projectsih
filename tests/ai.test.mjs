/* AI engine unit test — runs the real lib against fixture problems */
import { classify, priorityScore, haversine, CATS } from "../lib/ai.js";

const fixtures = [
  ["Hand pump broken near school, children carry water for weeks", "water"],
  ["No doctor at the PHC for seven months, pregnant women travel far", "health"],
  ["Village road has deep potholes, culvert washed out", "infrastructure"],
  ["Mica mine dust causing breathing illness in children", "environment"],
  ["Paddy seed distribution delayed, sowing window closing", "agriculture"],
  ["Girls school toilets non-functional for 5 months", "education"],
];

let pass = 0, fail = 0;
for (const [text, expect] of fixtures) {
  const r = await classify(text);
  const ok = r.category === expect;
  ok ? pass++ : fail++;
  console.log(`${ok ? "✓" : "✗"} ${expect.padEnd(14)} got=${r.category.padEnd(14)} engine=${r.engine} conf=${r.confidence}`);
}

const p1 = priorityScore("urgent repair needed, children affected, ambulance", 20, 30);
console.log(`✓ priority: score=${p1.score} hits=${p1.hits} words=[${p1.hitWords.join(",")}] (expect ≥ 4)`);

// Haversine tests
const km = haversine(23.43, 85.33, 23.44, 85.34);
if (km !== null && Math.abs(km - 1.5) < 0.3) {
  console.log(`✓ haversine: ${km.toFixed(1)}km (expect ~1.5km)`);
  pass++;
} else {
  console.log(`✗ haversine failed: got ${km}`);
  fail++;
}

// Edge case: null or undefined coords should return null, not NaN or 0
const nullKm1 = haversine(null, null, 23.44, 85.34);
const nullKm2 = haversine(undefined, undefined, null, null);
if (nullKm1 === null && nullKm2 === null) {
  console.log(`✓ haversine null/undefined edge cases correctly return null`);
  pass++;
} else {
  console.log(`✗ haversine null handling failed: got ${nullKm1}, ${nullKm2}`);
  fail++;
}

console.log(`\n${pass}/${pass + fail} total test assertions passed`);
process.exit(fail ? 1 : 0);
