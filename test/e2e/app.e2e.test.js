// End-to-end checks: open index.html from disk in headless Chromium and use it like a person would.
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { chromium } = require("playwright");
const { DATA } = require("../../js/data.js");

const PAGE_URL = pathToFileURL(path.join(__dirname, "..", "..", "index.html")).href;
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
  await page.goto(PAGE_URL);
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

test("saving to the API server and loading in a fresh browser restores the data", async () => {
  // In-memory stand-in for the Java API, served through Playwright's request interception.
  const store = {};
  let next = 1;
  const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS" };
  async function fakeApi(route) {
    const req = route.request();
    const path = new URL(req.url()).pathname;
    const reply = (status, body) => route.fulfill({ status, headers: { ...cors, "Content-Type": "application/json" },
      body: body === undefined ? "" : JSON.stringify(body) });
    if (req.method() === "OPTIONS") return reply(204);
    const body = req.postData() ? JSON.parse(req.postData()) : undefined;
    let m;
    if (req.method() === "POST" && path === "/api/workspaces") {
      const id = "ws-" + next++;
      store[id] = { id, createdAt: "2026-11-06T00:00:00Z", vars: {}, custom: [], notes: {}, done: [] };
      return reply(201, store[id]);
    }
    if ((m = path.match(/^\/api\/workspaces\/([^/]+)$/)) && store[m[1]]) return reply(200, store[m[1]]);
    if ((m = path.match(/^\/api\/workspaces\/([^/]+)\/vars$/))) { Object.assign(store[m[1]].vars, body); return reply(200, store[m[1]].vars); }
    if ((m = path.match(/^\/api\/workspaces\/([^/]+)\/done\/(.+)$/))) { store[m[1]].done.push(m[2]); return reply(204); }
    return reply(404, { message: "Not Found" });
  }

  const first = await open();
  await first.context.route("http://api.test/**", fakeApi);
  await first.page.fill("#var_IP", "10.10.11.42");
  await first.page.locator("#main .card .chk").first().click();
  await first.page.click("#dataBtn");
  await first.page.fill("#dx-api", "http://api.test");
  await first.page.click("#dx-save");
  await first.page.waitForFunction(() => document.querySelector("#dx-ws").value.startsWith("ws-"));
  const id = await first.page.inputValue("#dx-ws");
  assert.deepEqual(first.errors, []);
  await first.context.close();

  const second = await open();
  await second.context.route("http://api.test/**", fakeApi);
  await second.page.click("#dataBtn");
  await second.page.fill("#dx-api", "http://api.test");
  await second.page.fill("#dx-ws", id);
  await second.page.click("#dx-load");
  await second.page.waitForFunction(() => document.querySelector("#var_IP").value === "10.10.11.42");
  assert.match(await second.page.textContent("#progress"), /^1 \//);
  assert.deepEqual(second.errors, []);
  await second.context.close();
});
