# Foothold

[![CI](https://github.com/miracaral/Foothold/actions/workflows/ci.yml/badge.svg)](https://github.com/miracaral/Foothold/actions/workflows/ci.yml)

A single-page methodology reference for CTFs and lab pentesting. Set your target once and every command fills itself in — then work the engagement by phase, jump straight to a service by port, or paste an Nmap scan and get the commands for exactly what is open.

No build step, no backend, no database. It is a static page (`index.html` plus two plain scripts) that runs entirely in the browser, even straight from disk.

## Why

Every box starts the same way: a dozen tools, the same flags, the same `<IP>` typed over and over. Cheat sheets help, but you still copy a command and hand-edit it for your target. Foothold keeps the whole methodology in one place and fills your target details into every command automatically, so the reference keeps up with you instead of slowing you down.

## Features

- **Three ways in**
  - *Playbook* — the kill-chain by phase: Recon → Enumeration → Foothold → Privilege Escalation → AD / Lateral → Web → Post.
  - *By Port* — pick a service (21, 22, 88, 445, 1433, 3389, 5985 …) and get its commands.
  - *Scan* — paste raw `nmap -sC -sV` output, a banner, or just port numbers / service names. It pulls out the open ports and the target IP and shows the commands for each.
- **Set the target once** — IP, DOMAIN, USER, PASS, HASH, LHOST/LPORT, WORDLIST. Every `{{VARIABLE}}` across the whole UI updates live.
- **Grows with you** — a scan turns up a port the library doesn't cover yet? One click opens a pre-filled form to add it, so your own notes and commands become part of the reference.
- **Make it yours** — add your own commands from the UI, attach a personal note to any card, and track progress per command. Export and import everything as JSON to move it between machines.
- **Sourced** — every built-in command links to the public reference it comes from (HackTricks, GTFOBins, official docs).

## Run it

Open `index.html` in a browser. That's it — no server or install needed.

### Deploy

It is a static page, so any static host works:

- **GitHub Pages** — Settings → Pages → Source: `main` / root.
- **Vercel / Netlify** — drag the folder in, or point it at this repo.

## Extend

Every card is one object in the `DATA` array in [`js/data.js`](js/data.js):

```js
{ phase:"lateral", cat:"Active Directory", tags:["ad"], ports:[445],
  title:"Dump secrets",
  cmd:"impacket-secretsdump {{DOMAIN}}/{{USER}}:{{PASS}}@{{IP}}",
  note:"Pull hashes once you have admin on the host.",
  src:{t:"Impacket", u:"https://github.com/fortra/impacket"} }
```

Any `{{TOKEN}}` in a command becomes a target field automatically. Add a new service by giving it a `ports` array and, if you want a tile for it, a label in `SERVICES`.

## API server (optional)

The page never needs a server. If you want your custom commands, notes and progress stored centrally, run the **Java API** in [`backend/`](backend) and use *Data → Save to server* / *Load from server*.

- **Stack:** Java 17, Micronaut 4, Maven, Micronaut Data JDBC on **Oracle Database**, schema migrations with Flyway.
- **Endpoints:**

| Method | Path | What it does |
| --- | --- | --- |
| GET | `/api/commands?phase=&port=&os=&q=` | Built-in catalogue with filters |
| GET | `/api/commands/{id}` | One command |
| POST | `/api/scan` | Parse pasted Nmap output, return commands for each open port |
| POST | `/api/workspaces` | Create a workspace (id is an unguessable UUID) |
| GET / DELETE | `/api/workspaces/{id}` | Read or delete everything in it |
| POST / DELETE | `/api/workspaces/{id}/commands[/{n}]` | Add or remove a custom command |
| PUT / DELETE | `/api/workspaces/{id}/notes/{entryId}` | Set or clear a note |
| PUT / DELETE | `/api/workspaces/{id}/done/{entryId}` | Mark or unmark progress |
| PUT | `/api/workspaces/{id}/vars` | Merge target values |
| GET | `/health` | Liveness/readiness including the database |

- **One catalogue:** `js/data.js` stays the source of truth. `node scripts/export-catalogue.js` writes `backend/src/main/resources/catalogue.json`, and a test fails if they drift apart. The Java `NmapParser` is a port of the browser parser and has the same test cases.

### Run it locally

```bash
docker compose up --build
# front end  http://localhost:8000
# API        http://localhost:8080/api/commands
```

### Deploy to Kubernetes

Manifests in [`k8s/`](k8s): a namespace with Pod Security `restricted`, Oracle as a StatefulSet with a volume, the API as a 2-replica Deployment with health probes and a read-only root filesystem, and default-deny network policies that only let the API reach the database. CI publishes the image to `ghcr.io/miracaral/foothold-api` on every push to `main`.

```bash
cp k8s/examples/secret.example.yaml k8s/01-secret.yaml
sed -i "s/change-me-system/Fh$(openssl rand -hex 16)/; s/change-me-app/Fh$(openssl rand -hex 16)/" k8s/01-secret.yaml
kubectl apply -f k8s/
```

## Project layout

```
index.html        UI: markup, styles and DOM wiring
js/data.js        command catalogue, target fields, service and port tables
js/core.js        pure logic: templating, Nmap parsing, filtering, input validation, backup import
js/api.js         optional client for the API server
backend/          Java 17 / Micronaut REST API on Oracle Database (Maven)
k8s/              Kubernetes manifests
scripts/          catalogue export for the backend
test/             unit tests for js/, catalogue integrity and sync tests
test/e2e/         browser tests that open index.html from disk in headless Chromium
```

The logic in `js/core.js` has no DOM or storage access, so it runs unchanged in the browser and in Node. Both scripts load as classic `<script>` tags, which keeps the page working when opened via `file://`.

## Tests

```bash
npm test               # unit + catalogue tests (Node's built-in test runner, no dependencies)
npm ci && npx playwright install chromium
npm run test:e2e       # end-to-end tests in headless Chromium
```

- **Unit tests** cover `{{TOKEN}}` templating, the Nmap parser (version columns, filtered ports, bare port lists, service names, invalid ports and IPs), search and OS filters, input validation and backup merging.
- **Catalogue tests** check every built-in command: known phase and tags, valid ports that have a service name, every `{{TOKEN}}` defined as a target field, an https source and no duplicates. A bad edit to `js/data.js` fails CI instead of shipping.
- **End-to-end tests** load the page with all network access blocked and drive it like a user: set a target and reload, paste a scan, import a backup with broken entries, search and filter.

- **Java tests** (`cd backend && mvn verify`): JUnit 5 unit tests for the Nmap parser, and HTTP integration tests that start a real **Oracle Database Free** container with Testcontainers, apply the Flyway schema and exercise every endpoint, including validation errors and cross-workspace access.

GitHub Actions runs on every push and pull request: Node tests on Node 20 and 22, browser tests, the Java build with Oracle integration tests, a Docker Compose smoke test of the API with Oracle, and Kubernetes manifest validation.

## Scope

Reference material compiled from public sources, for authorized testing and CTF practice only.

## License

[MIT](LICENSE)
