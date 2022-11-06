const action = {
  workerStatus: null
}

action.saveParameters = async () => {
  const strategyData = await tv.getStrategy(null, true)
  if(!strategyData || !strategyData.hasOwnProperty('name') || !strategyData.hasOwnProperty('properties') || !strategyData.properties) {
    await ui.showWarningPopup('Please open the indicator (strategy) parameters window before saving them to a file.')
    return
  }
  let strategyParamsCSV = `Name,Value\n"__indicatorName",${JSON.stringify(strategyData.name)}\n`
  Object.keys(strategyData.properties).forEach(key => {
    strategyParamsCSV += `${JSON.stringify(key)},${typeof strategyData.properties[key][0] === 'string' ? JSON.stringify(strategyData.properties[key]) : strategyData.properties[key]}\n`
  })
  file.saveAs(strategyParamsCSV, `${strategyData.name}.csv`)
}

action.loadParameters = async () => {
  await file.upload(file.uploadHandler, '', false)
}

action.uploadSignals = async () => {
  await file.upload(signal.parseTSSignalsAndGetMsg, `Please check if the ticker and timeframe are set like in the downloaded data and click on the parameters of the "iondvSignals" script to automatically enter new data on the chart.`, true)
}

action.uploadStrategyTestParameters = async () => {
  await file.upload(model.parseStrategyParamsAndGetMsg, '', false)
}

action.getStrategyTemplate = async () => {
  const strategyData = await tv.getStrategy()
  if(!strategyData || !strategyData.hasOwnProperty('name') || !strategyData.hasOwnProperty('properties') || !strategyData.properties) {
    await ui.showErrorPopup('It was not possible to find a strategy with parameters among the indicators. Add it to the chart and try again.')
  } else {
    const paramRange = model.getStrategyRange(strategyData)
    console.log(paramRange)
    // await storage.setKeys(storage.STRATEGY_KEY_PARAM, paramRange)
    const strategyRangeParamsCSV = model.convertStrategyRangeToTemplate(paramRange)
    await ui.showPopup('The range of parameters is saved for the current strategy.\n\nYou can start optimizing the strategy parameters by clicking on the "Test strategy" button')
    file.saveAs(strategyRangeParamsCSV, `${strategyData.name}.csv`)
  }
}

action.clearAll = async () => {
  const clearRes = await storage.clearAll()
  await ui.showPopup(clearRes && clearRes.length ? `The data was deleted: \n${clearRes.map(item => '- ' + item).join('\n')}` : 'There was no data in the storage')
}

action.downloadStrategyTestResults = async () => {
  const testResults = await storage.getKey(storage.STRATEGY_KEY_RESULTS)
  if(!testResults || (!testResults.perfomanceSummary && !testResults.perfomanceSummary.length)) {
    await ui.showWarningPopup('There is no data for conversion. Try to do test again')
    return
  }
  testResults.optParamName = testResults.optParamName || backtest.DEF_MAX_PARAM_NAME
  console.log('testResults', testResults)
  const CSVResults = file.convertResultsToCSV(testResults)
  const bestResult = testResults.perfomanceSummary ? model.getBestResult(testResults) : {}
  const propVal = {}
  testResults.paramsNames.forEach(paramName => {
    if(bestResult.hasOwnProperty(`__${paramName}`))
      propVal[paramName] = bestResult[`__${paramName}`]
  })
  await tv.setStrategyParams(testResults.shortName, propVal)
  if(bestResult && bestResult.hasOwnProperty(testResults.optParamName))
    await ui.showPopup(`The best found parameters are set for the strategy\n\nThe best ${testResults.isMaximizing ? '(max) ':'(min)'} ${testResults.optParamName}: ` + bestResult[testResults.optParamName])
  file.saveAs(CSVResults, `${testResults.ticker}:${testResults.timeFrame} ${testResults.shortName} - ${testResults.cycles}_${testResults.isMaximizing ? 'max':'min'}_${testResults.optParamName}_${testResults.method}.csv`)
}

action.deepTestStrategy = async (request) => {
  console.log('request', request)
  try {
    const strategyData = await action._getStrategyData()
    const [allRangeParams, paramRange, cycles] = await action._getRangeParams(strategyData)
    const testParams = await action._getTestParams(request, strategyData, allRangeParams, paramRange, cycles)
    action._showStartMsg( testParams.paramSpace, testParams.cycles)
    const testResults = await backtest.testStrategy(testParams, strategyData, allRangeParams)
    await action._saveTestResults(testResults, testParams)
  } catch (err) {
    await ui.showErrorPopup(`{err}`)
  }
  ui.statusMessageRemove()
}


