/*
 @license Copyright 2021 akumidv (https://github.com/akumidv/)
 SPDX-License-Identifier: Apache-2.0
*/

'use strict';

(async function() {

  const MAX_PARAM_NAME = '.Margin'

  let isMsgShown = false
  let workerStatus = null
  let tickerTextPrev = null
  let timeFrameTextPrev = null

  const STORAGE_KEY_PREFIX = 'iondv'
  const STORAGE_STRATEGY_KEY_PARAM = 'strategy_param'
  const STORAGE_STRATEGY_KEY_RESULTS = 'strategy_result'
  const STORAGE_SIGNALS_KEY_PREFIX = 'signals'

  const SEL = {
    tvLegendIndicatorItem: 'div[data-name="legend"] div[class^="sourcesWrapper"] div[class^="sources"] div[data-name="legend-source-item"]',
    tvLegendIndicatorItemTitle: 'div[data-name="legend-source-title"]',
    tvDialogRoot: '#overlap-manager-root',
    indicatorTitle: '#overlap-manager-root div[data-name="indicator-properties-dialog"] div[class^="title"]',
    tabInput: 'div[data-name="indicator-properties-dialog"] div[data-value="inputs"]',
    tabInputActive: 'div[data-name="indicator-properties-dialog"] div[class*="active"][data-value="inputs"]',
    tabProperties: 'div[data-name="indicator-properties-dialog"] div[data-value="properties"]',
    ticker: '#header-toolbar-symbol-search > div[class*="text-"]',
    timeFrame: '#header-toolbar-intervals div[data-role^="button"]',
    timeFrameActive: '#header-toolbar-intervals div[data-role^="button"][class*="isActive"]',
    indicatorScroll: 'div[data-name="indicator-properties-dialog"] div[class^="scrollable-"]',
    indicatorProperty: 'div[data-name="indicator-properties-dialog"] div[class^="content-"] div[class^="cell-"]',
    okBtn: 'div[data-name="indicator-properties-dialog"] div[class^="footer-"] button[name="submit"]',
    strategyTesterTab: '#footer-chart-panel div[data-name="backtesting"]',
    strategyTesterTabActive: '#footer-chart-panel div[data-name="backtesting"][data-active="true"]',
    strategyCaption: '#bottom-area div.backtesting-head-wrapper .strategy-select .caption',
    strategyDialogParam: '#bottom-area div.backtesting-head-wrapper .js-backtesting-open-format-dialog',
    strategySummary: '#bottom-area div.backtesting-head-wrapper .backtesting-select-wrapper > ul >li:nth-child(2)',
    strategySummaryActive: '#bottom-area div.backtesting-head-wrapper .backtesting-select-wrapper > ul >li.active:nth-child(2)',
    strategyReportInProcess: '#bottom-area div.backtesting-content-wrapper > div.reports-content.fade',
    strategyReportReady: '#bottom-area div.backtesting-content-wrapper > div:not(.fade).reports-content',
    strategyReportError: '#bottom-area div.backtesting-content-wrapper > div.reports-content.report-error',
    strategyReportHeader: '#bottom-area div.backtesting-content-wrapper .report-data thead > tr > td',
    strategyReportRow: '#bottom-area div.backtesting-content-wrapper .report-data tbody > tr'
  }

  chrome.runtime.onMessage.addListener(
    async function(request, sender, reply) {
      if(sender.tab || !request.hasOwnProperty('action') || !request.action) {
        console.log('Not for action message received:', request)
        return
      }
      if(workerStatus !== null) {
        console.log('Waiting for end previous work. Status:', workerStatus)
        return
      }

      workerStatus = request.action
      try {
        switch (request.action) {
          case 'uploadSignals': {
            await uploadFiles(parseTSSignalsAndGetMsg, `Please check if the ticker and timeframe are set like in the downloaded data and click on the parameters of the "iondvSignals" script to automatically enter new data on the chart.`, true)
            break;
          }
          case 'uploadStrategyTestParameters': {
            await uploadFiles(parseStrategyParamsAndGetMsg, '', false)
            break;
          }
          case 'getStrategyTemplate': {
            const strategyData = await getStrategy()
            if(!strategyData || !strategyData.hasOwnProperty('name') || !strategyData.hasOwnProperty('properties') || !strategyData.properties) {
              alert('It was not possible to find a strategy with parameters among the indicators. Add it to the chart and try again.')
            } else {
              const paramRange = strategyGetRange(strategyData)
              const strategyRangeParamsCSV = strategyRangeToTemplate(paramRange)
              await storageSetKeys(STORAGE_STRATEGY_KEY_PARAM, paramRange)
              saveFileAs(strategyRangeParamsCSV, `${strategyData.name}.csv`)
              alert('The range of parameters is saved for the current strategy.\n\nYou can start optimizing the strategy parameters by clicking on the "Test strategy" button')
            }
            break;
          }
          case 'testStrategy': {
            const strategyData = await getStrategy()
            if(!strategyData || !strategyData.hasOwnProperty('name') || !strategyData.hasOwnProperty('properties') || !strategyData.properties) {
              alert('It was not possible to find a strategy with parameters among the indicators. Add it to the chart and try again.')
              break
            }
            const paramRange = await storageGetKey(STORAGE_STRATEGY_KEY_PARAM)
            const allRangeParams = await getStrategyRangeParameters(strategyData)
            if(!allRangeParams)
              break
            const cyclesStr = prompt(`Please enter the number of cycles for optimization.\n\nYou can interrupt the search for strategy parameters by just reloading the page and at the same time, you will not lose calculations. All data are stored in the storage after each iteration.\nYou can download last test results by clicking on the "Download results" button until you launch new strategy testing.`, 100)
            if(!cyclesStr)
              break
            let cycles = parseInt(cyclesStr)
            if(!cycles || cycles < 1)
              break
            let testParams = await switchToStrategyTab()
            testParams.cycles = cycles
            if(!testParams)
              break
            statusMessage('Started')
            const testResults = await testStrategy(testParams, strategyData, allRangeParams)  // TODO realize optimization functions
            console.log('testResults', testResults)
            if(!testResults.perfomanceSummary && !testResults.perfomanceSummary.length) {
              alert('There is no data for conversion. Try to do test again')
              break
            }
            const CSVResults = convertResultsToCSV(testResults)
            const bestResult = testResults.perfomanceSummary ? getBestResult(testResults.perfomanceSummary) : {}
            const propVal = {}
            testResults.paramsNames.forEach(paramName => {
              if(bestResult.hasOwnProperty(`__${paramName}`))
                propVal[paramName] = bestResult[`__${paramName}`]
            })
            await setStrategyParams(testResults.shortName, propVal)
            statusMessage(`All done.\n\n${bestResult && bestResult.hasOwnProperty(MAX_PARAM_NAME) ? 'The best ' + MAX_PARAM_NAME.replace('.', '') + ': ' + bestResult[MAX_PARAM_NAME] : ''}`)
            alert(`All done.\n\n${bestResult && bestResult.hasOwnProperty(MAX_PARAM_NAME) ? 'The best' + MAX_PARAM_NAME.replace('.', '') +': ' + bestResult[MAX_PARAM_NAME] : ''}`)
            console.log(`All done.\n\n${bestResult && bestResult.hasOwnProperty(MAX_PARAM_NAME) ? 'The best ' + MAX_PARAM_NAME + ': ' + bestResult[MAX_PARAM_NAME] : ''}`)
            saveFileAs(CSVResults, `${testResults.ticker}:${testResults.timeFrame} ${testResults.shortName} - ${testResults.cycles}.csv`)
            statusMessageRemove()
            break;
          }
          case 'downloadStrategyTestResults': {
            const testResults = await storageGetKey(STORAGE_STRATEGY_KEY_RESULTS)
            if(!testResults || (!testResults.perfomanceSummary && !testResults.perfomanceSummary.length)) {
              alert('There is no data for conversion. Try to do test again')
              break
            }
            console.log('testResults', testResults)
            const CSVResults = convertResultsToCSV(testResults)

            const bestResult = testResults.perfomanceSummary ? getBestResult(testResults.perfomanceSummary) : {}
            const propVal = {}
            testResults.paramsNames.forEach(paramName => {
              if(bestResult.hasOwnProperty(`__${paramName}`))
                propVal[paramName] = bestResult[`__${paramName}`]
            })
            await setStrategyParams(testResults.shortName, propVal)
            if(bestResult && bestResult.hasOwnProperty(MAX_PARAM_NAME))
              alert(`The best found parameters are set for the strategy\n\nThe best ${MAX_PARAM_NAME}: ` + bestResult[MAX_PARAM_NAME])
            saveFileAs(CSVResults, `${testResults.ticker}:${testResults.timeFrame} ${testResults.shortName} - ${testResults.cycles}.csv`)
            break
          }
          case 'clearAll': {
            const clearRes = await storageClearAll()
            alert(clearRes && clearRes.length ? `The data was deleted: \n${clearRes.map(item => '- ' + item).join('\n')}` : 'There was no data in the storage')
            break
          }
          default:
            console.log('None of realisation for signal:', request)

        }
      } catch (err) {
        console.error(err)
        alert(`An error has occurred.\n\nReload the page and try again.\nYou can describe the problem by following the link https://github.com/akumidv/tradingview-assistant-chrome-extension/.\n\nError message: ${err.message}`)
      }
      workerStatus = null
      statusMessageRemove()
    }
  );

  function getBestResult(perfomanceSummary, checkField = MAX_PARAM_NAME) {
    const bestResult = perfomanceSummary.reduce((curBestRes, curResult) => {
      if(curResult.hasOwnProperty(checkField) && (!curBestRes || !curBestRes[checkField] || curBestRes[checkField] < curResult[checkField]))
        return curResult

      return curBestRes
    })
    console.log('bestResult:', bestResult)
    return bestResult
  }

  function autoCloseAlert(msg, duration = 2000) {
    console.log('autoCloseAlert')
    const altEl = document.createElement("div");
    altEl.setAttribute("style","background-color: #ffeaa7;color:black; width: 450px;height: 300px;position: absolute;top:0;bottom:0;left:0;right:0;margin:auto;border: 1px solid black;font-family:arial;font-size:25px;font-weight:bold;display: flex; align-items: center; justify-content: center; text-align: center;");
    altEl.setAttribute("id","iondvAlert");
    altEl.innerHTML = msg;
    setTimeout(function() {
      altEl.parentNode.removeChild(altEl);
    }, duration);
    document.body.appendChild(altEl);
  }

  function statusMessage(msgText) {
    const isStatusPresent = document.getElementById('iondvStatus')
    const msgEl = isStatusPresent ? document.getElementById('iondvStatus') : document.createElement("div");
    if(!isStatusPresent) {
      msgEl.setAttribute("id","iondvStatus");
      msgEl.setAttribute("style","background-color: #fffcd7;" +
        "color: black;" +
        "width: 800px;" +
        "height: 150px;" +
        "position: fixed;" +
        "top: 1%;" +
        "right: 0;" +
        "left: 0;" +
        "margin: auto;" +
        "border: 1px solid lightblue;" +
        // "display: flex;" +
        "align-items: center; " +
        "justify-content: left; " +
        "text-align: left;");
    }
    if(isStatusPresent && msgEl && document.getElementById('iondvMsg')) {
      document.getElementById('iondvMsg').innerHTML = msgText
    } else {
      msgEl.innerHTML = '<div style="color: blue;font-size: 26px;margin: 5px 5px;text-align: center;">Attention!</div>' +
        '<div style="font-size: 18px;margin-bottom: 10px;margin-left: 5px;margin-right: 5px;text-align: center;">The page elements are controlled by the browser extension. Please do not click on the page elements. You can reload the page to stop it.</div>' +
        '<div id="iondvMsg" style="margin: 5px 3px">' +
        msgText + '</div>';
      if(!isStatusPresent) {
        const tvDialog = document.getElementById('overlap-manager-root')
        if(tvDialog)
          document.body.insertBefore(msgEl, tvDialog) // For avoid problem if msg overlap tv dialog window
        else
          document.body.appendChild(msgEl);
      }
    }

  }

  function statusMessageRemove() {
    const statusMessageEl = document.getElementById('iondvStatus')
    if(statusMessageEl)
      statusMessageEl.parentNode.removeChild(statusMessageEl)
  }

  function convertResultsToCSV(testResults) {
    if(!testResults.perfomanceSummary && !testResults.perfomanceSummary.length)
      return 'There is no data for conversion'
    let headers = Object.keys(testResults.perfomanceSummary[0]) // The first test table can be with error and can't have rows with previous values when parsedReport
    if(testResults.hasOwnProperty('paramsNames') && headers.length <= (Object.keys(testResults.paramsNames).length + 1)) { // Find the another header if only params names and 'comment' in headers
      const headersAll = testResults.perfomanceSummary.find(report => Object.keys(report).length > headers.length)
      if(headersAll)
        headers = Object.keys(headersAll)
    }

    let csv = headers.map(header => JSON.stringify(header)).join(',')
    csv += '\n'
    // testResults.paramsNames.forEach(paramName => csv.replace(`__${paramName}`, paramName)) // TODO isFirst? or leave it as it is
    testResults.perfomanceSummary.forEach(row => {
      const rowData = headers.map(key => typeof row[key] !== 'undefined' ? JSON.stringify(row[key]) : '')
      csv += rowData.join(',')
      csv += '\n'
    })
    return csv
  }

  function randomInteger (min = 0, max = 10) {
    return Math.floor( min + Math.random() * (max + 1 - min))
  }


  async function getOptimizedPropertiesValues(allRangeParams, testResults, method = 'random') {
    const res = {}
    const paramsNames = Object.keys(allRangeParams)
    switch(method) {
      case 'annealing': {
        break
      }
      case 'random':
      default: {
        paramsNames.forEach(param => {
          res[param] = allRangeParams[param][randomInteger(0, allRangeParams[param].length - 1)]
        })
      }
    }
    return res
  }

  function parseReportTable() {
    const strategyHeaders = []
    const allHeadersEl = document.querySelectorAll(SEL.strategyReportHeader)
    for(let headerEl of allHeadersEl) {
      if(headerEl)
        strategyHeaders.push(headerEl.innerText)
    }

    const report = {}
    const allReportRowsEl = document.querySelectorAll(SEL.strategyReportRow)
    for(let rowEl of allReportRowsEl) {
      if(rowEl) {
        const allTdEl = rowEl.querySelectorAll('td')
        if(!allTdEl || allTdEl.length < 2 || !allTdEl[0]) {
          console.log(allTdEl[0].innerText)
          continue
        }
        let paramName = allTdEl[0].innerText
        for(let i = 1; i < allTdEl.length; i++) {
          let values = allTdEl[i].innerText
          if(values && typeof values === 'string' && values.trim() && strategyHeaders[i]) {
            values = values.replace(' ', ' ').trim()
            const digitOfValues = values.match(/-?\d+\.?\d*/)
            if(values.includes('\n') && (values.endsWith('%') || values.includes('N/A'))) {
              const valuesPair = values.split('\n', 2)
              if(valuesPair && valuesPair.length == 2) {
                const digitVal0 = valuesPair[0].match(/-?\d+\.?\d*/)
                const digitVal1 = valuesPair[1].match(/-?\d+\.?\d*/)
                report[`${paramName} ${strategyHeaders[i]}`] = Boolean(digitVal0) ? parseFloat(digitVal0[0]) : valuesPair[0]
                report[`${paramName} ${strategyHeaders[i]} %`] = Boolean(digitVal1) ? parseFloat(digitVal1[0]) : valuesPair[0]
                continue
              }
            } else if(digitOfValues)
              report[`${paramName} ${strategyHeaders[i]}`] = parseFloat(digitOfValues)
            else
              report[`${paramName} ${strategyHeaders[i]}`] = values
          }
        }
      }
    }
    return report
  }

// console.log('###', calculateAdditionValuesToReport({ 'Percent Profitable All': 84, 'Ratio Avg Win / Avg Loss All': 1.78})) // Test
  function calculateAdditionValuesToReport(report) {
    if(!report.hasOwnProperty('Percent Profitable All') || !typeof report['Percent Profitable All']  === 'number' ||
      !report.hasOwnProperty('Ratio Avg Win / Avg Loss All') || !typeof report['Ratio Avg Win / Avg Loss All']  === 'number')
      return report
    report['.Percent Decimal'] = report['Percent Profitable All'] / 100
    report['.Reward'] = report['Ratio Avg Win / Avg Loss All'] * 100
    report['.Breakeven'] = (100 /(100+report['.Reward'])) + 0.2
    report['.Margin'] = report['.Percent Decimal'] - report['.Breakeven']

    return report
  }

  async function testStrategy(testResults, strategyData, allRangeParams) {
    testResults.perfomanceSummary = []
    testResults.shortName = strategyData.name
    console.log('testStrategy', testResults.shortName, testResults.cycles, 'times')
    testResults.paramsNames = Object.keys(allRangeParams)
    let maxOfSearchingValue = null
    for(let i = 0; i < testResults.cycles; i++) {
      const propVal = await getOptimizedPropertiesValues(allRangeParams, testResults)
      const isParamsSet = await setStrategyParams(testResults.shortName, propVal)
      if(!isParamsSet)
        break

      const isProcessStart = await waitForSelector(SEL.strategyReportInProcess, 1500)
      let report = {}
      let isProcessEnd = null
      let isProcessError = null
      if (isProcessStart) {
        isProcessEnd = await waitForSelector(SEL.strategyReportReady, 30000) // TODO to options
      }
      isProcessError = document.querySelector(SEL.strategyReportError)
      if(!isProcessError && isProcessEnd) {
        await waitForTimeout(150) // Waiting for update digits. 150 is enough but 250 for reliable TODO Another way?
        report = parseReportTable()
        report = calculateAdditionValuesToReport(report)
      }

      Object.keys(propVal).forEach(key => report[`__${key}`] = propVal[key])
      report['comment'] = isProcessError ? 'The tradingview error occurred when calculating the strategy based on these parameter values' :
        !isProcessStart ? 'The tradingview calculation process has not started for the strategy based on these parameter values'  :
        isProcessEnd ? '' : 'The calculation of the strategy parameters took more than 30 seconds for one combination. Testing of this combination is skipped.'
      testResults.perfomanceSummary.push(report)
      await storageSetKeys(STORAGE_STRATEGY_KEY_RESULTS, testResults)
      try {
        if(report.hasOwnProperty(MAX_PARAM_NAME)) {
          if(maxOfSearchingValue === null)
            maxOfSearchingValue = report[MAX_PARAM_NAME]
          else
            maxOfSearchingValue = maxOfSearchingValue < report[MAX_PARAM_NAME] ? report[MAX_PARAM_NAME] : maxOfSearchingValue
        }
        statusMessage(`<p>Cycle: ${i + 1}/${testResults.cycles}.</p><p>Max of ${MAX_PARAM_NAME.replace('.', '')}: ${maxOfSearchingValue}.</p>
            ${report['comment'] ? '<p style="color: red">' + report['comment'] + '</p>' : report[MAX_PARAM_NAME] ? '<p>Current ' + MAX_PARAM_NAME.replace('.', '') + ' ' + report[MAX_PARAM_NAME] + '.</p>': ''}`)
      } catch {}

    }
    return testResults
  }

  async function setStrategyParams (name, propVal) {
    const indicatorTitle = await checkAndOpenStrategy(name) // In test.name - ordinary strategy name but in strategyData.name short one as in indicator title
    if(!indicatorTitle)
      return null
    const indicProperties = document.querySelectorAll(SEL.indicatorProperty)
    const propKeys = Object.keys(propVal)
    let setResultNumber = 0
    for(let j = 0; j < indicProperties.length; j++) {
      const propText = indicProperties[j].innerText
      if(propKeys.includes(propText)) {
        setResultNumber++
        setInputElementValue(indicProperties[j + 1].querySelector('input'), propVal[propText])
        if(propKeys.length === setResultNumber)
          break
      }
    }
    // TODO check if not equal propKeys.length === setResultNumber, because there is none of changes too. So calculation doesn't start
    if(document.querySelector(SEL.okBtn))
      document.querySelector(SEL.okBtn).click()
    return true
  }

  async function checkAndOpenStrategy(name) {
    let indicatorTitleEl = document.querySelector(SEL.indicatorTitle)
    if(!indicatorTitleEl || indicatorTitleEl.innerText !== name) {
      const res = await switchToStrategyTab()
      if(!res)
        return null
      const stratParamEl = document.querySelector(SEL.strategyDialogParam)
      if(!stratParamEl) {
        alert('There is not strategy param button on the strategy tab. Test stopped. Open correct page please')
        return null
      }
      stratParamEl.click()
      const stratIndicatorEl = await waitForSelector(SEL.indicatorTitle, 2000)
      if(!stratIndicatorEl) {
        alert('There is not strategy parameters. Test stopped. Open correct page please')
        return null
      }
      const tabInputEl = document.querySelector(SEL.tabInput)
      if(!tabInputEl) {
        alert('There is not strategy parameters input tab. Test stopped. Open correct page please')
        return null
      }
      tabInputEl.click()
      const tabInputActiveEl = await waitForSelector(SEL.tabInputActive)
      if(!tabInputActiveEl) {
        alert('There is not strategy parameters active input tab. Test stopped. Open correct page please')
        return null
      }
      indicatorTitleEl = document.querySelector(SEL.indicatorTitle)
      if(!indicatorTitleEl || indicatorTitleEl.innerText !== name) {
        alert(`The ${name} strategy parameters could not be opened. Reload the page, leave one strategy on the chart and try again.`)
        return null
      }
    }
    return indicatorTitleEl
  }

  async function switchToStrategyTab() {
    let isStrategyActiveEl = document.querySelector(SEL.strategyTesterTabActive)
    if(!isStrategyActiveEl) {
      const strategyTabEl = document.querySelector(SEL.strategyTesterTab)
      if(strategyTabEl) {
        strategyTabEl.click()
      } else {
        alert('There is not strategy tester tab on the page. Open correct page please')
        return null
      }
    }
    const testResults = {}
    const tickerEl = document.querySelector(SEL.ticker)
    if(!tickerEl || !tickerEl.innerText) {
      alert('There is not symbol element on page. Open correct page please')
      return null
    }
    testResults.ticker = tickerEl.innerText
    let timeFrameEl = document.querySelector(SEL.timeFrameActive)
    if(!timeFrameEl)
      timeFrameEl = document.querySelector(SEL.timeFrame)
    if(!timeFrameEl || !timeFrameEl.innerText) {
      alert('There is not timeframe element on page. Open correct page please')
      return null
    }
    testResults.timeFrame = timeFrameEl.innerText
    const strategyCaptionEl = document.querySelector(SEL.strategyCaption)
    if(!strategyCaptionEl || !strategyCaptionEl.innerText) {
      alert('There is not stratagy name element on page. Open correct page please')
      return null
    }
    testResults.name = strategyCaptionEl.innerText

    const stratSummaryEl = await waitForSelector(SEL.strategySummary, 1000)
    if(!stratSummaryEl) {
      alert('There is not strategy performance summary tab on the page. Open correct page please')
      return null
    }
    stratSummaryEl.click()
    await waitForSelector(SEL.strategySummaryActive, 1000)
    return testResults
  }

  async function getStrategyRangeParameters(strategyData) {
    let paramRange = await storageGetKey(STORAGE_STRATEGY_KEY_PARAM)
    if(paramRange) {
      const mismatched = Object.keys(paramRange).filter(key => !Object.keys(strategyData.properties).includes(key))
      if(mismatched && mismatched.length) {
        const isDef = confirm(`The data loaded from the storage has parameters that are not present in the current strategy: ${mismatched.join(',')}.\n\nYou need to load the correct strategy in the Tradingview chart or load new parameters for the current one. \nAlternatively, you can use the default strategy optimization parameters.\n\nShould it use the default settings?`)
        if (!isDef)
          return null
        paramRange = strategyGetRange(strategyData)
      }
    } else {
      paramRange = strategyGetRange(strategyData)
    }
    console.log('paramRange', paramRange)
    await storageSetKeys(STORAGE_STRATEGY_KEY_PARAM, paramRange)
    const allRangeParams = createParamsFormRange(paramRange)
    return allRangeParams
  }

  function createParamsFormRange(paramRange) {
    const allRangeParams = {}

    Object.keys(paramRange).forEach(key => {
      allRangeParams[key] = []
      for(let i = paramRange[key][0]; i < paramRange[key][1]; i = i + paramRange[key][2])
        allRangeParams[key].push(i)
      if(allRangeParams[key][allRangeParams[key].length -1] < paramRange[key][1])
        allRangeParams[key].push(paramRange[key][1])
    })
    return allRangeParams
  }

  function saveFileAs(text, filename) {
    let aData = document.createElement('a');
    aData.setAttribute('href', 'data:text/plain;charset=urf-8,' + encodeURIComponent(text));
    aData.setAttribute('download', filename);
    aData.click();
    if (aData.parentNode)
      aData.parentNode.removeChild(aData);
  }

  function strategyGetRange(strategyData) {
    const paramRange = {}
    Object.keys(strategyData.properties).forEach(key => {
      const isInteger =  strategyData.properties[key] === Math.round(strategyData.properties[key]) // TODO or convert to string and check the point?
      if(strategyData.properties[key]) { // Not 0 or Nan
        paramRange[key] = [isInteger ? Math.floor(strategyData.properties[key] / 2) : strategyData.properties[key] / 2,
          strategyData.properties[key] * 2]
        let step = isInteger ? Math.round((paramRange[key][1] - paramRange[key][0]) / 10) : (paramRange[key][1] - paramRange[key][0]) / 10
        step = isInteger && step !== 0 ? step : paramRange[key][1] < 0 ? -1 : 1 // TODO or set paramRange[key][1]?
        paramRange[key].push(step)
      }
    })
    return paramRange
  }
  function strategyRangeToTemplate(paramRange) {
    let csv = 'Parameter,From,To,Step\n'
    Object.keys(paramRange).forEach(key => {
      csv += `${JSON.stringify(key)},${paramRange[key][0]},${paramRange[key][1]},${paramRange[key][2]}\n`
    })
    return csv
  }

  async function getStrategy(strategyName) {
    let strategyData = {}
    const indicatorLegendsEl = document.querySelectorAll(SEL.tvLegendIndicatorItem)
    if(!indicatorLegendsEl)
      return null
    for(let indicatorItemEl of indicatorLegendsEl) {
      const indicatorTitleEl = indicatorItemEl.querySelector(SEL.tvLegendIndicatorItemTitle)
      if(!indicatorTitleEl)
        continue
      if(strategyName) {
       if(strategyName !== indicatorTitleEl.innerText)
         continue
      }
      mouseClick(indicatorTitleEl)
      mouseClick(indicatorTitleEl)
      const dialogTitle = await waitForSelector(SEL.indicatorTitle, 2500)
      if(!dialogTitle || !dialogTitle.innerText)
         continue
      let isPropertiesTab = document.querySelector(SEL.tabProperties) // For strategy only
      if(isPropertiesTab) {
        strategyData = {name: dialogTitle.innerText, properties: {}}
        if(await tvDialogChangeTabToInput()) {
          const indicProperties = document.querySelectorAll(SEL.indicatorProperty)
          for(let i = 0; i < indicProperties.length; i++) {
            const propClassName = indicProperties[i].getAttribute('class')
            if(propClassName.includes('topCenter-')) {  // Two rows, also have first in class name
              i++ // Skip get the next cell because it content values
              continue // Doesn't realise to manage this kind of properties (two rows)
            } else if (propClassName.includes('first-')) {
              const propText = indicProperties[i].innerText
              i++
              if(indicProperties[i]) {
                if(indicProperties[i].querySelector('input')) {
                  let propValue = indicProperties[i].querySelector('input').value
                  if(indicProperties[i].querySelector('input').getAttribute('inputmode') === 'numeric') {
                    propValue = parseFloat(propValue) == parseInt(propValue) ? parseInt(propValue) : parseFloat(propValue)  // TODO how to get float from param or just  search point in string
                    if(!isNaN(propValue))
                      strategyData.properties[propText] = propValue
                  } else {
                    strategyData.properties[propText] = propValue // TODO get all other values from list  // TODO not only inputmode==numbers input have digits
                  }
                }
                else if(indicProperties[i].querySelector('span[role="button"]')) { // TODO as list
                  continue
                //   strategyData.properties[propText] = indicProperties[i].querySelector('span[role="button"]').innerText
                }
              }
            } else if (propClassName.includes('fill-')) {
              continue // Doesn't realise to manage this kind of properties (bool)
            }
          }
        } else {
          console.error(`Can't set parameters tab to input`)
        }
        document.querySelector(SEL.okBtn).click()
        break
      }
      document.querySelector(SEL.okBtn).click()
    }
    return strategyData
  }

  function parseCSVLine(text) {
    return text.match( /\s*(\".*?\"|'.*?'|[^,]+)\s*(,|$)/g ).map(function (text) {
      let m;
      if (m = text.match(/^\s*\"(.*?)\"\s*,?$/)) return m[1]; // Double Quoted Text
      if (m = text.match(/^\s*'(.*?)'\s*,?$/)) return m[1]; // Single Quoted Text
      if (m = text.match(/^\s*(true|false)\s*,?$/)) return m[1] === "true"; // Boolean
      if (m = text.match(/^\s*((?:\+|\-)?\d+)\s*,?$/)) return parseInt(m[1]); // Integer Number
      if (m = text.match(/^\s*((?:\+|\-)?\d*\.\d*)\s*,?$/)) return parseFloat(m[1]); // Floating Number
      if (m = text.match(/^\s*(.*?)\s*,?$/)) return m[1]; // Unquoted Text
      return text;
    } );
  }

  function parseCSV2JSON(s, sep=',') {
    const csv = s.split(/\r\n|\r|\n/g).filter(item => item).map(line => parseCSVLine(line))
    if(!csv || csv.length <= 1) return []
    const headers = csv[0].map(item => item.toLowerCase())
    const JSONData = csv.slice(1).map((line) => {
      const lineObj = {}
      line.forEach((value, line_index) => lineObj[headers[line_index]] = value)
      return lineObj
    })
    return JSONData;
  }

  async function uploadFiles (handler, endOfMsg, isMultiple = false) {
    let fileUploadEl = document.createElement('input');
    fileUploadEl.type = 'file';
    if(isMultiple)
      fileUploadEl.multiple = 'multiple';
    fileUploadEl.addEventListener('change', async () => {
      let message = isMultiple ? 'File upload results:\n' : 'File upload result:\n'
      for(let file of fileUploadEl.files) {
        message += await handler(file)
      }
      message += endOfMsg ? '\n' + endOfMsg : ''
      alert(message)
      isMsgShown = false
    });
    fileUploadEl.click();
  }

  async function parseCSVFile (fileData) {
    return new Promise((resolve, reject) => {
      const CSV_FILENAME = fileData.name
      const isCSV = CSV_FILENAME.toLowerCase().endsWith('.csv')
      if(!isCSV) return reject(`please upload correct file.`)
      const reader = new FileReader();
      reader.addEventListener('load', async (event) => {
        if(!event.target.result) return reject(`there error when loading content from the file ${CSV_FILENAME}`)
        const CSV_VALUE = event.target.result
        try {
          const csvData = parseCSV2JSON(CSV_VALUE)
          if (csvData && csvData.length)
            return resolve(csvData)
        } catch (err) {
          console.error(err)
          return reject(`CSV parsing error: ${err.message}`)
        }
        return reject(`there is no data in the file`)
      })
      return reader.readAsText(fileData);
    });
  }

  function shiftToTimeframe(data, tfValues, tfType) {
    switch (tfType.toLowerCase()) {
      case 'd':
        return data.map(dt => {
          if(dt.getUTCDate() % tfValues !== 0) {
            dt.setUTCDate(dt.getUTCDate() - dt.getUTCDate() % tfValues)
          }
          dt.setUTCHours(0, 0, 0, 0)
          return dt
        })
      case 'h':
        return data.map(dt => {
          if(dt.getUTCHours() % tfValues !== 0)
            dt.setUTCHours(dt.getUTCHours() - dt.getUTCHours() % tfValues, 0, 0, 0)
          else
            dt.setUTCMinutes( 0, 0, 0)
          return dt
        })
      case 'm':
        return data.map(dt => {
          if(dt.getUTCMinutes() % tfValues !== 0)
            dt.setUTCMinutes( dt.getUTCMinutes() - dt.getUTCMinutes() % tfValues, 0, 0)
          else
            dt.setUTCSeconds( 0, 0)
          return dt
        })
      default:
        return []
    }
  }

  function parseTF(tf) {
    if(tf.length < 2)
      return [null, null]
    const tfType = (tf[tf.length - 1]).toLowerCase()
    const tfVal = parseInt(tf.substring(0, tf.length - 1), 10)
    if(tfVal)
      return [tfVal, tfType]
    return [null, null]
  }

  async function parseTSSignalsAndGetMsg (fileData) {
    try {
      const csvData = await parseCSVFile(fileData)
      const headers = Object.keys(csvData[0])
      const missColumns = ['timestamp', 'ticker', 'timeframe', 'signal'].filter(columnName => !headers.includes(columnName))
      if(missColumns && missColumns.length)
        return `  - ${fileData.name}: There is no column(s) "${missColumns.join(', ')}" in CSV. Please add all necessary columns to CSV like showed in the template. Uploading canceled.\n`
      const tickersAndTFSignals = {}
      for(let row of csvData) { // Prepare timestamp arrays
        if(row['timestamp'] && row['signal'] && row['ticker'] && row['timeframe'] && row['timeframe'].length >= 2) {
          try {
            const [tfVal, tfType] = parseTF(row['timeframe'])
            if(!['h', 'm', 'd'].includes(tfType) || !(tfVal > 0))
              return `  - ${fileData.name}: only minute(m) and hour(h) timeframes are supported. There is a timeframe '${row['timeframe']}' in the file. Uploading canceled.\n`
            const tktfName = `${row['ticker']}::${tfVal}${tfType}`.toLowerCase()
            if(!tickersAndTFSignals.hasOwnProperty(tktfName))
              tickersAndTFSignals[tktfName] = {tsBuy: [], tsSell: []}
            const ts = new Date(row['timestamp'])
            if(!isNaN(ts.getTime())) {
              if(row['signal'].toLowerCase().includes('buy'))
                tickersAndTFSignals[tktfName].tsBuy.push(ts)
              else if (row['signal'].toLowerCase().includes('sell'))
                tickersAndTFSignals[tktfName].tsSell.push(ts)
            } else {
              console.error(`Timestamp ${row['timestamp']} ${typeof(row['timestamp'])} isn't valid`)
            }
          } catch (err) {
            console.error(err)
          }
        }
      }
      let msgArr = []
      for(let tktfName of Object.keys(tickersAndTFSignals)) {
        try {
          const tf = tktfName.split('::').pop()
          const [tfVal, tfType] = parseTF(tf)
          if(!tfVal || !tfType) continue
          const buyArr = shiftToTimeframe(tickersAndTFSignals[tktfName].tsBuy, tfVal, tfType)
          const buyConv = buyArr.map(dt => dt.getTime())
          const sellArr = shiftToTimeframe(tickersAndTFSignals[tktfName].tsSell,  tfVal, tfType)
          const sellConv = sellArr.map(dt => dt.getTime())
          await storageSetKeys(`${STORAGE_SIGNALS_KEY_PREFIX}_${tktfName}`,  {buy: buyConv.filter((item, idx) => buyConv.indexOf(item) === idx).join(','),
                                                sell: sellConv.filter((item, idx) => sellConv.indexOf(item) === idx).join(','),
                                                loadData: (new Date()).toISOString()})
          console.log(`For ${tktfName} loaded ${buyConv.length + sellConv.length} timestamps`)
          msgArr.push(`${tktfName} (${buyConv.length + sellConv.length})`)
        } catch (err) {
          console.error(err)
        }
      }
      return `- ${fileData.name}. Timestamps saved for tickers: ${msgArr.join(', ')}. Data saved in storage.\n`
    } catch (err) {
      console.error(fileData.name)
      console.error(err)
      return `- ${fileData.name}: ${err.message}\n`
    }
  }

  async function parseStrategyParamsAndGetMsg (fileData) {
    console.log('parsStrategyParamsAndGetMsg filename', fileData)
    const paramRange = {}
    const csvData = await parseCSVFile(fileData)
    const headers = Object.keys(csvData[0])
    const missColumns = ['parameter','from','to','step'].filter(columnName => !headers.includes(columnName.toLowerCase()))
    if(missColumns && missColumns.length)
      return `  - ${fileData.name}: There is no column(s) "${missColumns.join(', ')}" in CSV. Please add all necessary columns to CSV like showed in the template. Uploading canceled.\n`
    csvData.forEach(row => paramRange[row['parameter']] = [row['from'], row['to'], row['step']])
    await storageSetKeys(STORAGE_STRATEGY_KEY_PARAM, paramRange)
    return `The data was saved in the storage. To use them for repeated testing, click on the "Test strategy" button in the extension pop-up window.`
  }

  async function storageSetKeys(storageKey, value) {
    const storageData = {}
    storageData[`${STORAGE_KEY_PREFIX}_${storageKey}`] = value
    return new Promise (resolve => {
      chrome.storage.local.set(storageData, () => {
        resolve()
      })
    })
  }

  async function storageGetKey(storageKey) {
    const getParam = storageKey === null ? null : Array.isArray(storageKey) ? storageKey.map(item => `${STORAGE_KEY_PREFIX}_${item}`) : `${STORAGE_KEY_PREFIX}_${storageKey}`
    return new Promise (resolve => {
      chrome.storage.local.get(getParam, (getResults) => {
        if(storageKey === null) {
          const storageData = {}
          Object.keys(getResults).filter(key => key.startsWith(STORAGE_KEY_PREFIX)).forEach(key => storageData[key] = getResults[key])
          return resolve(storageData)
        } else if(!getResults.hasOwnProperty(`${STORAGE_KEY_PREFIX}_${storageKey}`)) {
          return resolve(null)
        }
        return resolve(getResults[`${STORAGE_KEY_PREFIX}_${storageKey}`])
      })
    })
  }

  async function storageRemoveKey(storageKey) {
    return new Promise (resolve => {
      chrome.storage.local.remove(storageKey, () => {
        resolve()
      })
    })
  }

  async function storageClearAll() {
    const allStorageKey = await storageGetKey(null)
    await storageRemoveKey(Object.keys(allStorageKey))
    return Object.keys(allStorageKey)
  }
  function mouseTrigger (el, eventType) {
    var clickEvent = document.createEvent ('MouseEvents');
    clickEvent.initEvent (eventType, true, true);
    el.dispatchEvent (clickEvent);
  }
  function mouseClick (el) {
    mouseTrigger (el, "mouseover");
    mouseTrigger (el, "mousedown");
    mouseTrigger (el, "mouseup");
    mouseTrigger (el, "click");
  }
  const waitForTimeout = async (timeout = 2500) => new Promise(resolve => setTimeout(resolve, timeout))

  async function waitForSelector(selector, timeout = 5000, isHide = false, parentEl) {
    parentEl = parentEl ? parentEl : document
    return new Promise(async (resolve) => {
      let iter = 0
      let elem
      const tikTime = timeout === 0 ? 1000 : 50
      do {
        await waitForTimeout(tikTime)
        elem = parentEl.querySelector(selector)
        iter += 1
      } while ((timeout === 0 ? true : (tikTime * iter) < timeout) && (isHide ? !!elem : !elem))
      // if(isHide ? elem : !elem ) {
      //   console.error(isHide ? `waitingForSelector: still present ${selector}` : `waitingForSelector: still absent ${selector}`)
      // }
      resolve(elem)
    });
  }

  function getTextForSel(selector, elParent) {
    elParent = elParent ? elParent : document
    const element = elParent.querySelector(selector)
    return element ? element.innerText : null
  }

  const reactValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  const inputEvent = new Event('input', { bubbles: true});
  const changeEvent = new Event('change', { bubbles: true});

  function setInputElementValue (element, value, isChange = false) {
    reactValueSetter.call(element, value)
    element.dispatchEvent(inputEvent);
    if(isChange) element.dispatchEvent(changeEvent);
  }

  async function tvDialogChangeTabToInput() {
    let isInputTabActive = document.querySelector(SEL.tabInputActive)
    if(isInputTabActive) return true
    document.querySelector(SEL.tabInput).click()
    isInputTabActive = await waitForSelector(SEL.tabInputActive, 2000)
    return isInputTabActive ? true : false
  }

  async function tvDialogHandler () {
    const indicatorTitle = getTextForSel(SEL.indicatorTitle)
    if(!document.querySelector(SEL.okBtn) || !document.querySelector(SEL.tabInput))
      return
    if(indicatorTitle === 'iondvSignals' && workerStatus === null) {
      let tickerText = document.querySelector(SEL.ticker).innerText
      let timeFrameText = document.querySelector(SEL.timeFrame).innerText
      if(!tickerText || !timeFrameText)
        return
      timeFrameText = timeFrameText.toLowerCase() === 'd' ? '1D' : timeFrameText
      if (isMsgShown && tickerText === tickerTextPrev && timeFrameText === timeFrameTextPrev)
        return
      tickerTextPrev = tickerText
      timeFrameTextPrev = timeFrameText

      if(!await tvDialogChangeTabToInput()) {
        console.error(`Can't set parameters tab to input`)
        isMsgShown = true
        return
      }

      console.log("Tradingview indicator parameters window opened for ticker:", tickerText);
      const tsData = await storageGetKey(`${STORAGE_SIGNALS_KEY_PREFIX}_${tickerText}::${timeFrameText}`.toLowerCase())
      if(tsData === null) {
        alert(`No data was loaded for the ${tickerText} and timeframe ${timeFrameText}.\n\n` +
          `Please change the ticker and timeframe to correct and reopen script parameter window.`)
        isMsgShown = true
        return
      }
      isMsgShown = false

      const indicProperties = document.querySelectorAll(SEL.indicatorProperty)

      const propVal = {
        TSBuy: tsData && tsData.hasOwnProperty('buy') ? tsData.buy : '',
        TSSell: tsData && tsData.hasOwnProperty('sell') ? tsData.sell : '',
        Ticker: tickerText,
        Timeframe: timeFrameText
      }
      const setResult = []
      const propKeys = Object.keys(propVal)
      for(let i = 0; i < indicProperties.length; i++) {
        const propText = indicProperties[i].innerText
        if(propKeys.includes(propText)) {
          setResult.push(propText)
          setInputElementValue(indicProperties[i + 1].querySelector('input'), propVal[propText])
          if(propKeys.length === setResult.length)
            break
        }
      }
      const notFoundParam = propKeys.filter(item => !setResult.includes(item))
      if(notFoundParam && notFoundParam.length) {
        alert(`One of the parameters named ${notFoundParam} was not found in the window. Check the script.\n`)
        isMsgShown = true
        return
      }
      document.querySelector(SEL.okBtn).click()
      const allSignals = [].concat(tsData.buy.split(','),tsData.sell.split(',')).sort()
      alert(`${allSignals.length} signals are set.\n  - date of the first signal: ${new Date(parseInt(allSignals[0]))}.\n  - date of the last signal: ${new Date(parseInt(allSignals[allSignals.length - 1]))}`)
      isMsgShown =  true
    }
  }

  const dialogWindowNode = await waitForSelector(SEL.tvDialogRoot, 0)
  if(dialogWindowNode) {
    const tvObserver = new MutationObserver(tvDialogHandler);
    tvObserver.observe(dialogWindowNode, {
      childList: true,
      subtree: true,
      attributes: false,
      characterData: false
    });
    await tvDialogHandler() // First run
  }


})();
