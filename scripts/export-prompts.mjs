// 一次性脚本：把 lib/prompts.js 里硬编码的 SCENARIO_LABELS + SCENARIO_PROMPTS
// 导出到 data/prompts.json。跑完后 prompts.js 会改成从 JSON 读取。
//
// 用法：node scripts/export-prompts.mjs

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

const { SCENARIO_LABELS, SCENARIO_PROMPTS } = await import(
  pathToFileURL(path.join(root, "lib", "prompts.js")).href
);

const out = {
  $schema: "hazard-prompts/v1",
  generated_at: new Date().toISOString(),
  labels: SCENARIO_LABELS,
  prompts: SCENARIO_PROMPTS,
};

const outPath = path.join(root, "data", "prompts.json");
fs.writeFileSync(outPath, JSON.stringify(out, null, 2), "utf8");

const seedPath = path.join(root, "data", "prompts.seed.json");
fs.writeFileSync(seedPath, JSON.stringify(out, null, 2), "utf8");

console.log(`✓ wrote ${outPath}`);
console.log(`✓ wrote ${seedPath}`);
console.log(`  labels: ${Object.keys(SCENARIO_LABELS).length} scenarios`);
console.log(`  prompts: ${Object.keys(SCENARIO_PROMPTS).length} scenarios`);
