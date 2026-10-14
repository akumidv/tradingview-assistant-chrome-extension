# TradingView UI drift — the project's key approach: survive UI changes, keep working

The extension drives TradingView through its DOM ([selector.js](../../extension/content_scripts/selector.js)),
and TradingView changes its markup without notice (2026-10: report root `backtestingReport` → `reportShell`,
report tables replaced by metric cards, section tabs reusing one id). **Surviving such changes without
losing functionality is the project's key approach**, not an afterthought:

- **Fallback chains, not single selectors.** Stable attributes first (`id`, `data-qa-id`, `aria-*`), the
  hashed-class prefix second, text last; keep the previous UI's variant next to the new one so either works
  (e.g. `SEL.reportRoot`). Stamp a selector with the date it was last verified live.
- **Detect by structure, parse by layout with a fallback.** A parser tries the current layout, then the
  previous one (e.g. `tv._parseMetricCard` → the legacy two-container card; cards → tables per tab).
- **A missing element has two causes — name both.** The user's page may be in the wrong state (no strategy
  on the chart, a panel closed), or TradingView changed its UI. Throw `UserActionError` for the first and
  `UiChangedError` for the second (`content_scripts/log.js`); the top-level `ui.showErrorByKind` adds the
  GitHub issue instructions once. Never embed the issue link in a thrown message.
- **"Found nothing" ≠ "parsed nothing" ≠ "no data".** A matched container that yields no values is parser
  drift; TradingView's own "Not enough data to show" is a data state. In the 2026-10 UI that placeholder in
  the Key stats chart means *no closed trades* (an iteration result, recorded as filtered, the run goes on);
  the same placeholder in a section chart only means that one view is empty.
- **Never swallow a failure into a later misleading one** (`console.warn` and continue); carry the reason
  to the single popup the user sees.
- **Verify against the live page** with the `tv-browser-test` skill before changing a selector or blaming
  the user.

- **Page objects first, the page second — per stage, once per run.** "Report ready" detection and report
  reading are separate stages with separate sources (`tv.reportSources`): each prefers TradingView's own
  objects through `page-context.js` and falls back to the report page (snackbars / DOM parse) on its own, so
  one stage's break does not disable the other. A failed source is switched off until the next test run
  (`tv.resetReportSources`), so a broken path costs one timeout per run. Values are mapped to the popup
  metric names (`Net PnL: All`) and keep the sign TradingView displays — no sign convention of our own.
- **Prefer public API routes over internals.** Reach TradingView objects through the most public path first
  and keep the alternatives as ordered routes (`strategySourceRoutes` in `page-context.js`); drop routes
  that died rather than keeping them as dead code.

Known signals (verified 2026-10-14): the "Strategy Tester" tab (`[data-qa-id="backtesting"]`) exists only
while a strategy is on the chart. The strategy source is reached by
`TradingViewApi.activeChart().getAllStudies()` → `getStudyById(id).study()` (public chart API; fallbacks:
`window._exposed_chartWidgetCollection`, the backtesting widget bridge) → the source with
`isStudyStrategy === true` → `reportData().performance` (`all`/`long`/`short` blocks, percents as
fractions), `reportChanged()` (subscribable delegate, fires per recompute), `isLoading()`. The same
`getStudyById(id)` exposes `getInputsInfo()` (input ids `in_N` with names) and `getInputValues()` /
`setInputValues()`. The old `bottomWidgetBar._widgets.backtesting._reportWidgetsSet` and
`backtestingStrategyDispatcher` paths are dead.