action.testStrategy = async (request) => {
  console.log('request', request)
  try {
    const strategyData = await action._getStrategyData()
    const [allRangeParams, paramRange, cycles] = await action._getRangeParams(strategyData)
    const testParams = await action._getTestParams(request, strategyData, allRangeParams, paramRange, cycles)
    action._showStartMsg( testParams.paramSpace, testParams.cycles)
    const testResults = await backtest.testStrategy(testParams, strategyData, allRangeParams)
    await action._saveTestResults(testResults, testParams)
  } catch (err) {
    await ui.showErrorPopup(`{err}`)
  }
  ui.statusMessageRemove()
}

action._getRangeParams = async (strategyData) => {
  let paramRange = await model.getStrategyParameters(strategyData)
  console.log('paramRange', paramRange)
  if(!paramRange)
    return

  const initParams = {}
  initParams.paramRange = paramRange
  initParams.paramRangeSrc = model.getStrategyRange(strategyData)
  const changedStrategyParams = await ui.showAndUpdateStrategyParameters(initParams)
  if(changedStrategyParams === null) {
    throw new Error('Error get changed strategy parameters')
  }
  const cycles = changedStrategyParams.cycles ? changedStrategyParams.cycles : 100
  console.log('changedStrategyParams', changedStrategyParams)
  if (changedStrategyParams.paramRange === null) {
    console.log('Don not change paramRange')
  } else if (typeof changedStrategyParams.paramRange === 'object' && Object.keys(changedStrategyParams.paramRange).length) {
    paramRange = changedStrategyParams.paramRange
    await model.saveStrategyParameters(paramRange)
    console.log('ParamRange changes to', paramRange)
  } else {
    throw new Error ('The strategy parameters invalid. Change them or run default parameters set.')
  }

  const allRangeParams = model.createParamsFromRange(paramRange)
  console.log('allRangeParams', allRangeParams)
  if(!allRangeParams) {
    throw new Error ('Empty range parameters for strategy')
  }
  return [allRangeParams, paramRange, cycles]
}

action._getStrategyData = async () => {
  ui.statusMessage('Get the initial parameters.')
  const strategyData = await tv.getStrategy()
  if(!strategyData || !strategyData.hasOwnProperty('name') || !strategyData.hasOwnProperty('properties') || !strategyData.properties) {
    throw new Error('Could not find any strategy with parameters among the indicators. Add it to the chart and try again.')
  }
  return strategyData
}

action._getTestParams = async (request, strategyData, allRangeParams, paramRange, cycles) => {
  const testMethod = request.options && request.options.hasOwnProperty('optMethod') ? request.options.optMethod.toLowerCase() : 'random'
  let paramSpaceNumber = 0
  let isSequential = false
  if(['sequential'].includes(testMethod)) {
    paramSpaceNumber = Object.keys(allRangeParams).reduce((sum, param) => sum += allRangeParams[param].length, 0)
    isSequential = true
  } else {
    paramSpaceNumber = Object.keys(allRangeParams).reduce((mult, param) => mult *= allRangeParams[param].length, 1)
  }
  console.log('paramSpaceNumber', paramSpaceNumber)

  let testParams = await tv.switchToStrategyTab()
  if(!testParams)
    return
  testParams.paramSpace = paramSpaceNumber
  let paramPriority = model.getParamPriorityList(paramRange) // Filter by allRangeParams
  paramPriority = paramPriority.filter(key => allRangeParams.hasOwnProperty(key))
  console.log('paramPriority list', paramPriority)
  testParams.paramPriority = paramPriority

  testParams.startParams = await model.getStartParamValues(paramRange, strategyData)
  console.log('testParams.startParams', testParams.startParams)
  if(!testParams.hasOwnProperty('startParams') || !testParams.startParams.hasOwnProperty('current') || !testParams.startParams.current) {
    await ui.showErrorPopup('Error.\n\n The current strategy parameters could not be determined.\n Testing aborted')
    return
  }

  // if(isSequential) {
  //   await ui.showPopup(`For ${testMethod} testing, the number of ${paramSpaceNumber} cycles is automatically determined, which is equal to the size of the parameter space.\n\nYou can interrupt the search for strategy parameters by just reloading the page and at the same time, you will not lose calculations. All data are stored in the storage after each iteration.\nYou can download last test results by clicking on the "Download results" button until you launch new strategy testing.`, 100)
  //   testParams.cycles = paramSpaceNumber
  // } else {
  //   const cyclesStr = prompt(`Please enter the number of cycles for optimization for parameters space ${paramSpaceNumber}.\n\nYou can interrupt the search for strategy parameters by just reloading the page and at the same time, you will not lose calculations. All data are stored in the storage after each iteration.\nYou can download last test results by clicking on the "Download results" button until you launch new strategy testing.`, 100)
  //   if(!cyclesStr)
  //     return
  //   let cycles = parseInt(cyclesStr)
  //   if(!cycles || cycles < 1)
  //     return
  //   testParams.cycles = cycles
  // }
  testParams.cycles = cycles


  if(request.options) {
    testParams.isMaximizing = request.options.hasOwnProperty('isMaximizing') ? request.options.isMaximizing : true
    testParams.optParamName =  request.options.optParamName ? request.options.optParamName : backtest.DEF_MAX_PARAM_NAME
    testParams.method = testMethod
    testParams.filterAscending = request.options.hasOwnProperty('optFilterAscending') ? request.options.optFilterAscending : null
    testParams.filterValue = request.options.hasOwnProperty('optFilterValue') ? request.options.optFilterValue : 50
    testParams.filterParamName = request.options.hasOwnProperty('optFilterParamName') ? request.options.optFilterParamName : 'Total Closed Trades: All'
  }
  return testParams
}

