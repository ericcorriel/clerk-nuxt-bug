/**
 * Hand-rolled Clerk Nitro middleware — the working alternative to
 * `@clerk/nuxt`'s auto-registered middleware.
 *
 * This file is included in the repro repo as part of the workaround
 * verification (see README). It is NOT used in the default-config repro
 * — Nuxt's `server/middleware/*` files are auto-loaded, but with the
 * default `@clerk/nuxt` config the bug fires before this file's
 * middleware is reachable, because the auto-imports virtual module is
 * populated at the top of the bundle.
 *
 * To test the workaround:
 *   1. Uncomment `clerk: { skipServerMiddleware: true }` in nuxt.config.ts
 *   2. `rm -rf .nuxt && yarn dev`
 *   3. Visit http://localhost:3000/ — should render cleanly
 *
 * Imports only from `@clerk/backend` and `h3`. Importing anything from
 * `@clerk/nuxt/server` (e.g. `clerkMiddleware`) re-triggers the bug.
 */

import { createClerkClient } from '@clerk/backend'

let clerkSingleton: ReturnType<typeof createClerkClient> | null = null

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig(event)
  const secretKey = config.clerk?.secretKey
  if (!secretKey) {
    event.context.auth = () => ({
      isAuthenticated: false,
      userId: null,
      sessionId: null,
      sessionClaims: null
    })
    return
  }

  if (!clerkSingleton) {
    clerkSingleton = createClerkClient({
      secretKey,
      publishableKey: config.public?.clerk?.publishableKey
    })
  }

  try {
    const requestState = await clerkSingleton.authenticateRequest(
      toWebRequest(event),
      { acceptsToken: 'any' }
    )
    event.context.auth = () => requestState.toAuth()
    if (requestState.headers) {
      requestState.headers.forEach((value, key) => {
        setResponseHeader(event, key, value)
      })
    }
  } catch {
    event.context.auth = () => ({
      isAuthenticated: false,
      userId: null,
      sessionId: null,
      sessionClaims: null
    })
  }
})
