// Integrity checks for the built-in command catalogue in js/data.js.
const test = require("node:test");
const assert = require("node:assert/strict");
const { VARS, PHASES, SERVICES, DATA, SERVICE_ALIASES, HT_SLUG } = require("../js/data.js");
const { VALID_TAGS, tokensIn } = require("../js/core.js");

const phaseIds = PHASES.map(p => p.id);
const varNames = VARS.map(v => v.k);
const label = e => `${e.phase}/${e.cat}/${e.title}`;

test("the catalogue is not empty", () => {
  assert.ok(DATA.length > 0);
});

test("every entry has the required fields", () => {
  for (const e of DATA) {
    for (const f of ["phase", "cat", "title", "cmd"]) {
      assert.equal(typeof e[f], "string", `${label(e)}: ${f}`);
      assert.ok(e[f].trim(), `${label(e)}: empty ${f}`);
    }
  }
});

test("every entry belongs to a known phase", () => {
  for (const e of DATA) assert.ok(phaseIds.includes(e.phase), `${label(e)}: unknown phase ${e.phase}`);
});

test("every phase has at least one entry", () => {
  for (const p of phaseIds) assert.ok(DATA.some(e => e.phase === p), `phase ${p} is empty`);
});

test("every entry uses known OS tags", () => {
  for (const e of DATA) {
    assert.ok(Array.isArray(e.tags) && e.tags.length, `${label(e)}: no tags`);
    for (const t of e.tags) assert.ok(VALID_TAGS.includes(t), `${label(e)}: unknown tag ${t}`);
  }
});

test("every port is valid and has a service name for the port tiles", () => {
  for (const e of DATA) {
    for (const p of e.ports || []) {
      assert.ok(Number.isInteger(p) && p >= 1 && p <= 65535, `${label(e)}: bad port ${p}`);
      assert.ok(SERVICES[p], `${label(e)}: port ${p} missing from SERVICES`);
    }
  }
});

test("every {{TOKEN}} in a command is a field in the target bar", () => {
  for (const e of DATA) {
    for (const t of tokensIn(e.cmd)) assert.ok(varNames.includes(t), `${label(e)}: {{${t}}} is not in VARS`);
  }
});

test("every entry cites an https source", () => {
  for (const e of DATA) {
    assert.ok(e.src && e.src.t && e.src.u, `${label(e)}: no source`);
    assert.match(e.src.u, /^https:\/\//, `${label(e)}: source is not https`);
  }
});

test("no two entries share the same phase, category and title", () => {
  const seen = new Set();
  for (const e of DATA) {
    const k = label(e);
    assert.ok(!seen.has(k), `duplicate entry ${k}`);
    seen.add(k);
  }
});

test("service aliases and HackTricks slugs point at valid ports", () => {
  for (const [name, p] of Object.entries(SERVICE_ALIASES)) {
    assert.ok(Number.isInteger(p) && p >= 1 && p <= 65535, `alias ${name}`);
    assert.equal(name, name.toLowerCase(), `alias ${name} must be lower case to match`);
  }
  for (const p of Object.keys(HT_SLUG)) assert.ok(+p >= 1 && +p <= 65535, `slug port ${p}`);
});
