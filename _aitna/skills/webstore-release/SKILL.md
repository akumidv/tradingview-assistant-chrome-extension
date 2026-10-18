---
name: webstore-release
description: Prepares a new version of this extension for the Chrome Web Store and leaves it ready for the owner to land and upload — compares with the version live in the store, bumps manifest.json and package.json, has the changelog skill write the CHANGELOG.md entry, checks that the local manifest carries the store key, that the versions agree and are newer than the published one and that every file the manifest references exists, runs the tv-browser-test skill on a live chart and verifies the saved results CSV and the console log of that run, then builds assistant-ext.zip with the key and prints the owner's commit, tag, push and upload steps with the dashboard link. It never commits, tags, pushes or uploads. Triggers on "release", "new version", "publish to the web store", "prepare the package", "build the zip", "выпуск версии", "подготовь релиз", "собери архив".
metadata:
  owner: project
---

# webstore-release

The release of this extension is a zip uploaded to the Chrome Web Store developer dashboard by the owner. This
skill prepares everything up to that upload; the owner commits, tags, pushes and uploads (D5). It is this
project's release procedure for the `package` subject of the shared akmon `release` skill, which defers here
through [`_aitna/agents/release/README.md`](../../agents/release/README.md).

## Tool

[`_aitna/tools/release/cli.mjs`](../../tools/release/cli.mjs) — JSON on stdout, exit 1 on a failed check:

- `check [--offline]` (`npm run release:check`) — read-only gate:
  - `key.present`, `key.matches-store` — the **local** `extension/manifest.json` carries the store's public
    key and the extension ID derived from it is the published one. The store requires the key in the
    package of an already published item; the test browser also runs the extension under its real ID.
  - `version.package-json`, `version.changelog` — `package.json` and the top `## <version>` of
    `extension/CHANGELOG.md` equal the manifest version.
  - `version.newer-than-store` — the manifest version is strictly greater than the one live in the store
    (Chrome update service, store ID `pfbdfjaonemppanfnlmliafffahlohfg`). `--offline` skips it and says so.
  - `manifest.files` — every icon, popup, content script and web-accessible resource the manifest names
    exists.
  - `git.clean-extension` — a warning listing uncommitted changes under `extension/`: the zip is built from
    the working tree.
- `pack [--offline] [--out PATH]` (`npm run release:pack`, `./prepare-ext.sh`) — runs `check`, refuses on a
  failure, then zips a copy of `extension/` (dotfiles and source maps left out) into `assistant-ext.zip`,
  re-reads the zip to confirm its manifest carries the version and the store item's key, and prints
  `upload_url`, the developer dashboard.
- `verify [--results CSV] [--since ISO] [--log FILE] [--cycles N] [--opt-param NAME]`
  (`npm run release:verify`) — the browser-test gate (step 6): the results CSV the backtest saved (default the
  newest `*.csv` in `~/Downloads`, or `TV_DOWNLOADS`) and the console log captured during the run. Both are
  required.

## Procedure

1. **Published version.** `npm run release:check -- --offline` for the local picture, then `check` online:
   `published_version` is what users have. The changes in this release are those since the commit that set
   that version: `git log --oneline -1 -G '"version": "<published>"' -- extension/manifest.json manifest.json`
   gives the base, `git log <base>..HEAD` and the working tree give the content.
2. **Version** *(owner gate)*. Propose the next version: patch `x.y.Z` for fixes, minor `x.Y.0` for new options
   or behaviour, major only for a change users must act on. The owner confirms it. If the manifest already
   carries an unpublished version above the store one (work collected under it), keep it.
3. **Bump.** Set the version in `extension/manifest.json` and `package.json` — the only version literals.
   Edit `version` in place; do not touch the local `key` line.
4. **Changelog.** Run the [changelog](../changelog/SKILL.md) skill: its `## <version>` section must exist and
   describe the release in its format (the popup shows the summary as "What's new").
