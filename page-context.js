// TradingView page injection script for get data from window.TradingView object

window.addEventListener('message', function (event) {
  const url =  window.location && window.location.origin ? window.location.origin : 'https://www.tradingview.com'
  if (!event.origin.startsWith(url) || !event.data ||
    !event.data.hasOwnProperty('name') || event.data.name !== 'iondvScript' ||
    !event.data.hasOwnProperty('action'))
    return
  switch (event.data.action) {
    case 'getPerformance': {
      let tvData = {}
      try {
        tvData = window.TradingView.bottomWidgetBar._widgets.backtesting._reportWidgetsSet.reportWidget._data.performance
      } catch (err) {
        console.error(err)
      }
      window.postMessage({name: 'iondvPage', action: event.data.action, data: tvData}, event.origin)
      break
    }
    default:
      console.error(`[error] Unknown action for get data from page"${event.data.action}". Skip processing`)
  }
})
