
const SEL = {
    tvLegendIndicatorItem: 'div[data-name="legend"] div[class^="sourcesWrapper"] div[class^="sources"] div[data-name="legend-source-item"]',
    tvLegendIndicatorItemTitle: 'div[data-name="legend-source-title"]',
    tvDialogRoot: '#overlap-manager-root',
    indicatorTitle: '#overlap-manager-root div[data-name="indicator-properties-dialog"] div[class^="title"]',
    tabInput: 'div[data-name="indicator-properties-dialog"] div[data-value="inputs"]',
    tabInputActive: 'div[data-name="indicator-properties-dialog"] div[class*="active"][data-value="inputs"]',
    tabProperties: 'div[data-name="indicator-properties-dialog"] div[data-value="properties"]',
    ticker: '#header-toolbar-symbol-search > div[class*="text-"]',
    timeFrame: '#header-toolbar-intervals div[data-role^="button"]',
    timeFrameActive: '#header-toolbar-intervals div[data-role^="button"][class*="isActive"]',
    indicatorScroll: 'div[data-name="indicator-properties-dialog"] div[class^="scrollable-"]',
    indicatorProperty: 'div[data-name="indicator-properties-dialog"] div[class^="content-"] div[class^="cell-"]',
    okBtn: 'div[data-name="indicator-properties-dialog"] div[class^="footer-"] button[name="submit"]',
    cancelBtn: 'div[data-name="indicator-properties-dialog"] span[data-name="close"][data-role="button"]',
    strategyTesterTab: '#footer-chart-panel div[data-name="backtesting"]',
    strategyTesterTabActive: '#footer-chart-panel div[data-name="backtesting"][data-active="true"]',
    strategyCaption: '#bottom-area div[class^="bottom-widgetbar-content backtesting"] [class^="fixedContent"] > div',
    
    strategyDialogParam: '#bottom-area div[class^="bottom-widgetbar-content backtesting"]  div[class^="fixedContent"]  > button:nth-child(1)',
    
    strategySummary: '#bottom-area div[class^="bottom-widgetbar-content backtesting"] div[class^="tabSwitcher"] > button:nth-child(2)',
    strategySummaryActive: '#bottom-area div[class^="bottom-widgetbar-content backtesting"] div[class^="tabSwitcher"] > button[class*="activeTab"]:nth-child(2)',
    // strategySummaryActiveNew: '#bottom-area div[class^="backtesting"] div[class^="tabSwitcher"] > button[class*="activeTab"]:nth-child(2)',
    strategyReport: '#bottom-area div.backtesting-content-wrapper > div.reports-content',
    strategyReportInProcess: '#bottom-area div.backtesting-content-wrapper > div.reports-content.fade',
    strategyReportIsTransition: '#bottom-area div.backtesting-content-wrapper > div.reports-content.opacity-transition',
    strategyReportReady: '#bottom-area div.backtesting-content-wrapper > div:not(.fade).reports-content',
    strategyReportTransitionReady: '#bottom-area div.backtesting-content-wrapper > div:not(.opacity-transition).reports-content',
    strategyReportError: '#bottom-area div.backtesting-content-wrapper > div.reports-content.report-error',
    
    strategyReportHeader: '#bottom-area > div.bottom-widgetbar-content.backtesting > div > div.backtesting-content-wrapper.widgetContainer-C69P68Cf > div > div > div > div > table > thead > tr > th',
    
    // strategyReportHeaderOld: '#bottom-area div.backtesting-content-wrapper thead > tr > td',
    strategyReportRow: '#bottom-area > div.bottom-widgetbar-content.backtesting > div > div.backtesting-content-wrapper.widgetContainer-C69P68Cf > div > div > div > div > table > tbody > tr',
    // strategyReportRowNew: '#bottom-area div.backtesting-content-wrapper tbody > tr',
    strategyListOptions: 'div[role="listbox"] div[data-name="menu-inner"] div[role="option"] span[class^="label-"]',
    strategyDefaultElement: '#study-defaults-manager',
    strategyImportExport: '#iondvImportExport'
}