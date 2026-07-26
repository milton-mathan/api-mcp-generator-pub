# Features

What the API MCP Generator does, and what you get out of it.

For installation and usage steps, see **[INSTRUCTIONS.md](INSTRUCTIONS.md)**.

---

## Input

Specifications can be supplied four ways:

| Method | Notes |
|---|---|
| **File upload** | Drag-and-drop or file picker |
| **Remote URL** | Fetched directly from a documentation site |
| **Paste** | Paste the raw specification text |
| **Included samples** | `sample-api.json` and `sample-api.yaml` in the repo root |

**Formats:** OpenAPI 3.1, OpenAPI 3.0, and Swagger 2.0 — JSON or YAML.

Specifications are parsed and validated entirely in the browser. Nothing is
uploaded to a server, so private or internal API specs stay on your machine.

Validation separates real problems from advisories: a missing `info` or `paths`
block is reported as an error with the offending field path, while softer issues
(a missing `description`, a `basePath` that doesn't start with `/`) surface as
warnings and don't block generation.

---

## Interactive API explorer

Once a spec is parsed you can browse it before generating anything:

- **View modes** — tree, table, and card layouts
- **Search and filter** — by path, method, tag, and authentication requirement
- **Grouping** — by tag, path, or HTTP method
- **Endpoint detail** — parameters, request body, responses, and security per operation
- **Selection** — choose exactly which endpoints become MCP tools

---

## Generation options

### Server framework

| | |
|---|---|
| **FastMCP** | Decorator-based (`@app.tool`), one Python function per endpoint. Simpler output; the recommended default. |
| **Basic MCP** | The lower-level `mcp.server` API with explicit `list_tools` / `call_tool` handlers. |

### Authentication

Configured per endpoint. Credentials are read from environment variables at
runtime — never written into the generated source:

- Bearer tokens
- API keys (header or query parameter)
- Basic auth
- OAuth 2.0
- Custom header schemes

The generated server validates its auth configuration on startup and exits with a
clear message naming the missing environment variable.

### Other options

| Option | Choices |
|---|---|
| **Tool naming** | From `operationId`, from the path, or custom names |
| **Transport** | stdio — see the note below |
| **Error handling** | Basic or detailed responses |
| **Python target** | 3.8 – 3.12 |
| **Examples** | Include or omit request/response examples in the generated docs |

> **There is no HTTP mode.** MCP is a stdio protocol: the client launches the
> server and talks JSON-RPC over its stdin and stdout. Generated servers expose
> no HTTP interface, and the option is disabled in the UI. If you need HTTP
> access to the same API, put a FastAPI or Flask app in front of the generated
> `APIClient` class in `server.py` — it already handles authentication, retries
> and error mapping.

---

## The generated project

```
your-api-mcp-server/
├── server.py              # The MCP server implementation
├── requirements.txt       # Pinned Python dependencies
├── .env.example           # Environment variable template
├── README.md              # Setup and usage instructions
├── pyproject.toml         # Python project configuration
├── Dockerfile             # Container image definition
├── docker-compose.yml     # Runs the server as a stdio process (when run scripts are enabled)
└── scripts/               # Helper scripts (when run scripts are enabled)
    ├── run-stdio.py       # Start the server
    └── setup.py           # Environment setup helper
```

A **test client** (`test_client.py`) is available as a separate download from the
results screen. It connects to your server, discovers the available tools,
generates sample arguments from each tool's schema, and reports success or failure
per tool.

### Qualities of the generated code

- Python type hints throughout
- Docstrings on tool functions, carried over from the spec's `summary` / `description`
- Exception handling with messages identifying the failing tool
- Credentials read from the environment; nothing secret in the source
- Retries with exponential backoff on transient HTTP failures
- Diagnostics written to `stderr`, never `stdout`

That last point matters more than it looks. On a stdio MCP server, **stdout carries
the JSON-RPC protocol stream**. Any stray text written there corrupts the stream,
the client fails to parse it, and the connection dies with an opaque
`unhandled errors in a TaskGroup` error. All generated diagnostics go to stderr.

---

## Export

- **ZIP package** — the whole project as a real archive with directory structure,
  named `{serverName}_mcp_server.zip`. JSZip is loaded on demand so it stays out
  of the main bundle.
- **Individual files** — download or copy any single file from the results view
- **Syntax-highlighted preview** — inspect generated code before downloading

---

## Using the result with an MCP client

The generated README includes a ready-to-paste Claude Desktop configuration:

```json
{
  "mcpServers": {
    "your-api-server": {
      "command": "python",
      "args": ["/path/to/your/server/server.py"],
      "env": {
        "API_KEY": "your_api_key_here"
      }
    }
  }
}
```

The same server runs under other MCP clients. Note that the client launches the
server itself — running `python server.py` in a separate terminal starts an
unrelated process that no client is attached to. To exercise the server by hand,
use the downloadable `test_client.py`, which launches it for you.

---

## Technology

**This application**

- React 18 + TypeScript, built with Vite
- Zustand for state, persisted across reloads
- Tailwind CSS + Headless UI
- Monaco editor for code preview, loaded from CDN on demand
- Vitest + React Testing Library

**Core services**

| Service | Responsibility |
|---|---|
| `specParser` | Multi-version OpenAPI/Swagger parsing and normalization |
| `specValidator` | Structural validation, errors and warnings |
| `endpointExtractor` | Endpoint metadata extraction |
| `endpointNormalizer` | Parameter, schema, and `$ref` resolution |
| `mcpCodeGenerator` | Template-based Python generation |
| `authConfigService` | Per-endpoint authentication configuration |
| `exportService` | Project packaging and download |

**Generated servers**

- Python 3.8 – 3.12
- `mcp` (standard) or `fastmcp`
- `httpx` for async HTTP calls
- Docker-ready
