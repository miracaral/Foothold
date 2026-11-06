const test = require("node:test");
const assert = require("node:assert/strict");
const api = require("../js/api.js");

/** A tiny in-memory stand-in for the Java API, enough to exercise the client. */
function fakeServer() {
  const calls = [];
  const ws = { id: "ws-1", createdAt: "2026-11-06T00:00:00Z", vars: {}, custom: [], notes: {}, done: [] };
  let next = 1;
  const json = (status, body) => ({ ok: status < 400, status, json: async () => body });
  async function fetch(url, init) {
    const path = url.replace("http://api.test", "");
    const body = init.body ? JSON.parse(init.body) : undefined;
    calls.push([init.method, path, body]);
    if (init.method === "POST" && path === "/api/workspaces") return json(201, ws);
    if (init.method === "POST" && path.endsWith("/commands")) {
      if (body.phase === "bad") return json(400, { message: "phase: must match" });
      const c = { id: "w" + next++, phase: body.phase, category: body.category, title: body.title, cmd: body.cmd,
        note: body.note || "", tags: body.tags, ports: body.ports || [], source: body.sourceUrl ? { title: "x", url: body.sourceUrl } : null, custom: true };
      ws.custom.push(c);
      return json(201, c);
    }
    let m;
    if ((m = path.match(/\/notes\/(.+)$/))) { ws.notes[decodeURIComponent(m[1])] = body.text; return json(204); }
    if ((m = path.match(/\/done\/(.+)$/))) { ws.done.push(decodeURIComponent(m[1])); return json(204); }
    if (path.endsWith("/vars")) { Object.assign(ws.vars, body); return json(200, ws.vars); }
    if (init.method === "GET" && path === "/api/workspaces/ws-1") return json(200, ws);
    return json(404, { message: "Not Found" });
  }
  return { fetch, calls, ws };
}

const STATE = {
  custom: [
    { id: "c0_1", phase: "privesc", cat: "Linux", title: "SUID", cmd: "find / -perm -4000", note: "",
      tags: ["linux"], ports: [22], src: { t: "gtfobins", u: "https://gtfobins.github.io/" }, custom: true },
    { id: "c1_2", phase: "enum", cat: "Custom", title: "Local note", cmd: "cat notes.txt", note: "",
      tags: ["any"], src: { t: "source", u: "notes.txt" }, custom: true }
  ],
  notes: { e3: "try anonymous login", c0_1: "worked on box X", e9: " " },
  done: new Set(["e1", "c0_1"]),
  vars: { IP: "10.10.11.42", USER: "" }
};

test("toNewCommand keeps http(s) sources only and fills defaults", () => {
  assert.deepEqual(api.toNewCommand(STATE.custom[1]), {
    phase: "enum", category: "Custom", title: "Local note", cmd: "cat notes.txt",
    note: null, tags: ["any"], ports: null, sourceUrl: null
  });
  assert.equal(api.toNewCommand(STATE.custom[0]).sourceUrl, "https://gtfobins.github.io/");
});

test("saveSnapshot uploads commands, then notes and progress under the new server ids", async () => {
  const server = fakeServer();
  const result = await api.client("http://api.test/", server.fetch).saveSnapshot(STATE);

  assert.deepEqual(result, { id: "ws-1", commands: 2, notes: 2, done: 2, vars: 1 });
  assert.deepEqual(server.ws.notes, { e3: "try anonymous login", w1: "worked on box X" });
  assert.deepEqual(server.ws.done, ["e1", "w1"]);
  assert.deepEqual(server.ws.vars, { IP: "10.10.11.42" });
  assert.equal(server.calls[0][1], "/api/workspaces", "no double slash after trimming the base URL");
});

test("load returns a backup that Core.mergeImport accepts", async () => {
  const server = fakeServer();
  const c = api.client("http://api.test", server.fetch);
  await c.saveSnapshot(STATE);
  const backup = await c.load("ws-1");

  assert.equal(backup.custom.length, 2);
  assert.deepEqual(backup.custom[0], {
    id: "w1", phase: "privesc", cat: "Linux", title: "SUID", cmd: "find / -perm -4000", note: "",
    tags: ["linux"], ports: [22], src: { t: "x", u: "https://gtfobins.github.io/" }, custom: true
  });
  const core = require("../js/core.js");
  const merged = core.mergeImport({ custom: [], notes: {}, done: new Set(), vars: {} }, backup);
  assert.equal(merged.added, 2);
  assert.equal(merged.vars.IP, "10.10.11.42");
});

test("server errors surface with status and message", async () => {
  const server = fakeServer();
  const bad = { custom: [{ phase: "bad", title: "t", cmd: "c", tags: ["any"] }], notes: {}, done: new Set(), vars: {} };
  await assert.rejects(api.client("http://api.test", server.fetch).saveSnapshot(bad),
    /POST \/api\/workspaces\/ws-1\/commands failed: 400 phase: must match/);
  await assert.rejects(api.client("http://api.test", server.fetch).load("missing"), /404/);
});
