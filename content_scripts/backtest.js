/*
 * DEBUGGING INSTRUCTIONS FOR PARAMETER NAME ISSUES:
 * 
 * If you're getting "Net profit: All Error on runtime" but it works initially:
 * 
 * 1. Run your backtest and check the console logs for:
 *    - "=== Available Parameters ===" - shows all parameter names from TradingView
 *    - "Found Net Profit variations" - shows detected Net Profit parameter names
 *    - "Using suggested parameter" - shows automatic parameter name correction
 * 
 * 2. If the automatic detection doesn't work, you can manually set the parameter name:
 *    backtest.setOptParamName(testResults, 'Correct Parameter Name')
 * 
 * 3. Update DEF_MAX_PARAM_NAME below with the correct parameter name found in the logs
 * 
 * Common parameter names TradingView uses:
 * - 'Net profit: All' (current default)
 * - 'Net Profit: All' (old version)
 * - 'Net P&L: All' (alternative)
 * - 'Total Net Profit: All' (some versions)
 */

const backtest = {
  DEF_MAX_PARAM_NAME: 'Net profit: All'
}

backtest.delay = async (backtestDelay = 0, isRandom = true) => {
  const minimalDelay = 0.2 // 20%
  if (backtestDelay) {
    let delay = backtestDelay * 1000
    if (isRandom) {
      const delay10percent = delay * minimalDelay
      delay = randomInteger(delay10percent, (delay - delay10percent) * 2) // fro, 0.1 value to 2x value - in average ~ delay == value
    }
    await page.waitForTimeout(delay)
  }
}

backtest.testStrategy = async (testResults, strategyData, allRangeParams) => {
  testResults.perfomanceSummary = []
  testResults.filteredSummary = []
  testResults.shortName = strategyData.name
  console.log('testStrategy', testResults.shortName, testResults.isMaximizing ? 'max' : 'min', 'value of', testResults.optParamName,
    'by', testResults.method,
    (testResults.filterAscending === null ? 'filter off' : 'filter ascending' + testResults.filterAscending + ' value ' +
      testResults.filterValue + ' by ' + testResults.filterParamName),
    testResults.cycles, 'times')
  testResults.paramsNames = Object.keys(allRangeParams)

  // Get best init value and properties values
  ui.statusMessage('Get the best initial values.')


  const initRes = await getInitBestValues(testResults) // allRangeParams
  if (initRes && initRes.hasOwnProperty('bestValue') && initRes.bestValue !== null && initRes.hasOwnProperty('bestPropVal') && initRes.hasOwnProperty('data')) {
    testResults.initBestValue = initRes.bestValue
    testResults.bestValue = initRes.bestValue
    testResults.bestPropVal = initRes.bestPropVal
    testResults.perfomanceSummary.push(initRes.data)
    try {
      ui.statusMessage(`<p>From default and previous test. Best "${testResults.optParamName}": ${backtest.convertValue(testResults.bestValue)}</p>`)
      console.log('Init best value', testResults.bestValue)
      // console.log(testResults.perfomanceSummary)
    } catch {
    }
  }
  // console.log('bestValue', testResults.bestValue)
  // console.log('bestPropVal', testResults.bestPropVal)

  // Test strategy
  const optimizationState = {}
  let isEnd = false
  let avgTime = 0

  for (let i = 0; i < testResults.cycles; i++) {
    if (action.workerStatus === null) {
      console.log('Stop command detected')
      break
    }
    // if (page.$(SEL.goproPopupCloseButton)) {
    //   page.mouseClickSelector(SEL.goproPopupCloseButton)
    //   console.log('GoPro popup was closed')
    // }
    let startTime = new Date()
    await backtest.delay(testResults.backtestDelay, testResults.randomDelay)
    const delayTime = Math.round((new Date() - startTime) / 1000 * 10) / 10
    startTime = new Date()
    let optRes = {}
    switch (testResults.method) {
      case 'annealing':
        optRes = await optAnnealingIteration(allRangeParams, testResults, testResults.bestValue, testResults.bestPropVal, optimizationState)
        break
      case 'sequential':
        optRes = await optSequentialIteration(allRangeParams, testResults, testResults.bestValue, testResults.bestPropVal, optimizationState)
        if (optRes === null)
          isEnd = true
        break
      case 'random':
        optRes = await optAllRandomIteration(allRangeParams, testResults, testResults.bestValue, testResults.bestPropVal, optimizationState)
        if (optRes === null)
          isEnd = true
        break
      case 'brute force':
        optRes = await optBruteForce(allRangeParams, testResults, testResults.bestValue, testResults.bestPropVal, optimizationState)
        if (optRes === null)
          isEnd = true
        break
      case 'random improvement':
      default:
        optRes = await optRandomIteration(allRangeParams, testResults, testResults.bestValue, testResults.bestPropVal, optimizationState)
        if (optRes === null)
          isEnd = true
    }
    if (isEnd)
      break
    const durationTime = Math.round((new Date() - startTime) / 1000 * 10) / 10
    avgTime = Math.round((avgTime - avgTime / (i + 1) + durationTime / (i + 1)) * 10) / 10
    let setTime = 0
    let parseTime = 0
    try {
      if (Object.hasOwn(optRes, 'data')) {
        setTime = optRes.data['_setTime_']
        parseTime = optRes.data['_parseTime_']
        optRes['data']['_duration_'] = durationTime
      }
    } catch {
    }
    if (optRes.hasOwnProperty('data') && optRes.hasOwnProperty('bestValue') && optRes.bestValue !== null && optRes.hasOwnProperty('bestPropVal')) {
      testResults.bestValue = optRes.bestValue
      testResults.bestPropVal = optRes.bestPropVal
      try {
        let text = `<p>Cycle: ${i + 1}/${testResults.cycles} (${durationTime}[${setTime}/${parseTime}]/${avgTime} sec). Best "${testResults.optParamName}": ${backtest.convertValue(testResults.bestValue)}</p>`
        text += optRes.hasOwnProperty('currentValue') ? `<p>Current "${testResults.optParamName}": ${backtest.convertValue(optRes.currentValue)}</p>` : ''
        text += optRes.error !== null ? `<p style="color: red">${optRes.message}</p>` : optRes.message ? `<p>${optRes.message}</p>` : ''
        ui.statusMessage(text)
      } catch {
      }
    } else {
      try {
        let text = `<p>Cycle: ${i + 1}/${testResults.cycles}. Best "${testResults.optParamName}": ${backtest.convertValue(testResults.bestValue)}</p>`
        text += optRes.currentValue ? `<p>Current "${testResults.optParamName}": ${backtest.convertValue(optRes.currentValue)}</p>` : `<p>Current "${testResults.optParamName}": error</p>`
        text += optRes.error !== null ? `<p style="color: red">${optRes.message}</p>` : optRes.message ? `<p>${optRes.message}</p>` : ''
        ui.statusMessage(text)
      } catch {
      }
    }
  }
  return testResults
}

