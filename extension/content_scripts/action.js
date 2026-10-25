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


action.clearAll = async () => {
  const clearRes = await storage.clearAll()
  await ui.showPopup(clearRes && clearRes.length ? `The data was deleted: \n${clearRes.map(item => '- ' + item).join('\n')}` : 'There was no data in the storage')
}

// ---------------------------------------------------------------------------------------------------------------------
// Strategy parameters and optimization settings in the assistant database (see shared/db.js).
// The pop-up sends the strategy selected in its optimization settings table as request.strategyId.
// ---------------------------------------------------------------------------------------------------------------------

action.SELECTED_STRATEGY_KEY = 'iondvSelectedStrategy'

action._requireStrategyId = (request) => {
  const strategyId = request && typeof request.strategyId === 'string' ? request.strategyId : ''
  if (!strategyId)
    throw new UserActionError('Select a strategy in the optimization settings table of the extension pop-up first.\n' +
      'If the table is empty, add a strategy with "Upload strategy parameters" or "Get strategy parameters".')
  return strategyId
}

action._getStoredOptions = () => new Promise(resolve =>
  chrome.storage.local.get('iondvOptions', (stored) => resolve(stored && stored.iondvOptions ? stored.iondvOptions : {})))

// The strategy the pop-up shows as selected next time it opens
action._selectStrategy = (strategyId) => new Promise(resolve =>
  chrome.storage.local.set({[action.SELECTED_STRATEGY_KEY]: strategyId}, () => resolve()))

// Reads the strategy parameters ("Name,Value" text) into {indicatorName, properties}
action._parseStrategyCsv = (csvText) => {
  const properties = {}
  let indicatorName = null
  parseCSV2JSON(String(csvText || '')).forEach(row => {
    if (row.name === '__indicatorName')
      indicatorName = row.value
    else if (row.name !== undefined && row.name !== null && row.name !== '')
      properties[String(row.name)] = row.value
  })
  return {indicatorName: indicatorName === null ? null : String(indicatorName), properties}
}

action._loadStrategy = async (strategyId) => {
  const settingsRec = await dbClient.get(dbClient.OPTIMIZATION_SETTINGS, strategyId)
  const strategyRec = await dbClient.get(dbClient.STRATEGY_SETTINGS, strategyId)
  if (!settingsRec || !strategyRec)
    throw new UserActionError(`There are no saved settings of "${strategyId}".\n` +
      'Add them with "Upload strategy parameters" or "Get strategy parameters" in the extension pop-up.')
  const {indicatorName, properties} = action._parseStrategyCsv(strategyRec.content_csv)
  const parsed = optSettings.fromXml(settingsRec.content_xml)
  return {strategyId, settingsRec, strategyRec, parsed, properties,
    indicatorName: indicatorName || strategyRec.indicator_name || settingsRec.indicator_name || strategyId}
}

