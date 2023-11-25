// TradingView page injection script for get data from window.TradingView object
let isBaseTradingView = true

window.addEventListener('message', async function (event) {
  const url =  window.location && window.location.origin ? window.location.origin : 'https://www.tradingview.com'
  if (!event.origin.startsWith(url) || !event.data ||
    !event.data.hasOwnProperty('name') || event.data.name !== 'iondvScript' ||
    !event.data.hasOwnProperty('action'))
    return
  switch (event.data.action) {
    case 'getPerformance': {
      let tvData = {}
      try {
        if(isBaseTradingView)
          tvData = window.TradingView.bottomWidgetBar._widgets.backtesting._reportWidgetsSet.reportWidget._data.performance
        else if (isBaseTradingView === false)
          tvData = window.TradingView.bottomWidgetBar._options.backtestingStrategyDispatcher._modelStrategies[0]._reportData.performance // First strategy, for new TV (deep history)
      } catch (err) {
        if (isBaseTradingView !== false) {
          try {
            tvData = window.TradingView.bottomWidgetBar._options.backtestingStrategyDispatcher._modelStrategies[0]._reportData.performance
          } catch (e) {
            isBaseTradingView = null
            console.error("Can't get TV API perfomance data, please write to developer")
            console.error(err)
            console.error(e)
          }
        }
      }
      window.postMessage({name: 'iondvPage', action: event.data.action, data: tvData}, event.origin)
      break
    }
    // case 'show3DChart': { // TODO move to ui
    //   try {
    //     if (!event.data.hasOwnProperty('data'))
    //       window.postMessage({name: 'iondvPage', action: event.data.action, message: "Can't get test results data"}, event.origin)
    //     await show3DChart(event.data.data)
    //     window.postMessage({name: 'iondvPage', action: event.data.action}, event.origin)
    //   } catch (err) {
    //     console.error(`[error] shor 3d chart.`, err)
    //     window.postMessage({name: 'iondvPage', action: event.data.action, data: null, message: `${err}`}, event.origin)
    //   }
    //   break
    // }
    default:
      console.error(`[error] Unknown action for get data from page"${event.data.action}". Skip processing`)
      window.postMessage({name: 'iondvPage', action: event.data.action, data: null, message: `${err}`}, event.origin)
  }
})
