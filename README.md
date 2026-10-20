# Smallworld summary

Results of the Smallworld managers (Anders, Micke, Danne) in Rosterrier, FPL and Allsvenskan fantasy, as a static site. It replaces the old Shiny app on shinyapps.io and shows the same things:

- **Season highlights**: the top three of the latest season in each game (and the latest Rosterrier playoffs), and each manager's all-time season wins.
- **Tables** for Rosterrier, Rosterrier playoffs, FPL and Allsvenskan, newest season first. Click a column header to sort; the search box filters on any text.

Everything is worked out in the browser from three files in `site/data/`. The rules are the same as in the Shiny app:

- The season **winner** is the manager with the best (lowest) world rank that season.
- **Playoffs**: Rosterrier rows with `Playoff` = `Yes`. Any team in a league whose name starts with "Winner" ranks above every team in the other (Looser) bracket; within a bracket, league rank decides, then world rank.
- The podium shows each manager's best team only.

## Updating once a year

Add a row per manager to the right file in `site/data/`, commit and push. GitHub publishes the new version within a minute or two. You can also edit the file straight on github.com (open it, click the pencil, "Commit changes").

The files are tab-separated, one row per team and season, newest first by convention (the order in the file doesn't matter):

| File | Columns |
|---|---|
| `fpl.tsv` | `Season` (e.g. `2026/27`), `Manager`, `Points`, `World_Rank` |
| `allsvenskan.tsv` | `Season` (e.g. `2026`), `Manager`, `Points`, `World_Rank` |
| `rosterrier.tsv` | `Season` (e.g. `2026-27`), `Manager`, `Team`, `League`, `World_Rank`, `League_Rank`, `Best_Day`, `Points`, `Value`, `Playoff` (`Yes`/`No`) |

Keep each game's season format the same as the rows already there, so the newest season sorts first. Use real tabs between columns (a spreadsheet's "save as tab-separated" works, as does copying cells from Excel into a text editor). Numbers without thousands separators.

A new manager works without code changes; they get a grey colour. To give them their own colour, add the name to `MANAGERS` in `site/app.js` and a `--m-<name>` colour (light and dark) in `site/style.css`.

## Run it locally

```bash
python -m http.server 8000 --directory site
```

Then open http://localhost:8000. (Opening `index.html` directly doesn't work, because the browser won't load the data files from disk.)

## Hosting on GitHub Pages

The workflow in `.github/workflows/deploy.yml` publishes `site/` to GitHub Pages on every push to `main` that changes something in `site/`. There is no schedule, so nothing runs between updates.

**One-time setup**

1. Create an empty **public** repository on GitHub, e.g. `smallworld` (no README or .gitignore, so it doesn't conflict). Pages on a private repo needs a paid plan.
2. Push this folder to it:
   ```bash
   git remote add origin https://github.com/<your-username>/smallworld.git
   ```
   ```bash
   git push -u origin main
   ```
3. In the repo, go to **Settings → Pages** and set **Source** to **GitHub Actions**.
4. Go to **Actions → Deploy site → Run workflow** for the first deploy (the first push ran before Pages was switched on). The site appears at `https://<your-username>.github.io/smallworld/`.

Free for public repositories.