// Saves the strategy parameters and creates, extends or resets its optimization settings:
// - no settings yet: new ones with the default ranges are created, after a confirmation;
// - the same parameter names: the optimization settings stay as they are;
// - all old parameters plus new ones: the new ones are added unchecked;
// - otherwise (a parameter was removed or renamed): the settings are reset to the default ones, after a confirmation.
// Returns the text of the result for the user.
action._importStrategyParameters = async (strategyId, indicatorName, properties) => {
  const names = Object.keys(properties)
  if (!strategyId)
    throw new UserActionError('The strategy name is empty: it is taken from the parameters file name.')
  if (!names.length)
    throw new UserActionError(`There are no strategy parameters for "${strategyId}".`)
  const settingsRec = await dbClient.get(dbClient.OPTIMIZATION_SETTINGS, strategyId)
  const saveStrategySettings = () => dbClient.put(dbClient.STRATEGY_SETTINGS, {
    strategy_id: strategyId, indicator_name: indicatorName, content_csv: optSettings.toStrategyCsv(indicatorName, properties)
  })
  const listNames = (list) => list.slice(0, 15).map(name => `  - ${name}`).join('\n') + (list.length > 15 ? `\n  ...and ${list.length - 15} more` : '')

  if (!settingsRec) {
    const isConfirmed = await ui.alertPopup(`There are no optimization settings of "${strategyId}" yet.\n\n` +
      `Create new settings with the default ranges for its ${names.length} parameters?`, null, true)
    if (isConfirmed !== true)
      return 'canceled, nothing is saved.'
    const options = optSettings.getOptionFields(await action._getStoredOptions())
    await dbClient.put(dbClient.OPTIMIZATION_SETTINGS, {strategy_id: strategyId, indicator_name: indicatorName,
      content_xml: optSettings.toXml(optSettings.getDefaultParams(properties, true), optSettings.DEFAULT_CYCLES), ...options})
    await saveStrategySettings()
    await action._selectStrategy(strategyId)
    return `new optimization settings are created (${names.length} parameters).`
  }

  let parsed = null
  try {
    parsed = optSettings.fromXml(settingsRec.content_xml)
  } catch (err) {
    log.warn(`The optimization settings of "${strategyId}" are damaged:`, err)
  }
  const oldNames = parsed ? parsed.params.map(param => param.name) : []
  const added = names.filter(name => !oldNames.includes(name))
  const removed = oldNames.filter(name => !names.includes(name))

  // The parameters match (or new ones are added): the strategy values become the Default values of the parameters
  const notSetDefaults = []
  const withDefaults = (params) => params.map(param => {
    if (!Object.hasOwn(properties, param.name))
      return param
    const updated = optSettings.setParamDefault(param, properties[param.name])
    if (!updated)
      notSetDefaults.push(`${param.name} = ${properties[param.name]}`)
    return updated || param
  })
  const notSetText = () => notSetDefaults.length ?
    `\nThese values do not fit the type of the parameter, their Default is not changed:\n${listNames(notSetDefaults)}` : ''

  if (parsed && !added.length && !removed.length) {
    await dbClient.update(dbClient.OPTIMIZATION_SETTINGS, strategyId, {indicator_name: indicatorName,
      content_xml: optSettings.toXml(withDefaults(parsed.params), parsed.cycles, parsed.timeLimit)})
    await saveStrategySettings()
    await action._selectStrategy(strategyId)
    return 'the strategy parameters are saved; they match the optimization settings, their values are set as the Default ' +
      `values (the ranges and Active marks are not changed).${notSetText()}`
  }

  if (parsed && !removed.length) {
    const maxPriority = Math.max(0, ...parsed.params.map(param => Number(param.range[4]) || 0))
    const byName = Object.fromEntries(withDefaults(parsed.params).map(param => [param.name, param]))
    added.forEach((name, idx) => byName[name] = {name, active: false, range: optSettings.getDefaultRange(properties[name], maxPriority + idx + 1)})
    const ordered = names.map(name => byName[name]) // the order of the strategy parameters
    await dbClient.update(dbClient.OPTIMIZATION_SETTINGS, strategyId,
      {indicator_name: indicatorName, content_xml: optSettings.toXml(ordered, parsed.cycles, parsed.timeLimit)})
    await saveStrategySettings()
    await action._selectStrategy(strategyId)
    return `the strategy parameters are saved and set as the Default values; ${added.length} new parameter(s) are added to the ` +
      `optimization settings, unchecked:\n${listNames(added)}${notSetText()}`
  }

  const details = (removed.length ? `\n\nNot in the new parameters:\n${listNames(removed)}` : '') +
    (added.length ? `\n\nNew parameters:\n${listNames(added)}` : '') + (!parsed ? '\n\nThe stored settings are damaged.' : '')
  const isConfirmed = await ui.alertPopup(`The parameters of "${strategyId}" do not match its optimization settings.${details}\n\n` +
    'The optimization settings will be fully reset: the new default ones will be loaded. Continue?', false, true)
  if (isConfirmed !== true)
    return 'canceled, nothing is changed.'
  await dbClient.update(dbClient.OPTIMIZATION_SETTINGS, strategyId, {indicator_name: indicatorName,
    content_xml: optSettings.toXml(optSettings.getDefaultParams(properties, true), optSettings.DEFAULT_CYCLES)})
  await saveStrategySettings()
  await action._selectStrategy(strategyId)
  return `the optimization settings are reset to the default ones (${names.length} parameters).`
}

