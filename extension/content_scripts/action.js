const action = {
  workerStatus: null
}

const message = {
  noBacktestResults: 'There are no backtest results yet. Run a test first.',
  noStrategyInputs: 'The strategy on the chart has no inputs that can be saved or optimized. Add a strategy with inputs to the chart, or choose another one.'
}

action.saveParameters = async () => {
  const strategyData = await tv.getStrategy(null, true)
  if (!strategyData || !strategyData.hasOwnProperty('name') || !strategyData.hasOwnProperty('properties') || !strategyData.properties) {
    await ui.showErrorPopup(message.noStrategyInputs)
    // await ui.showWarningPopup('Please open the indicator (strategy) parameters window before saving them to a file.')
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
  if (!strategyData || !strategyData.hasOwnProperty('name') || !strategyData.hasOwnProperty('properties') || !strategyData.properties) {
    await ui.showErrorPopup(message.noStrategyInputs)
  } else {
    const paramRange = model.getStrategyRange(strategyData)
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

action.previewStrategyTestResults = async () => {
  const testResults = await storage.getKey(storage.STRATEGY_KEY_RESULTS)
  if (!hasBacktestResults(testResults)) {
    await ui.showWarningPopup(message.noBacktestResults)
    return
  }
  const eventData = await sendActionMessage(testResults, 'previewStrategyTestResults')
  if (eventData.hasOwnProperty('message'))
    await ui.showPopup(eventData.message)

  // await ui.showPreviewResults(previewResults) // WHY NOT WORKING ?
}

action.downloadStrategyTestResults = async () => {
  const testResults = await storage.getKey(storage.STRATEGY_KEY_RESULTS)
  if (!hasBacktestResults(testResults)) {
    await ui.showWarningPopup(message.noBacktestResults)
    return
  }
  testResults.optParamName = testResults.optParamName || backtest.DEF_MAX_PARAM_NAME
  const CSVResults = file.convertResultsToCSV(testResults)
  const bestResult = testResults.perfomanceSummary ? model.getBestResult(testResults) : {}
  const propVal = {}
  testResults.paramsNames.forEach(paramName => {
    if (bestResult.hasOwnProperty(`__${paramName}`))
      propVal[paramName] = bestResult[`__${paramName}`]
  })
  await tv.setStrategyParams(testResults.shortName, propVal)
  if (bestResult && bestResult.hasOwnProperty(testResults.optParamName))
    await ui.showPopup(`The best found parameters are set for the strategy\n\nThe best ${testResults.isMaximizing ? '(max) ' : '(min)'} ${testResults.optParamName}: ` + bestResult[testResults.optParamName])
  file.saveAs(CSVResults, `${testResults.ticker}:${testResults.timeFrame} ${testResults.shortName} - ${testResults.cycles}_${testResults.isMaximizing ? 'max' : 'min'}_${testResults.optParamName}_${testResults.method}.csv`)
}




action.testStrategy = async (request, isDeepTest = false) => {
  const actionName = isDeepTest ? 'deepTestStrategy' : 'testStrategy'
  try {
    const strategyData = await action._getStrategyData(isDeepTest)
    isDeepTest = await tvChart.detectDeepTest()
    const [allRangeParams, paramRange, cycles] = await action._getRangeParams(strategyData)
    if (allRangeParams !== null) { // click cancel on parameters
      const testParams = await action._getTestParams(request, strategyData, allRangeParams, paramRange, cycles, isDeepTest)
      action._showStartMsg(testParams.paramSpace, testParams.cycles, testParams.backtestDelay ? ` with delay between tests ${testParams.backtestDelay} sec` : '')
      testParams.isDeepTest = isDeepTest
      action._logRunStart(testParams, strategyData)
      let testResults = {}
      if (testParams.shouldTestTF) {
        if (!testParams.listOfTF || testParams.listOfTF.length === 0) {
          await ui.showWarningPopup(`Timeframe testing is enabled in the options, but the timeframe list has no valid values: "${testParams.listOfTFSource || ''}".\nSet timeframes separated by commas, for example: 1m,4h`)
        } else {
          let bestValue = null
          let bestTf = null
          testParams.shouldSkipInitBestResult = true
          for (const tf of testParams.listOfTF) {
            log.info('Test timeframe:', tf)
            await tvChart.changeTimeFrame(tf)
            testParams.timeFrame = tf
            if (testParams.hasOwnProperty('bestPropVal'))
              delete testParams.bestPropVal
            if (testParams.hasOwnProperty('bestValue'))
              delete testParams.bestValue
            testResults = await backtest.testStrategy(testParams, strategyData, allRangeParams) // TODO think about not save, but store them from  testResults.perfomanceSummary, testResults.filteredSummary = [], testResults.timeFrame to list
            await action._saveTestResults(testResults, testParams, false)
            if (bestTf === null) {
              bestValue = testResults.bestValue
              bestTf = tf
            } else if (testResults.isMaximizing ? testParams.bestValue > bestValue : testParams.bestValue < bestValue) {
              bestValue = testResults.bestValue
              bestTf = tf
            }
            if (action.workerStatus === null) {
              log.info('Stop command detected')
              break
            }
          }
          if (bestValue !== null) {
            await ui.showPopup(`The best value ${bestValue} for timeframe ${bestTf}. Check the saved files to get the best result parameters`)
          } else {
            await ui.showWarningPopup(`Did not found any result value after testing`)
          }
        }
      } else {
        testResults = await backtest.testStrategy(testParams, strategyData, allRangeParams)
        await action._saveTestResults(testResults, testParams, true)
      }
    }
  } catch (err) {
    await ui.showErrorByKind(err, actionName)
  }
  ui.statusMessageRemove()
}

action._getRangeParams = async (strategyData) => {
  let paramRange = await model.getStrategyParameters(strategyData)
  if (paramRange === null)
    // throw new Error('Error get changed strategy parameters')
    return [null, null, null]

  const initParams = {}
  initParams.paramRange = paramRange
  initParams.paramRangeSrc = model.getStrategyRange(strategyData)
  const changedStrategyParams = await ui.showAndUpdateStrategyParameters(initParams)
  if (changedStrategyParams === null) {
    return [null, null, null]
  }
  const cycles = changedStrategyParams.cycles ? changedStrategyParams.cycles : 100
  log.debug('changedStrategyParams', changedStrategyParams)
  // null paramRange means the user kept the ranges unchanged
  if (changedStrategyParams.paramRange === null) {
  } else if (typeof changedStrategyParams.paramRange === 'object' && Object.keys(changedStrategyParams.paramRange).length) {
    paramRange = changedStrategyParams.paramRange
    await model.saveStrategyParameters(paramRange)
    log.info('Parameter ranges changed:', Object.keys(paramRange).length, 'parameters')
  } else {
    throw new UserActionError('The strategy parameter ranges are invalid. Change them or run with the default parameters.')
  }

  const allRangeParams = model.createParamsFromRange(paramRange)
  // createParamsFromRange skips single-value and invalid ranges, so an empty result means nothing to optimize
  if (!Object.keys(allRangeParams).length) {
    throw new UserActionError('No parameter has a range to test: every parameter has a single value or an invalid range.\n' +
      'Set "from", "to" and "step" for at least one parameter (Upload/Download parameters) or run with defaults.')
  }
  return [allRangeParams, paramRange, cycles]
}

action._getStrategyData = async (isDeepTest) => {
  ui.statusMessage('Get the initial parameters.')
  const strategyData = await tv.getStrategy('', false, isDeepTest)
  if (!strategyData || !strategyData.hasOwnProperty('name') || !strategyData.hasOwnProperty('properties') || !strategyData.properties) {
    throw new UserActionError(message.noStrategyInputs)
  }
  return strategyData
}


action._parseTF = (listOfTF) => {
  if (!listOfTF || typeof (listOfTF) !== 'string')
    return []
  return listOfTF.split(',').map(tf => tf.trim()).filter(tf => /(^\d{1,2}m$)|(^\d{1,2}h$)|(^\d{1,2}D$)|(^\d{1,2}W$)|(^\d{1,2}M$)/.test(tf))

}

action._getTestParams = async (request, strategyData, allRangeParams, paramRange, cycles, isDeepTest=false) => {
  let testParams = await tv.switchToStrategyTabAndSetObserveForReport(isDeepTest)
  const options = request && request.hasOwnProperty('options') ? request.options : {}
  const testMethod = options.hasOwnProperty('optMethod') && typeof (options.optMethod) === 'string' ? options.optMethod.toLowerCase() : 'random'
  let paramSpaceNumber = 0
  let isSequential = false
  if (['sequential'].includes(testMethod)) {
    paramSpaceNumber = Object.keys(allRangeParams).reduce((accumulator, param) => accumulator + allRangeParams[param].length, 0)
    isSequential = true
  } else {
    paramSpaceNumber = Object.keys(allRangeParams).reduce((accumulator, param) => accumulator * (allRangeParams[param].length || 1), 1)
  }

  testParams.shouldTestTF = options.hasOwnProperty('shouldTestTF') ? options.shouldTestTF : false
  testParams.listOfTF = action._parseTF(options.listOfTF)
  testParams.listOfTFSource = options.listOfTF
  testParams.shouldSkipInitBestResult = false // TODO get from options

  testParams.paramSpace = paramSpaceNumber
  let paramPriority = model.getParamPriorityList(paramRange) // Filter by allRangeParams
  paramPriority = paramPriority.filter(key => allRangeParams.hasOwnProperty(key))
  testParams.paramPriority = paramPriority

  testParams.startParams = await model.getStartParamValues(paramRange, strategyData)
  log.debug('Start parameters:', testParams.startParams)
  if (!testParams.hasOwnProperty('startParams') || !testParams.startParams.hasOwnProperty('current') || !testParams.startParams.current) {
    throw new Error('The current strategy parameters could not be determined. Testing aborted.')
  }

  testParams.cycles = cycles

  if (request.options) {
    testParams.isMaximizing = request.options.hasOwnProperty('isMaximizing') ? request.options.isMaximizing : true
    testParams.optParamName = request.options.optParamName ? request.options.optParamName : backtest.DEF_MAX_PARAM_NAME
    testParams.method = testMethod
    testParams.filterAscending = request.options.hasOwnProperty('optFilterAscending') ? request.options.optFilterAscending : null
    testParams.filterValue = request.options.hasOwnProperty('optFilterValue') ? request.options.optFilterValue : 50
    testParams.filterParamName = request.options.hasOwnProperty('optFilterParamName') ? request.options.optFilterParamName : 'Total trades: All'
    testParams.deepStartDate = !request.options.hasOwnProperty('deepStartDate') || request.options['deepStartDate'] === '' ? null : request.options['deepStartDate']
    testParams.backtestDelay = !request.options.hasOwnProperty('backtestDelay') || !request.options['backtestDelay'] ? 0 : request.options['backtestDelay']
    testParams.randomDelay = request.options.hasOwnProperty('randomDelay') ? Boolean(request.options['randomDelay']) : true
    testParams.shouldSkipInitBestResult = request.options.hasOwnProperty('shouldSkipInitBestResult') ? Boolean(request.options['shouldSkipInitBestResult']) : false
    testParams.shouldSkipWaitingForDownload = request.options.hasOwnProperty('shouldSkipWaitingForDownload') ? Boolean(request.options['shouldSkipWaitingForDownload']) : false
    testParams.parseExtraReportTabs = request.options.hasOwnProperty('parseExtraReportTabs') ? Boolean(request.options['parseExtraReportTabs']) : false
    testParams.setParamsByApi = request.options.hasOwnProperty('setParamsByApi') ? Boolean(request.options['setParamsByApi']) : false
    testParams.dataLoadingTime = request.options.hasOwnProperty('dataLoadingTime') && !isNaN(parseInt(request.options['dataLoadingTime'])) ? request.options['dataLoadingTime'] : 30
    const maxMissingOptParamStreak = Number.parseInt(request.options['maxMissingOptParamStreak'])
    testParams.maxMissingOptParamStreak = request.options.hasOwnProperty('maxMissingOptParamStreak') && !Number.isNaN(maxMissingOptParamStreak)
      ? Math.max(1, maxMissingOptParamStreak)
      : backtest.DEF_MAX_MISSING_OPT_PARAM_STREAK
  }

  return testParams
}


// One summary line per run, so a user's console log shows what was tested without the verbose detail
action._logRunStart = (testParams, strategyData) => {
  log.info('Test run started:', {
    version: chrome.runtime.getManifest().version,
    strategy: strategyData.name,
    method: testParams.method,
    optimization: `${testParams.isMaximizing ? 'max' : 'min'} ${testParams.optParamName}`,
    combinations: testParams.paramSpace,
    cycles: testParams.cycles,
    ticker: testParams.ticker,
    timeFrame: testParams.timeFrame,
    isDeepTest: testParams.isDeepTest
  })
}

action._showStartMsg = (paramSpaceNumber, cycles, addInfo) => {
  let extraHeader = `The search is performed among ${paramSpaceNumber} possible combinations of parameters (space).`
  extraHeader += (paramSpaceNumber / cycles) > 10 ? `<br />This is too large for ${cycles} cycles. It is recommended to use up to 3-4 essential parameters, remove the rest from the strategy parameters file.` : ''
  ui.statusMessage(`Started${addInfo}.`, extraHeader)
}

action._saveTestResults = async (testResults, testParams, isFinalTest = true) => {
  if (!hasBacktestResults(testResults)) {
    await ui.showWarningPopup(message.noBacktestResults)
    return
  }

  const CSVResults = file.convertResultsToCSV(testResults)
  const bestResult = testResults.perfomanceSummary ? model.getBestResult(testResults) : {}
  const initBestValue = testResults.hasOwnProperty('initBestValue') ? testResults.initBestValue : null
  const propVal = {}
  testResults.paramsNames.forEach(paramName => {
    if (bestResult.hasOwnProperty(`__${paramName}`))
      propVal[paramName] = bestResult[`__${paramName}`]
  })
  if (isFinalTest)
    await tv.setStrategyParams(testResults.shortName, propVal)
  let text = `All done.\n\n`
  text += bestResult && bestResult.hasOwnProperty(testParams.optParamName) ? 'The best ' + (testResults.isMaximizing ? '(max) ' : '(min) ') + testParams.optParamName + ': ' + backtest.convertValue(bestResult[testParams.optParamName]) : ''
  text += (initBestValue !== null && bestResult && bestResult.hasOwnProperty(testParams.optParamName) && initBestValue === bestResult[testParams.optParamName]) ? `\nIt isn't improved from the initial value: ${backtest.convertValue(initBestValue)}` : ''
  ui.statusMessage(text)
  log.info(`All done. ${bestResult && bestResult.hasOwnProperty(testParams.optParamName) ? 'The best ' + (testResults.isMaximizing ? '(max) ' : '(min) ') + testParams.optParamName + ': ' + bestResult[testParams.optParamName] : ''}`)
  if (testParams.shouldSkipWaitingForDownload || !isFinalTest)
    file.saveAs(CSVResults, `${testResults.ticker}:${testResults.timeFrame}${testResults.isDeepTest ? ' deep backtesting' : ''} ${testResults.shortName} - ${testResults.cycles}_${testResults.isMaximizing ? 'max' : 'min'}_${testResults.optParamName}_${testResults.method}.csv`)
  if (isFinalTest) {
    await ui.showPopup(text)
    if (!testParams.shouldSkipWaitingForDownload)
      file.saveAs(CSVResults, `${testResults.ticker}:${testResults.timeFrame}${testResults.isDeepTest ? ' deep backtesting' : ''} ${testResults.shortName} - ${testResults.cycles}_${testResults.isMaximizing ? 'max' : 'min'}_${testResults.optParamName}_${testResults.method}.csv`)
  }
}


action.show3DChart = async () => {
  const testResults = await storage.getKey(storage.STRATEGY_KEY_RESULTS)
  if (!hasBacktestResults(testResults)) {
    await ui.showWarningPopup(message.noBacktestResults)
    return
  }
  testResults.optParamName = testResults.optParamName || backtest.DEF_MAX_PARAM_NAME
  const eventData = await sendActionMessage(testResults, 'show3DChart')
  if (eventData.hasOwnProperty('message'))
    await ui.showPopup(eventData.message)
}

async function sendActionMessage(data, action) {
  return new Promise(resolve => {
    const url = window.location && window.location.origin ? window.location.origin : 'https://www.tradingview.com'
    tvPageMessageData[action] = resolve
    window.postMessage({ name: 'iondvScript', action, data }, url) // TODO wait for data
  })
}

function hasBacktestResults(testResults) {
  return Boolean(testResults && Array.isArray(testResults.perfomanceSummary) && testResults.perfomanceSummary.length)
}
