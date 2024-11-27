const tv = {
  reportNode: null,
  reportDeepNode: null,
  tickerTextPrev: null,
  timeFrameTextPrev: null,
  isReportChanged: false
}


const SUPPORT_TEXT = 'Please retry. <br />If the problem reproduced then it is possible that TV UI changed. Create task on' +
        '<a href="https://github.com/akumidv/tradingview-assistant-chrome-extension/issues/" target="_blank"> github</a> please (check before if it isn\'t alredy created)'

// Inject script to get access to TradingView data on page
const script = document.createElement('script');
script.src = chrome.runtime.getURL('page-context.js');
document.documentElement.appendChild(script);

const scriptPlot = document.createElement('script');
scriptPlot.src = chrome.runtime.getURL('lib/plotly.min.js')
document.documentElement.appendChild(scriptPlot);

const tvPageMessageData = {}

window.addEventListener('message', messageHandler)


async function messageHandler(event) {
  const url =  window.location && window.location.origin ? window.location.origin : 'https://www.tradingview.com'
  if (!event.origin.startsWith(url) || !event.data ||
      !event.data.hasOwnProperty('name') || event.data.name !== 'iondvPage' ||
      !event.data.hasOwnProperty('action'))
    return
  if (tvPageMessageData.hasOwnProperty(event.data.action) && typeof (tvPageMessageData[event.data.action]) === 'function') { // Callback
    const resolve = tvPageMessageData[event.data.action]
    delete tvPageMessageData[event.data.action]
    resolve(event.data)
  } else {
    tvPageMessageData[event.data.action] = event.data.data
  }
}


tv.getStrategy = async (strategyName = '', isIndicatorSave = false) => {
  let indicatorName = null
  if(strategyName !== null) {
    if (!strategyName) {
      await tv.openStrategyTab()
      let strategyCaptionEl = document.querySelector(SEL.strategyCaption)
      if(!strategyCaptionEl || !strategyCaptionEl.innerText) {
        throw new Error('There is not strategy name element on "Strategy tester" tab.' + SUPPORT_TEXT)
      }
      indicatorName = strategyCaptionEl.innerText

      let stratParamEl = document.querySelector(SEL.strategyDialogParam)
      if(!stratParamEl) {
        throw new Error('There is not strategy param button on the "Strategy tester" tab.' + SUPPORT_TEXT)
      }
      page.mouseClick(stratParamEl)
      const dialogTitle = await page.waitForSelector(SEL.indicatorTitle, 7500)
      if (!dialogTitle || !dialogTitle.innerText) {
        if (document.querySelector(SEL.cancelBtn))
          document.querySelector(SEL.cancelBtn).click()
        throw new Error('The strategy parameter windows is not opened.' +  SUPPORT_TEXT)
      }

      let isStrategyPropertiesTab = document.querySelector(SEL.tabProperties) // For strategy only
      if (isIndicatorSave || isStrategyPropertiesTab) {
        indicatorName = dialogTitle.innerText
      }
    } else {
      const indicatorLegendsEl = document.querySelectorAll(SEL.tvLegendIndicatorItem)
      if(!indicatorLegendsEl)
        return null
      for(let indicatorItemEl of indicatorLegendsEl) {
        const indicatorTitleEl = indicatorItemEl.querySelector(SEL.tvLegendIndicatorItemTitle)
        if (!indicatorTitleEl)
          continue
        if (strategyName && strategyName !== indicatorTitleEl.innerText)
          continue

        page.mouseClick(indicatorTitleEl)
        page.mouseClick(indicatorTitleEl)
        const dialogTitle = await page.waitForSelector(SEL.indicatorTitle, 2500)
        if (!dialogTitle || !dialogTitle.innerText) {
          if (document.querySelector(SEL.cancelBtn))
            document.querySelector(SEL.cancelBtn).click()
          continue
        }
        let isStrategyPropertiesTab = document.querySelector(SEL.tabProperties) // For strategy only
        if (isIndicatorSave || isStrategyPropertiesTab) {
          indicatorName = dialogTitle.innerText
          break
        }
      }
    }
  } else {
    let dialogTitleEl = await page.waitForSelector(SEL.indicatorTitle, 2500)
    if (!dialogTitleEl || !dialogTitleEl.innerText) {
      await page.mouseClickSelector(SEL.cancelBtn)
      await tv.openStrategyTab()
      await tv.openCurrentStrategyParam()
      dialogTitleEl = await page.$(SEL.indicatorTitle)
    }
    let isStrategyPropertiesTab = document.querySelector(SEL.tabProperties) // For strategy only
    if (isIndicatorSave || isStrategyPropertiesTab) {
      indicatorName = dialogTitleEl.innerText
    }
  }
  if(indicatorName === null)
    throw new Error('It was not possible to find a strategy with parameters among the indicators. Add it to the chart and try again.')
    // return strategyData

  if(!await tv.changeDialogTabToInput())
    throw new Error(`Can\'t activate input tab in strategy parameters`  +  SUPPORT_TEXT)
  // if(await tv.changeDialogTabToInput()) {

  // } else {
  //   console.error(`Can't set parameters tab to input`)
  // }
  const strategyInputs = await tv.getStrategyParams(isIndicatorSave)
  const strategyData = {name: indicatorName, properties: strategyInputs}

  if (document.querySelector(SEL.cancelBtn)) {
    document.querySelector(SEL.cancelBtn).click()
    await page.waitForSelector(SEL.cancelBtn, 1000, true)
  }

  return strategyData
}

