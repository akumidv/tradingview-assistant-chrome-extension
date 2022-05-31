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
  console.log('parsStrategyParamsAndGetMsg filename', fileData)
  const paramRange = {}
  const csvData = await file.parseCSV(fileData)
  const headers = Object.keys(csvData[0])
  const missColumns = ['parameter','from','to','step','default','priority'].filter(columnName => !headers.includes(columnName.toLowerCase()))
  if(missColumns && missColumns.length)
    return `  - ${fileData.name}: There is no column(s) "${missColumns.join(', ')}" in CSV.\nPlease add all necessary columns to CSV like showed in the template.\n\nUploading canceled.\n`
  csvData.forEach(row => paramRange[row['parameter']] = [row['from'], row['to'], row['step'], row['default'], row['priority']])
  await storage.setKeys(storage.STRATEGY_KEY_PARAM, paramRange)
  console.log(paramRange)
  return `The data was saved in the storage. \nTo use them for repeated testing, click on the "Test strategy" button in the extension pop-up window.`
}

model.convertStrategyRangeToTemplate = (paramRange) => {
  let csv = 'Parameter,From,To,Step,Default,Priority\n'
  Object.keys(paramRange).forEach(key => {
    csv += `${JSON.stringify(key)},${typeof paramRange[key][0] === 'string' ? JSON.stringify(paramRange[key][0]) : paramRange[key][0]},`+
      `${paramRange[key][1]},${paramRange[key][2]},${typeof paramRange[key][3] === 'string' ? JSON.stringify(paramRange[key][3]) : paramRange[key][3]},${paramRange[key][4]}\n`
  })
  return csv
}

model.getBestResult = (testResults) => {
  const perfomanceSummary = testResults.perfomanceSummary
  const checkField = testResults.optParamName || backtest.DEF_MAX_PARAM_NAME
  const isMaximizing = testResults.hasOwnProperty('isMaximizing') ?  testResults.isMaximizing : true
  if(!perfomanceSummary || !perfomanceSummary.length)
    return ''
  const bestResult = perfomanceSummary.reduce((curBestRes, curResult) => {
    if(curResult.hasOwnProperty(checkField)) {
      if(isMaximizing && (!curBestRes || !curBestRes[checkField] || curBestRes[checkField] < curResult[checkField]))
        return curResult
      else if (!isMaximizing && (!curBestRes || !curBestRes[checkField] || curBestRes[checkField] > curResult[checkField]))
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
      console.error('Errors in param length', key, paramRange[key])
    } else if(typeof paramRange[key][0] === 'boolean' && typeof paramRange[key][1] === 'boolean') {
      allRangeParams[key] = [true, false]
    } else if (typeof paramRange[key][0] === 'string' && paramRange[key][1] === '' && paramRange[key][0].includes(';')) {
      allRangeParams[key] = paramRange[key][0].split(';').filter(item => item)
    } else if(paramRange[key][2] === 0) {
      if(paramRange[key][1] !== '')
        allRangeParams[key] = [paramRange[key][0], paramRange[key][1]]
      else
        console.log(`Parameter "${key}" will be skipped, because it have only one value in range`)
      // allRangeParams[key] = [paramRange[key][0]] // Or skip this param?
    } else if (typeof  paramRange[key][0] === 'number' && typeof paramRange[key][1] === 'number' && typeof paramRange[key][2] === 'number') {
      allRangeParams[key] = []
      const isFloat = paramRange[key][0] % 1 !== 0 || paramRange[key][1]  % 1 !== 0 || paramRange[key][2] % 1 !== 0
      for(let i = paramRange[key][0]; i < paramRange[key][1]; i = i + paramRange[key][2])
        allRangeParams[key].push(isFloat ? Number(i.toFixed(4)) : i) // Reformat values like result 0.7 + 0.1 = 0.799999999999
      if(allRangeParams[key][allRangeParams[key].length - 1] < paramRange[key][1])
        allRangeParams[key].push(isFloat ? Number(paramRange[key][1].toFixed(4)) : paramRange[key][1])
    } else {
      console.error('Unsupported param values combination', key, paramRange[key])
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
      console.error('Errors in param length', key, paramRange[key])
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
  const currenPropVal = getCurrentPropValues(strategyData)
  const startValues = {'default': {}, 'current': currenPropVal}

  Object.keys(paramRange).forEach(key => {
    if(paramRange[key].length !== 5)
      console.error('Errors in param length', key, paramRange[key])
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

function getCurrentPropValues(strategyData) {
  const propVal = {}
  Object.keys(strategyData.properties).forEach(key => {
    if (typeof strategyData.properties[key] === 'string' && strategyData.properties[key].includes(';'))
      propVal[key] = strategyData.properties[key].split(';')[0]
    else
      propVal[key] = strategyData.properties[key]
  })
  return propVal
}