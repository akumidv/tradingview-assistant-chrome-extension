
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
    strategyDialogParam: '#bottom-area div[class^="backtesting"]  [class^="strategyGroup"]  > div:nth-child(2) > button:nth-child(1)',
    strategySummary: '[id="Performance Summary"]',
    strategySummaryActive: '[id="Performance Summary"][class*="selected"]',
    strategyPerformanceTab: '[id="Performance Summary"]',
    strategyPerformanceTabActive: '[id="Performance Summary"][class*="selected"]',

    strategyReportObserveArea: '#bottom-area div[class^="backtesting"] div[class^="widgetContainer"]',
    strategyReportInProcess: '#bottom-area div[class^="backtesting"] div[class^="widgetContainer"]  div[role="progressbar"]', //div[class^="tv-spinner"]',
    strategyReportReady: '#bottom-area div[class^="backtesting"] div[class^="widgetContainer"] div[class^="reportContainer"] [class*="root"]',
    // strategyReportTransitionReady: '#bottom-area div.backtesting-content-wrapper > div:not(.opacity-transition).reports-content',
    strategyReportError: '#bottom-area div[class^="backtesting"] div[class^="container"] [class*=emptyStateIcon]',
    strategyReportHeader: '#bottom-area div[class^="backtesting"] div[class^="widgetContainer"] div[class^="reportContainer"] table thead > tr > th',
    strategyReportRow: '#bottom-area  div[class^="backtesting"] div[class^="widgetContainer"] div[class^="reportContainer"] table tbody > tr',


    strategyDeepTestCheckbox: '#bottom-area div[class^="backtesting"]  [class^="deepHistoryContainer"]  [class^="switcher"] input',
    strategyDeepTestStartDate: '#bottom-area div[class^="backtesting"]  [class^="historyParams"]  [class^="container" ]> div:nth-child(1) div[class^="pickerInput"] input',
    strategyDeepTestGenerateBtn: '#bottom-area div[class^="backtesting"]  [class^="historyParams"] button[class^="generateReportBtn"]:not([disabled])',
    strategyDeepTestGenerateBtnDisabled: '#bottom-area div[class^="backtesting"]  [class^="historyParams"] button[class^="generateReportBtn"][disabled]',
    strategyReportDeepTestObserveArea: '#bottom-area div[class^="backtesting"] div[class^="backtesting-content-wrapper"]',
    strategyReportDeepTestInProcess: '#bottom-area div[class^="backtesting"] div[class^="backtesting-content-wrapper"] div[role="progressbar"]',
    strategyReportDeepTestReady: '#bottom-area div[class^="backtesting"] div[class^="backtesting-content-wrapper"] div[class^="reportContainer"] [class*="root"]',
    strategyReportDeepTestHeader: '#bottom-area div[class^="backtesting"] div[class^="backtesting-content-wrapper"] div[class^="reportContainer"] table thead > tr > th',
    strategyReportDeepTestRow: '#bottom-area  div[class^="backtesting"] div[class^="backtesting-content-wrapper"] div[class^="reportContainer"] table tbody > tr',


    strategyListOptions: 'div[role="listbox"] div[data-name="menu-inner"] div[role="option"] span[class^="label-"]',
    strategyDefaultElement: '#property-actions',

    strategyImportExport: '#iondvImportExport',

    chartTicker: '#header-toolbar-symbol-search > div[class*="text-"]',
    chartTimeframeFavorite: '#header-toolbar-intervals button[data-value]',
    chartTimeframeActive: '#header-toolbar-intervals button[data-value][aria-checked="true"]',
    chartTimeframeMenuOrSingle: '#header-toolbar-intervals button[class^="menu"]',


    // chartTimeframeFavorite: '#header-toolbar-intervals div[data-role="button"][data-value]',
    // chartTimeframeActive: '#header-toolbar-intervals div[data-role="button"][data-value][class*="isActive"]',
    // chartTimeframeMenuOrSingle: '#header-toolbar-intervals div[data-role="button"][class^="menu"]',
    chartTimeframeMenuItem: "#overlap-manager-root div[data-name=\"menu-inner\"] div[class^=\"dropdown\"] div[data-value]",
    chartTimeframeMenuInput: "#overlap-manager-root div[data-name=\"menu-inner\"] div[class^=\"dropdown\"] div[class^=\"form\"] > input",
    chartTimeframeMenuType: "#overlap-manager-root div[data-name=\"menu-inner\"] div[class^=\"dropdown\"] div[class^=\"form\"] > div[class^=\"menu\"]",
    chartTimeframeMenuAdd: "#overlap-manager-root div[data-name=\"menu-inner\"] div[class^=\"dropdown\"] div[class^=\"form\"] > div[class^=\"add\"]",
    chartTimeframeMenuTypeItems: "#overlap-manager-root div[data-name=\"menu-inner\"] > div[class^=\"item\"]",
    chartTimeframeMenuTypeItemsMin: "#overlap-manager-root div[data-name=\"menu-inner\"] > div[class^=\"item\"]:nth-child(1)",
    chartTimeframeMenuTypeItemsHours: "#overlap-manager-root div[data-name=\"menu-inner\"] > div[class^=\"item\"]:nth-child(2)",
    chartTimeframeMenuTypeItemsDays: "#overlap-manager-root div[data-name=\"menu-inner\"] > div[class^=\"item\"]:nth-child(3)",
    chartTimeframeMenuTypeItemsWeeks: "#overlap-manager-root div[data-name=\"menu-inner\"] > div[class^=\"item\"]:nth-child(4)",
    chartTimeframeMenuTypeItemsMonth: "#overlap-manager-root div[data-name=\"menu-inner\"] > div[class^=\"item\"]:nth-child(5)",
    chartTimeframeMenuTypeItemsRange: "#overlap-manager-root div[data-name=\"menu-inner\"] > div[class^=\"item\"]:nth-child(6)",

}
