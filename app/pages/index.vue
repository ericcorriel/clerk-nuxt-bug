<script setup>
// Bare SSR page. The bug fires at module-load time on the first request,
// regardless of what this page renders.
</script>

<template>
  <main style="font-family: system-ui; padding: 2rem; max-width: 40rem; margin: 0 auto;">
    <h1>Clerk Nuxt bug repro</h1>
    <p>
      If you see this page, the bug is <strong>not</strong> reproducing —
      either Clerk patched the upstream issue, or you've enabled the
      workaround in <code>nuxt.config.ts</code>.
    </p>
    <p>
      With the default config and a fresh <code>.nuxt/</code> cache, this
      page should throw <code>ReferenceError: H3Error is not defined</code>
      at module-load time.
    </p>
  </main>
</template>
