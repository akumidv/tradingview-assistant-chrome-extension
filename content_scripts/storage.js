const storage = {
  KEY_PREFIX: 'iondv',
  STRATEGY_KEY_PARAM: 'strategy_param',
  STRATEGY_KEY_RESULTS: 'strategy_result',
  SIGNALS_KEY_PREFIX: 'signals'
}



storage.getKey = async (storageKey) => {
  const getParam = storageKey === null ? null : Array.isArray(storageKey) ? storageKey.map(item => `${storage.KEY_PREFIX}_${item}`) : `${storage.KEY_PREFIX}_${storageKey}`
  return new Promise (resolve => {
    chrome.storage.local.get(getParam, (getResults) => {
      if(storageKey === null) {
        const storageData = {}
        Object.keys(getResults).filter(key => key.startsWith(storage.KEY_PREFIX)).forEach(key => storageData[key] = getResults[key])
        return resolve(storageData)
      } else if(!getResults.hasOwnProperty(`${storage.KEY_PREFIX}_${storageKey}`)) {
        return resolve(null)
      }
      return resolve(getResults[`${storage.KEY_PREFIX}_${storageKey}`])
    })
  })
}

storage.setKeys = async (storageKey, value) => {
  const storageData = {}
  storageData[`${storage.KEY_PREFIX}_${storageKey}`] = value
  return new Promise (resolve => {
    chrome.storage.local.set(storageData, () => {
      resolve()
    })
  })
}

storage.removeKey = async (storageKey) => {
  return new Promise (resolve => {
    chrome.storage.local.remove(storageKey, () => {
      resolve()
    })
  })
}

storage.clearAll = async () => {
  const allStorageKey = await storage.getKey(null)
  await storage.removeKey(Object.keys(allStorageKey))
  return Object.keys(allStorageKey)
}