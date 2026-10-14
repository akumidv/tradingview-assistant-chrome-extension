const model = {}


model.getStrategyParameters = async (strategyData) => {
  let paramRange = await storage.getKey(storage.STRATEGY_KEY_PARAM)
  if(paramRange) {
    const mismatched = Object.keys(paramRange).filter(key => !Object.keys(strategyData.properties).includes(key))
    if(mismatched && mismatched.length) {
      const isDef = await ui.alertPopup(`The parameters loaded from the storage are not present in the current strategy: ${mismatched.join(', ')}.\n\n` +
        'Load the matching strategy on the TradingView chart, or upload new parameters for the current one.\n' +
        'Alternatively, use the default optimization parameters of the strategy.\n\n' +
        'Use the default parameters?', false, true)
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


model.saveStrategyParameters = async (paramRange) => {
  await storage.setKeys(storage.STRATEGY_KEY_PARAM, paramRange)
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

model.parseStrategyParamsAndGetMsg = async (fileData) => {
  const paramRange = {}
  const csvData = await file.parseCSV(fileData)
  const headers = Object.keys(csvData[0])
  const missColumns = ['parameter','from','to','step','default','priority'].filter(columnName => !headers.includes(columnName.toLowerCase()))
  if(missColumns && missColumns.length)
    return {text: `  - ${fileData.name}: There is no column(s) "${missColumns.join(', ')}" in CSV.\nPlease add all necessary columns to CSV like showed in the template.\n\nUploading canceled.\n`, isError: true}
  csvData.forEach(row => paramRange[row['parameter']] = [row['from'], row['to'], row['step'], row['default'], row['priority']])
  await storage.setKeys(storage.STRATEGY_KEY_PARAM, paramRange)
  return {text: 'The data was saved in the storage.\nTo use them for repeated testing, click on the "Test strategy" button in the extension pop-up window.', isError: false}
}

model.convertStrategyRangeToTemplate = (paramRange) => {
  let csv = 'Parameter,From,To,Step,Default,Priority\n'
  Object.keys(paramRange).forEach(key => {
    csv += `${JSON.stringify(key)},${typeof paramRange[key][0] === 'string' ? JSON.stringify(paramRange[key][0]) : paramRange[key][0]},`+
      `${paramRange[key][1]},${paramRange[key][2]},${typeof paramRange[key][3] === 'string' ? JSON.stringify(paramRange[key][3]) : paramRange[key][3]},${paramRange[key][4]}\n`
  })
  return csv
}

// Optimisation direction; a missing flag means maximise, the same default action.js applies to testParams
model.isMaximizing = (testResults) => {
  return testResults && testResults.hasOwnProperty('isMaximizing') ? Boolean(testResults.isMaximizing) : true
}

model.getBestResult = (testResults) => {
  const perfomanceSummary = testResults.perfomanceSummary
  const checkField = testResults.optParamName || backtest.DEF_MAX_PARAM_NAME
  const isMaximizing = model.isMaximizing(testResults)
  if(!perfomanceSummary || !perfomanceSummary.length)
    return ''
  const bestResult = perfomanceSummary.reduce((curBestRes, curResult) => {
    // A metric value of 0 is a valid value, so presence is checked by type, not by truthiness
    if(curResult && typeof curResult[checkField] === 'number') {
      const isBestMissing = !curBestRes || typeof curBestRes[checkField] !== 'number'
      if(isMaximizing && (isBestMissing || curBestRes[checkField] < curResult[checkField]))
        return curResult
      else if (!isMaximizing && (isBestMissing || curBestRes[checkField] > curResult[checkField]))
        return curResult
    }
    return curBestRes
  })
  return bestResult
}

model.createParamsFromRange = (paramRange) => {
  const allRangeParams = {}

  Object.keys(paramRange).forEach(key => {
    if(paramRange[key].length !== 5) {
      log.error(`createParamsFromRange: parameter "${key}" range must have 5 values, got`, paramRange[key])
    } else if(typeof paramRange[key][0] === 'boolean' && typeof paramRange[key][1] === 'boolean') {
      allRangeParams[key] = [true, false]
    } else if (typeof paramRange[key][0] === 'string' && paramRange[key][1] === '' && paramRange[key][0].includes(';')) {
      allRangeParams[key] = paramRange[key][0].split(';').filter(item => item)
    } else if(paramRange[key][2] === 0) {
      if(paramRange[key][1] !== '')
        allRangeParams[key] = [paramRange[key][0], paramRange[key][1]]
      else
        log.info(`Parameter "${key}" is skipped because its range has only one value`)
      // allRangeParams[key] = [paramRange[key][0]] // Or skip this param?
    } else if (typeof  paramRange[key][0] === 'number' && typeof paramRange[key][1] === 'number' && typeof paramRange[key][2] === 'number') {
      allRangeParams[key] = []
      const isFloat = paramRange[key][0] % 1 !== 0 || paramRange[key][1]  % 1 !== 0 || paramRange[key][2] % 1 !== 0
      for(let i = paramRange[key][0]; i < paramRange[key][1]; i = i + paramRange[key][2])
        allRangeParams[key].push(isFloat ? Number(i.toFixed(4)) : i) // Reformat values like result 0.7 + 0.1 = 0.799999999999
      // An empty list (from equal to "to", e.g. 0..0) would yield undefined candidates, so the bound is always added
      if(!allRangeParams[key].length || allRangeParams[key][allRangeParams[key].length - 1] < paramRange[key][1])
        allRangeParams[key].push(isFloat ? Number(paramRange[key][1].toFixed(4)) : paramRange[key][1])
      if(paramRange[key][0] > paramRange[key][1])
        log.warn(`Parameter "${key}" range is reversed (from ${paramRange[key][0]} > to ${paramRange[key][1]}), only ${paramRange[key][1]} is tested`)
    } else {
      log.error(`createParamsFromRange: parameter "${key}" has an unsupported combination of range values:`, paramRange[key])
    }
  })
  return allRangeParams
}

model.getParamPriorityList = (paramRange) => {
  const paramPriorityPair = {}
  const priorityList = []
  Object.keys(paramRange).forEach(key => paramRange[key].length === 5 ? priorityList.push(paramRange[key][4]) : null)
  let maxVal = Math.max.apply(null, priorityList)
  maxVal = Math.max(maxVal, Object.keys(paramRange).length)
  Object.keys(paramRange).forEach(key => {
    if(paramRange[key].length !== 5) {
      log.error(`getParamPriorityList: parameter "${key}" range must have 5 values, got`, paramRange[key])
    } else {
      const idx = paramRange[key][4] * maxVal
      if(paramPriorityPair.hasOwnProperty(idx)) {
        for(let i = 1; i < maxVal; i++) {
          if(!paramPriorityPair.hasOwnProperty(idx + i)) {
            paramPriorityPair[idx + i] = key
            break
          }
        }
      } else {
        paramPriorityPair[idx] = key
      }
    }
  })
  const sortedPriority = Object.keys(paramPriorityPair).sort((a, b) => a - b)
  const paramPriorityList = []
  sortedPriority.forEach(idx => paramPriorityList.push(paramPriorityPair[idx]))
  return paramPriorityList
}

model.getStartParamValues = async (paramRange, strategyData) => {
  const currenPropVal = getCurrentPropValues(strategyData, paramRange)
  const startValues = {'default': {}, 'current': currenPropVal}

  Object.keys(paramRange).forEach(key => {
    if(paramRange[key].length !== 5)
      log.error(`getStartParamValues: parameter "${key}" range must have 5 values, got`, paramRange[key])
    else
      startValues.default[key] = paramRange[key][3]
  })

  const testResults = await storage.getKey(storage.STRATEGY_KEY_RESULTS)
  if(testResults && testResults.perfomanceSummary && testResults.perfomanceSummary.length) {
    const bestResult = testResults.perfomanceSummary ? model.getBestResult(testResults) : {}
    const allParamsName = Object.keys(startValues.default)
    if(bestResult) {
      const propVal = {}
      testResults.paramsNames.forEach(paramName => {
        if(bestResult.hasOwnProperty(`__${paramName}`))
          propVal[paramName] = bestResult[`__${paramName}`]
      })
      if(propVal && Object.keys(propVal).every(key => allParamsName.includes(key)))
        startValues.best = propVal
    }
  }
  return startValues
}

function getCurrentPropValues(strategyData, paramRange = null) {
  const propVal = {}
  const keys = paramRange
    ? Object.keys(strategyData.properties).filter(key => Object.hasOwn(paramRange, key))
    : Object.keys(strategyData.properties)
  keys.forEach(key => {
    if (typeof strategyData.properties[key] === 'string' && strategyData.properties[key].includes(';'))
      propVal[key] = strategyData.properties[key].split(';')[0]
    else
      propVal[key] = strategyData.properties[key]
  })
  return propVal
}
