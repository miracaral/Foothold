#!/usr/bin/env node
// Writes the command catalogue from js/data.js as JSON for the Java API, so both read one source.
// Usage: node scripts/export-catalogue.js [--check]
const fs = require("node:fs");
const path = require("node:path");
const { VARS, PHASES, SERVICES, DATA, SERVICE_ALIASES } = require("../js/data.js");

const OUT = path.join(__dirname, "..", "backend", "src", "main", "resources", "catalogue.json");

function build() {
  const catalogue = {
    vars: VARS.map(v => v.k),
    phases: PHASES.map(p => p.id),
    services: Object.fromEntries(Object.entries(SERVICES).map(([p, s]) => [String(p), s])),
    aliases: SERVICE_ALIASES,
    entries: DATA.map((e, i) => ({
      id: "e" + i,
      phase: e.phase,
      category: e.cat,
      title: e.title,
      cmd: e.cmd,
      note: e.note || "",
      tags: e.tags,
      ports: e.ports || [],
      source: e.src ? { title: e.src.t, url: e.src.u } : null
    }))
  };
  return JSON.stringify(catalogue, null, 2) + "\n";
}

module.exports = { build, OUT };

if (require.main === module) {
  const json = build();
  if (process.argv.includes("--check")) {
    const current = fs.existsSync(OUT) ? fs.readFileSync(OUT, "utf8") : "";
    if (current !== json) {
      console.error("catalogue.json is out of date. Run: node scripts/export-catalogue.js");
      process.exit(1);
    }
    console.log("catalogue.json is up to date");
  } else {
    fs.writeFileSync(OUT, json);
    console.log("Wrote " + path.relative(process.cwd(), OUT));
  }
}