backtest.convertValue = (value) => {
  if (!value)
    return 0
  return (Math.round(value * 100) / 100).toFixed(2)
}


async function getInitBestValues(testResults) {
  let resVal = null
  let resPropVal = testResults.startParams.current
  let resData = {}

  function setBestVal(newVal, newPropVal, newResData) {
    if (resVal === null || resPropVal === null) {
      resVal = newVal
      resPropVal = newPropVal
      resData = newResData
    } else if (testResults.isMaximizing && newVal > resVal) {
      resVal = newVal
      resPropVal = newPropVal
      resData = newResData
    } else if (!testResults.isMaximizing && newVal < resVal) {
      resVal = newVal < resVal ? newVal : resVal
      resPropVal = newVal < resVal ? newPropVal : resPropVal
      resData = newVal < resVal ? newResData : resData
    }
  }

  await backtest.delay(testResults.backtestDelay, testResults.randomDelay)
  const startTime = new Date()
  const res = await tv.getPerformance(testResults)
  res['data']['_setTime_'] = 0
  res['data']['_parseTime_'] = Math.round((new Date() - startTime) / 1000 * 10) / 10
  res['data']['_duration_'] = 0
  resData = res['data']
  if (res['error'] === null)
    resData = calculateAdditionValuesToReport(resData)

  // DEBUG: Log all available parameters
  backtest.logAvailableParameters(resData, 'in getInitBestValues - Current')

  // Check if parameter exists, if not try to find the correct one
  let actualParamName = testResults.optParamName
  if (resData && !resData.hasOwnProperty(testResults.optParamName)) {
    console.error(`❌ Parameter "${testResults.optParamName}" not found in current report data!`)
    const suggestedParam = backtest.findBestNetProfitParam(resData)
    if (suggestedParam) {
      console.log(`🔄 Using suggested parameter: "${suggestedParam}" instead of "${testResults.optParamName}"`)
      actualParamName = suggestedParam
      testResults.optParamName = suggestedParam
    }
  }

  if (resData && resData.hasOwnProperty(actualParamName)) {
    console.log(`Init from current "${actualParamName}":`, resData[actualParamName])
    // resVal = resData[actualParamName]
    resData['comment'] = resData['comment'] ? `Current parameters. ${resData['comment']}` : 'Current parameters.'
    Object.keys(resPropVal).forEach(key => resData[`__${key}`] = resPropVal[key])
    const curPropVal = expandPropVal(testResults.startParams.current, resPropVal)
    setBestVal(res.data[actualParamName], curPropVal, res.data)
  } else {
    console.error(`❌ Parameter "${actualParamName}" not found in current report data!`)
  }

  if (testResults.startParams.hasOwnProperty('default') && testResults.startParams.default) {
    const defPropVal = expandPropVal(testResults.startParams.default, resPropVal)
    if (resPropVal === null || Object.keys(resPropVal).some(key => resPropVal[key] !== defPropVal[key])) {
      await backtest.delay(testResults.backtestDelay, testResults.randomDelay)
      const res = await backtest.getTestIterationResult(testResults, defPropVal, true) // Ignore error because propValues can be the same
      if (res && res.data && res.data.hasOwnProperty(testResults.optParamName)) {
        console.log(`Init from default "${testResults.optParamName}":`, res.data[testResults.optParamName])
        res.data['comment'] = res.data['comment'] ? `Default parameters. ${res.data['comment']}` : 'Default parameters.'
        Object.keys(defPropVal).forEach(key => res.data[`__${key}`] = defPropVal[key])
        setBestVal(res.data[testResults.optParamName], defPropVal, res.data)
      }
    } else {
      console.log(`Default "${testResults.optParamName}" equal current:`, resData[testResults.optParamName])
    }
  }

  if (!testResults.shouldSkipInitBestResult && testResults.startParams.hasOwnProperty('best') && testResults.startParams.best) {
    const isBestIdenticalCurrent = testResults.startParams.current && Object.keys(testResults.startParams.current).some(key => testResults.startParams.current[key] !== testResults.startParams.best[key])
    const isBestIdenticalDefault = testResults.startParams.default && Object.keys(testResults.startParams.default).some(key => testResults.startParams.default[key] !== testResults.startParams.best[key])
    if (resPropVal === null || (!isBestIdenticalCurrent && !isBestIdenticalDefault)) {
      const bestPropVal = expandPropVal(testResults.startParams.best, resPropVal)
      await backtest.delay(testResults.backtestDelay, testResults.randomDelay)
      const res = await backtest.getTestIterationResult(testResults, bestPropVal, true)  // Ignore error because propValues can be the same
      if (res && res.data && res.data.hasOwnProperty(testResults.optParamName)) {
        console.log(`Init from best "${testResults.optParamName}":`, res.data[testResults.optParamName])
        res.data['comment'] = res.data['comment'] ? `Best value parameters. ${res.data['comment']}` : 'Best value parameters.'
        Object.keys(bestPropVal).forEach(key => res.data[`__${key}`] = bestPropVal[key])
        setBestVal(res.data[testResults.optParamName], bestPropVal, res.data)
      }
    } else {
      console.log(`Best "${testResults.optParamName}" equal previous (current or default):`, resData[testResults.optParamName])
    }
  }
  console.log(`For init "${testResults.optParamName}":`, resVal)

  if (resVal !== null && resPropVal !== null && resData !== null)
    return { bestValue: resVal, bestPropVal: resPropVal, data: resData }
  return null
}