tv.getStrategyParams = async (isIndicatorSave=false) => {
  const strategyInputs = {} // TODO to list of values and set them in the same order
    const indicProperties = document.querySelectorAll(SEL.indicatorProperty)
    for (let i = 0; i < indicProperties.length; i++) {
      const propClassName = indicProperties[i].getAttribute('class')
      const propText = indicProperties[i].innerText
      if(!propClassName || !propText) // Undefined type of element
        continue
      if(propClassName.includes('topCenter-')) {  // Two rows, also have first in class name
        i++ // Skip get the next cell because it content values
        continue // Doesn't realise to manage this kind of properties (two rows)
      } else if (propClassName.includes('first-') && indicProperties[i].innerText) {
        i++
        if (indicProperties[i] && indicProperties[i].querySelector('input')) {
          let propValue = indicProperties[i].querySelector('input').value
          if(indicProperties[i].querySelector('input').getAttribute('inputmode') === 'numeric' ||
            (parseFloat(propValue) == propValue || parseInt(propValue) == propValue)) { // not only inputmode==numbers input have digits
            const digPropValue = parseFloat(propValue) == parseInt(propValue) ? parseInt(propValue) : parseFloat(propValue)  // Detection if float or int in the string
            if(!isNaN(propValue))
              strategyInputs[propText] = digPropValue
            else
              strategyInputs[propText] = propValue
          } else {
            strategyInputs[propText] = propValue
          }
        } else if(indicProperties[i].querySelector('span[role="button"]')) { // List
          const buttonEl = indicProperties[i].querySelector('span[role="button"]')
          if(!buttonEl)
            continue
          const propValue = buttonEl.innerText
          if(propValue) {
            if(isIndicatorSave) {
              strategyInputs[propText] = propValue
              continue
            }
            buttonEl.scrollIntoView()
            await page.waitForTimeout(100)
            page.mouseClick(buttonEl)
            const isOptions = await page.waitForSelector(SEL.strategyListOptions, 1000)
            if(isOptions) {
              const allOptionsEl = document.querySelectorAll(SEL.strategyListOptions)
              let allOptionsList = propValue + ';'
              for(let optionEl of allOptionsEl) {
                if(optionEl && optionEl.innerText && optionEl.innerText !== propValue) {
                  allOptionsList += optionEl.innerText + ';'
                }
              }
              if(allOptionsList)
                strategyInputs[propText] = allOptionsList
              page.mouseClick(buttonEl)
            } else {
              strategyInputs[propText] = propValue
            }
          }
        } else { // Undefined
          continue
        }
      } else if (propClassName.includes('fill-')) {
        const element = indicProperties[i].querySelector('input[type="checkbox"]')
        if(element)
          strategyInputs[propText] = element.getAttribute('checked') !== null ? element.checked : false
        else { // Undefined type of element
          continue
        }
      } else if (propClassName.includes('titleWrap-')) { // Titles bwtwen parameters
        continue
      } else { // Undefined type of element
        continue
      }
    }
    return strategyInputs
}

