# votejoe.org Static Clone

This directory contains a static local mirror of `votejoe.org`, including `/template`
and all published routes linked or present in the site data:

- `/`
- `/template`
- `/about`
- `/volunteer`
- `/check`
- `/repair`
- `/crypto`
- `/issues`
- `/events`
- `/news`

Run it with:

```sh
npm start
```

The server defaults to `http://localhost:4173` and automatically tries the next port
if that port is already busy.

The mirrored artifacts are:

- `pages/*/index.html`: live route snapshots with local asset references.
- `public/_next`: mirrored Next.js CSS and JavaScript bundles from the live site.
- `public/assets/images`: mirrored image assets used by the pages and template data.
- `data/next-data.json`: extracted published site data from `__NEXT_DATA__`.
- `component-library`: reusable section renderers and a catalog page based on the
  sections from `/template`.

Useful commands:

```sh
npm run fetch
npm run audit
npm start
```

`npm run fetch` refreshes the mirror from the live site. `npm run audit` verifies
that the route HTML, static bundles, local images, and component library files are
present.
