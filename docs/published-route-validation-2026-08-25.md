# Published Route Validation — 2026-08-25

The published MY PLAN route loaded normally after the loading state. A signed-out request to the private reminder section safely resolved to the local Calendar workspace rather than exposing reminder settings or any private account data.

The published Calendar shell displayed the extracted sidebar, planning controls, calendar filters, and selected-day panel correctly. The visible `Made with Manus` label remained outside MY PLAN’s application DOM as host-level page chrome, consistent with the previously documented platform limitation; no MY PLAN source attribution was added.