// "Upload strategy parameters": a strategy parameters file ("Name,Value", as the export button of the strategy
// settings dialog saves it). strategy_id is the file name without " (N)" of the browser copies.
action.uploadStrategyParameters = async () => {
  await file.upload(async (fileData) => {
    const csvData = await file.parseCSV(fileData)
    if (!csvData.length || !Object.hasOwn(csvData[0], 'name') || !Object.hasOwn(csvData[0], 'value'))
      return {text: `  - ${fileData.name}: it is not a strategy parameters file, the columns "Name" and "Value" are missing.\n`, isError: true}
    const properties = {}
    let indicatorName = null
    csvData.forEach(row => {
      if (row.name === '__indicatorName')
        indicatorName = row.value
      else if (row.name !== undefined && row.name !== null && row.name !== '')
        properties[String(row.name)] = row.value
    })
    if (!indicatorName)
      return {text: `  - ${fileData.name}: the row "__indicatorName" with the strategy name is missing.\n`, isError: true}
    const strategyId = optSettings.strategyIdFromFileName(fileData.name)
    const result = await action._importStrategyParameters(strategyId, String(indicatorName), properties)
    return {text: `  - ${fileData.name} -> "${strategyId}": ${result}\n`, isError: false}
  }, '', false)
}

// "Get strategy parameters": the parameters of the strategy on the chart, the rest as uploading a file
action.getStrategyParameters = async () => {
  const strategyData = await tv.getStrategy()
  if (!strategyData || !strategyData.hasOwnProperty('name') || !strategyData.hasOwnProperty('properties') || !strategyData.properties) {
    await ui.showErrorPopup(message.noStrategyInputs)
    return
  }
  const strategyId = optSettings.strategyIdFromName(strategyData.name)
  const result = await action._importStrategyParameters(strategyId, strategyData.name, strategyData.properties)
  await ui.showPopup(`"${strategyId}": ${result}`)
}

// Double click in the optimization settings table: the "Strategy parameters" window of the strategy
action.editOptimizationSettings = async (request) => {
  const strategyId = action._requireStrategyId(request)
  const strategy = await action._loadStrategy(strategyId)
  const result = await ui.showOptimizationSettingsDialog(strategyId, strategy.parsed.params, strategy.parsed.cycles, strategy.parsed.timeLimit, async (state) => {
    await dbClient.update(dbClient.OPTIMIZATION_SETTINGS, strategyId, {content_xml: optSettings.toXml(state.params, state.cycles, state.timeLimit)})
    log.info(`Optimization settings of "${strategyId}" are saved:`, state.params.filter(param => param.active).length, 'active parameters')
  })
  if (!result)
    return
  await action.testStrategy(request, false, {cycles: result.state.cycles, timeLimit: result.state.timeLimit})
}

// The strategy parameter values as the strategy settings dialog takes them
action._toChartValues = (properties) => Object.fromEntries(Object.entries(properties).map(([name, value]) =>
  [name, typeof value === 'string' && value.includes(';') ? value.split(';')[0] : value]))

action.exportDatabase = async () => {
  const data = await dbClient.exportAll()
  const date = new Date().toISOString().slice(0, 16).replace('T', ' ').replace(':', '-')
  file.saveAs(JSON.stringify(data, null, 1), `tv-assistant database ${date}.json`)
}

action.importDatabase = async () => {
  await file.upload(async (fileData) => {
    const data = JSON.parse(await fileData.text())
    const isConfirmed = await ui.alertPopup(`Import "${fileData.name}"?\n\nThe strategies from the file replace the stored ones ` +
      'with the same names; the other stored strategies are kept.', false, true)
    if (isConfirmed !== true)
      return {text: `  - ${fileData.name}: canceled.\n`, isError: false}
    const count = await dbClient.importAll(data)
    return {text: `  - ${fileData.name}: ${count} records are imported.\n`, isError: false}
  }, '', false)
}

// ---------------------------------------------------------------------------------------------------------------------
// Results of the selected strategy: optimization_results, every test run is kept
// ---------------------------------------------------------------------------------------------------------------------

