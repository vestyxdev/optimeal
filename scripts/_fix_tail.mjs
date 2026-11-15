import fs from "node:fs";
const t = "src/lib/generator/generator.test.ts";
const s = fs.readFileSync(t, "utf8");
// remove the literal \n-fragment appended by the failed PowerShell append
const idx = s.indexOf('\\ndescribe("tydenni rotace rodin"');
if (idx === -1) {
  console.log("fragment not found; tail:", JSON.stringify(s.slice(-80)));
} else {
  fs.writeFileSync(t, s.slice(0, idx));
  console.log("truncated at", idx);
}
