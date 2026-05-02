// Minimal Nuxt 4 config that reproduces the @clerk/nuxt server-middleware
// bundler bug. Adding '@clerk/nuxt' to the modules array is sufficient —
// no app code needs to use any Clerk feature for the bug to fire.
//
// To verify the workaround, uncomment the `clerk:` block below AND run
// `yarn dev` again. The page will load cleanly. See README.md.
export default defineNuxtConfig({
  compatibilityDate: '2026-04-30',
  devtools: { enabled: false },
  modules: ['@clerk/nuxt']

  // ─── Workaround (uncomment to verify it fixes the bug) ────────────
  // clerk: {
  //   skipServerMiddleware: true
  // }
})