action._getRuns = async (request) => {
  const strategyId = action._requireStrategyId(request)
  const record = await dbClient.get(dbClient.OPTIMIZATION_RESULTS, strategyId)
  const runs = record && record.content_results && Array.isArray(record.content_results.runs) ? record.content_results.runs : []
  return {strategyId, runs: runs.filter(run => hasBacktestResults(run) || (Array.isArray(run.filteredSummary) && run.filteredSummary.length))}
}

action._requireRuns = async (request) => {
  const {strategyId, runs} = await action._getRuns(request)
  if (!runs.length)
    throw new UserActionError(`There are no test results of "${strategyId}" yet. Run a test first.`)
  return {strategyId, runs}
}

// A run is shown in the preview, which needs at least one row among the passed results
action._runForView = (run) => {
  const view = {...run}
  if (!hasBacktestResults(view) && Array.isArray(view.filteredSummary) && view.filteredSummary.length) {
    view.perfomanceSummary = view.filteredSummary
    view.filteredSummary = []
  }
  view.optParamName = view.optParamName || backtest.DEF_MAX_PARAM_NAME
  return view
}

action._storeRun = async (strategyId, testResults, runStartTime) => {
  const run = {
    run_id: `${Date.now()}-${Math.round(Math.random() * 1e6)}`,
    started: runStartTime ? new Date(runStartTime).toISOString() : null,
    finished: new Date().toISOString(),
    name: testResults.name, shortName: testResults.shortName, ticker: testResults.ticker, timeFrame: testResults.timeFrame,
    isDeepTest: Boolean(testResults.isDeepTest), method: testResults.method, cycles: testResults.cycles, timeLimit: testResults.timeLimit || 0,
    isMaximizing: model.isMaximizing(testResults), optParamName: testResults.optParamName,
    filterAscending: testResults.filterAscending, filterValue: testResults.filterValue, filterParamName: testResults.filterParamName,
    paramsNames: testResults.paramsNames || [], initBestValue: testResults.hasOwnProperty('initBestValue') ? testResults.initBestValue : null,
    bestValue: testResults.hasOwnProperty('bestValue') ? testResults.bestValue : null,
    perfomanceSummary: (testResults.perfomanceSummary || []).filter(row => row && typeof row === 'object'),
    filteredSummary: (testResults.filteredSummary || []).filter(row => row && typeof row === 'object')
  }
  const count = await dbClient.appendRun(strategyId, JSON.parse(JSON.stringify(run)))
  testResults._isStored = true
  log.info(`Test results are saved to the database for "${strategyId}" (run ${count}).`)
}

action.previewStrategyTestResults = async (request) => {
  const {strategyId, runs} = await action._requireRuns(request)
  const eventData = await sendActionMessage({strategyId, runs: runs.map(run => action._runForView(run))}, 'previewStrategyTestResults')
  if (eventData && eventData.hasOwnProperty('message'))
    await ui.showPopup(eventData.message)
}

// Results CSV files downloaded earlier are added to the runs of the selected strategy and shown in the preview
action.uploadStrategyTestResults = async (request) => {
  const strategyId = action._requireStrategyId(request)
  let addedCount = 0
  await file.upload(async (fileData) => {
    const results = await file.parseResultsFile(fileData)
    const fileStrategyId = optSettings.strategyIdFromName(results.shortName)
    if (fileStrategyId && fileStrategyId !== strategyId) {
      const isConfirmed = await ui.alertPopup(`"${fileData.name}" has the results of "${fileStrategyId}", ` +
        `but the selected strategy is "${strategyId}".\n\nAdd them to "${strategyId}" anyway?`, false, true)
      if (isConfirmed !== true)
        return {text: `  - ${fileData.name}: skipped.\n`, isError: false}
    }
    await dbClient.appendRun(strategyId, JSON.parse(JSON.stringify({
      ...results, run_id: `${Date.now()}-${Math.round(Math.random() * 1e6)}`, started: null,
      finished: fileData.lastModified ? new Date(fileData.lastModified).toISOString() : null, source: fileData.name
    })))
    addedCount++
    return {text: `  - ${fileData.name}: ${results.perfomanceSummary.length + results.filteredSummary.length} results are added to "${strategyId}".\n`, isError: false}
  }, '', true, async (hasError, message) => {
    if (hasError || !addedCount)
      await ui.showWarningPopup(message)
    if (addedCount)
      await action.previewStrategyTestResults(request)
  })
}

