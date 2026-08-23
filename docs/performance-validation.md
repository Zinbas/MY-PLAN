# MY PLAN Performance Validation

## Scope

This focused check measured a cache-disabled local development load of the core calendar route and a visible next-month calendar interaction. It uses an isolated browser script that saves and restores all `my-plan-*` local storage keys; it does not read, alter, or retain personal planning data.

| Measure | Before optimization | After optimization | Observed result |
| --- | ---: | ---: | --- |
| Cold development-route transfer | 3,908,550 bytes | 3,777,982 bytes | 130,568 fewer bytes requested |
| DOM content loaded | 224 ms | 185 ms | Faster in this local measurement |
| Load event | 361 ms | 336 ms | Faster in this local measurement |
| Verified next-month interaction | 21 ms | 41 ms | Both measurements updated the visible month heading well under a frame budget for typical interaction feedback |
| Production React vendor bundle | 481.06 kB (144.83 kB gzip) | 439.88 kB (130.24 kB gzip) | 41.18 kB smaller (14.59 kB gzip) |

## Change and validation

The root application shell no longer loads a global tooltip provider on the core planning route. The provider was unused by every rendered MY PLAN page; its only remaining reference is the un-routed component showcase. This preserves the Calendar, To-do, Progress, Import, Admin, and Spark experiences while avoiding the initial tooltip dependency.

The performance profiler confirms that the calendar’s **Next month** control changes the visible heading. Code-splitting remains in place for Import Schedule, Gemini Spark, and Administrator surfaces, so those workspaces continue to load only when opened. Full unit tests, TypeScript checking, and the production build passed after the change.

> Development-network numbers include Vite modules and are not a substitute for an external production real-user measurement. The production bundle comparison is the deployment-relevant size check.
