const test = require("node:test");
const assert = require("node:assert/strict");
const core = require("../js/core.js");
const { SERVICES, SERVICE_ALIASES } = require("../js/data.js");

test("resolveCmd fills known tokens and keeps unknown ones as placeholders", () => {
  const cmd = "nmap -p {{PORTS}} {{IP}} -oN {{OUT}}";
  assert.equal(core.resolveCmd(cmd, { IP: "10.10.10.5", PORTS: "22,80" }), "nmap -p 22,80 10.10.10.5 -oN {{OUT}}");
});

test("resolveCmd treats empty values as missing", () => {
  assert.equal(core.resolveCmd("ssh {{USER}}@{{IP}}", { USER: "", IP: "1.2.3.4" }), "ssh {{USER}}@1.2.3.4");
});

test("tokenize splits a command into text, values and placeholders", () => {
  assert.deepEqual(core.tokenize("a {{IP}} b {{USER}}", { IP: "1.1.1.1" }), [
    { type: "text", text: "a " },
    { type: "val", text: "1.1.1.1", name: "IP" },
    { type: "text", text: " b " },
    { type: "ph", text: "{{USER}}", name: "USER" }
  ]);
});

test("tokenize is stateless across calls", () => {
  const first = core.tokenize("{{IP}}", {});
  const second = core.tokenize("{{IP}}", {});
  assert.deepEqual(first, second);
});

test("tokensIn lists each token once in order", () => {
  assert.deepEqual(core.tokensIn("{{USER}}:{{PASS}}@{{IP}} {{USER}}"), ["USER", "PASS", "IP"]);
});

const NMAP = `Starting Nmap 7.94 ( https://nmap.org )
Nmap scan report for dc01.corp.local (10.10.11.42)
Host is up (0.031s latency).
PORT     STATE    SERVICE       VERSION
22/tcp   open     ssh           OpenSSH 8.9p1 Ubuntu 3ubuntu0.6
80/tcp   open     http          nginx 1.18.0
135/tcp  filtered msrpc
445/tcp  open     microsoft-ds?
5985/tcp open     http          Microsoft HTTPAPI httpd 2.0
`;

test("detect reads open ports, services and products from nmap output", () => {
  const { ports, ip } = core.detect(NMAP, SERVICES, SERVICE_ALIASES);
  assert.equal(ip, "10.10.11.42");
  assert.deepEqual(ports.map(p => p.port), [22, 80, 445, 5985]);
  assert.equal(ports[0].service, "ssh");
  assert.equal(ports[0].product, "OpenSSH 8.9p1 Ubuntu 3ubuntu0.6");
  assert.equal(ports[2].service, "microsoft-ds?");
  assert.equal(ports[2].product, "");
});

test("detect does not swallow the next port when a line has no version column", () => {
  const { ports } = core.detect("445/tcp open microsoft-ds\n5985/tcp open http Microsoft HTTPAPI", SERVICES, SERVICE_ALIASES);
  assert.deepEqual(ports.map(p => p.port), [445, 5985]);
  assert.equal(ports[0].product, "");
});

test("detect ignores filtered and closed ports", () => {
  const { ports } = core.detect(NMAP, SERVICES, SERVICE_ALIASES);
  assert.ok(!ports.some(p => p.port === 135));
});

test("detect accepts a plain IP in the scan report line", () => {
  assert.equal(core.detect("Nmap scan report for 192.168.1.20\n22/tcp open ssh", SERVICES, SERVICE_ALIASES).ip, "192.168.1.20");
});

test("detect rejects an IP with an octet above 255", () => {
  assert.equal(core.detect("Nmap scan report for 10.10.300.1\n22/tcp open ssh", SERVICES, SERVICE_ALIASES).ip, null);
});

test("detect falls back to bare port numbers and fills known service names", () => {
  const { ports, ip } = core.detect("22, 445 and 3389", SERVICES, SERVICE_ALIASES);
  assert.equal(ip, null);
  assert.deepEqual(ports.map(p => p.port), [22, 445, 3389]);
  assert.equal(ports[0].service, SERVICES[22].toLowerCase());
});

test("detect maps service names to ports when no numbers are given", () => {
  const { ports } = core.detect("there is redis and winrm on this box", SERVICES, SERVICE_ALIASES);
  assert.deepEqual(ports.map(p => p.port), [5985, 6379]);
});

test("detect drops out-of-range port numbers", () => {
  const { ports } = core.detect("0 70000 8080", SERVICES, SERVICE_ALIASES);
  assert.deepEqual(ports.map(p => p.port), [8080]);
});

test("detect handles empty and non-string input", () => {
  assert.deepEqual(core.detect("", SERVICES, SERVICE_ALIASES), { ports: [], ip: null });
  assert.deepEqual(core.detect(undefined), { ports: [], ip: null });
});

test("matchesOs keeps 'any' entries under every filter", () => {
  assert.ok(core.matchesOs({ tags: ["any"] }, "windows"));
  assert.ok(core.matchesOs({ tags: ["linux"] }, "all"));
  assert.ok(!core.matchesOs({ tags: ["linux"] }, "windows"));
});

test("matchesOs and matchesQuery do not crash on entries without tags", () => {
  assert.ok(!core.matchesOs({}, "linux"));
  assert.ok(core.matchesQuery({ title: "Kerberoasting" }, "kerb"));
});