// The last run of the selected strategy: its best parameters are set for the strategy and the results are downloaded
action.downloadStrategyTestResults = async (request) => {
  const {strategyId, runs} = await action._requireRuns(request)
  const testResults = action._runForView(runs[runs.length - 1])
  const CSVResults = file.convertResultsToCSV(testResults)
  const bestResult = model.getBestResult(testResults)
  const propVal = {}
  ;(testResults.paramsNames || []).forEach(paramName => {
    if (bestResult.hasOwnProperty(`__${paramName}`))
      propVal[paramName] = bestResult[`__${paramName}`]
  })
  if (Object.keys(propVal).length)
    await tv.setStrategyParams(testResults.shortName, propVal)
  if (bestResult && bestResult.hasOwnProperty(testResults.optParamName))
    await ui.showPopup(`The best found parameters are set for the strategy\n\nThe best ${testResults.isMaximizing ? '(max) ' : '(min)'} ${testResults.optParamName}: ` + bestResult[testResults.optParamName])
  const date = (testResults.finished || '').slice(0, 16).replace('T', ' ').replace(':', '-')
  file.saveAs(CSVResults, `${testResults.ticker}:${testResults.timeFrame} ${strategyId} - ${testResults.cycles}_${testResults.isMaximizing ? 'max' : 'min'}_${testResults.optParamName}_${testResults.method}${date ? ' ' + date : ''}.csv`)
}

action.show3DChart = async (request) => {
  const {runs} = await action._requireRuns(request)
  const testResults = action._runForView(runs[runs.length - 1])
  const eventData = await sendActionMessage(testResults, 'show3DChart')
  if (eventData && eventData.hasOwnProperty('message'))
    await ui.showPopup(eventData.message)
}

