# Clerk Nuxt server-middleware bundler bug — minimal repro

Adding `@clerk/nuxt` to a Nuxt 4 app's `modules` array with default settings causes every SSR-rendered page to throw `ReferenceError: H3Error is not defined` at module-load time. The Nitro dev bundle's auto-imports virtual module references h3 helpers (`H3Error`, `H3Event`, `appendCorsHeaders`, …) without their corresponding `import` statements at the top of the bundle.

## Versions reproduced on

| Package | Versions tested |
|---|---|
| `nuxt` | `4.3.1`, `4.4.4` |
| `@clerk/nuxt` | `2.2.8`, `2.2.9` |
| `@nuxt/nitro-server` | `4.3.1`, `4.4.4` |
| `unimport` | `5.6.0`, `5.7.0`, `6.2.0` |
| `h3` | `1.15.6` |

This repo pins to the latest stable as of writing (see `package.json`).

## Reproduce the bug

```bash
yarn install
cp .env.example .env
# Edit .env and paste real publishable + secret keys from https://dashboard.clerk.com → API Keys
# (any dev instance works — the bug fires at module-load time, before the keys
# are actually used to authenticate anything)

yarn dev
# In another terminal or browser, visit http://localhost:3000/
```

You should see a 500 error page with:

```
ReferenceError: H3Error is not defined
    at /path/to/.nuxt/dev/index.mjs:NNNN:NN
    at ModuleJob.run (node:internal/modules/esm/module_job:343:25)
    ...
```

The line number varies with bundle size; the symbol may also be `H3Event`, `appendCorsHeaders`, `setHeaders`, etc. — anything in `@nuxt/nitro-server`'s h3 auto-imports preset that user code doesn't already import explicitly.

## What's actually broken

In `.nuxt/dev/index.mjs` the bundle contains an auto-imports virtual module:

```js
const _virtual__imports = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  // ... other symbols ...
  H3Error: H3Error,        // <-- ReferenceError fires here at module load
  H3Event: H3Event,
  appendCorsHeaders: appendCorsHeaders,
  // ...
}));
```

But the top-of-file `import { ... } from 'h3'` statement only includes the subset of helpers that user code references explicitly. `H3Error`, `H3Event`, `appendCorsHeaders` etc. are listed in the virtual imports object but were never imported into scope.

`@nuxt/nitro-server` registers these as auto-imports via:

```js
// node_modules/@nuxt/nitro-server/dist/index.mjs
presets: [{
  from: 'h3',
  imports: ['H3Event', 'H3Error']
}, ...]
```

This preset works correctly when `@clerk/nuxt` is **not** in the modules array. Adding `@clerk/nuxt` is the trigger.

## Verify the workaround

In `nuxt.config.ts`, uncomment the `clerk: { skipServerMiddleware: true }` block:

```ts
modules: ['@clerk/nuxt'],
clerk: {
  skipServerMiddleware: true
}
```

Then:

```bash
rm -rf .nuxt
yarn dev
# Visit http://localhost:3000/ again
```

The page renders cleanly. `event.context.auth` is now populated by the hand-rolled middleware in `server/middleware/clerk.ts`, which uses `@clerk/backend` directly. **Importing anything from `@clerk/nuxt/server` (including just the `clerkMiddleware` named export) re-triggers the bug** — see "What we tried" below.

## What we tried (none of these worked)

1. **Pinning unimport** to `5.6.0`, `5.7.0`, and `^6.2.0` via yarn `resolutions`.
2. **Explicit user import**: adding `import { H3Error, H3Event } from 'h3'` to a server plugin file. The bundler tree-shakes the plugin away or unimport strips the import as already-auto-registered.
3. **Explicit `nitro.imports.imports` config** with `[{ name: 'H3Error', from: 'h3' }, ...]`.
4. **Stripping the h3 value-preset** via a `nitro:config` hook — made `H3Error` materialize, but the next preset entry (`appendCorsHeaders`) failed identically. Bug is preset-wide.
5. **Upgrading Nuxt** from 4.3.1 to 4.4.4.
6. **Manual middleware registration** via `import { clerkMiddleware } from '@clerk/nuxt/server'` in `server/middleware/clerk.ts`. Re-triggered the bug.

## Hypothesis

Something in `@clerk/nuxt`'s server-runtime entry or its internal exports interacts with unimport's scanner in a way that registers h3 auto-imports as "tracked" but short-circuits the bundler's import-injection step. The corruption manifests in any code path that pulls `@clerk/nuxt/server` into the bundle — auto-registered middleware, manually-registered middleware via `clerkMiddleware()` import, possibly other entry points.

The workaround in `server/middleware/clerk.ts` sidesteps this by using `@clerk/backend` directly, which is a transitive dep of `@clerk/nuxt` but doesn't pull `@clerk/nuxt/server` paths into the bundle.

## Repo layout

```
.
├── nuxt.config.ts                 # @clerk/nuxt module, workaround block (commented out)
├── package.json                   # Pinned to nuxt 4.4.4 + @clerk/nuxt 2.2.9
├── app/pages/index.vue            # Bare SSR page; bug fires regardless of content
├── server/middleware/clerk.ts     # Hand-rolled middleware for the workaround
├── .env.example                   # Template for Clerk dev keys
└── README.md                      # This file
```

## Impact

For any Nuxt 4 app adopting `@clerk/nuxt` server-side, this is a hard blocker on default usage — every SSR page crashes. The workaround restores functionality but adds maintenance burden.

Happy to test patches or canaries against this repo. Tag the linked issue if helpful.
