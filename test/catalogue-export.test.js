// The Java API serves backend/src/main/resources/catalogue.json; it must match js/data.js.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const { build, OUT } = require("../scripts/export-catalogue.js");

test("backend catalogue.json is in sync with js/data.js", () => {
  assert.equal(fs.readFileSync(OUT, "utf8"), build(),
    "Run `node scripts/export-catalogue.js` after editing js/data.js");
});
