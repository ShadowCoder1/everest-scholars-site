# Everest Futures website

Live site: **https://www.everestfutures.com** (also at https://shadowcoder1.github.io/everest-scholars-site/)

The whole homepage is one file: **`index.html`**. GitHub Pages serves this repo directly. When you change `index.html` on `main`, the live site updates by itself in about a minute.

## How it works

```
index.html (this repo) → GitHub Pages → www.everestfutures.com
```

- **Airtable** hosts the strategy-call application. Every Apply button links to it, and responses land in Airtable.
- Cohort labels start at **Fall 2027** and advance automatically every three months.
- **Images and logos** live in `assets/` and are referenced with relative paths (e.g. `assets/brand/mark-on-dark.png`).
- **`CNAME`** tells GitHub Pages to serve the site at www.everestfutures.com. Don't delete it.

## The portal

The login-only portal for students and mentors lives in `portal/`, at www.everestfutures.com/portal. Its database rules and local preview are in `firebase/`. Read `firebase/README.md` before changing either.

## Making a change (easiest way, no setup)

1. Open `index.html` in this repo on github.com and click the **pencil icon** (Edit).
2. Press **Ctrl+F / Cmd+F** and search for the text you want to change, e.g. `Real research`.
3. Edit it.
4. Click **Commit changes** → **Commit directly to the main branch** → **Commit changes**.
5. Wait about a minute, then open the site and hard-refresh (**Cmd+Shift+R** on Mac, **Ctrl+Shift+R** on Windows).

You can see when it's done under **Actions** ("pages build and deployment" turns green).

## Making bigger changes

- **Preview locally:** clone the repo and open `index.html` directly in Chrome. Everything works locally, including images.
- **Using an AI:** if you use Claude Code, Cursor or similar, tell it to read this README first and follow the rules below.

## Rules (so the site doesn't break)

1. **Keep CSS scoped to `#es`.** Every CSS rule starts with `#es` (for example `#es .es-hero h1 { … }`). It keeps styles predictable.
2. **Keep application calls consistent.** All application links and buttons point to the Airtable strategy-call form. Don't add name or email fields to this page; Airtable collects those submissions.
3. **Keep the one-`<script>` structure.** All JavaScript lives in the single `<script>` at the bottom.
4. **Images:** put files in `assets/` and use a relative path like `assets/competitions/isef.jpg`. External images from `images.unsplash.com` are fine too.
5. **No people's names on the site, no em dashes, and no numbers or claims we can't back up.**

## Common edits

| What | Where to look (search for) |
|---|---|
| Hero headline | `Real research` |
| Scholarships stat | `var ES_SCHOLARSHIPS` (e.g. `'$800,000'`; set to `''` to hide it) |
| The four paths | `Competitions`, `Research &amp; Publication`, `Selective Programs`, `College Admissions` |
| FAQ | `Questions families ask` |
| Application section | `Start with a free strategy call` (Airtable link: search `airtable.com`) |
| Footer | `© 2026 Everest Futures` |

## Undoing a bad change

On github.com, open the repo → **Commits**. Open the commit that broke things and edit the file back, or restore the previous version. The live site follows `main` within about a minute.

If the homepage ever shows up **blank** or unstyled, the most recent change almost certainly broke the HTML or JavaScript. Undo it.