// "Test strategy": the strategy selected in the pop-up table is tested with its optimization settings from the
// database. The strategy is not read from TradingView: its stored parameter values are set on the chart first and are
// the current (start) values of the test. Every run is saved to optimization_results.
action.testStrategy = async (request, isDeepTest = false, override = {}) => {
  const actionName = isDeepTest ? 'deepTestStrategy' : 'testStrategy'
  let strategyId = null
  let testParams = null
  let runStartTime = null
  try {
    strategyId = action._requireStrategyId(request)
    const strategy = await action._loadStrategy(strategyId)
    request = {...request, options: {...(request.options || {}), ...optSettings.toRequestOptions(strategy.settingsRec)}}
    const strategyData = {name: strategy.indicatorName, properties: action._toChartValues(strategy.properties)}
    const activeParams = strategy.parsed.params.filter(param => param.active)
    if (!activeParams.length)
      throw new UserActionError(`No parameter of "${strategyId}" is checked as Active.\n` +
        'Double-click the strategy in the table of the extension pop-up and check the parameters to optimize.')
    const paramRange = Object.fromEntries(activeParams.map(param => [param.name, param.range]))
    const allRangeParams = model.createParamsFromRange(paramRange)
    // createParamsFromRange skips single-value and invalid ranges, so an empty result means nothing to optimize
    if (!Object.keys(allRangeParams).length)
      throw new UserActionError('No active parameter has a range to test: every one has a single value or an invalid range.\n' +
        'Double-click the strategy in the table of the extension pop-up and set "From", "To" and "Step".')
    const cycles = Number.isInteger(override.cycles) && override.cycles >= 0 ? override.cycles : strategy.parsed.cycles
    const timeLimit = Number.isFinite(override.timeLimit) && override.timeLimit >= 0 ? override.timeLimit : strategy.parsed.timeLimit

    ui.statusMessage(`Set the stored parameters of "${strategyId}" on the chart.`)
    const isSet = await tv.setStrategyParams(strategyData.name, strategyData.properties)
    if (!isSet)
      throw new UserActionError(`The stored parameters could not be set for the strategy "${strategyData.name}".\n` +
        'Add this strategy to the chart (the title of its settings dialog must be the same) and try again. ' +
        'If the strategy inputs were changed, upload its parameters again.')
    const rejected = tv.lastSetStrategyResult?.legacy?.rejected || {}
    Object.keys(rejected).forEach(key => strategyData.properties[key] = rejected[key].actual) // the values in effect
    if (Object.keys(rejected).length)
      log.warn('TradingView did not accept the stored values, the test starts from the values in the dialog:', rejected)

    isDeepTest = await tvChart.detectDeepTest()
    const previous = await action._getRuns({strategyId})
    // All strategy parameters take part in the start values, so every result keeps the whole parameter set (a row
    // saved from the preview is a complete parameters file); the unchecked ones keep their stored values
    const startRange = {}
    strategy.parsed.params.forEach(param => {
      if (!Object.hasOwn(strategyData.properties, param.name))
        return
      startRange[param.name] = param.active ? param.range :
        [param.range[0], param.range[1], param.range[2], strategyData.properties[param.name], param.range[4]]
    })
    testParams = await action._getTestParams(request, strategyData, allRangeParams, startRange, cycles, isDeepTest,
      previous.runs.length ? previous.runs[previous.runs.length - 1] : null)
    testParams.strategyId = strategyId
    testParams.timeLimit = timeLimit // minutes, 0 - no limit
    action._showStartMsg(testParams.paramSpace, testParams.cycles, testParams.backtestDelay ? ` with delay between tests ${testParams.backtestDelay} sec` : '')
    testParams.isDeepTest = isDeepTest
    action._logRunStart(testParams, strategyData)
    runStartTime = new Date()
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
          testParams._isStored = false
          if (testParams.hasOwnProperty('bestPropVal'))
            delete testParams.bestPropVal
          if (testParams.hasOwnProperty('bestValue'))
            delete testParams.bestValue
          testResults = await backtest.testStrategy(testParams, strategyData, allRangeParams)
          await action._saveTestResults(testResults, testParams, false, runStartTime)
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
          await ui.showPopup(`The best value ${bestValue} for timeframe ${bestTf}. The results of every timeframe are saved in the database (Results tab).`)
        } else {
          await ui.showWarningPopup(`Did not found any result value after testing`)
        }
      }
    } else {
      testResults = await backtest.testStrategy(testParams, strategyData, allRangeParams)
      await action._saveTestResults(testResults, testParams, true, runStartTime)
    }
  } catch (err) {
    // A failed run keeps the results it has got
    if (strategyId && testParams && !testParams._isStored && hasBacktestResults(testParams)) {
      try {
        await action._storeRun(strategyId, testParams, runStartTime)
      } catch (storeErr) {
        log.error('Saving the results of the failed run failed:', storeErr)
      }
    }
    await ui.showErrorByKind(err, actionName)
  }
  ui.statusMessageRemove()
}

action._parseTF = (listOfTF) => {
  if (!listOfTF || typeof (listOfTF) !== 'string')
    return []
  return listOfTF.split(',').map(tf => tf.trim()).filter(tf => /(^\d{1,2}m$)|(^\d{1,2}h$)|(^\d{1,2}D$)|(^\d{1,2}W$)|(^\d{1,2}M$)/.test(tf))

}

