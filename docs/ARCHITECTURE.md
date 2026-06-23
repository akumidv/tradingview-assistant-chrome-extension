# Architecture Notes

TradingView Assistant is a Chrome MV3 extension that assists with user-driven
backtesting workflows in the TradingView chart UI. The project intentionally
keeps the implementation close to browser APIs and the TradingView DOM because
the extension must run as an unpacked/static extension without a build step.

## Terms-of-Use Boundary

TradingView may treat active automated browser interaction as bot-like behavior,
which can violate TradingView rules and lead to an account ban. The extension is
designed as a local, user-operated helper: it does not bypass TradingView
protective mechanisms, scrape market data, or use private server-side APIs.

This boundary is part of the architecture. The code works through the visible
browser UI, keeps delays configurable, persists intermediate results locally,
and documents the risk so users can decide whether and how to use it.

## Runtime Boundaries

- `popup/` renders the extension popup, stores user options, and sends commands
  to the active TradingView tab.
- `content_scripts/controller.js` receives popup commands and serializes
  long-running actions with `action.workerStatus`.
- `content_scripts/action.js` orchestrates user workflows: save/load parameters,
  run backtests, export results, and show charts.
- `content_scripts/tv.js` is the TradingView UI integration boundary. It opens
  strategy dialogs, reads/writes inputs, switches report tabs, and parses report
  data from the page.
- `content_scripts/backtest.js` owns the optimization loop and result selection.
  It supports random search, random improvements, sequential improvements,
  brute force, and simulated annealing.
- `content_scripts/model.js` converts TradingView strategy inputs into parameter
  ranges, restores saved ranges, and extracts best-known parameter sets.
- `content_scripts/file.js` and `content_scripts/storage.js` provide CSV
  import/export and browser-local persistence.
- `page-context.js` is injected into the page context for functionality that
  cannot be accessed directly from an isolated content script, such as rendering
  result previews with Plotly.

## Backtesting Flow

1. The popup sends a command such as `testStrategy` to the content script.
2. `controller.js` rejects concurrent jobs and delegates the command to
   `action.js`.
3. `action.js` reads the current strategy inputs through `tv.js`, asks `model.js`
   for an optimization range, and combines user options with detected chart
   metadata.
4. `backtest.js` selects the next parameter set, applies it through `tv.js`,
   reads the TradingView report, updates best/current results, and persists
   intermediate data to `chrome.storage.local`.
5. At the end of the run, the extension can restore the best parameter set and
   export all collected results as CSV.

## Resilience Strategy

TradingView is a third-party UI, so selectors, dialogs, report structure, terms
of use, and timing can change without notice. The code treats this integration
as unreliable and uses several defensive patterns:

- multiple ways to open strategy settings when TradingView changes controls;
- pointer-event based clicks where native `click()` is not enough for the UI;
- normalized comparison for existing and desired parameter values to avoid
  unnecessary recalculations;
- stale-report detection when parameter changes do not trigger a fresh report;
- missing-metric handling with a configurable consecutive-miss threshold;
- incremental persistence after each iteration so a reload or UI error does not
  lose the whole run;
- configurable delays to reduce continuous UI pressure during long backtests.

## Data Model

The extension stores strategy ranges, signal data, and backtest results in
`chrome.storage.local` under the `iondv_` prefix. CSV is used as the interchange
format because it is easy to edit manually, inspect after a failed run, and reuse
outside the extension.

Backtest rows include both TradingView report metrics and synthetic fields:

- `__<parameter name>` columns store the tested strategy input values;
- `_setTime_`, `_parseTime_`, and `_duration_` help diagnose slow UI/report
  interactions;
- `comment` records filtering, errors, stale reports, and other run context.

## Trade-Offs

This repository favors compatibility and low operational friction over a modern
frontend build pipeline. The code is plain JavaScript loaded directly by the
extension manifest, which keeps installation simple but limits static analysis,
module boundaries, and automated tests.

The most important architectural boundary is therefore not a framework boundary
but a responsibility boundary: TradingView DOM integration stays in `tv.js`,
optimization decisions stay in `backtest.js`, workflow orchestration stays in
`action.js`, and persistence/import/export stay in their dedicated helpers.
