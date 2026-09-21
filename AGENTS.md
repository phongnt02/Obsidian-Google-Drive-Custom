# Obsidian Google Drive Sync

Obsidian plugin for two-way vault sync with Google Drive. Forked and maintained locally.

## Quick Commands

```bash
npm install          # Install dependencies
npm run build        # TypeScript check + esbuild production bundle → main.js
npm run dev          # esbuild watch mode (rebuilds on file changes)
npm run test         # Run vitest (all tests)
npm run lint         # ESLint with obsidianmd plugin
```

Build order matters: `tsc -noEmit` runs first in `npm run build`, then esbuild bundles.

## Architecture

- **Entry**: `main.ts` → bundled to `main.js` (CJS, es2021)
- **Plugin class**: `ObsidianGoogleDrive` in `main.ts` (lifecycle, commands, settings tab)
- **Helpers**:
  - `helpers/drive/` — Google Drive API layer (client, requests, query, types, utils)
  - `helpers/sync/` — Sync operations (pull, push, reset)
  - `helpers/oauth-flow.ts` — OAuth2 localhost redirect flow
  - `helpers/modals.ts` — Confirmation modals
- **Settings**: `settings.ts` (PluginSettings interface + defaults)
- **Vault ops**: `vault-operations.ts` (create/modify/delete wrappers around Obsidian vault API)
- **Lifecycle**: `sync-lifecycle.ts` (startSync/endSync/abortSync)
- **Tests**: `tests/` (7 vitest test files)

## Key Quirks

- **esbuild externals**: `obsidian`, `electron`, `@codemirror/*`, `@lezer/*`, and all Node builtins are externalized — they're provided by the Obsidian runtime at load time.
- **OAuth flow**: Uses a local HTTP server on port 48321 to catch the redirect. The `helpers/oauth-flow.ts` opens a browser window and waits for the callback. This only works on desktop (not mobile).
- **Plugin ID**: `google-drive-sync` — must match folder name in `.obsidian/plugins/`. Never rename after release.
- **Release artifacts**: `main.js`, `manifest.json`, `styles.css` must be at plugin root.
- **`main.js` is committed**: Despite being a build artifact, it's tracked for direct vault installation.

## Testing

Tests mock `obsidian` module heavily (Notice, TFile, TFolder, Setting, etc.). If you modify Obsidian API usage, check that mocks in test files still match the API surface.

```bash
npx vitest run              # single run
npx vitest run tests/pull   # run specific test file
npx vitest                  # watch mode
```

## Mobile Support

- `isDesktopOnly: false` in manifest
- OAuth flow (`helpers/oauth-flow.ts`) uses Node `http` module — desktop only
- Avoid Node/Electron APIs in vault operations for mobile compatibility
- Plugin distributed via BRAT for iOS testing

## Linting

- ESLint config: `eslint.config.mts`
- Uses `eslint-plugin-obsidianmd` for Obsidian-specific rules (sentence case, UI text)
- Ignores: `.eslintignore` file

## Files to Update Together

- `manifest.json` version ↔ `versions.json` (use `npm version`)
- After code changes: `npm run build` to regenerate `main.js`
- Settings schema changes: update both `settings.ts` and `PluginSettings` interface