tv.setStrategyParams = async (name, propVal, isCheckOpenedWindow = false) => {
  if(isCheckOpenedWindow) {
    const indicatorTitleEl = document.querySelector(SEL.indicatorTitle)
    if(!indicatorTitleEl || indicatorTitleEl.innerText !== name) {
      return null
    }
  } else {
    const indicatorTitleEl = await tv.checkAndOpenStrategy(name) // In test.name - ordinary strategy name but in strategyData.name short one as in indicator title
    if(!indicatorTitleEl)
      return null
  }
  const indicProperties = document.querySelectorAll(SEL.indicatorProperty)
  const propKeys = Object.keys(propVal)
  let setResultNumber = 0
  let setPropertiesNames = {}
  for(let i = 0; i < indicProperties.length; i++) {
    const propText = indicProperties[i].innerText
    if(propText && propKeys.includes(propText)) {
      setPropertiesNames[propText] = true
      setResultNumber++
      const propClassName = indicProperties[i].getAttribute('class')
      if (propClassName.includes('first-')) {
        i++
        if(indicProperties[i].querySelector('input')) {
          page.setInputElementValue(indicProperties[i].querySelector('input'), propVal[propText])
        } else if(indicProperties[i].querySelector('span[role="button"]')) { // List
          const buttonEl = indicProperties[i].querySelector('span[role="button"]')
          if(!buttonEl || !buttonEl.innerText)
            continue
          buttonEl.scrollIntoView()
		      await page.waitForTimeout(100)
          page.mouseClick(buttonEl)
          page.setSelByText(SEL.strategyListOptions, propVal[propText])
        }
      } else if (propClassName.includes('fill-')) {
        const checkboxEl = indicProperties[i].querySelector('input[type="checkbox"]')
        if(checkboxEl) {
			// const isChecked = checkboxEl.getAttribute('checked') !== null ? checkboxEl.checked : false
          const isChecked = Boolean(checkboxEl.checked)
          if(Boolean(propVal[propText]) !== isChecked) {
            page.mouseClick(checkboxEl)
            checkboxEl.checked = Boolean(propVal[propText])
          }
        }
      }
      setResultNumber = Object.keys(setPropertiesNames).length
      if(propKeys.length === setResultNumber)
        break
    }
  }
  // TODO check if not equal propKeys.length === setResultNumber, because there is none of changes too. So calculation doesn't start
  if(!isCheckOpenedWindow && document.querySelector(SEL.okBtn))
    document.querySelector(SEL.okBtn).click()
  return true
}

tv.changeDialogTabToInput = async () => {
  let isInputTabActive = document.querySelector(SEL.tabInputActive)
  if(isInputTabActive) return true
  const inputTabEl = document.querySelector(SEL.tabInput)
  if (!inputTabEl) {
    throw new Error('There are no parameters in this strategy that can be optimized (There is no "Inputs" tab with input values)')
  }
  inputTabEl.click()
  isInputTabActive = await page.waitForSelector(SEL.tabInputActive, 2000)
  return isInputTabActive ? true : false
}


tv.openCurrentStrategyParam = async () => {
  let stratParamEl = document.querySelector(SEL.strategyDialogParam)
  if(!stratParamEl) {
    await ui.showErrorPopup('There is not strategy param button on the strategy tab. Test stopped. Open correct page please')
    return null
  }
  stratParamEl.click()
  const stratIndicatorEl = await page.waitForSelector(SEL.indicatorTitle, 2000)
  if(!stratIndicatorEl) {
    await ui.showErrorPopup('There is not strategy parameters. Test stopped. Open correct page please')
    return null
  }
  const tabInputEl = document.querySelector(SEL.tabInput)
  if(!tabInputEl) {
    await ui.showErrorPopup('There is not strategy parameters input tab. Test stopped. Open correct page please')
    return null
  }
  tabInputEl.click()
  const tabInputActiveEl = await page.waitForSelector(SEL.tabInputActive)
  if(!tabInputActiveEl) {
    await ui.showErrorPopup('There is not strategy parameters active input tab. Test stopped. Open correct page please')
    return null
  }
  return true
}

