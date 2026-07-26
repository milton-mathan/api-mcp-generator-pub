# API MCP Generator

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.2-blue.svg)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18.2-blue.svg)](https://reactjs.org/)

> Turn an OpenAPI specification into a working Python MCP server.

A browser-based tool that reads an OpenAPI/Swagger specification, lets you explore
its endpoints, and generates a complete Python [MCP](https://modelcontextprotocol.io/)
(Model Context Protocol) server project — so an API can be exposed to an AI
assistant as callable tools without writing the server by hand.

Everything runs client-side. Your specification is parsed in the browser and is
never uploaded to a server.

---

## Quick start

```bash
git clone https://github.com/milton-mathan/api-mcp-generator-pub.git
cd api-mcp-generator-pub
npm install
npm run dev
```

The dev server starts on **http://localhost:3000** and opens your browser
automatically. If port 3000 is busy, Vite picks the next free port and prints it.

Requires **Node.js 18 or newer**.

No configuration or API keys are needed to run the application.

---

## How it works

1. **Input** — upload an OpenAPI file, fetch one from a URL, or paste it directly
2. **Explore** — browse endpoints with search, filtering, and grouping
3. **Select** — choose which endpoints become MCP tools
4. **Configure** — set the server framework, authentication, and tool naming
5. **Generate** — produce a complete Python project
6. **Export** — download it as a ZIP, ready to run

Two sample specifications (`sample-api.json`, `sample-api.yaml`) are included in
the repository if you want to try it immediately.

---

## What it supports

| | |
|---|---|
| **Spec formats** | OpenAPI 3.1, OpenAPI 3.0, Swagger 2.0 — JSON or YAML |
| **Server frameworks** | FastMCP (recommended) and basic `mcp.server` |
| **Authentication** | Bearer, API key, Basic, OAuth 2.0, custom headers |
| **Transport** | stdio — the transport MCP clients use |
| **Python targets** | 3.8 through 3.12 |

See **[FEATURES.md](FEATURES.md)** for the full picture of what the tool does and
what a generated project contains.

---

## Common commands

```bash
npm run dev            # Start the dev server on port 3000
npm run build          # Type-check and build to dist/
npm run preview        # Serve the production build locally
npm test               # Run tests in watch mode
npm run test:run       # Run tests once
npm run test:coverage  # Run tests with a coverage report
npm run lint           # Lint (zero warnings enforced)
npm run validate       # Lint + tests + build, the full gate
```

---

## Architecture

React 18 + TypeScript, built with Vite. State is held in Zustand and persisted
across reloads. Styling is Tailwind CSS with Headless UI.

The work happens in a service layer under `src/services/`:

| Service | Responsibility |
|---|---|
| `specParser` | Parses and normalizes OpenAPI 3.x / Swagger 2.0 |
| `specValidator` | Structural validation, errors and warnings |
| `endpointExtractor` | Extracts endpoint metadata from the parsed spec |
| `endpointNormalizer` | Resolves parameters, schemas, and `$ref`s |
| `mcpCodeGenerator` | Generates the Python server from templates |
| `authConfigService` | Per-endpoint authentication configuration |
| `exportService` | Packages the project for download |

---

## Documentation

- **[FEATURES.md](FEATURES.md)** — what the tool does and what it generates
- **[INSTRUCTIONS.md](INSTRUCTIONS.md)** — setup, usage, deployment, security, troubleshooting

---

## Contributing

Contributions are welcome.

1. Fork the repository and create a branch: `git checkout -b feature/your-feature`
2. Make your changes and add tests
3. Run the full gate: `npm run validate`
4. Open a pull request

`npm run validate` must pass — lint is enforced at zero warnings.

To report a bug or request a feature, open an issue on
[GitHub](https://github.com/milton-mathan/api-mcp-generator-pub/issues).

---

## License

MIT — see [LICENSE](LICENSE).

---

## Acknowledgments

- [OpenAPI Initiative](https://www.openapis.org/) for the OpenAPI Specification
- [Model Context Protocol](https://modelcontextprotocol.io/) for the MCP standard
- [React](https://reactjs.org/), [Vite](https://vitejs.dev/), and [Tailwind CSS](https://tailwindcss.com/)
