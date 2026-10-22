# Arc UI integration

Free MIT sources from [Arc UI](https://uiarc.dev/):

- `button.tsx` and `button.module.css`: https://uiarc.dev/r/button.json
- `motion-tokens.ts`: https://uiarc.dev/r/arc-motion-tokens.json
- `foundation.css`: base and dark token declarations from https://uiarc.dev/r/arc-foundation.json, scoped to public pages.

The import path in the button source is adjusted for this directory. `public-button.tsx` preserves the app's existing variants and disables submission while loading. The semantic bridge in `src/app/globals.css` maps Arc surface/text roles to existing shadcn roles, keeps `next-themes` class-based dark mode, and applies the custom neutral/cobalt palette.

Original license: [LICENSE](./LICENSE). No Arc Pro components are included.
