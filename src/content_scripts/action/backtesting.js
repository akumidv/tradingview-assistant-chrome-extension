const actionBacktest = {}
if (typeof module !== 'undefined') {
  module.exports = {
    actionBacktest
  }
}

actionBacktest.testStrategy = async(request, isDeepTest = false) => {
  try {
    const strategyData = await actionBacktest._getStrategyData()
    const [allRangeParams, paramRange, cycles] = await actionBacktest._getRangeParams(strategyData)
    if (allRangeParams !== null) { // click cancel on parameters
      const testParams = await actionBacktest._getTestParams(request, strategyData, allRangeParams, paramRange, cycles)
      console.log('Test parameters', testParams)
      actionBacktest._showStartMsg(testParams.paramSpace, testParams.cycles, testParams.backtestDelay ? ` with delay between tests ${testParams.backtestDelay} sec` : '')
      testParams.isDeepTest = isDeepTest
      await tv.setDeepTest(isDeepTest, testParams.deepStartDate)

      let testResults = {}
      if (testParams.shouldTestTF) {
        if (!testParams.listOfTF || testParams.listOfTF.length === 0) {
          await ui.showWarningPopup(`You set to test timeframes in options, but timeframes list after correction values is empty: ${testParams.listOfTFSource}\nPlease set correct one with separation by comma. \nFor example: 1m,4h`)
        } else {
          let bestValue = null
          let bestTf = null
          testParams.shouldSkipInitBestResult = true
          for (const tf of testParams.listOfTF) {
            console.log('\nTest timeframe:', tf)
            await tvChart.changeTimeFrame(tf)
            testParams.timeFrame = tf
            if (testParams.hasOwnProperty('bestPropVal'))
              delete testParams.bestPropVal
            if (testParams.hasOwnProperty('bestValue'))
              delete testParams.bestValue
            testResults = await backtest.testStrategy(testParams, strategyData, allRangeParams) // TODO think about not save, but store them from  testResults.performanceSummary, testResults.filteredSummary = [], testResults.timeFrame to list
            await actionBacktest._saveTestResults(testResults, testParams, false)
            if (bestTf === null) {
              bestValue = testResults.bestValue
              bestTf = tf
            } else if (testResults.isMaximizing ? testParams.bestValue > bestValue : testParams.bestValue < bestValue) {
              bestValue = testResults.bestValue
              bestTf = tf
            }
            if (action.workerStatus === null) {
              console.log('Stop command detected')
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
        await actionBacktest._saveTestResults(testResults, testParams)
      }
      if (isDeepTest)
        await tv.setDeepTest(!isDeepTest) // Reverse (switch off)
    }
  } catch (err) {
    console.error(err)
    await ui.showErrorPopup(`${err}`)
  }
  ui.statusMessageRemove()
}

actionBacktest._getRangeParams = async(strategyData) => {
  let paramRange = await model.getStrategyParameters(strategyData)
  console.log('paramRange', paramRange)
  if (paramRange === null)
    // throw new Error('Error get changed strategy parameters')
    return [null, null, null]

  const initParams = {}
  initParams.paramRange = paramRange
  initParams.paramRangeSrc = model.getStrategyRange(strategyData)
  const changedStrategyParams = await backtestParameters.showAndUpdateStrategyParameters(initParams)
  if (changedStrategyParams === null) {
    return [null, null, null]
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
    throw new Error('The strategy parameters invalid. Change them or run default parameters set.')
  }

  const allRangeParams = model.createParamsFromRange(paramRange)
  console.log('allRangeParams', allRangeParams)
  if (!allRangeParams) {
    throw new Error('Empty range parameters for strategy')
  }
  return [allRangeParams, paramRange, cycles]
}

actionBacktest._getStrategyData = async () => {
  ui.statusMessage('Get the initial parameters.')
  const strategyData = await tv.getStrategy()
  if (!strategyData || !strategyData.hasOwnProperty('name') || !strategyData.hasOwnProperty('properties') || !strategyData.properties) {
    throw new Error('The current strategy do not contain inputs, that can be optimized. You can choose another strategy to optimize.')
  }
  return strategyData
}


actionBacktest._parseTF = (listOfTF) => {
  if (!listOfTF || typeof (listOfTF) !== 'string')
    return []
  return listOfTF.split(',').map(tf => tf.trim()).filter(tf => /(^\d{1,2}m$)|(^\d{1}h$)|(^\d{1}D$)|(^\d{1}W$)|(^\d{1}M$)/.test(tf))

}

actionBacktest._getTestParams = async (request, strategyData, allRangeParams, paramRange, cycles) => {
  const testParams = await tv.switchToStrategyTab()
  const options = request && request.hasOwnProperty('options') ? request.options : {}
  const testMethod = options.hasOwnProperty('optMethod') && typeof (options.optMethod) === 'string' ? options.optMethod.toLowerCase() : 'random'
  let paramSpaceNumber = 0
  let isSequential = false
  if (['sequential'].includes(testMethod)) {
    paramSpaceNumber = Object.keys(allRangeParams).reduce((sum, param) => sum += allRangeParams[param].length, 0)
    isSequential = true
  } else {
    paramSpaceNumber = Object.keys(allRangeParams).reduce((mult, param) => mult *= allRangeParams[param].length, 1)
  }
  console.log('paramSpaceNumber', paramSpaceNumber)

  testParams.shouldTestTF = options.hasOwnProperty('shouldTestTF') ? options.shouldTestTF : false
  testParams.listOfTF = actionBacktest._parseTF(options.listOfTF)
  testParams.listOfTFSource = options.listOfTF
  testParams.shouldSkipInitBestResult = false // TODO get from options

  testParams.paramSpace = paramSpaceNumber
  let paramPriority = model.getParamPriorityList(paramRange) // Filter by allRangeParams
  paramPriority = paramPriority.filter(key => allRangeParams.hasOwnProperty(key))
  console.log('paramPriority list', paramPriority)
  testParams.paramPriority = paramPriority

  testParams.startParams = await model.getStartParamValues(paramRange, strategyData)
  console.log('testParams.startParams', testParams.startParams)
  if (!testParams.hasOwnProperty('startParams') || !testParams.startParams.hasOwnProperty('current') || !testParams.startParams.current) {
    throw new Error('Error.\n\n The current strategy parameters could not be determined.\n Testing aborted')
  }

  testParams.cycles = cycles


  if (request.options) {
    testParams.isMaximizing = request.options.hasOwnProperty('isMaximizing') ? request.options.isMaximizing : true
    testParams.optParamName = request.options.optParamName ? request.options.optParamName : backtest.DEF_MAX_PARAM_NAME
    testParams.method = testMethod
    testParams.filterAscending = request.options.hasOwnProperty('optFilterAscending') ? request.options.optFilterAscending : null
    testParams.filterValue = request.options.hasOwnProperty('optFilterValue') ? request.options.optFilterValue : 50
    testParams.filterParamName = request.options.hasOwnProperty('optFilterParamName') ? request.options.optFilterParamName : 'Total Closed Trades: All'
    testParams.deepStartDate = !request.options.hasOwnProperty('deepStartDate') || request.options['deepStartDate'] === '' ? null : request.options['deepStartDate']
    testParams.backtestDelay = !request.options.hasOwnProperty('backtestDelay') || !request.options['backtestDelay'] ? 0 : request.options['backtestDelay']
    testParams.randomDelay = request.options.hasOwnProperty('randomDelay') ? Boolean(request.options['randomDelay']) : true
    testParams.shouldSkipInitBestResult = request.options.hasOwnProperty('shouldSkipInitBestResult') ? Boolean(request.options['shouldSkipInitBestResult']) : false
    testParams.shouldSkipWaitingForDownload = request.options.hasOwnProperty('shouldSkipWaitingForDownload') ? Boolean(request.options['shouldSkipWaitingForDownload']) : false
    testParams.dataLoadingTime = request.options.hasOwnProperty('dataLoadingTime') && !isNaN(parseInt(request.options['dataLoadingTime'])) ? request.options['dataLoadingTime'] : 30
  }
  return testParams
}

actionBacktest._showStartMsg = (paramSpaceNumber, cycles, addInfo) => {
  let extraHeader = `The search is performed among ${paramSpaceNumber} possible combinations of parameters (space).`
  extraHeader += (paramSpaceNumber / cycles) > 10 ? `<br />This is too large for ${cycles} cycles. It is recommended to use up to 3-4 essential parameters, remove the rest from the strategy parameters file.` : ''
  ui.statusMessage(`Started${addInfo}.`, extraHeader)
}

actionBacktest._saveTestResults = async (testResults, testParams, isFinalTest = true) => {
  console.log('testResults', testResults)
  if (!testResults.performanceSummary && !testResults.performanceSummary.length) {
    await ui.showWarningPopup('There is no testing data for saving. Try to do test again')
    return
  }

  const CSVResults = file.convertResultsToCSV(testResults)
  const bestResult = testResults.performanceSummary ? model.getBestResult(testResults) : {}
  const initBestValue = testResults.hasOwnProperty('initBestValue') ? testResults.initBestValue : null
  const propVal = {}
  testResults.paramsNames.forEach(paramName => {
    if (bestResult.hasOwnProperty(`__${paramName}`))
      propVal[paramName] = bestResult[`__${paramName}`]
  })
  let errMsg
  if (isFinalTest)
    errMsg = await tvIndicator.setStrategyInputs(testResults.shortName, propVal)
  let text = 'All done.\n\n'
  text += bestResult && bestResult.hasOwnProperty(testParams.optParamName) ? 'The best ' + (testResults.isMaximizing ? '(max) ' : '(min) ') + testParams.optParamName + ': ' + backtest.convertValue(bestResult[testParams.optParamName]) : ''
  text += (initBestValue !== null && bestResult && bestResult.hasOwnProperty(testParams.optParamName) && initBestValue === bestResult[testParams.optParamName]) ? `\nIt isn't improved from the initial value: ${backtest.convertValue(initBestValue)}` : ''
  ui.statusMessage(text)
  console.log(`All done.\n\n${bestResult && bestResult.hasOwnProperty(testParams.optParamName) ? 'The best ' + (testResults.isMaximizing ? '(max) ' : '(min) ') + testParams.optParamName + ': ' + bestResult[testParams.optParamName] : ''}`)
  if (testParams.shouldSkipWaitingForDownload || !isFinalTest)
    file.saveAs(CSVResults, `${testResults.ticker}:${testResults.timeFrame}${testResults.isDeepTest ? ' deep backtesting' : ''} ${testResults.shortName} - ${testResults.cycles}_${testResults.isMaximizing ? 'max' : 'min'}_${testResults.optParamName}_${testResults.method}.csv`)
  if (isFinalTest) {
    await ui.showPopup(text)
    if (!testParams.shouldSkipWaitingForDownload)
      file.saveAs(CSVResults, `${testResults.ticker}:${testResults.timeFrame}${testResults.isDeepTest ? ' deep backtesting' : ''} ${testResults.shortName} - ${testResults.cycles}_${testResults.isMaximizing ? 'max' : 'min'}_${testResults.optParamName}_${testResults.method}.csv`)
  }
}

