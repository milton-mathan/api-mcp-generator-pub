# Instructions

Complete guide to installing, using, deploying, and troubleshooting the
API MCP Generator.

- [Installation](#installation)
- [Using the application](#using-the-application)
- [Running the generated server](#running-the-generated-server)
- [Development](#development)
- [Deployment](#deployment)
- [Security](#security)
- [Troubleshooting](#troubleshooting)

---

## Installation

### Requirements

- **Node.js 18 or newer** (required by Vite 5)
- **npm** (ships with Node)
- A modern browser — Chrome, Firefox, Safari, or Edge

To run a *generated* MCP server you also need **Python 3.8 – 3.12**. Python is not
needed to run this application itself.

### Setup

```bash
git clone https://github.com/milton-mathan/api-mcp-generator-pub.git
cd api-mcp-generator-pub
npm install
npm run dev
```

The dev server starts on **http://localhost:3000** and opens your browser
automatically. If port 3000 is in use, Vite picks the next free port and prints
the actual URL.

To use a specific port:

```bash
npm run dev:4000    # also available: dev:3000, dev:5000, dev:8080
```

There is nothing to configure. The application reads no environment variables and
needs no API keys or backend service.

---

## Using the application

### 1. Provide a specification

Four options:

- **Upload** — drag-and-drop or pick a JSON/YAML file
- **URL** — fetch from a remote documentation site
- **Paste** — paste the raw specification text
- **Samples** — `sample-api.json` / `sample-api.yaml` in the repo root

Supported: OpenAPI 3.1, OpenAPI 3.0, and Swagger 2.0.

Parsing happens entirely in your browser. The specification is never transmitted
anywhere, so internal or unreleased API specs are safe to load.

If the spec has problems, you'll see errors (blocking, with the offending field
path) and warnings (advisory — generation still proceeds).

### 2. Explore the endpoints

Browse via tree, table, or card view. Search and filter by path, method, tag, or
authentication requirement. Select an endpoint to inspect its parameters, request
body, responses, and security requirements.

### 3. Select endpoints

Tick the endpoints you want exposed as MCP tools. You don't have to take the whole
API — a focused server with ten well-chosen tools is usually more useful to an AI
assistant than one with two hundred.

### 4. Configure generation

| Setting | Notes |
|---|---|
| **Server name** | Used for the Python package and ZIP filename |
| **Base URL** | Where the generated server sends its requests |
| **Framework** | FastMCP (recommended) or basic `mcp.server` |
| **Tool naming** | From `operationId`, from the path, or custom |
| **Authentication** | Per endpoint — see below |
| **Transport** | stdio only — HTTP mode is disabled, see below |
| **Python version** | 3.8 – 3.12 |
| **Error handling** | Basic or detailed |

**Authentication** is configured per endpoint. You supply the *name* of an
environment variable, not the secret itself — the credential is read at runtime by
the generated server and never written into the source or the ZIP.

Supported: Bearer tokens, API keys (header or query), Basic auth, OAuth 2.0, and
custom header schemes.

### 5. Generate and export

Review the generated code in the preview, then download. **Download ZIP Package**
gives you the whole project as a proper archive. Individual files can be
downloaded or copied separately.

---

## Running the generated server

After extracting the ZIP:

```bash
cd your-api-mcp-server

# 1. Install dependencies
pip install -r requirements.txt

# 2. Configure credentials
cp .env.example .env
#    then edit .env and fill in your values

# 3. Run
python server.py
```

On Windows use `py` instead of `python`, and `copy` instead of `cp`.

A virtual environment is recommended:

```bash
python -m venv .venv
source .venv/bin/activate      # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

### How the server runs

```bash
python server.py           # starts, then waits for a client on stdin
```

MCP is a **stdio protocol**: the server reads JSON-RPC from stdin and writes
replies to stdout. Running it by hand is only a smoke test — it prints a
startup line to stderr and then sits there. That is correct behaviour, not a
hang. Nothing more happens until a client connects, because **the client is
what launches the server**; it is not a service you start first and attach to.

> **There is no HTTP mode.** Neither template implements one, and passing
> `--http` only logs a warning and starts in stdio anyway. To expose the same
> API over HTTP, wrap the `APIClient` class in `server.py` with FastAPI or
> Flask yourself.

### Connecting to Claude Desktop

Add the server to your Claude Desktop configuration:

```json
{
  "mcpServers": {
    "your-api-server": {
      "command": "python",
      "args": ["/absolute/path/to/your-api-mcp-server/server.py"],
      "env": {
        "API_KEY": "your_api_key_here"
      }
    }
  }
}
```

Use an **absolute path**. Restart Claude Desktop after editing the config.

Config file locations:

| OS | Path |
|---|---|
| macOS | `~/Library/Application Support/Claude/claude_desktop_config.json` |
| Windows | `%APPDATA%\Claude\claude_desktop_config.json` |

### Testing the server

Download `test_client.py` from the results screen, put it beside `server.py`, and
run it. It discovers the server's tools, builds sample arguments from each tool's
schema, calls them, and reports what passed.

```bash
python test_client.py
```

The client **starts its own copy of `server.py`** over stdio. Do not run the
server in another terminal first — that would be a second, unrelated process.
Run the client from the virtualenv the dependencies are installed in: it
launches the server with the same interpreter it is running under.

---

## Development

### Commands

```bash
npm run dev            # Dev server on port 3000
npm run build          # Type-check (tsc) then build to dist/
npm run preview        # Serve the production build locally
npm test               # Tests in watch mode
npm run test:run       # Tests once
npm run test:coverage  # Tests with coverage report
npm run test:ui        # Vitest UI
npm run test:e2e       # End-to-end tests only
npm run lint           # ESLint — zero warnings enforced
npm run format         # Prettier
npm run validate       # lint + test:run + build:validate
```

`npm run validate` is the full gate and is what CI should run. Note that
`npm run lint` uses `--max-warnings 0`, so a single warning fails the build.

### Project layout

```
src/
├── components/     React components
├── services/       Parsing, extraction, generation, export
├── store/          Zustand stores (app state, cache)
├── types/          Shared TypeScript types
├── test/           Test setup and helpers
└── __tests__/      Integration and end-to-end tests
```

Services carry the logic and are the best place to start reading. The generation
pipeline runs `specParser` → `specValidator` → `endpointExtractor` →
`endpointNormalizer` → `mcpCodeGenerator` → `exportService`.

### Testing

Tests run under Vitest with jsdom. Unit tests sit in `__tests__` directories
beside the code they cover; integration and E2E tests live in `src/__tests__/`.

Tests must not reach the network — a suite that fetches a live URL fails whenever
the network is unavailable or `fetch` is stubbed. Use a committed fixture instead;
`src/services/__tests__/fixtures/` has an example.

---

## Deployment

This application is a **static single-page app**. `npm run build` produces a
`dist/` directory of static files that can be served by any web server or static
host. There is no backend, no database, and no server-side configuration.

```bash
npm run build            # outputs to dist/
npm run build:validate   # build, then run the build validator
```

The production bundle is roughly 366 KB across all assets, split into vendor, UI,
utility, and JSZip chunks.

### Static hosts

```bash
# Netlify
npm run build && npx netlify deploy --prod --dir=dist

# Vercel
npm run build && npx vercel --prod

# GitHub Pages
npm run build && npx gh-pages -d dist
```

For AWS S3, upload the contents of `dist/` to a bucket configured for static
website hosting, and put CloudFront in front of it if you want a CDN.

### Serving it yourself

Because it's a single-page app, the server must fall back to `index.html` for
unknown paths. An nginx server block that does this, with sensible caching and
security headers:

```nginx
server {
    listen 80;
    server_name _;
    root /usr/share/nginx/html;
    index index.html;

    gzip on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/javascript application/javascript application/json;

    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header Referrer-Policy "strict-origin-when-cross-origin";

    # Hashed asset filenames are safe to cache indefinitely
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # SPA fallback
    location / {
        try_files $uri $uri/ /index.html;
    }

    location ~ /\. {
        deny all;
    }
}
```

Vite emits content-hashed asset filenames, so the long cache lifetime above is
safe — but `index.html` itself must **not** be cached aggressively, or browsers
will keep loading stale asset references.

> The repository does not ship a `Dockerfile`, `nginx.conf`, or CI workflow for
> this application. The configuration above is a starting point to adapt, not a
> file that exists in the repo. (The `Dockerfile` you may see referenced elsewhere
> belongs to the *generated* MCP servers, not to this app.)

---

## Security

### Reporting a vulnerability

Please **don't** open a public issue for a security problem. Report it privately
through GitHub's advisory flow:

**https://github.com/milton-mathan/api-mcp-generator-pub/security/advisories/new**

Useful things to include: the type of issue, the affected source files, the steps
to reproduce, and the impact you think it has.

This is an educational project maintained by one person — there is no SLA, and
fixes happen on a best-effort basis.

### How the application handles your data

- **Specifications are parsed in your browser.** Nothing is uploaded to a server.
  There is no backend to send it to.
- **The app reads no environment variables** and stores no credentials.
- **Persisted state** is limited to UI preferences (view mode, grouping) in
  `localStorage`. Specifications and generated code are not persisted.
- **Remote URL fetching** is done by your browser and is subject to the target
  server's CORS policy.

### Credentials in generated servers

Generated servers read credentials from environment variables at runtime. When you
configure authentication you supply the *variable name*, not the secret — so
nothing sensitive is written into the generated source or the downloaded ZIP.

When running a generated server:

- Keep `.env` out of version control — the generated `.gitignore` covers this
- Use the `.env.example` template to document which variables are needed
- Prefer scoped, least-privilege API credentials
- Rotate credentials that have been shared or committed by accident

### If you deploy this application publicly

It is a static site with no backend, so the attack surface is small, but:

- Serve it over HTTPS
- Set the security headers shown in the nginx config above
- Consider a Content Security Policy. Note that the code preview loads the Monaco
  editor from `cdn.jsdelivr.net`, so that origin must be allowed in `script-src`:

```html
<meta http-equiv="Content-Security-Policy" content="
  default-src 'self';
  script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net;
  style-src 'self' 'unsafe-inline';
  img-src 'self' data:;
  connect-src 'self' https:;
">
```

`connect-src https:` is required because users can fetch specifications from
arbitrary URLs. Tighten it if you only need specific hosts.

---

## Troubleshooting

### The application

**Port 3000 already in use**
Vite falls back to the next free port and prints the URL it actually used. To
force a specific one: `npm run dev:4000`.

**`npm install` fails**
Check your Node version with `node --version` — it must be 18 or newer. If it is,
clear and reinstall:

```bash
rm -rf node_modules package-lock.json
npm install
```

**Build fails with TypeScript errors**
`npm run build` runs `tsc` before Vite, so type errors block the build. Run
`npx tsc --noEmit` to see them on their own.

**Lint fails but there are no errors**
`npm run lint` runs with `--max-warnings 0`. Warnings fail the build. The output
lists every one with its file and line.

**A specification won't parse**
Confirm it is valid OpenAPI 3.x or Swagger 2.0 and that the root has both `info`
and `paths`. Validate it against an external linter to rule out a malformed spec.

**Fetching a spec from a URL fails**
Almost always CORS: the remote server has to permit browser requests from your
origin. Download the file and upload it instead.

### Generated servers

**`unhandled errors in a TaskGroup (1 sub-exception)`**
On a stdio MCP server, stdout carries the JSON-RPC stream. Anything else printed
there corrupts it and the client's connection collapses with this error. Generated
servers send all diagnostics to stderr — but if you add `print()` calls of your
own, use `print(..., file=sys.stderr)`.

**`ModuleNotFoundError: No module named 'mcp'`**
Dependencies aren't installed, or you're in the wrong environment:
`pip install -r requirements.txt`.

**`Required authentication environment variable ... is not set`**
The server validates its auth configuration at startup. Copy `.env.example` to
`.env` and fill in the named variable.

**The server starts but Claude Desktop doesn't see it**
Use an absolute path in `claude_desktop_config.json`, confirm the `command`
resolves (`which python`), and restart Claude Desktop fully. Run
`python server.py` directly first — it should start without printing anything to
stdout.

**`--http` does nothing**
There is no HTTP mode in either template — the flag logs a warning and the
server starts in stdio. Regenerating with the basic framework will not change
that. Wrap `APIClient` in FastAPI or Flask if you need HTTP.

**`Error running tests: unhandled errors in a TaskGroup (1 sub-exception)`**
Almost always the server subprocess dying at import. `test_client.py` launches
`server.py` itself using the interpreter running the client, so the usual cause
is running the client from a different virtualenv than the one the
dependencies were installed into. Check with:

```bash
python -c "import mcp, httpx; print('ok')"   # add fastmcp for a FastMCP server
python server.py                             # should wait, not traceback
```

Do **not** start `server.py` in a separate terminal first — the client spawns
its own copy and never sees yours.

---

## Further reading

- **[README.md](README.md)** — overview and quick start
- **[FEATURES.md](FEATURES.md)** — what the tool does and what it generates
- [Model Context Protocol](https://modelcontextprotocol.io/) — the MCP specification
- [OpenAPI Specification](https://spec.openapis.org/) — the spec format