tv.setDeepTest = async (isDeepTest, deepStartDate = null) => {
  const deepCheckboxEl = await page.waitForSelector(SEL.strategyDeepTestCheckbox)
  if (!deepCheckboxEl && !isDeepTest)
    return
  if (isDeepTest && !deepCheckboxEl)
    throw new Error('Deep Backtesting mode switch not found. Do you have Premium subscription or may be TV UI changed?')
  const isChecked = Boolean(deepCheckboxEl.checked)
  if(isDeepTest !== isChecked) {
    page.mouseClick(deepCheckboxEl)
    deepCheckboxEl.checked = isDeepTest
  }
  if (isDeepTest && deepStartDate) {
    const startDateEl = await page.waitForSelector(SEL.strategyDeepTestStartDate)
    if (startDateEl) {
      page.setInputElementValue(startDateEl, deepStartDate)
    }
  }
}

tv.checkAndOpenStrategy = async (name) => {
  let indicatorTitleEl = document.querySelector(SEL.indicatorTitle)
  if(!indicatorTitleEl || indicatorTitleEl.innerText !== name) {
    try {
      await tv.switchToStrategyTab()
    } catch {
      return null
    }
    if(!await tv.openCurrentStrategyParam())
      return null
    indicatorTitleEl = document.querySelector(SEL.indicatorTitle)
    if(!indicatorTitleEl || indicatorTitleEl.innerText !== name) {
      await ui.showErrorPopup(`The ${name} strategy parameters could not opened. ${indicatorTitleEl.innerText ? 'Opened "' + indicatorTitleEl.innerText + '".' : ''} Reload the page, leave one strategy on the chart and try again.`)
      return null
    }
  }
  return indicatorTitleEl
}

tv.openStrategyTab = async () => {
  let isStrategyActiveEl = await page.waitForSelector(SEL.strategyTesterTabActive)
  if(!isStrategyActiveEl) {
    const strategyTabEl = await page.waitForSelector(SEL.strategyTesterTab)
    if(strategyTabEl) {
      strategyTabEl.click()
      await page.waitForSelector(SEL.strategyTesterTabActive)
    } else {
      throw new Error('There is not "Strategy Tester" tab on the page. Open correct page.' + SUPPORT_TEXT)
    }
  }
  return true
}


tv.switchToStrategyTab = async () => {
  await tv.openStrategyTab()
  const testResults = {}


  testResults.ticker = await tvChart.getTicker()
  testResults.timeFrame = await tvChart.getCurrentTimeFrame()

  let strategyCaptionEl = document.querySelector(SEL.strategyCaption) // 2023-02-24 Changed to more complicated logic - for single and multiple strategies in page
  // strategyCaptionEl = !strategyCaptionEl ? document.querySelector(SEL.strategyCaptionNew) : strategyCaptionEl // From 2022-11-13
  if(!strategyCaptionEl) { // || !strategyCaptionEl.innerText) {
    throw new Error('There is not strategy name element on "Strategy Tester" tab.' + SUPPORT_TEXT)
  }
  testResults.name = strategyCaptionEl.getAttribute('data-strategy-title') //strategyCaptionEl.innerText


  let stratSummaryEl = await page.waitForSelector(SEL.strategySummary, 1000)
  if(!stratSummaryEl) {
    throw new Error('There is not "Performance summary" tab on the page. Open correct page.' + SUPPORT_TEXT)
  }
  if (!page.$(SEL.strategySummaryActive))
    stratSummaryEl.click()
  const isActive = await page.waitForSelector(SEL.strategySummaryActive, 1000)
  if (!isActive) {
    console.error('The "Performance summary" tab is not active after click')
  }

  await page.waitForSelector(SEL.strategyReportObserveArea, 10000)
  if(!tv.reportNode) {
    // tv.reportNode = await page.waitForSelector(SEL.strategyReport, 10000)
    tv.reportNode = await page.waitForSelector(SEL.strategyReportObserveArea, 10000)
    if(tv.reportNode) {
      const reportObserver = new MutationObserver(()=> {
        tv.isReportChanged = true
      });
      console.log('SET DEEP TEST OBSERVE AREA')
      reportObserver.observe(tv.reportNode, {
        childList: true,
        subtree: true,
        attributes: false,
        characterData: false
      });
    } else {
      throw new Error('The strategy report did not found.' + SUPPORT_TEXT)
    }
  }

  if(!tv.reportDeepNode) {
    tv.reportDeepNode = await page.waitForSelector(SEL.strategyReportDeepTestObserveArea, 5000)
    if(tv.reportDeepNode) {
      const reportObserver = new MutationObserver(()=> {
        tv.isReportChanged = true
      });
      reportObserver.observe(tv.reportDeepNode, {
        childList: true,
        subtree: true,
        attributes: false,
        characterData: false
      });
    } else {
      console.error('The strategy deep report did not found.')
    }
  }
  return testResults
}

