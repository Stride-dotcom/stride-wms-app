#!/usr/bin/env node

import { readdirSync, readFileSync, existsSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

const args = new Set(process.argv.slice(2));
const isDryRun = args.has("--dry-run");

const pendingDir = resolve("docs/ledger/packets/pending");
const requiredSections = [
  "## Decision Index Rows",
  "## Detailed Decision Entries",
  "## Implementation Log Rows",
];

function listMarkdownFiles(dir) {
  const out = [];
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      out.push(...listMarkdownFiles(full));
    } else if (entry.toLowerCase().endsWith(".md")) {
      out.push(full);
    }
  }
  return out.sort();
}

function unique(values) {
  return [...new Set(values)];
}

function extractIds(text, pattern) {
  return unique(Array.from(text.matchAll(pattern)).map((m) => m[0]));
}

function validatePacket(path) {
  const content = readFileSync(path, "utf8");
  const missingSections = requiredSections.filter((section) => !content.includes(section));

  const sectionIndexes = requiredSections.map((section) => content.indexOf(section));
  const orderedSections =
    sectionIndexes.every((idx) => idx >= 0) &&
    sectionIndexes[0] < sectionIndexes[1] &&
    sectionIndexes[1] < sectionIndexes[2];

  const decisionIds = extractIds(content, /\bDL-\d{4}-\d{2}-\d{2}-\d{3}\b/g);
  const eventIds = extractIds(content, /\bDLE-\d{4}-\d{2}-\d{2}-\d{3}\b/g);

  const errors = [];
  if (missingSections.length > 0) {
    errors.push(`Missing sections: ${missingSections.join(", ")}`);
  }
  if (!orderedSections) {
    errors.push("Required sections are not in expected order.");
  }
  if (decisionIds.length === 0) {
    errors.push("No decision IDs found (DL-...).");
  }
  if (eventIds.length === 0) {
    errors.push("No event IDs found (DLE-...).");
  }

  return {
    path,
    decisionIds,
    eventIds,
    errors,
  };
}

const files = listMarkdownFiles(pendingDir);
if (files.length === 0) {
  console.error(`No pending packets found in ${pendingDir}`);
  process.exit(1);
}

const results = files.map(validatePacket);
const errors = results.flatMap((r) => r.errors.map((message) => ({ path: r.path, message })));

console.log(isDryRun ? "Ledger packet dry-run summary" : "Ledger packet validation summary");
console.log(`Pending directory: ${pendingDir}`);
console.log(`Packets discovered: ${results.length}`);

for (const result of results) {
  console.log(`\n- ${result.path}`);
  console.log(`  decisions: ${result.decisionIds.length} (${result.decisionIds.join(", ")})`);
  console.log(`  events: ${result.eventIds.length} (${result.eventIds.join(", ")})`);
  if (result.errors.length === 0) {
    console.log("  status: OK");
  } else {
    console.log("  status: ERROR");
    for (const err of result.errors) {
      console.log(`    - ${err}`);
    }
  }
}

if (errors.length > 0) {
  console.error("\nPacket validation failed:");
  for (const err of errors) {
    console.error(`- ${err.path}: ${err.message}`);
  }
  process.exit(1);
}

if (isDryRun) {
  console.log("\nDry-run validation passed. No files were modified.");
} else {
  console.log("\nValidation passed. Packet apply mode is not implemented in this runtime.");
}