action._showStartMsg = (paramSpaceNumber, cycles) => {
  let extraHeader = `The search is performed among ${paramSpaceNumber} possible combinations of parameters (space).`
  extraHeader += (paramSpaceNumber/cycles) > 10 ? `<br />This is too large for ${testParams.cycles} cycles. It is recommended to use up to 3-4 essential parameters, remove the rest from the strategy parameters file.` : ''
  ui.statusMessage('Started.', extraHeader)
}

action._saveTestResults = async (testResults, testParams) => {
  console.log('testResults', testResults)
  if(!testResults.perfomanceSummary && !testResults.perfomanceSummary.length) {
    await ui.showWarningPopup('There is no data for conversion. Try to do test again')
    return
  }

  const CSVResults = file.convertResultsToCSV(testResults)
  const bestResult = testResults.perfomanceSummary ? model.getBestResult(testResults) : {}
  const initBestValue = testResults.hasOwnProperty('initBestValue') ? testResults.initBestValue : null
  const propVal = {}
  testResults.paramsNames.forEach(paramName => {
    if(bestResult.hasOwnProperty(`__${paramName}`))
      propVal[paramName] = bestResult[`__${paramName}`]
  })
  await tv.setStrategyParams(testResults.shortName, propVal)
  let text = `All done.\n\n`
  text += bestResult && bestResult.hasOwnProperty(testParams.optParamName) ? 'The best '+ (testResults.isMaximizing ? '(max) ':'(min) ') + testParams.optParamName + ': ' + backtest.convertValue(bestResult[testParams.optParamName]) : ''
  text += (initBestValue !== null && bestResult && bestResult.hasOwnProperty(testParams.optParamName) && initBestValue === bestResult[testParams.optParamName]) ? `\nIt isn't improved from the initial value: ${backtest.convertValue(initBestValue)}` : ''
  ui.statusMessage(text)
  await ui.showPopup(text)
  console.log(`All done.\n\n${bestResult && bestResult.hasOwnProperty(testParams.optParamName) ? 'The best ' + (testResults.isMaximizing ? '(max) ':'(min) ')  + testParams.optParamName + ': ' + bestResult[testParams.optParamName] : ''}`)
  file.saveAs(CSVResults, `${testResults.ticker}:${testResults.timeFrame} ${testResults.shortName} - ${testResults.cycles}_${testResults.isMaximizing ? 'max':'min'}_${testResults.optParamName}_${testResults.method}.csv`)
}


action.show3DChart= async () => {
  const testResults = await storage.getKey(storage.STRATEGY_KEY_RESULTS)
  if(!testResults || (!testResults.perfomanceSummary && !testResults.perfomanceSummary.length)) {
    await ui.showPopup('There is no results data for to show. Try to backtest again')
    return
  }
  testResults.optParamName = testResults.optParamName || backtest.DEF_MAX_PARAM_NAME
  const eventData = await send3dChartMessage(testResults)
  if (eventData.hasOwnProperty('message'))
    await ui.showPopup(eventData.message)
}

async function send3dChartMessage (testResults) {
  return new Promise(resolve => {
    const url =  window.location && window.location.origin ? window.location.origin : 'https://www.tradingview.com'
    tvPageMessageData['show3DChart'] = resolve
    window.postMessage({name: 'iondvScript', action: 'show3DChart', data: testResults}, url) // TODO wait for data
  })
}