tv.dialogHandler = async () => {
  const indicatorTitle = page.getTextForSel(SEL.indicatorTitle)
  if(!document.querySelector(SEL.okBtn) || !document.querySelector(SEL.tabInput))
    return
  if(indicatorTitle === 'iondvSignals' && action.workerStatus === null) {
    let tickerText = document.querySelector(SEL.ticker).innerText
    let timeFrameEl = document.querySelector(SEL.timeFrameActive)
    if(!timeFrameEl)
      timeFrameEl = document.querySelector(SEL.timeFrame)


    let timeFrameText = timeFrameEl.innerText
    if(!tickerText || !timeFrameText)
      // ui.alertMessage('There is not timeframe element on page. Open correct page please')
      return

    timeFrameText = timeFrameText.toLowerCase() === 'd' ? '1D' : timeFrameText
    if (ui.isMsgShown && tickerText === tv.tickerTextPrev && timeFrameText === tv.timeFrameTextPrev)
      return
    tv.tickerTextPrev = tickerText
    tv.timeFrameTextPrev = timeFrameText

    if(!await tv.changeDialogTabToInput()) {
      console.error(`Can't set parameters tab to input`)
      ui.isMsgShown = true
      return
    }

    console.log("Tradingview indicator parameters window opened for ticker:", tickerText);
    const tsData = await storage.getKey(`${storage.SIGNALS_KEY_PREFIX}_${tickerText}::${timeFrameText}`.toLowerCase())
    if(tsData === null) {
      await ui.showErrorPopup(`No data was loaded for the ${tickerText} and timeframe ${timeFrameText}.\n\n` +
        `Please change the ticker and timeframe to correct and reopen script parameter window.`)
      ui.isMsgShown = true
      return
    }
    ui.isMsgShown = false

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
        page.setInputElementValue(indicProperties[i + 1].querySelector('input'), propVal[propText])
        if(propKeys.length === setResult.length)
          break
      }
    }
    const notFoundParam = propKeys.filter(item => !setResult.includes(item))
    if(notFoundParam && notFoundParam.length) {
      await ui.showErrorPopup(`One of the parameters named ${notFoundParam} was not found in the window. Check the script.\n`)
      ui.isMsgShown = true
      return
    }
    document.querySelector(SEL.okBtn).click()
    const allSignals = [].concat(tsData.buy.split(','),tsData.sell.split(',')).sort()
    await ui.showPopup(`${allSignals.length} signals are set.\n  - date of the first signal: ${new Date(parseInt(allSignals[0]))}.\n  - date of the last signal: ${new Date(parseInt(allSignals[allSignals.length - 1]))}`)
    ui.isMsgShown = true
  }
}

tv.isParsed = false

