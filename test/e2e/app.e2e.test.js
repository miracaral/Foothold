// End-to-end checks: open index.html from disk in headless Chromium and use it like a person would.
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { chromium } = require("playwright");
const { DATA } = require("../../js/data.js");

const URL = pathToFileURL(path.join(__dirname, "..", "..", "index.html")).href;
let browser;

test.before(async () => { browser = await chromium.launch(); });
test.after(async () => { await browser.close(); });

async function open() {
  const context = await browser.newContext();
  // The app must work offline, so block every network request (web fonts included).
  await context.route(/^https?:/, route => route.abort());
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", e => errors.push(e.message));
  page.on("console", m => {
    if (m.type() === "error" && !m.text().startsWith("Failed to load resource")) errors.push(m.text());
  });
  await page.goto(URL);
  return { page, errors, context };
}

test("the page loads from file:// with every command and no errors", async () => {
  const { page, errors, context } = await open();
  await page.waitForSelector("#main .card");
  assert.equal(await page.textContent("#progress"), `0 / ${DATA.length} done`);
  assert.ok(await page.locator("#main .card").count() > 0);
  assert.deepEqual(errors, []);
  await context.close();
});

test("setting the target fills it into commands and survives a reload", async () => {
  const { page, errors, context } = await open();
  await page.fill("#var_IP", "10.10.11.42");
  await page.waitForFunction(() => document.querySelector("#main .cmd .val")?.textContent === "10.10.11.42");
  await page.reload();
  assert.equal(await page.inputValue("#var_IP"), "10.10.11.42");
  assert.deepEqual(errors, []);
  await context.close();
});

test("pasting an nmap scan shows commands for every open port", async () => {
  const { page, errors, context } = await open();
  await page.click('.mode[data-mode="scan"]');
  await page.fill("#scanInput", [
    "Nmap scan report for dc01 (10.10.11.42)",
    "445/tcp  open  microsoft-ds",
    "5985/tcp open  http  Microsoft HTTPAPI httpd 2.0"
  ].join("\n"));
  await page.click("#parseBtn");
  const headings = await page.locator("#main h2").allTextContents();
  assert.ok(headings.some(h => h.startsWith("445")), headings.join(" | "));
  assert.ok(headings.some(h => h.startsWith("5985")), headings.join(" | "));
  assert.deepEqual(errors, []);
  await context.close();
});

test("importing a backup with broken entries keeps the page working", async () => {
  const { page, errors, context } = await open();
  await page.click("#dataBtn");
  await page.fill("#dx-in", JSON.stringify({
    v: 1,
    custom: [
      { title: "Imported without tags", cmd: "whoami", phase: "privesc" },
      { title: "Missing command" }
    ],
    notes: {}, done: [], vars: { USER: "bob" }
  }));
  await page.click("#dx-import");
  await page.waitForSelector("#main .card");
  assert.equal(await page.textContent("#progress"), `0 / ${DATA.length + 1} done`);
  assert.equal(await page.inputValue("#var_USER"), "bob");
  // Search and the OS filter used to crash on entries imported without tags.
  await page.fill("#search", "whoami");
  assert.ok(await page.locator("#main .card", { hasText: "Imported without tags" }).count() === 1);
  await page.fill("#search", "");
  await page.locator("#osChips .chip", { hasText: "Linux" }).click();
  await page.waitForFunction(() => document.querySelector("#main").childElementCount > 0);
  assert.deepEqual(errors, []);
  await context.close();
});
