// The assistant database for the content scripts: every call goes to the background service worker (background.js),
// which owns the IndexedDB of the extension origin. The table names are the ones of shared/db.js.
const dbClient = {
  OPTIMIZATION_SETTINGS: 'optimization_settings',
  STRATEGY_SETTINGS: 'strategy_settings',
  OPTIMIZATION_RESULTS: 'optimization_results'
}

dbClient.call = (op, ...args) => {
  return new Promise((resolve, reject) => {
    try {
      chrome.runtime.sendMessage({type: 'tvaDb', op, args}, (response) => {
        if (chrome.runtime.lastError)
          return reject(new Error(`The assistant database is not available: ${chrome.runtime.lastError.message}. ` +
            'Reload the TradingView page (F5) after reloading the extension.'))
        if (!response || !response.ok)
          return reject(new Error(response && response.error ? response.error : 'The assistant database did not respond'))
        resolve(response.result)
      })
    } catch (err) {
      reject(new Error(`The assistant database is not available: ${err.message}. Reload the TradingView page (F5).`))
    }
  })
}

dbClient.get = (storeName, strategyId) => dbClient.call('get', storeName, strategyId)
dbClient.put = (storeName, record) => dbClient.call('put', storeName, record)
dbClient.update = (storeName, strategyId, fields) => dbClient.call('update', storeName, strategyId, fields)
dbClient.appendRun = (strategyId, run) => dbClient.call('appendRun', strategyId, run)
dbClient.exportAll = () => dbClient.call('exportAll')
dbClient.importAll = (data) => dbClient.call('importAll', data)