test("matchesQuery searches title, note, command, tags and category case-insensitively", () => {
  const e = { title: "Pass-the-hash", note: "Reuse NTLM", cmd: "nxc smb {{IP}}", tags: ["ad"], cat: "SMB" };
  for (const q of ["PASS-THE", "ntlm", "nxc smb", "ad", "smb"]) assert.ok(core.matchesQuery(e, q), q);
  assert.ok(!core.matchesQuery(e, "kerberos"));
  assert.ok(core.matchesQuery(e, ""));
});

test("parsePorts keeps valid unique ports from free text", () => {
  assert.deepEqual(core.parsePorts("80, 443 8080/tcp 80 0 99999"), [80, 443, 8080]);
  assert.deepEqual(core.parsePorts(""), []);
});

test("normalizeEntry requires a title and a command", () => {
  assert.equal(core.normalizeEntry({ title: "x" }), null);
  assert.equal(core.normalizeEntry({ cmd: "x" }), null);
  assert.equal(core.normalizeEntry("not an object"), null);
});

test("normalizeEntry fills safe defaults", () => {
  const e = core.normalizeEntry({ title: " Scan ", cmd: " nmap {{IP}} " }, 123);
  assert.deepEqual(e, {
    phase: "enum", cat: "Custom", tags: ["any"], title: "Scan", cmd: "nmap {{IP}}",
    note: "", src: null, custom: true, _t: 123
  });
});

test("normalizeEntry drops unknown phases, tags and invalid ports", () => {
  const e = core.normalizeEntry({ title: "t", cmd: "c", phase: "pwn", tags: ["linux", "evil"], ports: [22, -1, 70000, "443"] });
  assert.equal(e.phase, "enum");
  assert.deepEqual(e.tags, ["linux"]);
  assert.deepEqual(e.ports, [22, 443]);
});

test("normalizeEntry turns a URL into a named source", () => {
  assert.deepEqual(core.normalizeEntry({ title: "t", cmd: "c", src: "https://www.netexec.wiki/smb" }).src,
    { t: "netexec.wiki", u: "https://www.netexec.wiki/smb" });
  assert.deepEqual(core.normalizeEntry({ title: "t", cmd: "c", src: "notes.txt" }).src, { t: "source", u: "notes.txt" });
});

test("buildPool assigns ids and returns sorted unique ports", () => {
  const data = [{ ports: [445, 22] }, {}];
  const custom = [{ ports: [22, 8080], _t: 5 }];
  const { pool, ports } = core.buildPool(data, custom);
  assert.equal(pool.length, 3);
  assert.deepEqual(pool.map(e => e.id), ["e0", "e1", "c0_5"]);
  assert.deepEqual(ports, [22, 445, 8080]);
});

const empty = () => ({ custom: [], notes: {}, done: new Set(), vars: {} });

test("mergeImport merges notes, progress and target variables", () => {
  const state = { custom: [], notes: { e1: "old" }, done: new Set(["e1"]), vars: { IP: "1.1.1.1" } };
  const r = core.mergeImport(state, { notes: { e2: "new" }, done: ["e2"], vars: { USER: "bob" } });
  assert.deepEqual(r.notes, { e1: "old", e2: "new" });
  assert.deepEqual([...r.done].sort(), ["e1", "e2"]);
  assert.deepEqual(r.vars, { IP: "1.1.1.1", USER: "bob" });
});

test("mergeImport does not mutate the current state", () => {
  const state = empty();
  core.mergeImport(state, { custom: [{ title: "t", cmd: "c" }], notes: { a: "b" } });
  assert.deepEqual(state, empty());
});

test("mergeImport skips invalid and duplicate custom entries instead of breaking the page", () => {
  const state = empty();
  state.custom.push({ id: "c0_1", title: "Existing", cmd: "x", tags: ["any"] });
  const r = core.mergeImport(state, {
    custom: [
      { id: "c0_1", title: "Existing", cmd: "x" },   // duplicate
      { title: "No tags", cmd: "whoami" },            // valid, gets defaults
      { title: "No command" },                        // invalid
      null,                                           // invalid
      { id: "c9", title: "Tagged", cmd: "id", tags: ["linux"] }
    ]
  });
  assert.equal(r.added, 2);
  assert.equal(r.skipped, 3);
  assert.ok(r.custom.every(e => Array.isArray(e.tags) && e.tags.length));
});

test("mergeImport ignores values of the wrong type", () => {
  const r = core.mergeImport(empty(), { notes: { a: 1 }, done: [1, "e3"], vars: { IP: { x: 1 } } });
  assert.deepEqual(r.notes, {});
  assert.deepEqual([...r.done], ["e3"]);
  assert.deepEqual(r.vars, {});
});

test("mergeImport rejects a backup that is not an object", () => {
  assert.throws(() => core.mergeImport(empty(), null));
  assert.throws(() => core.mergeImport(empty(), "text"));
});

test("htGuess links to the HackTricks page for a known port", () => {
  assert.equal(core.htGuess(22, { 22: "pentesting-ssh.html" }),
    "https://book.hacktricks.wiki/en/network-services-pentesting/pentesting-ssh.html");
  assert.equal(core.htGuess(9999, {}), "https://book.hacktricks.wiki/");
});
