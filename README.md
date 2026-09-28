# Everest Scholars website

Live site: **https://everestscholars.podia.com**

The whole homepage is one file: **`index.html`**. When you change it on `main`, the live site updates by itself in about 2 minutes.

## How it works

```
index.html (this repo) → GitHub Pages → loader in Podia → everestscholars.podia.com
```

- **Podia** still runs the application form, emails, payments and courses.
- **Podia holds a tiny loader** (`podia-loader.html`) that fetches this page. **Never edit Podia's "Third-party code" setting;** that is where the loader lives.

## Making a change (easiest way, no setup)

1. Open `index.html` in this repo on github.com and click the **pencil icon** (Edit).
2. Press **Ctrl+F / Cmd+F** and search for the text you want to change, e.g. `Real research`.
3. Edit it.
4. Click **Commit changes** → **Commit directly to the main branch** → **Commit changes**.
5. Wait about 2 minutes, then open the site and hard-refresh (**Cmd+Shift+R** on Mac, **Ctrl+Shift+R** on Windows).

You can see when it's done under **Actions** ("pages build and deployment" turns green).

## Making bigger changes

- **Preview locally:** clone the repo and open `index.html` directly in Chrome. The form won't send there; it only sends on Podia.
- **Using an AI:** if you use Claude Code, Cursor or similar, tell it to read this README first and follow the rules below.

## Rules (so the site doesn't break)

1. **Everything goes inside `<div id="es"> … </div>`.** Every CSS rule must start with `#es` (for example `#es .es-hero h1 { … }`). The page is dropped into Podia, and unscoped CSS will clash with Podia's styles.
2. **Don't touch the form's plumbing.** Keep `id="es-apply-form"`, the `action` URL, the `name="name"` and `name="email"` fields, and the `.es-ts` / Turnstile code. That's what sends signups to Podia. Changing the visible words around the form is fine.
3. **Images must use full URLs** starting with `https://`. Use `images.unsplash.com` links. If you add image files to this repo, use `https://shadowcoder1.github.io/everest-scholars-site/<file>`, not a relative path.
4. **No people's names on the site, and no numbers or claims we can't back up.**
5. **Keep the one-`<script>` structure.** All JavaScript lives in the single `<script>` at the bottom.

## Common edits

| What | Where to look (search for) |
|---|---|
| Hero headline | `Real research` |
| Scholarships stat | `var ES_SCHOLARSHIPS` (e.g. `'$800K'`; set to `''` to hide it) |
| The three paths | `Competitions`, `Publication`, `Programs` |
| FAQ | `Questions families ask` |
| Consultation form text | `Start with a free consultation` |
| Footer | `© 2026 Everest Scholars` |

## Undoing a bad change

On github.com, open the repo → **Commits**. Open the commit that broke things and edit the file back, or restore the previous version. The live site follows `main` within about 2 minutes.

If the homepage ever shows up **blank**, the most recent change almost certainly broke the HTML or JavaScript. Undo it.
