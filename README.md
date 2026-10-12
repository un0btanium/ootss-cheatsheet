# OotSS Cheatsheet

A spoiler-free, fill-it-yourself cheatsheet for *Order of the Sinking Star*. Built with Angular 22 + Angular Material; all data stays in your browser.

## Concepts

- **Categories** – short labels (items, places, characters…) with a text and background color.
- **Interactions** – free text that references categories. While typing, words that match the start of a category name open a suggestion list (↑/↓ to choose, Enter/Tab to insert, Esc to dismiss). Inserted categories are references: renaming or recoloring a category updates every interaction. Click a category anywhere to edit it.
- **Puzzles** – pick the categories involved in a puzzle and see every interaction that mentions *any* / *all* of them. The selection is kept in the URL, so it can be bookmarked.

Data is saved automatically to `localStorage` (key `ootss-cheatsheet:v1`). Use the ⋮ menu to export/import a JSON file for backups or sharing. Importing replaces the current data.

## Development

```bash
npm install
npm start          # http://localhost:4200
npm test           # Vitest unit tests
npm run build
```

## Deploying to GitHub Pages

Push to `main` on GitHub and set **Settings → Pages → Source** to **GitHub Actions**. The workflow in `.github/workflows/deploy.yml` tests, builds with the repository name as base href, and deploys. Hash-based routing (`/#/puzzles`) means no 404 fallback is needed.
