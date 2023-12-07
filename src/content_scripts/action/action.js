if (typeof exports === 'object' && typeof module === 'object') {
  // eslint no-var: "ignore"
  var _ = require('./backtesting')

  actionSignal = require('./uploadingSignals')
}


const action = {
  workerStatus: null
}

if (typeof module !== 'undefined') {
  module.exports = {
    action
  }
}


action.attachActionElementsToTVUI = () => {
  if (action.workerStatus) // If there is running process - just return
    return
  uiAttaching.injectIndicator()
}


action.show3DChart = async () => {
  let testResults = await storage.getKey(storage.STRATEGY_KEY_RESULTS)
  testResults = {} // TODO remove
  if (!('perfomanceSummary' in testResults)) {  // TODO remove
    testResults.perfomanceSummary = []
  }
  // if(!testResults || !testResults.perfomanceSummary || !testResults.perfomanceSummary.length) {
  //   await ui.showPopup('There is no results data for to show. Try to backtest again')
  //   return
  // }
  testResults.performanceSummary = testResults.perfomanceSummary
  testResults.optParamName = testResults.optParamName || backtest.DEF_MAX_PARAM_NAME
  await ui3DChart.show3DChart(testResults)
}

action.uploadSignals = async () => {
  await file.upload(actionSignal.parseTSSignalsAndGetMsg, `Please check if the ticker and timeframe are set like in the downloaded data and click on the parameters of the "iondvSignals" script to automatically enter new data on the chart.`, true)
}

action.uploadStrategyTestParameters = async () => {
  await file.upload(model.parseStrategyParamsAndGetMsg, '', false)
}

action.getStrategyTemplate = async () => {
  const strategyData = await tv.getStrategy()
  if(!strategyData || !strategyData.hasOwnProperty('name') || !strategyData.hasOwnProperty('properties') || !strategyData.properties) {
    await ui.showErrorPopup('The current strategy do not contain inputs, that can be saved')
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
  if(!testResults || (!testResults.performanceSummary && !testResults.performanceSummary.length)) {
    await ui.showWarningPopup('There is no data for conversion. Try to do test again')
    return
  }
  testResults.optParamName = testResults.optParamName || backtest.DEF_MAX_PARAM_NAME
  console.log('testResults', testResults)
  const CSVResults = file.convertResultsToCSV(testResults)
  const bestResult = testResults.performanceSummary ? model.getBestResult(testResults) : {}
  const propVal = {}
  testResults.paramsNames.forEach(paramName => {
    if(bestResult.hasOwnProperty(`__${paramName}`))
      propVal[paramName] = bestResult[`__${paramName}`]
  })
  const errMsg = await tvIndicator.setStrategyInputs(testResults.shortName, propVal)
  if(bestResult && bestResult.hasOwnProperty(testResults.optParamName))
    await ui.showPopup(`The best found parameters are set for the strategy\n\nThe best ${testResults.isMaximizing ? '(max) ':'(min)'} ${testResults.optParamName}: ` + bestResult[testResults.optParamName])
  file.saveAs(CSVResults, `${testResults.ticker}:${testResults.timeFrame} ${testResults.shortName} - ${testResults.cycles}_${testResults.isMaximizing ? 'max':'min'}_${testResults.optParamName}_${testResults.method}.csv`)
}