backtest.getTestIterationResult = async (testResults, propVal, isIgnoreError = false, isIgnoreSetParam = false) => {
  try {
    tv.isReportChanged = false // Global value
    let startTime = new Date()
    if (!isIgnoreSetParam) {
      const isParamsSet = await tv.setStrategyParams(testResults.shortName, propVal, testResults.isDeepTest, false)
      if (!isParamsSet)
        return { error: 1, errMessage: 'The strategy parameters cannot be set', data: null }
    }
    const setTime = Math.round((new Date() - startTime) / 1000 * 10) / 10
    startTime = new Date()
    const res = await tv.getPerformance(testResults, isIgnoreError)
    const parseTime = Math.round((new Date() - startTime) / 1000 * 10) / 10

    Object.keys(propVal).forEach(key => res['data'][`__${key}`] = propVal[key])

    // DEBUG: Log all available parameters during iteration
    if (res.error === null || isIgnoreError) {
      backtest.logAvailableParameters(res['data'], 'in getTestIterationResult')
    }

    if (res.error === null || isIgnoreError) {
      res['data'] = calculateAdditionValuesToReport(res['data'])
    } else {
      res['data']['comment'] = res['error'] === 2 ? 'The tradingview error occurred when calculating the strategy based on these parameter values' :
        res['error'] === 1 ? 'The tradingview calculation process has not started for the strategy based on these parameter values' :
          res['error'] === 3 ? `The calculation of the strategy parameters took more than ${testResults.dataLoadingTime} seconds for one combination. Testing of this combination is skipped.` : ''
    }
    res['data']['_setTime_'] = setTime
    res['data']['_parseTime_'] = parseTime
    return res
  } catch (err) {
    console.log('Error to getTestIterationResult ', err)
    return { 'data': {} }
  }
  // return {error: isProcessError ? 2 : !isProcessEnd ? 3 : null, message: reportData['comment'], data: reportData}
}

