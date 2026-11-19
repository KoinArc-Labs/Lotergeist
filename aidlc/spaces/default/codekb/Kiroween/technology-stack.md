# Technology Stack

| Layer | Choice | Version | Source |
| --- | --- | --- | --- |
| Language | TypeScript | 5.9.3 | root package.json |
| Runtime | Node | 22.5 or later (CI uses 24) | engines, ci.yml |
| Package manager | pnpm workspaces | 12.16.1 | packageManager |
| API | Fastify, zod | 5.12.8, 3.25.76 | apps/api/package.json |
| Plugins | @fastify/cookie, cors, static | 11.1.5, 11.4.1, 10.1.10 | apps/api |
| State | SQLite via built-in `node:sqlite` | Node built-in | db.ts |
| Jobs | node-cron | 4.6.0 | server.ts |
| Documents | pdfkit, bwip-js | 0.20.2, 4.11.4 | apps/api |
| LLM | @aws-sdk/client-bedrock-runtime, Anthropic over fetch | 3.1163.0 | packages/coroner |
| Web | React, react-router-dom, TanStack Query | 18.3.1, 7.18.5, 5.106.1 | apps/web |
| Scan and OCR | @zxing/browser, @zxing/library, tesseract.js | 0.2.1, 0.21.3, 7.0.0 | apps/web |
| Bundler | Vite with plugin-react | 7.3.7, 5.2.0 | apps/web |
| Tests | Vitest, fast-check, Playwright, tsx | 3.2.7, 4.10.2, 1.65.0, 4.23.15 | root |
| Task runner | turbo config present | n/a | turbo.json |

Dependencies are pinned to exact versions (steering rule). Packages are consumed as TypeScript source with no build step.
