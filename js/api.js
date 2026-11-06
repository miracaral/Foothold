/* Foothold API client: saves this browser's data to the Java API and loads it back.
   Optional. The page works fully offline without it. fetch is injected so tests can fake it. */
(function (root) {
  "use strict";

  /** Browser entry -> request body for POST /api/workspaces/{id}/commands */
  function toNewCommand(e) {
    const url = e.src && e.src.u && /^https?:\/\/\S+$/.test(e.src.u) ? e.src.u : null;
    return {
      phase: e.phase,
      category: e.cat || "Custom",
      title: e.title,
      cmd: e.cmd,
      note: e.note || null,
      tags: e.tags && e.tags.length ? e.tags : ["any"],
      ports: e.ports && e.ports.length ? e.ports : null,
      sourceUrl: url
    };
  }

  /** API command -> browser entry */
  function fromCommand(c) {
    const e = {
      id: c.id, phase: c.phase, cat: c.category, title: c.title, cmd: c.cmd, note: c.note || "",
      tags: c.tags, src: c.source ? { t: c.source.title, u: c.source.url } : null, custom: true
    };
    if (c.ports && c.ports.length) e.ports = c.ports;
    return e;
  }

  /** GET /api/workspaces/{id} -> the same shape as the Data export, ready for Core.mergeImport */
  function toBackup(view) {
    return { v: 1, custom: view.custom.map(fromCommand), notes: view.notes, done: view.done, vars: view.vars };
  }

  function client(baseUrl, fetchImpl) {
    const base = String(baseUrl || "").replace(/\/+$/, "");
    const doFetch = fetchImpl || root.fetch.bind(root);

    async function call(method, path, body) {
      const res = await doFetch(base + path, {
        method,
        headers: body === undefined ? {} : { "Content-Type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body)
      });
      if (!res.ok) {
        let detail = "";
        try { detail = (await res.json()).message || ""; } catch (_) { /* no body */ }
        throw new Error(method + " " + path + " failed: " + res.status + (detail ? " " + detail : ""));
      }
      return res.status === 204 ? null : res.json();
    }

    return {
      health: () => call("GET", "/health"),
      getWorkspace: id => call("GET", "/api/workspaces/" + encodeURIComponent(id)),

      /** Upload everything as a new workspace. Returns its id and what was saved. */
      async saveSnapshot(state) {
        const ws = await call("POST", "/api/workspaces");
        const path = "/api/workspaces/" + ws.id;
        const idMap = {};
        for (const e of state.custom) {
          const created = await call("POST", path + "/commands", toNewCommand(e));
          if (e.id) idMap[e.id] = created.id;
        }
        const noteEntries = Object.entries(state.notes).filter(([, v]) => typeof v === "string" && v.trim());
        for (const [entryId, text] of noteEntries) {
          await call("PUT", path + "/notes/" + encodeURIComponent(idMap[entryId] || entryId), { text });
        }
        const done = [...state.done];
        for (const entryId of done) {
          await call("PUT", path + "/done/" + encodeURIComponent(idMap[entryId] || entryId));
        }
        const vars = Object.fromEntries(Object.entries(state.vars).filter(([, v]) => typeof v === "string" && v.trim()));
        if (Object.keys(vars).length) await call("PUT", path + "/vars", vars);
        return { id: ws.id, commands: state.custom.length, notes: noteEntries.length, done: done.length, vars: Object.keys(vars).length };
      },

      async load(id) {
        return toBackup(await call("GET", "/api/workspaces/" + encodeURIComponent(id)));
      }
    };
  }

  const api = { client, toNewCommand, fromCommand, toBackup };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.FootholdApi = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