async function getResWithBestValue(res, testResults, bestValue, bestPropVal, propVale) {
  let isFiltered = false
  
  // DEBUG: Check if the parameter exists and try to find alternative if not
  let actualParamName = testResults.optParamName
  if (!Object.hasOwn(res.data, testResults.optParamName)) {
    console.error(`❌ Parameter "${testResults.optParamName}" not found in getResWithBestValue!`)
    backtest.logAvailableParameters(res.data, 'in getResWithBestValue - Missing Parameter')
    
    // Try to find the correct parameter name automatically
    const suggestedParam = backtest.findBestNetProfitParam(res.data)
    if (suggestedParam) {
      console.log(`🔄 Using suggested parameter: "${suggestedParam}" instead of "${testResults.optParamName}"`)
      actualParamName = suggestedParam
      // Update the testResults to use the correct parameter name for future iterations
      testResults.optParamName = suggestedParam
    } else {
      console.error('❌ Could not find any suitable parameter to use!')
    }
  }
  
  if (Object.hasOwn(res.data, actualParamName)) {
    if (testResults.filterAscending !== null &&
      res.data.hasOwnProperty(testResults.filterParamName) && testResults.hasOwnProperty('filterValue')) {
      if (typeof res.data[testResults.filterParamName] !== 'number' ||
        (testResults.filterAscending && res.data[testResults.filterParamName] < testResults.filterValue) ||
        (!testResults.filterAscending && res.data[testResults.filterParamName] > testResults.filterValue)
      ) {
        isFiltered = true
        res.data['comment'] = `Skipped for "${testResults.filterParamName}": ${backtest.convertValue(res.data[testResults.filterParamName])}.${res.data['comment'] ? ' ' + res.data['comment'] : ''}`
        res.message = res.data['comment']
        res.isFiltered = true
      }
    }
    if (isFiltered)
      testResults.filteredSummary.push(res.data)
    else
      testResults.perfomanceSummary.push(res.data)
    await storage.setKeys(storage.STRATEGY_KEY_RESULTS, testResults)

    res.currentValue = res.data[actualParamName]
    if (!isFiltered) {
      if (bestValue === null || typeof bestValue === 'undefined') {
        res.bestValue = res.data[actualParamName]
        res.bestPropVal = propVale
        console.log(`Best value (first): ${bestValue} => ${res.bestValue}`)
      } else if (!isFiltered && testResults.isMaximizing) {
        res.bestValue = bestValue < res.data[actualParamName] ? res.data[actualParamName] : bestValue
        res.bestPropVal = bestValue < res.data[actualParamName] ? propVale : bestPropVal
        if (bestValue < res.data[actualParamName]) {
          res.isBestChanged = true
          console.log(`Best value max: ${bestValue} => ${res.bestValue}`, res.bestPropVal)
        } else {
          res.isBestChanged = false
        }

      } else {
        res.bestValue = bestValue > res.data[actualParamName] ? res.data[actualParamName] : bestValue
        res.bestPropVal = bestValue > res.data[actualParamName] ? propVale : bestPropVal
        if (bestValue > res.data[actualParamName]) {
          res.isBestChanged = true
          console.log(`Best value min: ${bestValue} => ${res.bestValue}`)
        } else {
          res.isBestChanged = false
        }
      }
    } else {
      res.isFiltered = true
    }
  } else {
    res.bestValue = bestValue
    res.bestPropVal = bestPropVal
    res.currentValue = `${actualParamName} missed in data`
  }
  return res
}

function calculateAdditionValuesToReport(report) {
  // TODO
  return report
}


