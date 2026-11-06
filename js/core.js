/* Foothold core: pure functions with no DOM or storage access.
   index.html calls these; test/ exercises them directly in Node. */
(function (root) {
  "use strict";

  const TOKEN = /\{\{(\w+)\}\}/g;
  const VALID_PHASES = ["recon", "enum", "access", "privesc", "lateral", "web", "post"];
  const VALID_TAGS = ["linux", "windows", "ad", "web", "net", "any"];

  /** Replace every {{TOKEN}} with its value; unknown or empty tokens stay as placeholders. */
  function resolveCmd(cmd, vars) {
    return String(cmd).replace(TOKEN, (_, name) => (vars && vars[name]) || "{{" + name + "}}");
  }

  /** Split a command into text / filled value / placeholder parts for rendering. */
  function tokenize(cmd, vars) {
    const parts = [];
    const s = String(cmd);
    const re = new RegExp(TOKEN.source, "g");
    let last = 0, m;
    while ((m = re.exec(s))) {
      if (m.index > last) parts.push({ type: "text", text: s.slice(last, m.index) });
      const val = vars && vars[m[1]];
      parts.push(val ? { type: "val", text: val, name: m[1] } : { type: "ph", text: "{{" + m[1] + "}}", name: m[1] });
      last = re.lastIndex;
    }
    if (last < s.length) parts.push({ type: "text", text: s.slice(last) });
    return parts;
  }

  /** Names of all {{TOKENS}} used in a command, in order of first use. */
  function tokensIn(cmd) {
    return [...new Set([...String(cmd).matchAll(TOKEN)].map(m => m[1]))];
  }

  const validPort = p => Number.isInteger(p) && p >= 1 && p <= 65535;

  /**
   * Find open ports and the target IP in pasted text.
   * Accepts `nmap -sV` output first; otherwise falls back to bare port numbers and service names.
   */
  function detect(text, services, aliases) {
    services = services || {};
    aliases = aliases || {};
    text = String(text || "");
    const out = new Map();

    const nmap = /^[ \t]*(\d{1,5})\/(tcp|udp)[ \t]+open[ \t]+(\S+)(?:[ \t]+(.*))?$/gim;
    let m;
    while ((m = nmap.exec(text))) {
      const p = +m[1];
      if (validPort(p) && !out.has(p)) out.set(p, { port: p, proto: m[2], service: m[3], product: (m[4] || "").trim() });
    }

    if (out.size === 0) {
      const bare = /\b(\d{1,5})\b(?:[\/\s]+(?:tcp|udp)\b)?(?:\s+([a-z][a-z0-9_.\/-]{1,24}))?/gi;
      let b;
      while ((b = bare.exec(text))) {
        const p = +b[1];
        if (!validPort(p)) continue;
        if (!out.has(p)) out.set(p, { port: p, service: (b[2] || services[p] || "").toLowerCase(), product: "" });
      }
      const low = " " + text.toLowerCase() + " ";
      Object.keys(aliases).forEach(name => {
        if (low.includes(name)) {
          const p = aliases[name];
          if (!out.has(p)) out.set(p, { port: p, service: name, product: "" });
        }
      });
    }

    const ports = [...out.values()].sort((a, b) => a.port - b.port);
    const im = text.match(/(?:scan report for|for)\s+(?:[\w.-]+\s+\()?(\d{1,3}(?:\.\d{1,3}){3})\)?/i);
    const ip = im && im[1].split(".").every(o => +o <= 255) ? im[1] : null;
    return { ports, ip };
  }

  function matchesOs(entry, osFilter) {
    const tags = entry.tags || [];
    return osFilter === "all" || tags.includes(osFilter) || tags.includes("any");
  }

  function matchesQuery(entry, query) {
    if (!query) return true;
    const hay = [entry.title, entry.note, entry.cmd, (entry.tags || []).join(" "), entry.cat].join(" ");
    return hay.toLowerCase().includes(query.toLowerCase());
  }

  /** Parse a free-text port list such as "80, 443 8080" into valid unique ports. */
  function parsePorts(input) {
    return [...new Set(String(input || "").split(/[^\d]+/).map(Number).filter(validPort))];
  }

  /**
   * Turn user input (the Add form or an imported JSON object) into a safe entry,
   * or return null when it cannot be one.
   */
  function normalizeEntry(raw, now) {
    if (!raw || typeof raw !== "object") return null;
    const title = String(raw.title || "").trim();
    const cmd = String(raw.cmd || "").trim();
    if (!title || !cmd) return null;
    const tags = (Array.isArray(raw.tags) ? raw.tags : []).filter(t => VALID_TAGS.includes(t));
    const ports = Array.isArray(raw.ports) ? raw.ports.map(Number).filter(validPort) : parsePorts(raw.ports);
    const e = {
      phase: VALID_PHASES.includes(raw.phase) ? raw.phase : "enum",
      cat: String(raw.cat || "").trim() || "Custom",
      tags: tags.length ? tags : ["any"],
      title,
      cmd,
      note: String(raw.note || "").trim(),
      src: normalizeSrc(raw.src),
      custom: true,
      _t: raw._t || now || Date.now()
    };
    if (ports.length) e.ports = ports;
    if (raw.id) e.id = String(raw.id);
    return e;
  }

  function normalizeSrc(src) {
    if (!src) return null;
    if (typeof src === "object" && src.u) return { t: String(src.t || "source"), u: String(src.u) };
    const url = String(src).trim();
    if (!url) return null;
    try {
      return { t: new URL(url).hostname.replace(/^www\./, ""), u: url };
    } catch (_) {
      return { t: "source", u: url };
    }
  }

  /** Give every entry a stable id and collect the sorted list of ports they cover. */
  function buildPool(data, custom) {
    data.forEach((e, i) => { e.id = "e" + i; });
    custom.forEach((e, i) => { e.id = e.id || "c" + i + "_" + (e._t || Date.now()); e.custom = true; });
    const pool = data.concat(custom);
    const ports = [...new Set(pool.flatMap(e => e.ports || []))].sort((a, b) => a - b);
    return { pool, ports };
  }

  /**
   * Merge an exported backup into the current state without losing anything already there.
   * Invalid custom entries are dropped instead of breaking the page.
   */
  function mergeImport(state, incoming) {
    if (!incoming || typeof incoming !== "object") throw new Error("Backup must be a JSON object");
    const custom = state.custom.slice();
    const notes = Object.assign({}, state.notes);
    const done = new Set(state.done);
    const vars = Object.assign({}, state.vars);
    let added = 0, skipped = 0;

    if (Array.isArray(incoming.custom)) {
      const ids = new Set(custom.map(x => x.id));
      incoming.custom.forEach(raw => {
        const e = normalizeEntry(raw);
        if (!e || (e.id && ids.has(e.id))) { skipped++; return; }
        custom.push(e);
        if (e.id) ids.add(e.id);
        added++;
      });
    }
    if (incoming.notes && typeof incoming.notes === "object") {
      Object.entries(incoming.notes).forEach(([k, v]) => { if (typeof v === "string") notes[k] = v; });
    }
    if (Array.isArray(incoming.done)) incoming.done.forEach(x => { if (typeof x === "string") done.add(x); });
    if (incoming.vars && typeof incoming.vars === "object") {
      Object.entries(incoming.vars).forEach(([k, v]) => { if (typeof v === "string") vars[k] = v; });
    }
    return { custom, notes, done, vars, added, skipped };
  }

  function htGuess(port, slugs) {
    const s = slugs && slugs[port];
    return s ? "https://book.hacktricks.wiki/en/network-services-pentesting/" + s : "https://book.hacktricks.wiki/";
  }

  const api = {
    VALID_PHASES, VALID_TAGS,
    resolveCmd, tokenize, tokensIn, detect, matchesOs, matchesQuery,
    parsePorts, normalizeEntry, buildPool, mergeImport, htGuess
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.FootholdCore = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
