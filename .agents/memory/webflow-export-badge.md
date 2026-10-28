---
name: Webflow export badge
description: Why the exported site’s “Made in Webflow” badge reappears and how to prevent it without removing other interactions.
---

For the Kairov export, hiding `.w-webflow-badge` or removing it after load is not sufficient. The bundled Webflow brand module creates the badge and checks again on a timer and during scroll-related events. Disable that local initializer before it runs, and keep the CSS/DOM removal as a fallback. Preserve the other local Webflow modules because they power the original page interactions.

**Why:** The badge appeared briefly on scroll even though the iframe observer removed it; the brand module was re-adding it.

**How to apply:** Keep the badge-module rewrite in both the Vite development response middleware and the production output sanitizer. Verify the served script no longer contains the badge initializer or its “Made in Webflow” image reference.