function randomNormalDistribution(min, max) {
  let u = 0, v = 0;
  while (u === 0) u = crypto.getRandomValues(new Uint16Array(1))[0] / 65536 //Math.random(); //Converting [0,1) to (0,1)
  while (v === 0) v = crypto.getRandomValues(new Uint16Array(1))[0] / 65536 //Math.random();
  let num = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  num = num / 10.0 + 0.5; // Translate to 0 -> 1
  if (num > 1 || num < 0)
    return randomNormalDistribution() // resample between 0 and 1
  else {
    num *= max - min // Stretch to fill range
    num += min // offset to min
  }
  return num
}

function randomInteger(min = 0, max = 10) {
  // min = Math.ceil(min);
  // max = Math.floor(max);
  return Math.floor((crypto.getRandomValues(new Uint16Array(1))[0] / 65536) * (max - min + 1)) + min;
  // return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Random optimization
async function optAllRandomIteration(allRangeParams, testResults, bestValue, bestPropVal, optimizationState) {
  const propData = optRandomGetPropertiesValues(allRangeParams, null, testResults.paramConditions)
  let propVal = propData.data
  const changedParam = propData.hasOwnProperty('changedParam') ? propData.changedParam : null
  if (bestPropVal)
    propVal = expandPropVal(propVal, bestPropVal)

  const res = await backtest.getTestIterationResult(testResults, propVal, false, false, changedParam)
  if (!res || !res.data || res.error !== null)
    return res
  res.data['comment'] = res.data['comment'] ? res.data['comment'] + propData.message : propData.message
  if (!res.message)
    res.message = propData.message
  else
    res.message += propData.message
  return await getResWithBestValue(res, testResults, bestValue, bestPropVal, propVal)
}


async function optRandomIteration(allRangeParams, testResults, bestValue, bestPropVal, optimizationState) {
  const propData = optRandomGetPropertiesValues(allRangeParams, bestPropVal)
  let propVal = propData.data

  if (bestPropVal)
    propVal = expandPropVal(propVal, bestPropVal)

  const res = await backtest.getTestIterationResult(testResults, propVal)
  if (!res || !res.data || res.error !== null)
    return res
  res.data['comment'] = res.data['comment'] ? res.data['comment'] + propData.message : propData.message
  if (!res.message)
    res.message = propData.message
  else
    res.message += propData.message
  return await getResWithBestValue(res, testResults, bestValue, bestPropVal, propVal)
}

function optRandomGetPropertiesValues(allRangeParams, curPropVal) {
  const propVal = {}
  let msg = ''
  const allParamNames = Object.keys(allRangeParams)
  if (curPropVal) {
    allParamNames.forEach(paramName => {
      propVal[paramName] = curPropVal[paramName]
    })
    const indexToChange = randomInteger(0, allParamNames.length - 1)
    const paramName = allParamNames[indexToChange]
    const curVal = propVal[paramName]
    const diffParams = allRangeParams[paramName].filter(paramVal => paramVal !== curVal)
    propVal[paramName] = diffParams.length === 0 ? curVal : diffParams.length === 1 ? diffParams[0] : diffParams[randomInteger(0, diffParams.length - 1)]
    msg = `Changed "${paramName}": ${curVal} => ${propVal[paramName]}.`
  } else {
    allParamNames.forEach(paramName => {
      propVal[paramName] = allRangeParams[paramName][randomInteger(0, allRangeParams[paramName].length - 1)]
    })
    msg = `All parameters are changed randomly`
  }
  return { message: msg, data: propVal }
}

function expandPropVal(propVal, basePropVal) {
  const newPropVal = {}
  Object.keys(basePropVal).forEach(key => {
    if (propVal.hasOwnProperty(key))
      newPropVal[key] = propVal[key]
    else
      newPropVal[key] = basePropVal[key]
  })
  return newPropVal
}


// Annealing optimization
async function optAnnealingIteration(allRangeParams, testResults, bestValue, bestPropVal, optimizationState) {
  const initTemp = 1// TODO to param? Find teh best match?
  const isMaximizing = testResults.hasOwnProperty('isMaximizing') ? testResults.isMaximizing : true
  if (!optimizationState.isInit) {
    optimizationState.currentTemp = initTemp

    if (!bestPropVal || bestValue === 'undefined') {
      let propVal = optAnnealingNewState(allRangeParams) // Random value
      if (bestPropVal)
        propVal = expandPropVal(propVal, bestPropVal)
      optimizationState.lastState = propVal
      const res = await backtest.getTestIterationResult(testResults, optimizationState.lastState)
      if (!res || !res.data)
        return res

      optimizationState.lastEnergy = res.data[testResults.optParamName]
      optimizationState.bestState = optimizationState.lastState;
      optimizationState.bestEnergy = optimizationState.lastEnergy;
    } else {
      optimizationState.lastState = bestPropVal
      optimizationState.bestState = bestPropVal;
      optimizationState.lastEnergy = bestValue
      optimizationState.bestEnergy = bestValue
    }

    optimizationState.isInit = true
  }
  const iteration = testResults.perfomanceSummary.length


  let propData = optAnnealingNewState(allRangeParams, optimizationState.currentTemp, optimizationState.lastState)
  let propVal = propData.data
  if (bestPropVal)
    propVal = expandPropVal(propVal, bestPropVal)
  const currentState = propVal
  let res = await backtest.getTestIterationResult(testResults, currentState)

  if (!res || !res.data || res.error !== null)
    return res
  res.data['comment'] = res.data['comment'] ? res.data['comment'] + propData.message : propData.message
  if (!res.message)
    res.message = propData.message
  else
    res.message += propData.message
  // return await getResWithBestValue(res, testResults, bestValue, bestPropVal, propVal)
  res = await getResWithBestValue(res, testResults, bestValue, bestPropVal, propVal)
  if (!res.data.hasOwnProperty(testResults.optParamName))
    return res
  const currentEnergy = res.data[testResults.optParamName]

  if (res.hasOwnProperty('isBestChanged') && res.isBestChanged) {
    optimizationState.lastState = currentState;
    optimizationState.lastEnergy = currentEnergy;
    res.message += ` The best value ${res.bestValue}.`
  } else {
    const randVal = crypto.getRandomValues(new Uint16Array(1))[0] / 65536 //Math.random()
    const expVal = Math.exp(-(currentEnergy - optimizationState.lastEnergy) / optimizationState.currentTemp) // Math.exp(-10) ~0,000045,  Math.exp(-1) 0.3678 Math.exp(0); => 1
    // console.log('#', optimizationState.currentTemp, randVal, expVal, currentEnergy, optimizationState.lastEnergy, currentEnergy - optimizationState.lastEnergy)
    if (randVal <= expVal) { // TODO need to optimize
      optimizationState.lastState = currentState;
      optimizationState.lastEnergy = currentEnergy;
      // res.message += ' Randomly changed state to current.'
    } else { // To revert to best condition
      optimizationState.lastState = res.bestPropVal;
      optimizationState.lastEnergy = res.bestValue;
      // res.message += ` Returned to best state with best value ${res.bestValue}`
    }
  }
  optimizationState.currentTemp = optAnnealingGetTemp(optimizationState.currentTemp, testResults.cycles);
  // optimizationState.currentTemp = optAnnealingGetBoltzmannTemp(initTemp, iteration, Object.keys(allRangeParams).length);
  // optimizationState.currentTemp = optAnnealingGetExpTemp(initTemp, iteration, Object.keys(allRangeParams).length);
  return res
}

function optAnnealingGetTemp(prevTemperature, cylces) {
  return prevTemperature * (1 - 1 / cylces);
}

function optAnnealingGetBoltzmannTemp(initTemperature, iter, cylces, dimensionSize) {
  return iter === 1 ? 1 : initTemperature / Math.log(1 + iter / (dimensionSize * 2));
}

function optAnnealingGetExpTemp(initTemperature, iter, dimensionSize) {
  return initTemperature / Math.pow(iter, 1 / dimensionSize);
}

function optAnnealingNewState(allRangeParams, temperature, curState) {
  const propVal = {} // TODO prepare as
  let msg = ''
  const allParamNames = Object.keys(allRangeParams)
  const isAll = (randomInteger(0, 10) * temperature) >= 5
  if (!isAll && curState) {
    allParamNames.forEach(paramName => {
      propVal[paramName] = curState[paramName]
    })
    const indexToChange = randomInteger(0, allParamNames.length - 1)
    const paramName = allParamNames[indexToChange]
    const curVal = propVal[paramName]
    const diffParams = allRangeParams[paramName].filter(paramVal => paramVal !== curVal)

    if (diffParams.length === 0) {
      propVal[paramName] = curVal
    } else if (diffParams.length === 1) {
      propVal[paramName] = diffParams[0]
    } else {
      propVal[paramName] = diffParams[randomInteger(0, diffParams.length - 1)]

      // Is not proportional chances for edges of array
      // const offset = sign * Math.floor(temperature * randomNormalDistribution(0, (allRangeParams[paramName].length - 1)))
      // const newIndex = curIndex + offset > allRangeParams[paramName].length - 1 ? allRangeParams[paramName].length - 1 : // TODO +/-
      //   curIndex + offset < 0 ? 0 : curIndex + offset
      // propVal[paramName] = allRangeParams[paramName][newIndex]
      // Second variant
      const curIndex = allRangeParams[paramName].indexOf(curState[paramName])
      const sign = randomInteger(0, 1) === 0 ? -1 : 1
      const baseOffset = Math.floor(temperature * randomNormalDistribution(0, (allRangeParams[paramName].length - 1)))
      const offsetIndex = (curIndex + sign * baseOffset) % (allRangeParams[paramName].length)
      const newIndex2 = offsetIndex >= 0 ? offsetIndex : allRangeParams[paramName].length + offsetIndex
      propVal[paramName] = allRangeParams[paramName][newIndex2]
    }
    msg = `Changed "${paramName}": ${curVal} => ${propVal[paramName]}.`
  } else if (isAll && curState) {
    allParamNames.forEach(paramName => {
      const curIndex = allRangeParams[paramName].indexOf(curState[paramName])
      const sign = randomInteger(0, 1) === 0 ? -1 : 1
      const baseOffset = Math.floor(temperature * randomNormalDistribution(0, (allRangeParams[paramName].length - 1)))
      const offsetIndex = (curIndex + sign * baseOffset) % (allRangeParams[paramName].length)
      const newIndex2 = offsetIndex >= 0 ? offsetIndex : allRangeParams[paramName].length + offsetIndex
      propVal[paramName] = allRangeParams[paramName][newIndex2]
    })
    msg = `Changed all parameters randomly.`
  } else {
    allParamNames.forEach(paramName => {
      propVal[paramName] = allRangeParams[paramName][randomInteger(0, allRangeParams[paramName].length - 1)]
    })
    msg = `Changed all parameters randomly without temperature.`
  }
  return { message: msg, data: propVal }
}

async function optAnnealingGetEnergy(testResults, propVal) { // TODO 2del test function annealing
  const allDimensionVal = Object.keys(propVal).map(name => Math.abs(propVal[name] * propVal[name] - 16))
  testResults.perfomanceSummary.push(allDimensionVal)
  const resData = {}
  resData[testResults.optParamName] = allDimensionVal.reduce((sum, item) => item + sum, 0)
  return { error: 0, data: resData };
}


// rute Force
async function optBruteForce(allRangeParams, testResults, bestValue, bestPropVal, optimizationState) {
  const propVal = {}
  let paramName = ''
  let msg = ''
  if (!optimizationState.hasOwnProperty('valuesIdx')) {
    // optimizationState['valuesIdx'] = new Array(testResults.paramPriority.length)
    optimizationState['valuesIdx'] = []
    for (let i = 0; i < testResults.paramPriority.length; i++) {
      optimizationState['valuesIdx'].push(0)
      paramName = testResults.paramPriority[i]
      propVal[paramName] = allRangeParams[paramName][0]
    }
    // optimizationState['valuesIdx'].forEach((val, idx) => optimizationState['valuesIdx'][idx] = 0)
    for (let i = 0; i < testResults.paramPriority.length; i++) {
      paramName = testResults.paramPriority[i]
      propVal[paramName] = allRangeParams[paramName][0]
    }
    msg = 'All parameters set to init values'
  } else {
    for (let i = 0; i < testResults.paramPriority.length; i++) {
      paramName = testResults.paramPriority[i]
      let valIdx = optimizationState['valuesIdx'][i]
      propVal[paramName] = allRangeParams[paramName][valIdx]
    }
    for (let i = 0; i < testResults.paramPriority.length; i++) {
      paramName = testResults.paramPriority[i]
      let valIdx = optimizationState['valuesIdx'][i]

      if (valIdx + 1 < allRangeParams[paramName].length) {
        valIdx += 1
        optimizationState['valuesIdx'][i] = valIdx
        propVal[paramName] = allRangeParams[paramName][valIdx]
        break
      } else if (i + 1 === testResults.paramPriority.length) {
        return null // End all variants
      } else {
        valIdx = 0
        optimizationState['valuesIdx'][i] = valIdx // Next parameter
        propVal[paramName] = allRangeParams[paramName][valIdx]
      }
    }
    msg = `"${paramName}" set to ${propVal[paramName]}.`
  }
  const res = await backtest.getTestIterationResult(testResults, propVal)
  if (!res || !res.data || res.error !== null)
    return res
  res.data['comment'] = res.data['comment'] ? res.data['comment'] + msg : msg
  if (!res.message)
    res.message = msg
  else
    res.message += msg
  return await getResWithBestValue(res, testResults, bestValue, bestPropVal, propVal)
}


async function optSequentialIteration(allRangeParams, testResults, bestValue, bestPropVal, optimizationState) {
  if (!optimizationState.hasOwnProperty('paramIdx')) {
    optimizationState.paramIdx = 0
  }
  let paramName = testResults.paramPriority[optimizationState.paramIdx]
  if (!optimizationState.hasOwnProperty('valIdx')) {
    optimizationState.valIdx = 0
  } else {
    optimizationState.valIdx += 1
    if (optimizationState.valIdx >= allRangeParams[paramName].length) {
      optimizationState.valIdx = 0
      optimizationState.paramIdx += 1
      if (optimizationState.paramIdx >= testResults.paramPriority.length) {
        return null // End
      } else {
        paramName = testResults.paramPriority[optimizationState.paramIdx]
      }
    }
  }
  const valIdx = optimizationState.valIdx


  const propVal = {}
  Object.keys(bestPropVal).forEach(paramName => {
    propVal[paramName] = bestPropVal[paramName]
  })
  propVal[paramName] = allRangeParams[paramName][valIdx]
  if (bestPropVal[paramName] === propVal[paramName])
    return {
      error: null,
      currentValue: bestValue,
      message: `The same value of the "${paramName}" parameter equal to ${propVal[paramName]} is skipped`
    }
  const msg = `Changed "${paramName}": ${bestPropVal[paramName]} => ${propVal[paramName]}.`

  const res = await backtest.getTestIterationResult(testResults, propVal)
  if (!res || !res.data || res.error !== null)
    return res
  res.data['comment'] = res.data['comment'] ? res.data['comment'] + msg : msg
  if (!res.message)
    res.message = msg
  else
    res.message += msg
  return await getResWithBestValue(res, testResults, bestValue, bestPropVal, propVal)
}

// Add debugging function to log available parameter names
backtest.logAvailableParameters = (reportData, context = '') => {
  console.log(`=== Available Parameters ${context} ===`)
  const paramNames = Object.keys(reportData).filter(key => !key.startsWith('_') && key !== 'comment')
  paramNames.forEach(name => {
    console.log(`  "${name}": ${reportData[name]}`)
  })
  console.log(`=== End Parameters ${context} ===`)
  
  // Look for potential "Net profit" variations
  const netProfitParams = paramNames.filter(name => 
    name.toLowerCase().includes('net profit') || 
    name.toLowerCase().includes('net p&l') ||
    name.toLowerCase().includes('netprofit')
  )
  if (netProfitParams.length > 0) {
    console.log(`🔍 Found Net Profit variations: ${netProfitParams.join(', ')}`)
  }
  
  return paramNames
}

// Function to find the best matching parameter name for Net Profit
backtest.findBestNetProfitParam = (reportData) => {
  const paramNames = Object.keys(reportData).filter(key => !key.startsWith('_') && key !== 'comment')
  
  // Priority order for matching Net Profit parameters
  const netProfitPatterns = [
    'Net profit: All',      // Current expected
    'Net Profit: All',      // Old version
    'Net profit',           // Simple version
    'Net Profit',           // Old simple version
    'Net P&L: All',         // Alternative naming
    'Net P&L',              // Alternative simple
    'netProfit: All',       // Camel case
    'netProfit'             // Camel case simple
  ]
  
  // First try exact matches
  for (const pattern of netProfitPatterns) {
    if (paramNames.includes(pattern)) {
      console.log(`✅ Found exact match for Net Profit: "${pattern}"`)
      return pattern
    }
  }
  
  // Then try partial matches
  for (const pattern of ['net profit', 'net p&l', 'netprofit']) {
    const matches = paramNames.filter(name => 
      name.toLowerCase().includes(pattern.toLowerCase())
    )
    if (matches.length > 0) {
      console.log(`✅ Found partial match for Net Profit: "${matches[0]}"`)
      return matches[0]
    }
  }
  
  // If no net profit found, look for other profit-related parameters
  const profitParams = paramNames.filter(name => 
    name.toLowerCase().includes('profit') || 
    name.toLowerCase().includes('p&l') ||
    name.toLowerCase().includes('return')
  )
  
  if (profitParams.length > 0) {
    console.log(`⚠️ No Net Profit found, suggesting: "${profitParams[0]}"`)
    return profitParams[0]
  }
  
  console.error('❌ No suitable profit parameter found!')
  return null
}

// Function to manually set the correct parameter name (for debugging)
backtest.setOptParamName = (testResults, newParamName) => {
  console.log(`🔧 Manually setting parameter name from "${testResults.optParamName}" to "${newParamName}"`)
  testResults.optParamName = newParamName
  return testResults
}