action._getTestParams = async (request, strategyData, allRangeParams, paramRange, cycles, isDeepTest=false, previousRun=null) => {
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

  // The best parameters of the previous run of this strategy, by the metric of this test, are a start value too
  const previousResults = previousRun ? {...previousRun,
    optParamName: options.optParamName || backtest.DEF_MAX_PARAM_NAME,
    isMaximizing: options.hasOwnProperty('isMaximizing') ? options.isMaximizing : true} : null
  testParams.startParams = await model.getStartParamValues(paramRange, strategyData, previousResults)
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

// Run summary for the final log line, from the results already stored: tests count, duration and
// the no-trades / stale outcomes, recognised by the comment markers written by tv.getPerformance
action._getRunStats = (testResults, runStartTime) => {
  const formatDuration = (ms) => {
    const totalSec = Math.round(ms / 1000)
    const min = Math.floor(totalSec / 60)
    return min ? `${min}m ${totalSec % 60}s` : `${totalSec}s`
  }
  const performed = Array.isArray(testResults.perfomanceSummary) ? testResults.perfomanceSummary : []
  const filtered = Array.isArray(testResults.filteredSummary) ? testResults.filteredSummary : []
  const hasComment = (data, marker) => data && typeof data['comment'] === 'string' && data['comment'].includes(marker)
  const noTrades = filtered.filter(data => hasComment(data, 'No trades for these parameters') || hasComment(data, 'No report data: ')).length
  const stale = filtered.filter(data => hasComment(data, 'WARNING: report not updated')).length
  const duration = runStartTime ? ` in ${formatDuration(new Date() - runStartTime)}` : ''
  return `${performed.length + filtered.length} tests${duration} (${noTrades} no trades, ${stale} stale)`
}

action._showStartMsg = (paramSpaceNumber, cycles, addInfo) => {
  let extraHeader = `The search is performed among ${paramSpaceNumber} possible combinations of parameters (space).`
  if (!(cycles > 0))
    extraHeader += '<br />Cycles = 0: no limit of cycles.'
  else extraHeader += (paramSpaceNumber / cycles) > 10 ? `<br />This is too large for ${cycles} cycles. It is recommended to use up to 3-4 essential parameters, remove the rest from the strategy parameters file.` : ''
  ui.statusMessage(`Started${addInfo}.`, extraHeader)
}


// The run is saved to optimization_results of the strategy; at the end the best parameters are set for the strategy
action._saveTestResults = async (testResults, testParams, isFinalTest = true, runStartTime = null) => {
  if (!hasBacktestResults(testResults) && !(Array.isArray(testResults.filteredSummary) && testResults.filteredSummary.length)) {
    await ui.showWarningPopup(message.noBacktestResults)
    return
  }
  let storeError = null
  if (testParams.strategyId) {
    try {
      await action._storeRun(testParams.strategyId, testResults, runStartTime)
    } catch (err) {
      storeError = err
      log.error('Saving the test results to the database failed:', err)
    }
  }
  const bestResult = testResults.perfomanceSummary ? model.getBestResult(testResults) : {}
  const initBestValue = testResults.hasOwnProperty('initBestValue') ? testResults.initBestValue : null
  const propVal = {}
  testResults.paramsNames.forEach(paramName => {
    if (bestResult.hasOwnProperty(`__${paramName}`))
      propVal[paramName] = bestResult[`__${paramName}`]
  })
  if (isFinalTest && Object.keys(propVal).length)
    await tv.setStrategyParams(testResults.shortName, propVal)
  let text = `All done.\n\n`
  text += bestResult && bestResult.hasOwnProperty(testParams.optParamName) ? 'The best ' + (testResults.isMaximizing ? '(max) ' : '(min) ') + testParams.optParamName + ': ' + backtest.convertValue(bestResult[testParams.optParamName]) : 'No result passed the filter.'
  text += (initBestValue !== null && bestResult && bestResult.hasOwnProperty(testParams.optParamName) && initBestValue === bestResult[testParams.optParamName]) ? `\nIt isn't improved from the initial value: ${backtest.convertValue(initBestValue)}` : ''
  text += storeError ? `\n\nThe results were NOT saved to the database: ${storeError.message}\nUse "Download results" before the next test.` :
    '\n\nThe results are saved in the database: the Results tab of the extension shows them.'
  ui.statusMessage(text)
  log.info(`All done: ${action._getRunStats(testResults, runStartTime)}. ${bestResult && bestResult.hasOwnProperty(testParams.optParamName) ? 'The best ' + (testResults.isMaximizing ? '(max) ' : '(min) ') + testParams.optParamName + ': ' + bestResult[testParams.optParamName] : ''}`)
  if (storeError && !isFinalTest) // without the database the results of a timeframe are kept in a file
    file.saveAs(file.convertResultsToCSV(testResults), `${testResults.ticker}:${testResults.timeFrame} ${testResults.shortName} - ${testResults.cycles}_${testResults.isMaximizing ? 'max' : 'min'}_${testResults.optParamName}_${testResults.method}.csv`)
  if (isFinalTest) {
    await ui.showPopup(text)
    if (storeError)
      file.saveAs(file.convertResultsToCSV(testResults), `${testResults.ticker}:${testResults.timeFrame} ${testResults.shortName} - ${testResults.cycles}_${testResults.isMaximizing ? 'max' : 'min'}_${testResults.optParamName}_${testResults.method}.csv`)
  }
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
