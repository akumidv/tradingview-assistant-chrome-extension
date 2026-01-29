const selStatus = {
  isNewVersion: true,
}


const SEL = {
  tvLegendIndicatorItem: 'div[data-name="legend"] div[class^="sourcesWrapper"] div[class^="sources"] div[data-name="legend-source-item"]',
  tvLegendIndicatorItemTitle: 'div[data-name="legend-source-title"]',
  tvDialogRoot: '#overlap-manager-root',
  indicatorTitle: '#overlap-manager-root div[data-name="indicator-properties-dialog"] [class^="container"] div[class^="title"]',
  tabInput: '#overlap-manager-root div[data-name="indicator-properties-dialog"] [class^="tab"] button#inputs',
  tabInputActive: '#overlap-manager-root div[data-name="indicator-properties-dialog"] [class^="tab"] button#inputs[class*="selected"]',
  tabProperties: '#overlap-manager-root div[data-name="indicator-properties-dialog"] [class^="tab"] button#properties',
  ticker: '#header-toolbar-symbol-search > div[class*="text-"]',
  timeFrame: '#header-toolbar-intervals div[data-role^="button"]',
  timeFrameActive: '#header-toolbar-intervals div[data-role^="button"][class*="isActive"]',
  indicatorScroll: 'div[data-name="indicator-properties-dialog"] div[class^="scrollable-"]',
  indicatorProperty: 'div[data-name="indicator-properties-dialog"] div[class^="content-"] div[class^="cell-"]',
  okBtn: 'div[data-name="indicator-properties-dialog"] div[class^="footer-"] button[name="submit"]',
  cancelBtn: 'div[data-name="indicator-properties-dialog"] span[data-name="close"][data-role="button"]',
  strategyTesterTab: '[data-name="backtesting"]', // 2023-10-19 #footer-chart-panel  or #bottom-area
  strategyTesterTabActive: '[data-name="backtesting"][data-active="true"]', // 2023-10-19 #footer-chart-panel  or #bottom-area
  strategyCaption: '#bottom-area  [class^="strategyGroup"] [data-strategy-title]',
  strategyMenuItemSettings: '[role="menu"] [role="menuitem"][aria-label^="Settings"]',
  strategyDialogParam: '#bottom-area div[class^="backtesting"]  [class^="strategyGroup"]  > div:nth-child(2) > button:nth-child(1)',
  // strategySummary: selStatus.isNewVersion ?  '[id="Performance"]' : '[id="Performance Summary"]',
  // strategySummaryActive: selStatus.isNewVersion ? '[id="Performance"][class*="selected"]' : '[id="Performance Summary"][class*="selected"]',
  metricsTab: '[id="Strategy report"]',
  metricsTabActive: '[id="Strategy report"][class*="selected"]',
  tradesTab: '[id="List of Trades"]',
  tradesTabActive: '[id="List of Trades"][class*="selected"]',
  goproPopupCloseButton: '[data-dialog-name="gopro"][class^="dialog"] button[class*="close"]',
  metricPerformanceGroup: '[data-qa-id="Performance-button"]',
  metricPerformanceGroupExpanded: '[data-qa-id="Performance-button"][aria-expanded="true"]',
  metricTradeAnalysisGroup: '[data-qa-id="Trades analysis-button"]',
  metricTradeAnalysisGroupExpanded: '[data-qa-id="Trades analysis-button"][aria-expanded="true"]',
  metricCapitalEfficiencyGroup: '[data-qa-id="Capital efficiency-button"]',
  metricCapitalEfficiencyGroupExpanded: '[data-qa-id="Capital efficiency-button"][aria-expanded="true"]',
  metricRunUpsGroup: '[data-qa-id="Run-ups and drawdowns-button"]',
  metricRunUpsGroupExpanded: '[data-qa-id="Run-ups and drawdowns-button"][aria-expanded="true"]',


  metricPerformanceReturnsTable: '[data-qa-id="returns-summary-table"]',
  metricBenchmarkingTable: '[data-qa-id="benchmarking-table"]',
  metricRatiosTable: '[data-qa-id="ratios-table"]',
  metricTradeAnalysisTable: '[data-qa-id="trades-analysis-table"]',
  metricCapitalEfficiencyTable: '[data-qa-id="capital-efficiency-table"]',
  metricMarginEfficiencyTable: '[data-qa-id="margin-efficiency-table"]',
  metricRunUpsTable: '[data-qa-id="run-ups-table"]',
  metricDrawdownsTable: '[data-qa-id="drawdowns-table"]',

  metricsValueCell: '[class^="reportContainer-"] [class^="containerCell"]',

  get strategyReportInProcess() {
    return selStatus.isNewVersion ?
      '[id="snackbar-container"] [data-qa-id^="backtesting-loading-report-snackbar"]' :
      '#bottom-area div[class^="backtesting"] div[class^="widgetContainer"]  div[role="progressbar"]'
  },
  get strategyReportReady() {
    return selStatus.isNewVersion ?
      '[id="snackbar-container"] [data-qa-id^="backtesting-success-report-snackbar"]' :
      '#bottom-area div[class^="backtesting"] div[class^="widgetContainer"] div[class^="reportContainer"] [class*="root"]'
  },
  get strategyReportUpdate() {
    return selStatus.isNewVersion ?
      '[id="snackbar-container"] [data-qa-id^="backtesting-updated-report-snackbar"] button' :
      '#bottom-area div[class^="backtesting"] div[class^="widgetContainer"] div[class^="reportContainer"] [class*="root"]'
  },
  // strategyUpdateButton: '[id="snackbar-container"]  button'
  // strategyReportTransitionReady: '#bottom-area div.backtesting-content-wrapper > div:not(.opacity-transition).reports-content',
  get strategyReportError() {
    return selStatus.isNewVersion ?
      '#bottom-area div[class*="backtesting"] div[class^="wrapper-"] [class*=emptyStateIcon]' :
      '#bottom-area div[class^="backtesting"] div[class^="container"] [class*=emptyStateIcon]'
  },

  strategyReportHeaderBase: 'div[class^="wrapper-"] div[class^="ka root"] table thead > tr > th',
  strategyReportRowBase: ' div[class^="wrapper-"] div[class^="ka root"] table tbody > tr',
  get strategyReportHeader() {
    return selStatus.isNewVersion ?
      '#bottom-area div[class*="backtesting"] div[class^="wrapper-"] div[class^="ka root"] table thead > tr > th' :
      '#bottom-area div[class^="backtesting"] div[class^="widgetContainer"] div[class^="reportContainer"] table thead > tr > th'
  },
  get strategyReportRow() {
    return selStatus.isNewVersion ?
      '#bottom-area div[class*="backtesting"] div[class^="wrapper-"] div[class^="ka root"] table tbody > tr' :
      '#bottom-area  div[class^="backtesting"] div[class^="widgetContainer"] div[class^="reportContainer"] table tbody > tr'
  },

  strategyTabPeriodDD: '[class^="dateRangeMenuWrapper"] button',
  strategyTabPeriodEntyreHistory: '[class^="eventWrapper"] [role="group"] > div:nth-child(5) > div[aria-checked="true"]',

  strategyListOptions: 'div[role="listbox"] [role="option"]',
  strategyDefaultElement: '#property-actions',

  strategyImportExport: '#iondvImportExport',

  chartTicker: '#header-toolbar-symbol-search > span',
  chartTimeframeFavorite: '#header-toolbar-intervals button[data-value]',
  chartTimeframeActive: '#header-toolbar-intervals button[data-value][aria-checked="true"]',
  chartTimeframeMenuOrSingle: '#header-toolbar-intervals button[class^="menu"]',

  chartTimeframeMenuItem: '#overlap-manager-root div[data-name="popup-menu-container"] div[class^="dropdown"] div[data-value]',
  chartTimeframeMenuInput: '#overlap-manager-root div[data-name="menu-inner"] div[class^="dropdown"] div[class^="form"] > input',
  chartTimeframeMenuType: '#overlap-manager-root div[data-name="menu-inner"] div[class^="dropdown"] div[class^="form"] > div[class^="menu"]',
  chartTimeframeMenuAdd: '#overlap-manager-root div[data-name="menu-inner"] div[class^="dropdown"] div[class^="form"] > div[class^="add"]',
  chartTimeframeMenuTypeItems: '#overlap-manager-root div[data-name="menu-inner"] > div[class^="item"]',
  chartTimeframeMenuTypeItemsMin: '#overlap-manager-root div[data-name="menu-inner"] > div[class^="item"]:nth-child(1)',
  chartTimeframeMenuTypeItemsHours: '#overlap-manager-root div[data-name="menu-inner"] > div[class^="item"]:nth-child(2)',
  chartTimeframeMenuTypeItemsDays: '#overlap-manager-root div[data-name="menu-inner"] > div[class^="item"]:nth-child(3)',
  chartTimeframeMenuTypeItemsWeeks: '#overlap-manager-root div[data-name="menu-inner"] > div[class^="item"]:nth-child(4)',
  chartTimeframeMenuTypeItemsMonth: '#overlap-manager-root div[data-name="menu-inner"] > div[class^="item"]:nth-child(5)',
  chartTimeframeMenuTypeItemsRange: '#overlap-manager-root div[data-name="menu-inner"] > div[class^="item"]:nth-child(6)',
}