tv.parseReportTable = async (isDeepTest) => {
  const strategyHeaders = []
  const selHeader = isDeepTest ? SEL.strategyReportDeepTestHeader : SEL.strategyReportHeader
  const selRow = isDeepTest ? SEL.strategyReportDeepTestRow : SEL.strategyReportRow
  await page.waitForSelector(selHeader, 2500)

  let allHeadersEl = document.querySelectorAll(selHeader)
  if (!allHeadersEl || !(allHeadersEl.length === 4 || allHeadersEl.length === 5)) { // 5 - Extra column for full screen
    if (!tv.isParsed)
      throw new Error('Can\'t get performance headers.' +  SUPPORT_TEXT)
    else
      return {}
  }
  for(let headerEl of allHeadersEl) {
    if(headerEl)
      strategyHeaders.push(headerEl.innerText)
  }

  const report = {}
  await page.waitForSelector(selRow, 2500)
  let allReportRowsEl = document.querySelectorAll(selRow)
  if (!allReportRowsEl || allReportRowsEl.length === 0) {
    if (!tv.isParsed)
      throw new Error('Can\'t get performance rows.'  +  SUPPORT_TEXT)
  } else {
    tv.isParsed = true
  }
  for(let rowEl of allReportRowsEl) {
    if(rowEl) {
      const allTdEl = rowEl.querySelectorAll('td')
      if(!allTdEl || allTdEl.length < 2 || !allTdEl[0]) {
        continue
      }
      let paramName = allTdEl[0].innerText
      // if (paramName === 'Net Profit') console.log('##paramName', paramName, allTdEl[1].innerText)
      let isSingleValue = allTdEl.length === 3 || ['Buy & Hold Return', 'Max Run-up', 'Max Drawdown', 'Sharpe Ratio', 'Sortino Ratio', 'Open PL'].includes(paramName)
      for(let i = 1; i <  allTdEl.length; i++) {
        if (isSingleValue && i >= 2)
          continue
        let values = allTdEl[i].innerText

        const isNegative = allTdEl[i].querySelector('[class^="negativeValue"]') && !['Avg Losing Trade', 'Largest Losing Trade', 'Gross Loss', 'Max Run-up', 'Max Drawdown'].includes(paramName)
        if(values && typeof values === 'string' && strategyHeaders[i]) {
          values = values.replaceAll(' ', ' ').replaceAll('−', '-').trim()
          const digitalValues = values.replaceAll(/([\-\d\.])|(.)/g, (a, b) => b || '')
          let digitOfValues = digitalValues.match(/-?\d+\.?\d*/)
          const nameDigits = isSingleValue ? paramName : `${paramName}: ${strategyHeaders[i]}`
          const namePercents = isSingleValue ? `${paramName} %` : `${paramName} %: ${strategyHeaders[i]}`
          if((values.includes('\n') && values.endsWith('%'))) {
            const valuesPair = values.split('\n', 2)
            if(valuesPair && valuesPair.length === 2) {
              const digitVal0 = valuesPair[0].replaceAll(/([\-\d\.])|(.)/g, (a, b) => b || '') //.match(/-?\d+\.?\d*/)
              const digitVal1 = valuesPair[1].replaceAll(/([\-\d\.])|(.)/g, (a, b) => b || '') //match(/-?\d+\.?\d*/)

              if(Boolean(digitVal0)) {
                report[nameDigits] = nameDigits.includes('Trades')? parseInt(digitVal0) : parseFloat(digitVal0)//[0])
                if (report[nameDigits] > 0 && isNegative)
                  report[nameDigits] = report[nameDigits] * -1
              } else {
                report[nameDigits] = valuesPair[0]
              }
              if(Boolean(digitVal1)) {
                report[namePercents] = namePercents.includes('Trades')? parseInt(digitVal1) : parseFloat(digitVal1) //[0])
                if (report[namePercents] > 0 && isNegative)
                  report[namePercents] = report[namePercents] * -1
              } else {
                report[namePercents] = valuesPair[1]
              }
            }
          } else if(Boolean(digitOfValues)) {
            report[nameDigits] = nameDigits.includes('Trades')? parseInt(digitalValues) : parseFloat(digitalValues)//[0])
            if (report[nameDigits] > 0 && isNegative)
              report[nameDigits] = report[nameDigits] * -1
          }   else
            report[nameDigits] = values
        }
      }
    }
  }
  return report
}

