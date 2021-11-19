const model = {}


model.getStrategyParameters = async (strategyData) => {
  let paramRange = await storage.getKey(storage.STRATEGY_KEY_PARAM)
  if(paramRange) {
    const mismatched = Object.keys(paramRange).filter(key => !Object.keys(strategyData.properties).includes(key))
    if(mismatched && mismatched.length) {
      const isDef = confirm(`The data loaded from the storage has parameters that are not present in the current strategy: ${mismatched.join(',')}.\n\nYou need to load the correct strategy in the Tradingview chart or load new parameters for the current one. \nAlternatively, you can use the default strategy optimization parameters.\n\nShould it use the default settings?`)
      if (!isDef)
        return null
      paramRange = model.getStrategyRange(strategyData)
    }
  } else {
    paramRange = model.getStrategyRange(strategyData)
  }
  await storage.setKeys(storage.STRATEGY_KEY_PARAM, paramRange)
  return paramRange
}


model.getStrategyRange = (strategyData) => {
  const paramRange = {}
  Object.keys(strategyData.properties).forEach((key, idx) => {
    if(typeof strategyData.properties[key] === 'boolean') {
      paramRange[key] = [true, false, 0, strategyData.properties[key], idx + 1]
    } else if (typeof strategyData.properties[key] === 'string' && strategyData.properties[key].includes(';')) {
      paramRange[key] = [strategyData.properties[key], '', 0, strategyData.properties[key].split(';')[0], idx + 1]
    } else {
      const isInteger = strategyData.properties[key] === Math.round(strategyData.properties[key]) // TODO or convert to string and check the point?
      if(strategyData.properties[key]) { // Not 0 or Nan
        paramRange[key] = [isInteger ? Math.floor(strategyData.properties[key] / 2) : strategyData.properties[key] / 2,
          strategyData.properties[key] * 2]
        let step = isInteger ? Math.round((paramRange[key][1] - paramRange[key][0]) / 10) : (paramRange[key][1] - paramRange[key][0]) / 10
        step = isInteger && step !== 0 ? step : paramRange[key][1] < 0 ? -1 : 1 // TODO or set paramRange[key][1]?
        paramRange[key].push(step)
        paramRange[key].push(strategyData.properties[key])
        paramRange[key].push(idx + 1)
      } else {
        paramRange[key] = [strategyData.properties[key], '', 0, strategyData.properties[key], idx + 1]
      }
    }
  })
  return paramRange
}