5. **Gate.** `npm run release:check` and `npm run test:tools` — all green; a warning from
   `git.clean-extension` is expected before the owner's commit. A missing key: the owner adds the store public
   key (developer dashboard → Package → "Public key") as `"key"` to the local manifest; never into a commit.
6. **Browser test** *(gate, every release)*. Run the [tv-browser-test](../tv-browser-test/SKILL.md) skill on
   the working tree that will be zipped — it loads `extension/` unpacked, under the store ID thanks to the key:
   1. Note the start time (`date -u +%FT%TZ`) and start capturing the chart tab's console into the
      scratchpad, in the background, before the run:
      `npm run browser logs -- --seconds 1800 --until "All done" > <scratchpad>/release-run.log`.
   2. The popup opens and shows this version's "What's new".
   3. A backtest runs to its end on a TradingView chart (a few cycles, e.g. 5, with the default "Total PnL"
      or another metric) and saves its results CSV to the Downloads folder.
   4. Each change since the published version (step 1) is exercised where the UI reaches it.
   5. `npm run release:verify -- --since <start time> --log <scratchpad>/release-run.log` — the success
      criteria, all machine-checked:
      - **Results file** (`results.*`): the newest CSV in Downloads was written after the start time; it has
        data, the base columns (`comment`, `Total PnL`, `Total PnL %`, `Max drawdown`, `Max drawdown %`,
        `Profit factor`, `Profitable trades`, `Sharpe ratio`, `Sortino ratio`, `_setTime_`, `_parseTime_`),
        the optimised metric and the strategy's `__<parameter>` columns; every row has the header's column
        count; it holds cycles + 1 tested sets (the first is "Current parameters"; the cycles and the metric
        come from the file name); at least one set has a numeric value of the metric and all its
        parameters; no set carries a TradingView error, a skipped combination or "No report data".
        Sets with "No trades for these parameters" are a warning: acceptable when the strategy makes no
        trades on them, but a chart where every set has no trades does not test the report.
      - **Console log** (`log.*`): it was captured from the extension's world, it reaches "All done", and it
        has no `error` or uncaught exception of the extension. Warnings of the extension are listed for the
        report; TradingView's own page errors are counted but never fail the gate.

   Report what was run and seen, with the `verify` JSON summary and the warnings. A failed check stops the
   release and goes to the engineer. Any edit under `extension/` after this step invalidates it: run it again
   before packing.
7. **Pack.** `npm run release:pack`; report the zip path, size, file count and version.
8. **Owner handoff** *(gate, D5)* — print, do not run:
   ```
   git add extension/ ':!extension/manifest.json' package.json
   git add -p extension/manifest.json     # every hunk except the "key" line — the hook refuses it
   git commit -m "v<version> - <one-line summary>"
   git tag v<version>
   git push && git push origin v<version>
   ```
   then the upload: <https://chrome.google.com/webstore/devconsole> → the item → Package → "Upload new package"
   → `assistant-ext.zip`,
   check the store listing and the permission justifications if the manifest's permissions or host matches
   changed, submit for review. State the step 6 result and the residual risk (paths the browser test did not
   reach, review-sensitive changes such as new permissions or remotely loaded code).
9. **After publication.** Once `check` shows the new version live, the
   [github-issues](../github-issues/SKILL.md) skill drafts the "fixed in" notices.

## Rules

- The key goes into the package but **never into the code repository**: it lives only in the working
  `extension/manifest.json` and the gitignored `assistant-ext.zip`. Never remove it from the working file,
  never stage it — [`.githooks/pre-commit`](../../../.githooks/pre-commit) rejects a staged manifest with it.
- The skill edits only `extension/manifest.json` (`version`), `package.json` (`version`) and
  `extension/CHANGELOG.md` (through the changelog skill). A code problem found on the way becomes a task for
  the engineer, not a fix inside the release.
- No commit, tag, push or upload by the agent, even when asked to "just publish": print the commands.