tv.generateDeepTestReport = async () => { //loadingTime = 60000) => {
  const generateBtnEl = await page.waitForSelector(SEL.strategyDeepTestGenerateBtn)
  if (generateBtnEl) {
    page.mouseClick(generateBtnEl) // // generateBtnEl.click()
    // const reportHeader = await page.waitForSelector(SEL.strategyReportHeader, loadingTime)
    // if (!reportHeader) {
    //   // if (tv.isParsed)
    //   //   return false
    //   // else
    //     throw new Error('Error waiting Performance summary table for deep backtesting.' + SUPPORT_TEXT)
    // }
  // } else if (tv.isParsed) {
  //   return false
  } else if (page.$(SEL.strategyDeepTestGenerateBtnDisabled)) {
    return ' Deep backtesting process is not started'
  } else {
    throw new Error('Error for generate deep backtesting report due the button is not exist.'  + SUPPORT_TEXT)
  }
  return ''

}

tv.getPerformance = async (testResults, isIgnoreError=false) => {
  let reportData = {}
  let message = ''
  let isProcessError = null
  let selProgress = SEL.strategyReportInProcess
  let selReady = SEL.strategyReportReady
  const dataWaitingTime = testResults.isDeepTest ? testResults.dataLoadingTime * 2000 : testResults.dataLoadingTime * 1000
  if (testResults.isDeepTest) {
    message = await tv.generateDeepTestReport() //testResults.dataLoadingTime * 2000)
    if (message)
      isProcessError = true
    selProgress = SEL.strategyReportDeepTestInProcess
    selReady = SEL.strategyReportDeepTestReady
  }

  let isProcessStart = await page.waitForSelector(selProgress, 2500)
  let isProcessEnd = tv.isReportChanged
  if (isProcessStart) {
    const tick = 100
    for(let i = 0; i < 5000/tick; i++) { // Waiting for an error 5000 ms      // isProcessEnd = await page.waitForSelector(SEL.strategyReportError, 5000)
      isProcessError = await page.waitForSelector(SEL.strategyReportError, tick)
      isProcessEnd = document.querySelector(selReady)
      if (isProcessError || isProcessEnd) {
        break
      }
    }
    if (isProcessError == null)
      isProcessEnd = await page.waitForSelector(selReady, dataWaitingTime)
  } else if (isProcessEnd)
    isProcessStart = true

  isProcessError = isProcessError || document.querySelector(SEL.strategyReportError)
  await page.waitForTimeout(250) // Waiting for update digits. 150 is enough but 250 for reliable TODO Another way?

  if (!isProcessError)
    reportData = await tv.parseReportTable(testResults.isDeepTest)
  if (!isProcessError && !isProcessEnd && testResults.perfomanceSummary.length && !testResults.isDeepTest) {
    const lastRes = testResults.perfomanceSummary[testResults.perfomanceSummary.length - 1] // (!) Previous value maybe in testResults.filteredSummary
    if(reportData.hasOwnProperty(testResults.optParamName) && lastRes.hasOwnProperty(testResults.optParamName) &&
      reportData[testResults.optParamName] !== lastRes[testResults.optParamName]) {
      isProcessEnd = true
      isProcessStart = true
    }
  }
  if (reportData['comment'])
    message += '. ' + reportData['comment']
  const comment = message ? message : testResults.isDeepTest ? 'Deep BT. ' : null
  if (comment) {
    if (reportData['comment'])
      reportData['comment'] = comment ? comment + ' ' + reportData['comment'] : reportData['comment']
    else {
      reportData['comment'] = comment
    }
  }

  return {error: isProcessError ? 2 : !isProcessStart ? 1 : !isProcessEnd ? 3 : null, message: message, data: reportData}
  // return await tv.parseReportTable()
  // TODO change the object to get data
  // function convertPercent(key, value) {
  //   if (!value)
  //     return 0
  //   return key.endsWith('Percent') || key.startsWith('percent')? value * 100 : value
  // }
  //
  // const perfDict = {
  //   'netProfit': 'Net Profit',
  //   'netProfitPercent': 'Net Profit %',
  //   'grossProfit': 'Gross Profit',
  //   'grossProfitPercent': 'Gross Profit %',
  //   'grossLoss': 'Gross Loss',
  //   'grossLossPercent': 'Gross Loss %',
  //   'maxStrategyDrawDown': 'Max Drawdown',
  //   'maxStrategyDrawDownPercent': 'Max Drawdown %',
  //   'buyHoldReturn': 'Buy & Hold Return',
  //   'buyHoldReturnPercent': 'Buy & Hold Return %',
  //   'sharpeRatio': 'Sharpe Ratio',
  //   'sortinoRatio': 'Sortino Ratio',
  //   'profitFactor': 'Profit Factor',
  //   'maxContractsHeld': 'Max Contracts Held',
  //   'openPL': 'Open PL',
  //   'openPLPercent': 'Open PL %',
  //   'commissionPaid': 'Commission Paid',
  //   'totalTrades': 'Total Closed Trades',
  //   'totalOpenTrades': 'Total Open Trades',
  //   'numberOfLosingTrades': 'Number Losing Trades',
  //   'numberOfWiningTrades': 'Number Winning Trades',
  //   'percentProfitable': 'Percent Profitable',
  //   'avgTrade': 'Avg Trade',
  //   'avgTradePercent': 'Avg Trade %',
  //   'avgWinTrade': 'Avg Winning Trade',
  //   'avgWinTradePercent': 'Avg Winning Trade %',
  //   'avgLosTrade': 'Avg Losing Trade',
  //   'avgLosTradePercent': 'Avg Losing Trade %',
  //   'ratioAvgWinAvgLoss': 'Ratio Avg Win / Avg Loss',
  //   'largestWinTrade': 'Largest Winning Trade',
  //   'largestWinTradePercent': 'Largest Winning Trade %',
  //   'largestLosTrade': 'Largest Losing Trade',
  //   'largestLosTradePercent': 'Largest Losing Trade %',
  //   'avgBarsInTrade': 'Avg # Bars in Trades',
  //   'avgBarsInLossTrade': 'Avg # Bars In Losing Trades',
  //   'avgBarsInWinTrade': 'Avg # Bars In Winning Trades',
  //   'marginCalls': 'Margin Calls',
  // }
  //
  // const performanceData = await tv.getPageData('getPerformance')
  // let data = {}
  // if (performanceData) {
  //   if(performanceData.hasOwnProperty('all') && performanceData.hasOwnProperty('long') && performanceData.hasOwnProperty('short')) {
  //     for (let key of Object.keys(performanceData['all'])) {
  //       const keyName = perfDict.hasOwnProperty(key) ? perfDict[key] : key
  //       data[`${keyName}: All`] = convertPercent(key, performanceData['all'][key])
  //       if(performanceData['long'].hasOwnProperty(key))
  //         data[`${keyName}: Long`] = convertPercent(key, performanceData['long'][key])
  //       if(performanceData['short'].hasOwnProperty(key))
  //         data[`${keyName}: Short`] = convertPercent(key, performanceData['short'][key])
  //     }
  //   }
  //   for(let key of Object.keys(performanceData)) {
  //     if (!['all', 'long', 'short'].includes(key)) {
  //       const keyName = perfDict.hasOwnProperty(key) ? perfDict[key] : key
  //       data[keyName] =  convertPercent(key, performanceData[key])
  //     }
  //   }
  // }
  // return data
}

tv.getPageData = async (actionName, timeout = 1000) => {
  delete tvPageMessageData[actionName]
  const url = window.location && window.location.origin ? window.location.origin : 'https://www.tradingview.com'
  window.postMessage({name: 'iondvScript', action: actionName}, url) // TODO wait for data
  let iter = 0
  const tikTime = 50
  do {
    await page.waitForTimeout(tikTime)
    iter += 1
    if(tikTime * iter >= timeout)
      break
  } while (!tvPageMessageData.hasOwnProperty(actionName))
  return tvPageMessageData.hasOwnProperty(actionName) ? tvPageMessageData[actionName] : null
}