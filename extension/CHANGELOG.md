# Changelog

Newest version first. Each version starts with a summary for users, shown once after an update as the popup
"What's new" notice; a "Details" part after it holds what the summary and git can not tell. The Help tab shows
the whole file. Format and rendering rules: [_aitna/skills/changelog](../_aitna/skills/changelog/SKILL.md).

## 2.14.0
- Supports the redesigned Strategy Tester (2026-10: metrics shown as cards).
- Faster and more reliable reading of results from TradingView report data; about 1 s less per test.
- **New:** option "Also parse the report tabs" (Options & Tools) for metrics missing from TradingView data.
- **New, experimental:** option to set strategy parameters through the TradingView chart API, faster than the
  strategy dialog. TradingView may change this API, and automated use may violate its terms: use at your own
  risk.
- Clearer error messages: what happened and what to do; when TradingView changed its UI, how to report it on
  GitHub and what to attach.
- **Fixes:** parameter sets with no trades, Min mode, metric value 0, ranges where "from" equals "to", empty
  report tabs, signals indicator.
- Popup: the header and tabs stay in place, long tabs scroll, and this "What's new" notice after updates.

### Details
- Results are read from TradingView's own strategy data; if that fails, the extension parses the report page
  for the rest of the test run and tries the data again on the next run.
- "Also parse the report tabs" matters only when results come from TradingView data: when the report page is
  parsed, all tabs are read anyway.
- The chart API option sets what it can and leaves the rest (e.g. a source taken from another indicator) to the
  settings dialog for that test. It uses a TradingView API that is not documented for this use, hence off by
  default and experimental.
- A parameter set with no trades is kept in the results as "No trades for these parameters" and filtered out,
  so it never becomes the best result.
- For a bug report: open the console (F12), filter by `[tv-assistant]` and enable the "Verbose" level to
  include the per-test detail.
