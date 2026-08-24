# Production branding observation

On 24 August 2026, the public MY PLAN page was inspected after a host-level “Made with Manus” badge appeared in the browser rendering. The MY PLAN source tree contains no matching application markup, and the badge was not present in the normal application document tree. Browser inspection showed a separate `manus-content-root` host element with a shadow root, while the MY PLAN application remains under its own `#root` element.

This is therefore treated as hosting/preview chrome rather than MY PLAN product copy. No MY PLAN screen, metadata, or source code intentionally includes attribution. The user-facing application continues to use MY PLAN as its sole product brand.
