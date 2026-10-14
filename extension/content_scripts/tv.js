const tv = {
  reportDeepNode: null,
  tickerTextPrev: null,
  timeFrameTextPrev: null,
  isReportChanged: false,
  _settingsMethod: null,
  lastSetStrategyResult: null,
  // isParsed: false,
}


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
  const url = window.location && window.location.origin ? window.location.origin : 'https://www.tradingview.com'
  if (!event.origin.startsWith(url) || !event.data ||
    !event.data.hasOwnProperty('name') || event.data.name !== 'iondvPage' ||
    !event.data.hasOwnProperty('action'))
    return
  const messageKey = event.data.requestId ? `${event.data.action}#${event.data.requestId}` : event.data.action
  if (tvPageMessageData.hasOwnProperty(messageKey) && typeof (tvPageMessageData[messageKey]) === 'function') { // Callback
    const resolve = tvPageMessageData[messageKey]
    delete tvPageMessageData[messageKey]
    resolve(event.data)
  } else {
    tvPageMessageData[messageKey] = event.data.data
  }
}


tv.getStrategy = async (strategyName = '', isIndicatorSave = false, isDeepTest = false) => {
  try {
    await tv.openStrategyTab(isDeepTest)
  } catch (err) {
    log.warn('checkAndOpenStrategy failed:', err)
  }
  let isOpened = false
  if (strategyName)
    isOpened = await tv.openStrategyParameters(strategyName, true)
  else
    isOpened = await tv.openStrategyParameters(null, false)
  if (isOpened === null)
    return null  // openStrategyParameters already showed error popup
  if (!isOpened)
    throw new UserActionError('Could not open the strategy. Add a strategy to the chart and try again.')

  const dialogTitle = await page.waitForSelector(SEL.indicatorTitle)
  if (!dialogTitle || dialogTitle.innerText === null)
    throw new UserActionError('It was not possible to find a strategy with parameters among the indicators. Add it to the chart and try again.')
  const indicatorName = await tv.getStrategyNameFromPopup()
  if (!await tv.changeDialogTabToInput())
    throw new UiChangedError('Cannot activate the Inputs tab in the strategy settings dialog.')

  const strategyInputs = await tv.getStrategyParams(isIndicatorSave)
  const strategyData = { name: indicatorName, properties: strategyInputs }

  if (!isIndicatorSave && document.querySelector(SEL.cancelBtn)) {
    document.querySelector(SEL.cancelBtn).click()
    await page.waitForSelector(SEL.cancelBtn, 1000, true)
  }

  return strategyData
}

tv.getStrategyParams = async (isIndicatorSave = false) => {
  const strategyInputs = {} // TODO to list of values and set them in the same order
  const indicProperties = document.querySelectorAll(SEL.indicatorProperty)
  for (let i = 0; i < indicProperties.length; i++) {
    const propClassName = indicProperties[i].getAttribute('class')
    const propText = indicProperties[i].innerText
    if (!propClassName || !propText) // Undefined type of element
      continue
    if (propClassName.includes('topCenter-')) {  // Two rows, also have first in class name
      i++ // Skip get the next cell because it content values
      continue // Doesn't realise to manage this kind of properties (two rows)
    } else if (propClassName.includes('first-') && indicProperties[i].innerText) {
      i++
      if (indicProperties[i] && indicProperties[i].querySelector('input')) {
        let propValue = indicProperties[i].querySelector('input').value
        if (indicProperties[i].querySelector('input').getAttribute('inputmode') === 'numeric' ||
          (parseFloat(propValue) == propValue || parseInt(propValue) == propValue)) { // not only inputmode==numbers input have digits
          const digPropValue = parseFloat(propValue) == parseInt(propValue) ? parseInt(propValue) : parseFloat(propValue)  // Detection if float or int in the string
          if (!isNaN(propValue))
            strategyInputs[propText] = digPropValue
          else
            strategyInputs[propText] = propValue
        } else {
          strategyInputs[propText] = propValue
        }
      } else if (indicProperties[i].querySelector('button[role="combobox"]')) { // List, type="button"
        const buttonEl = indicProperties[i].querySelector('button[role="combobox"]')
        if (!buttonEl)
          continue
        const propValue = buttonEl.innerText
        if (propValue) {
          if (isIndicatorSave) {
            strategyInputs[propText] = propValue
            continue
          }
          buttonEl.scrollIntoView()
          await page.waitForTimeout(100)
          page.mouseClick(buttonEl)
          const isOptions = await page.waitForSelector(SEL.strategyListOptions, 1000)
          if (isOptions) {
            const allOptionsEl = document.querySelectorAll(SEL.strategyListOptions)
            let allOptionsList = propValue + ';'
            for (let optionEl of allOptionsEl) {
              if (optionEl && optionEl.innerText && optionEl.innerText !== propValue) {
                allOptionsList += optionEl.innerText + ';'
              }
            }
            if (allOptionsList)
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
      if (element)
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

// How a test run sets strategy parameters: through the strategy dialog (default), or - when the user opts in
// in the popup - through TradingView's public chart API (setInputValues), which skips the dialog. When the API
// fails or does not apply a value, the run goes on with the dialog until its end; a value the API can not
// express (e.g. a source taken from another indicator) is set by the dialog for that iteration only.
tv.paramSetter = {isApi: false}

tv.resetParamSetter = (isApiEnabled = false) => {
  tv.paramSetter = {isApi: Boolean(isApiEnabled), isUnsupportedLogged: false}
  if (tv.paramSetter.isApi)
    log.info('Strategy parameters are set through the TradingView chart API, the dialog is the fallback')
}

tv._switchParamSetterToDialog = (reason) => {
  if (!tv.paramSetter.isApi)
    return
  tv.paramSetter.isApi = false
  log.warn(`Setting strategy parameters through the TradingView chart API failed (${reason}), ` +
    'the strategy dialog is used until the end of this test run. TradingView may have changed its chart API.')
}

// True when the chart API applied the values; false when the dialog has to set them
tv._setStrategyParamsByApi = async (name, propVal, isDeepTest = false) => {
  if (!tv.paramSetter.isApi)
    return false
  let response
  try {
    response = await tv.callPageAction('setStrategyParams', {strategyName: name, values: propVal}, 1500)
  } catch (err) {
    tv._switchParamSetterToDialog(err.message)
    return false
  }
  if (!response?.success) {
    tv._switchParamSetterToDialog(response?.error || 'no response data')
    return false
  }
  const result = response.data
  if (result?.missing?.length) {
    // An input the dialog shows but the API does not name the same way: the same for every iteration
    tv._switchParamSetterToDialog(`inputs are not found by name: ${result.missing.join(', ')}`)
    return false
  }
  if (result?.unsupported?.length) {
    // The same inputs are unsupported on every iteration: log them once per run, the rest at debug
    const unsupportedText = `The strategy dialog sets the inputs the chart API cannot express: ${result.unsupported.join('; ')}`
    if (tv.paramSetter.isUnsupportedLogged) {
      log.debug(unsupportedText)
    } else {
      tv.paramSetter.isUnsupportedLogged = true
      log.info(unsupportedText)
    }
    return false
  }
  tv.lastSetStrategyResult = {method: 'api', response: result}
  // No dialog opens, so the user sees what changed the strategy
  if (result?.changed?.length)
    ui.showToast(`Strategy parameters set by the extension (chart API): ${result.changed.join(', ')}`)
  // As the dialog path does: the report page and its snackbars belong to the open Strategy Tester tab
  // (immediate when it is already open); when it can not be opened, the dialog path reports why
  try {
    await tv.openStrategyTab(isDeepTest)
  } catch (err) {
    log.warn('Unable to open the Strategy Tester tab after setting parameters through the chart API.', err)
    return false
  }
  return true
}

tv.setStrategyParams = async (name, propVal, isDeepTest = false, keepStrategyParamOpen = false) => {
  tv.lastSetStrategyResult = null
  // Report version before the change: getPerformance waits for TradingView to report a newer one
  tv.reportStateBeforeChange = await tv.captureReportState(name)
  // The chart API is used only when the dialog is closed: an open dialog would overwrite the values on "Ok"
  if (!keepStrategyParamOpen && !page.$(SEL.indicatorTitle) && await tv._setStrategyParamsByApi(name, propVal, isDeepTest))
    return true

  try {
    if (page.$(SEL.indicatorTitle))
      await tv.changeDialogTabToInput()
  } catch (err) {
    log.warn('Unable to switch the open strategy dialog to the Inputs tab.', err)
  }
  const legacyEnvelope = await tv._setStrategyParamsLegacy(name, propVal, isDeepTest, keepStrategyParamOpen)
  const legacySuccess = !!(legacyEnvelope && legacyEnvelope.success !== false)
  if (!tv.lastSetStrategyResult)
    tv.lastSetStrategyResult = { method: legacySuccess ? 'legacy' : 'legacy-error', response: null }
  tv.lastSetStrategyResult.legacy = legacyEnvelope
  return legacySuccess
}

// TradingView renders numbers/bools as text and dropdown labels may differ only by surrounding
// whitespace (incl. zero-width spaces), so compare trimmed/lowercased - same as setSelByText.
tv._isSameParamValue = (currentRaw, desiredRaw) => {
  if (currentRaw === null || currentRaw === undefined || desiredRaw === null || desiredRaw === undefined)
    return false
  const cur = String(currentRaw).replaceAll('​', '').trim().toLowerCase()
  const want = String(desiredRaw).replaceAll('​', '').trim().toLowerCase()
  return cur === want
}

tv._setStrategyParamsLegacy = async (name, propVal, isDeepTest = false, keepStrategyParamOpen = false) => {
  const indicatorTitleEl = await tv.checkAndOpenStrategy(name, isDeepTest) // In test.name - ordinary strategy name but in strategyData.name short one as in indicator title
  if (!indicatorTitleEl)
    return null
  let popupVisibleHeight = 917
  try {
    popupVisibleHeight = page.$(SEL.indicatorScroll)?.getBoundingClientRect()?.bottom || 917
  } catch {
  }
  let indicProperties = document.querySelectorAll(SEL.indicatorProperty)
  const propKeys = Object.keys(propVal)
  let setPropertiesNames = {}
  for (let i = 0; i < indicProperties.length; i++) {
    const propText = indicProperties[i].innerText
    if (propText && propKeys.includes(propText)) {
      try {
        const rect = indicProperties[i].getBoundingClientRect()
        if (rect.top < 0 || rect.bottom > popupVisibleHeight || !indicProperties[i].checkVisibility()) {
          indicProperties[i].scrollIntoView()
          await page.waitForTimeout(10)
          if (indicProperties[i].getBoundingClientRect()?.bottom > popupVisibleHeight)
            await page.waitForTimeout(50)
        }
      } catch {
      }
      setPropertiesNames[propText] = true
      const propClassName = indicProperties[i].getAttribute('class')
      if (propClassName.includes('first-')) {
        i++
        let inputEl = indicProperties[i].querySelector('input')
        if (inputEl) {
          if (!tv._isSameParamValue(inputEl.value, propVal[propText]))
            page.setInputElementValue(inputEl, propVal[propText])
          inputEl = null
        } else {
          let buttonEl = indicProperties[i].querySelector('button[role="combobox"]')
          if (buttonEl?.innerText) {
            // The selected dropdown option is shown as the button text; re-selecting the same
            // option still triggers a strategy recalculation, so skip when it already matches.
            if (!tv._isSameParamValue(buttonEl.innerText, propVal[propText])) {
              page.mouseClick(buttonEl) // Pointer events open the menu; native click() no longer does
              buttonEl = null
              await page.setSelByText(SEL.strategyListOptions, propVal[propText])
            }
            buttonEl = null
          }
        }
      } else if (propClassName.includes('fill-')) {
        let checkboxEl = indicProperties[i].querySelector('input[type="checkbox"]')
        if (checkboxEl) {
          const isChecked = Boolean(checkboxEl.checked)
          if (Boolean(propVal[propText]) !== isChecked) {
            page.mouseClick(checkboxEl)
            checkboxEl.checked = Boolean(propVal[propText])
          }
          checkboxEl = null
        }
      }
      if (propKeys.length === Object.keys(setPropertiesNames).length)
        break
    }
  }
  indicProperties = null
  const elOkBtn = page.$(SEL.okBtn)
  if (!keepStrategyParamOpen && elOkBtn)
    elOkBtn.click()

  const appliedKeys = Object.keys(setPropertiesNames)
  const missingKeys = propKeys.filter(key => !setPropertiesNames[key])


return {
    success: missingKeys.length === 0,
    applied: appliedKeys,
    missing: missingKeys
  }
}

tv.changeDialogTabToInput = async () => {
  let isInputTabActive = document.querySelector(SEL.tabInputActive)
  if (isInputTabActive) return true
  const inputTabEl = document.querySelector(SEL.tabInput)
  if (!inputTabEl) {
    // TradingView hides the tab for a strategy without inputs, and a UI change hides it too: the code can not tell them apart
    throw new UiChangedError('The strategy settings dialog has no "Inputs" tab: either the strategy has no input parameters ' +
      'to optimize, or TradingView changed its UI.')
  }
  inputTabEl.click()
  isInputTabActive = await page.waitForSelector(SEL.tabInputActive, 2000)
  return !!isInputTabActive
}

// tv._openStrategyByButtonNearTitle = async () => { // No button after 2026 year
//   if (tv._settingsMethod !== null && tv._settingsMethod !== 'setButton')
//     return false
//   const stratParamEl = page.$(SEL.strategyDialogParam) // Version before 2025.02.21 with param button near title
//   if (!stratParamEl)
//     return false
//   tv._settingsMethod = 'setButton'
//   page.mouseClick(stratParamEl) // stratParamEl.click()
//   return true
// }

tv._openStrategyParamsByStrategyDoubleClickBy = async (indicatorTitle) => {
  if ((tv._settingsMethod !== null && tv._settingsMethod !== 'indName') || !indicatorTitle)
    return false
  const indicatorLegendsEl = document.querySelectorAll(SEL.tvLegendIndicatorItem)
  if (!indicatorLegendsEl)
    return false
  for (let indicatorItemEl of indicatorLegendsEl) {
    const indicatorTitleEl = indicatorItemEl.querySelector(SEL.tvLegendIndicatorItemTitle)
    if (!indicatorTitleEl)
      continue
    if (indicatorTitle !== indicatorTitleEl.innerText)
      continue
    page.mouseDoubleClick(indicatorTitleEl)
    // page.mouseClick(indicatorTitleEl)
    // page.mouseClick(indicatorTitleEl)
    const dialogTitle = await page.waitForSelector(SEL.indicatorTitle, 2500)
    if (dialogTitle && dialogTitle.innerText === indicatorTitle) {
      tv._settingsMethod = 'indName'
      return true
    }
    if (page.$(SEL.cancelBtn))
      page.mouseClickSelector(SEL.cancelBtn)//.click()

  }
  return false
}

tv._openStrategyParamsByStrategyMenu = async () => {
  if (tv._settingsMethod !== null && tv._settingsMethod !== 'setMenu')
    return false
  // Both real and fakeTabs have the button - filter by visibility and non-fake ancestor
  const allBtnEls = [...document.querySelectorAll(SEL.strategyCaptionSettings)]
  const strategyCaptionEl = allBtnEls.find(
    el => !el.closest('[class*="fake"]') && el.getBoundingClientRect().width > 0
  )
  if (!strategyCaptionEl)
    return false
  page.mouseClick(strategyCaptionEl) // pointer events needed for menu trigger
  const menuItemSettingsEl = await page.waitForSelector(SEL.strategyMenuItemSettings, 2000)
  if (!menuItemSettingsEl)
    return false
  menuItemSettingsEl.click() // native click needed for menu items
  tv._settingsMethod = 'setMenu'
  return true
}

tv.getStrategyNameFromPopup = async () => {

  // const strategyTitleEl = page.$(SEL.indicatorTitle)
  const strategyTitleEl = await page.waitForSelector(SEL.indicatorTitle, 1000)
  if (strategyTitleEl)
    return strategyTitleEl.innerText
  return null
}

tv.openStrategyParameters = async (indicatorTitle, searchAgainstStrategies = false) => {
  // Only whether the dialog is already open: waiting for it here cost a second on every iteration
  const curStrategyTitle = page.$(SEL.indicatorTitle)?.innerText || null
  let isOpened = !!curStrategyTitle
  if (!isOpened && (indicatorTitle && indicatorTitle !== curStrategyTitle) && searchAgainstStrategies) {
    isOpened = await tv._openStrategyParamsByStrategyDoubleClickBy(indicatorTitle)
    tv._settingsMethod = null
  } else if (!isOpened) {
    // isOpened = await tv._openStrategyByButtonNearTitle() // 2026-01-14 Disabled due changed in new UI
    // if (!isOpened)
    isOpened = await tv._openStrategyParamsByStrategyMenu()
    if (!isOpened) {
      if (!indicatorTitle) {
        const curStrategyCaptionEl = page.$(SEL.strategyCaption)
        if (curStrategyCaptionEl)
          indicatorTitle = curStrategyCaptionEl.innerText
      }
      isOpened = await tv._openStrategyParamsByStrategyDoubleClickBy(indicatorTitle)
    }
  }

  if (!isOpened) {
    // TV renders the "Strategy Tester" tab only while a strategy is on the chart, so its absence most likely
    // means no strategy - but the same symptom appears when TV changes its UI, so the issue block is shown too
    if (!page.$(SEL.strategyTesterTab))
      await ui.showIssuePopup('No strategy was found on the chart ("Strategy Tester" panel is missing).\n' +
        'Add a strategy to the chart and try again.')
    else
      await ui.showIssuePopup('Cannot find the strategy settings button on the "Strategy Tester" panel. The test is stopped.')
    return null
  }
  const stratIndicatorEl = await page.waitForSelector(SEL.indicatorTitle, 5000)
  if (!stratIndicatorEl) {
    await ui.showIssuePopup('The strategy settings dialog did not open. Reload the page and try again. The test is stopped.')
    return null
  }
  const inputsTabMissingText = 'The Inputs tab is missing in the strategy settings dialog. The test is stopped.'
  const tabInputEl = document.querySelector(SEL.tabInput)
  if (!tabInputEl) {
    await ui.showIssuePopup(inputsTabMissingText)
    return null
  }
  page.mouseClick(tabInputEl)

  const tabInputActiveEl = await page.waitForSelector(SEL.tabInputActive)
  if (!tabInputActiveEl) {
    await ui.showIssuePopup(inputsTabMissingText)
    return null
  }
  return true
}


tv.checkAndOpenStrategy = async (name, isDeepTest = false) => {
  let indicatorTitleEl = page.$(SEL.indicatorTitle)
  if (!indicatorTitleEl || indicatorTitleEl.innerText !== name) {
    try {
      await tv.openStrategyTab(isDeepTest)
    } catch (err) {
      log.warn('checkAndOpenStrategy failed:', err)
      return null
    }
    const reloadAdviceText = 'Reload the page, leave only one strategy on the chart and try again.'
    const isOpened = await tv.openStrategyParameters(name)
    if (!isOpened) {
      log.warn(`Cannot open the parameters of strategy "${name || ''}"`)
      await ui.showErrorPopup(`Cannot open the parameters of strategy "${name || ''}".\n${reloadAdviceText}`)
      return null
    }
    if (name) {
      indicatorTitleEl = page.$(SEL.indicatorTitle)
      if (!indicatorTitleEl || indicatorTitleEl.innerText !== name) {
        const openedTitle = indicatorTitleEl?.innerText
        await ui.showErrorPopup(`The parameters of strategy "${name}" could not be opened.` +
          `${openedTitle ? ` The dialog of "${openedTitle}" opened instead.` : ''}\n${reloadAdviceText}`)
        return null
      }
    }
  }
  await page.waitForSelector(SEL.indicatorProperty)
  return indicatorTitleEl
}

tv.checkIsNewVersion = async (timeout = 1000) => {
  selStatus.isNewVersion = true
  return
}

tv.openStrategyTab = async (isDeepTest = false) => {
  let isStrategyActiveEl = await page.waitForSelector(SEL.strategyTesterTabActive)
  if (!isStrategyActiveEl) {
    const strategyTabEl = await page.waitForSelector(SEL.strategyTesterTab)
    if (strategyTabEl) {
      strategyTabEl.click()
      await page.waitForSelector(SEL.strategyTesterTabActive)
    } else {
      throw new UiChangedError('Cannot find the "Strategy Tester" panel on the chart page.')
    }
  }
  let strategyCaptionEl = await page.waitForSelector(SEL.strategyCaption, 2500) // 2023-02-24 Changed to more complicated logic - for single and multiple strategies in page
  if (!strategyCaptionEl) { // || !strategyCaptionEl.innerText) {
    throw new UiChangedError('Cannot find the strategy name on the "Strategy Tester" panel.')
  }
  // await tv.checkIsNewVersion()
  let metricsTabActive = await page.waitForSelector(SEL.metricsTab, 1000)
  if (!metricsTabActive) {
    if (!metricsTabActive)
      throw new UiChangedError('Cannot find the "Metrics" tab on the "Strategy Tester" panel.')

  }
  if (!page.$(SEL.metricsTabActive))
    metricsTabActive.click()
  const isActive = await page.waitForSelector(SEL.metricsTabActive, 1000)
  if (!isActive) {
    log.error('The "Metrics" tab is not active after a click')
  }
  return true
}

tv.switchToStrategyTabAndSetObserveForReport = async (isDeepTest = false) => {
  // 2026-01-14 Not used anymore because of joining all tabs in one Performance tab in new UI
    // await tv.openStrategyTab(isDeepTest)

  const testResults = {}
  testResults.ticker = await tvChart.getTicker()
  testResults.timeFrame = await tvChart.getCurrentTimeFrame()
  let strategyCaptionEl = document.querySelector(SEL.strategyCaption)
  testResults.name = strategyCaptionEl?.innerText || strategyCaptionEl?.getAttribute('data-strategy-title')

  // const reportEl = await page.waitForSelector(SEL.strategyReportObserveArea, 10000)
  // if (!tv.reportNode) {
  //   // TODO When user switch to deep backtest or minimize window - it should be deleted and created again. Or delete observer after every test
  //   tv.reportNode = await page.waitForSelector(SEL.strategyReportObserveArea, 10000)
  //   if (tv.reportNode) {
  //     const reportObserver = new MutationObserver(() => {
  //       tv.isReportChanged = true
  //     });
  //     reportObserver.observe(tv.reportNode, {
  //       childList: true,
  //       subtree: true,
  //       attributes: false,
  //       characterData: false
  //     });
  //   } else {
  //     throw new Error('The strategy report did not found.')
  //   }
  // }


  return testResults
}

tv.dialogHandler = async () => {
  const indicatorTitle = page.getTextForSel(SEL.indicatorTitle)
  if (!document.querySelector(SEL.okBtn) || !document.querySelector(SEL.tabInput))
    return
  if (indicatorTitle === 'iondvSignals' && action.workerStatus === null) {
    let tickerText = document.querySelector(SEL.ticker).innerText
    let timeFrameEl = document.querySelector(SEL.timeFrameActive)
    if (!timeFrameEl)
      timeFrameEl = document.querySelector(SEL.timeFrame)

    let timeFrameText = timeFrameEl.innerText
    if (!tickerText || !timeFrameText)
      // ui.alertMessage('There is not timeframe element on page. Open correct page please')
      return

    timeFrameText = timeFrameText.toLowerCase() === 'd' ? '1D' : timeFrameText
    if (ui.isMsgShown && tickerText === tv.tickerTextPrev && timeFrameText === tv.timeFrameTextPrev)
      return
    tv.tickerTextPrev = tickerText
    tv.timeFrameTextPrev = timeFrameText

    if (!await tv.changeDialogTabToInput()) {
      log.error('Cannot switch the indicator settings dialog to the Inputs tab')
      ui.isMsgShown = true
      return
    }

    log.debug('Indicator parameters window opened for ticker:', tickerText)
    const tsData = await storage.getKey(`${storage.SIGNALS_KEY_PREFIX}_${tickerText}::${timeFrameText}`.toLowerCase())
    if (tsData === null) {
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
    for (let i = 0; i < indicProperties.length; i++) {
      const propText = indicProperties[i].innerText
      if (propKeys.includes(propText)) {
        setResult.push(propText)
        page.setInputElementValue(indicProperties[i + 1].querySelector('input'), propVal[propText])
        if (propKeys.length === setResult.length)
          break
      }
    }
    const notFoundParam = propKeys.filter(item => !setResult.includes(item))
    if (notFoundParam && notFoundParam.length) {
      await ui.showErrorPopup(`The parameters ${notFoundParam.join(', ')} were not found in the indicator settings dialog. Check the script.`)
      ui.isMsgShown = true
      return
    }
    document.querySelector(SEL.okBtn).click()
    const allSignals = [].concat(tsData.buy.split(','), tsData.sell.split(',')).sort()
    await ui.showPopup(`${allSignals.length} signals are set.\n  - date of the first signal: ${new Date(parseInt(allSignals[0]))}.\n  - date of the last signal: ${new Date(parseInt(allSignals[allSignals.length - 1]))}`)
    ui.isMsgShown = true
  }
}


tv._parseRows = (allReportRowsEl, strategyHeaders, report) => {
  function parseNumTypeByRowName(rowName, value) {
    const digitalValues = value.replaceAll(/([\-\d\.\n])|(.)/g, (a, b) => b || '')
    return rowName.toLowerCase().includes('trades') || rowName.toLowerCase().includes('contracts held')
      ? parseInt(digitalValues)
      : parseFloat(digitalValues)
  }

  const firstColumnValues = ['Initial capital', 'Open P&L', 'Buy & hold return',
        'Buy & hold % gain', 'Strategy outperformance', 'Sharpe ratio', 'Sortino ratio',
        'Account size required', 'Max margin used', 'Margin efficiency', 'Margin calls',
        'Avg equity run-up duration (close-to-close)', 'Avg equity run-up (close-to-close)',
        'Max equity run-up (close-to-close)',  'Max equity run-up (intrabar)',
        'Max equity run-up as % of initial capital (intrabar)',
        'Avg equity drawdown duration (close-to-close)', 'Avg equity drawdown (close-to-close)',
        'Max equity drawdown (close-to-close)', 'Max equity drawdown (intrabar)',
        'Max equity drawdown as % of initial capital (intrabar)',
        'Return of max equity drawdown'
      ]
  // Values keep the sign TradingView displays; the parser applies no sign convention of its own

  for (let rowEl of allReportRowsEl) {
    if (rowEl) {
      const allTdEl = rowEl.querySelectorAll('td')
      if (!allTdEl || allTdEl.length < 2 || !allTdEl[0]) {
        continue
      }
      const paramName = (allTdEl[0].innerText || '').trim()
      let isSingleValue = firstColumnValues.includes(paramName)
      for (let i = 1; i < allTdEl.length; i++) {
        if (isSingleValue && i >= 2)
          continue
        let values = allTdEl[i].innerText
        if (values && typeof values === 'string' && strategyHeaders[i]) {
          values = values.replaceAll(' ', ' ').replaceAll('−', '-').trim()
          const digitalValues = values.replaceAll(/([\-\d\.\n])|(.)/g, (a, b) => b || '')
          let digitOfValues = digitalValues.match(/-?\d+\.?\d*/)
          const nameDigits = isSingleValue ? paramName : `${paramName}: ${strategyHeaders[i]}`
          const namePercents = isSingleValue ? `${paramName} %` : `${paramName} %: ${strategyHeaders[i]}`

          if ((values.includes('\n') && values.endsWith('%'))) {
            const valuesPair = values.split('\n', 3)
            if (valuesPair && valuesPair.length >= 2) {
              const digitVal0 = valuesPair[0] //.replaceAll(/([\-\d\.])|(.)/g, (a, b) => b || '') //.match(/-?\d+\.?\d*/)
              const digitVal1 = valuesPair[valuesPair.length - 1]//.replaceAll(/([\-\d\.])|(.)/g, (a, b) => b || '') //match(/-?\d+\.?\d*/)

              if (Boolean(digitVal0)) {
                report[nameDigits] = parseNumTypeByRowName(nameDigits, digitVal0)
              } else {
                report[nameDigits] = valuesPair[0]
              }
              if (Boolean(digitVal1)) {
                report[namePercents] = parseNumTypeByRowName(namePercents, digitVal1)
              } else {
                report[namePercents] = valuesPair[1]
              }
            }
          } else if (Boolean(digitOfValues)) {
            report[nameDigits] = parseNumTypeByRowName(namePercents, digitalValues)
          } else
            report[nameDigits] = values
        }
      }
    }
  }
  return report
}


tv._normalizeReportText = (text) => (text || '').replaceAll(' ', ' ').replaceAll('−', '-').trim()

// "1,946.00" -> 1946, "6 bars" -> 6, "0.19%" -> 0.19; a label such as "January, 41.67% winners" or "—" stays a string
tv._parseMetricNumber = (text) => {
  const normalized = tv._normalizeReportText(text)
  const match = normalized.replaceAll(',', '').match(/^[+-]?\d+(\.\d+)?/)
  return match ? parseFloat(match[0]) : normalized
}

// 2026-10 card layout: name in [class^="title"], amount in [class^="value"], optional percent in [class^="change"].
// Returns false when the card is not in that layout, so the caller falls back to the previous one.
tv._parseMetricCard = (metricEl, report) => {
  const nameEl = metricEl.querySelector('[class^="title"], [class*=" title"]')
  const valueEl = metricEl.querySelector('[class^="value"], [class*=" value"]')
  const metricName = (nameEl?.innerText || '').trim()
  if (!metricName || !valueEl)
    return false
  report[metricName] = tv._parseMetricNumber(valueEl.innerText)
  const changeEl = metricEl.querySelector('[class^="change"], [class*=" change"]')
  const changeText = tv._normalizeReportText(changeEl?.innerText)
  if (!changeText)
    return true
  // "379/1001" (winning/total trades): the legacy ratio string plus both numbers
  const ratioMatch = changeText.replaceAll(',', '').match(/^(\d+)\s*\/\s*(\d+)$/)
  if (ratioMatch) {
    report[`${metricName} ratio`] = `${ratioMatch[1]}/${ratioMatch[2]}`
    report[`${metricName} count`] = parseInt(ratioMatch[1])
    report[`${metricName} total`] = parseInt(ratioMatch[2])
    return true
  }
  // "0.78%" or "47.19% winners" -> a percent value
  const isPercent = /^[+-]?[\d,]+(\.\d+)?%/.test(changeText)
  report[isPercent ? `${metricName} %` : `${metricName}_1`] = tv._parseMetricNumber(changeText)
  return true
}

tv._parseMetrics = (report, root = document, cellSelector = SEL.metricsValueCell) => {
  const matricsValuesEls = root.querySelectorAll(cellSelector)
  for (let metricEl of matricsValuesEls) {
    if (!metricEl)
      continue
    if (tv._parseMetricCard(metricEl, report))
      continue
    const metricNameAndValEls = metricEl.querySelectorAll('div[class^="container-"]')
    if (metricNameAndValEls && metricNameAndValEls.length < 2)
      continue
    const metricName = (metricNameAndValEls[0].innerText || '').trim()
    let metricValue = metricNameAndValEls[1].innerText || ''
    if (metricValue && typeof metricValue === 'string') {
      metricValue = metricValue.replaceAll(' ', ' ').replaceAll('−', '-').trim()
      const digitalValues = metricValue.replaceAll(/([\/\-\d\.\n%])|(.)/g, (a, b) => b || '')
      let digitOfValuesArr = digitalValues.split('\n')
      let value0 = null
      let value1 = null
      let name1 = null
      if (digitOfValuesArr.length === 1) {
        value0 = digitOfValuesArr[0].match(/-?\d+\.?\d*/g)
      } else {
          value0 = digitOfValuesArr[0].match(/-?\d+\.?\d*/g)
        const lastIdx = digitOfValuesArr.length - 1
        if (digitOfValuesArr[lastIdx].includes('/')) {
          value1 = digitOfValuesArr[lastIdx]
          name1 = `${metricName} ratio`
        } else {
          value1 = digitOfValuesArr[digitOfValuesArr.length - 1].match(/-?\d+\.?\d*/g)
          name1 = digitOfValuesArr[digitOfValuesArr.length - 1].endsWith('%') ? `${metricName} %` : `${metricName}_1`
        }
      }
      if (Boolean(value0))
        report[metricName] = parseFloat(value0)
      else
        report[metricName] = metricValue
      if(Boolean(value1) && name1)
        report[name1] =  (value1.includes('/')) ? value1 : parseFloat(value1)
    }
  }
  return report
}

tv._getMetricGroupTitle = (group) => {
  const titleEl = [...(group?.children || [])]
    .find(child => child.matches?.('p[class^="title"], p[class*=" title"]'))
  return (titleEl?.innerText || '').trim()
}

tv.REPORT_PARSER_VERSION = '2026-10-14-metric-cards-v6'

tv._getReportRoot = () => page.$(SEL.reportRoot) || page.$('#bottom-area')

// Data tables only: lightweight-charts renders its canvases inside a <table> as well
tv._getDataTables = (root) => [...root.querySelectorAll('table')].filter(table => !table.closest('.tv-lightweight-charts'))

// Section sub-tabs. Since 2026-10 the first tab of a group ("Breakdown", "Distribution") reuses the
// id "strategy-report-summary", so tabs are no longer filtered by id; the overflow "More" button is a fake tab
tv._getMetricTabButtons = (group) => [...group.querySelectorAll('button[id][aria-selected]')]
  .filter(btn => btn.getAttribute('aria-hidden') !== 'true' && !String(btn.className).includes('fake'))

tv._getMetricSectionRoot = (el, requireTable = false) => {
  const reportRoot = tv._getReportRoot()
  for (let node = el; node && node !== reportRoot; node = node.parentElement) {
    if (tv._getMetricGroupTitle(node) && (!requireTable || tv._getDataTables(node).length))
      return node
  }
  return null
}

tv._getMetricSectionGroups = () => {
  const sections = new Set()
  tv._getDataTables(page.$('#bottom-area') || document)
    .forEach(table => {
      const section = tv._getMetricSectionRoot(table, true)
      if (section)
        sections.add(section)
    })
  document.querySelectorAll('#bottom-area button[id][aria-selected]')
    .forEach(button => {
      const section = tv._getMetricSectionRoot(button)
      if (section)
        sections.add(section)
    })
  return [...sections]
}

tv._getReportScrollRoots = () => {
  const reportRoot = tv._getReportRoot()
  const candidates = [
    ...document.querySelectorAll('#bottom-area *'),
    reportRoot,
    page.$('#bottom-area'),
    document.scrollingElement,
  ].filter(Boolean)

  return [...new Set(candidates)]
    .filter(el =>
      el.scrollHeight > el.clientHeight + 50 &&
      (el === document.scrollingElement ||
        el.contains?.(reportRoot) ||
        el.querySelector?.(SEL.metricSectionGroup) ||
        el.querySelector?.(SEL.metricsValueCell))
    )
    .sort((a, b) => (b.scrollHeight - b.clientHeight) - (a.scrollHeight - a.clientHeight))
}

tv._getMetricSectionDebug = () => tv._getMetricSectionGroups().map(group => ({
  title: tv._getMetricGroupTitle(group),
  tabs: tv._getMetricTabButtons(group)
    .map(btn => ({
      id: btn.id,
      text: (btn.innerText || '').trim(),
      selected: btn.getAttribute('aria-selected'),
    })),
  table: (tv._getDataTables(group)[0]?.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 160),
  cards: group.querySelectorAll(SEL.metricCell).length,
}))

tv._nudgeReportScrollRoot = async (scrollRoot, deltaY) => {
  const target = scrollRoot === document.scrollingElement ? document : scrollRoot
  const event = new WheelEvent('wheel', {
    bubbles: true,
    cancelable: true,
    view: window,
    deltaY,
    deltaMode: 0,
  })

  target.dispatchEvent(event)
  scrollRoot.scrollTop += deltaY
  await page.waitForTimeout(180)
}

tv._parseVisibleMetricSectionGroups = async (report, parsedTabs, debugLabel = '') => {
  const visibleSections = tv._getMetricSectionDebug()
  for (const group of tv._getMetricSectionGroups())
    report = await tv._parseMetricSectionGroup(group, report, parsedTabs)

  if (tv.lastReportParseDebug)
    tv.lastReportParseDebug.passes.push({
      label: debugLabel,
      visibleSections,
      parsedTabsCount: parsedTabs.size,
      metricCount: Object.keys(report).filter(key => !key.startsWith('_') && key !== 'comment').length,
    })

  return report
}

tv._parseMetricSectionGroup = async (group, report, parsedTabs) => {
  const groupTitle = tv._getMetricGroupTitle(group)
  const tabButtons = tv._getMetricTabButtons(group)

  for (const tabBtn of tabButtons) {
    const tabKey = `${groupTitle}::${tabBtn.id}::${(tabBtn.innerText || '').trim()}`
    if (parsedTabs.has(tabKey))
      continue

    tabBtn.scrollIntoView({ block: 'center' })
    await page.waitForTimeout(80)

    if (tabBtn.getAttribute('aria-selected') !== 'true') {
      page.mouseClick(tabBtn)
      await page.waitForTimeout(180)
    }

    // A tab holds metric cards (2026-10 UI) or a table (earlier UI); try both, cards first
    const isContent = () => group.querySelector(SEL.metricCell) || tv._getDataTables(group).length
    if (!isContent())
      await page.waitForTimeout(250)
    // Nothing after a fair attempt - a genuine "no data" state or a chart-only tab. Either way the tab is
    // marked parsed, because retrying it on every later pass/scrollRoot re-clicks it forever and stalls the parse
    report = tv._parseMetrics(report, group, SEL.metricCell)
    for (const table of tv._getDataTables(group)) {
      const headerEls = table.querySelectorAll('thead > tr > th')
      const strategyHeaders = [...headerEls].map(h => (h?.innerText || '').trim())
      const rowEls = table.querySelectorAll('tbody > tr')
      if (rowEls.length)
        report = tv._parseRows(rowEls, strategyHeaders, report)
    }

    parsedTabs.add(tabKey)
  }

  return report
}

tv.parseReportTable = async () => {
  let report = {}
  report = tv._parseMetrics(report)
  const parsedTabs = new Set()
  const scrollRoots = tv._getReportScrollRoots()
  tv.lastReportParseDebug = {
    scrollRoots: scrollRoots.map((el, idx) => ({
      idx,
      tag: el.tagName,
      className: String(el.className || '').slice(0, 160),
      id: el.id || '',
      scrollTop: el.scrollTop,
      scrollHeight: el.scrollHeight,
      clientHeight: el.clientHeight,
    })),
    passes: [],
  }

  report = await tv._parseVisibleMetricSectionGroups(report, parsedTabs, 'initial')

  for (const scrollRoot of scrollRoots) {
    scrollRoot.scrollTop = 0
    await page.waitForTimeout(120)

    for (let pass = 0; pass < 25; pass++) {
      report = await tv._parseVisibleMetricSectionGroups(report, parsedTabs, `root:${scrollRoots.indexOf(scrollRoot)} pass:${pass}`)

      const prevScrollTop = scrollRoot.scrollTop
      await tv._nudgeReportScrollRoot(scrollRoot, Math.max(500, scrollRoot.clientHeight || 500))

      if (scrollRoot.scrollTop === prevScrollTop)
        break
    }
  }

  return report
}

tv.REPORT_NO_DATA_MESSAGES = ['This report requires trade data', 'Not enough data to show', 'Not enough data']

// Blocks of the report showing a "no data" placeholder instead of a chart/table, by block title.
// The placeholder is matched by text (English UI) because its class names are hashed.
tv._getReportNoDataBlocks = (root = tv._getReportRoot()) => {
  if (!root)
    return []
  const isNoDataText = (el) => tv.REPORT_NO_DATA_MESSAGES.some(message => (el.innerText || '').trim().startsWith(message))
  return [...root.querySelectorAll('div, p, span')]
    .filter(el => isNoDataText(el) && ![...el.children].some(isNoDataText))
    .map(el => {
      for (let node = el.parentElement; node && node !== root.parentElement; node = node.parentElement) {
        const titleEl = [...node.children].find(child => child !== el && !child.contains(el) &&
          /title/i.test(String(child.className)) && (child.innerText || '').trim().length < 80)
        if (titleEl)
          return { title: titleEl.innerText.trim(), message: el.innerText.trim(), el }
      }
      return { title: '', message: el.innerText.trim(), el }
    })
}

// 2026-10 UI: a strategy without closed trades keeps the metric cards (with "—" and 0 values) but the
// Key stats chart shows "Not enough data to show"; the per-tab charts show the same placeholder on their
// own whenever one view has nothing to draw - that is not a no-trades state and is ignored here.
// Earlier UI replaced the whole report by an empty-state block; both are reported as 'no_trade_data'.
tv._getReportEmptyState = () => {
  const emptyStateEl = page.$(SEL.strategyReportEmptyState)
  if (emptyStateEl && !page.$(SEL.metricsValueCell))
    return {
      type: 'no_trade_data',
      message: (emptyStateEl.innerText || '').replace(/\s+/g, ' ').trim() || 'Empty report'
    }
  const keyStatsEl = page.$(SEL.reportContent)
  const keyStatsNoData = keyStatsEl ? tv._getReportNoDataBlocks(keyStatsEl) : []
  if (keyStatsNoData.length)
    return {
      type: 'no_trade_data',
      message: keyStatsNoData[0].message
    }
  if (!keyStatsEl && !page.$(SEL.metricsValueCell)) { // Neither layout found - match the text of the whole report
    const reportText = (tv._getReportRoot()?.innerText || '').replace(/\s+/g, ' ').trim()
    const matchedMessage = tv.REPORT_NO_DATA_MESSAGES.find(message => reportText.includes(message))
    if (matchedMessage)
      return { type: 'no_trade_data', message: matchedMessage }
  }
  return null
}


tv._getLastStoredReport = (testResults) => {
  const perf = testResults && Array.isArray(testResults.perfomanceSummary) ? testResults.perfomanceSummary : []
  const filtered = testResults && Array.isArray(testResults.filteredSummary) ? testResults.filteredSummary : []
  const lastPerf = perf.length ? perf[perf.length - 1] : null
  const lastFiltered = filtered.length ? filtered[filtered.length - 1] : null
  if (!lastPerf)
    return lastFiltered
  return lastPerf
}

tv._getReportDataHash = (reportData) => {
  // `_`-prefixed fields are timings that always change, `comment` is a message, not a result.
  if (!reportData || typeof reportData !== 'object')
    return ''
  const keys = Object.keys(reportData).filter(k => !k.startsWith('_') && k !== 'comment').sort()
  if (!keys.length)
    return ''
  return keys.map(k => `${k}=${reportData[k]}`).join('|')
}

// 2026-08 Cheap "did the report re-render" signal for the polling loop below.
// Unlike tv.parseReportTable() this never clicks through report sub-tabs (Periodical,
// Benchmarking, Margin usage, Growth and decline, Streaks, ...) - TradingView keeps adding
// more of them, and re-clicking through all of them on every poll tick made the wait loop
// visibly hammer the tab strip (looked like the UI "hanging" while switching report tabs).
// It only reads whatever is already rendered, just to notice a change happened.
tv._getQuickReportSignature = () => {
  const reportRoot = tv._getReportRoot()
  if (!reportRoot)
    return ''
  return (reportRoot.innerText || '').replace(/\s+/g, ' ').trim()
}

// TradingView internal report (page-context.js getPerformance) -> metric names of the popup schema
// ("Net PnL: All", "Gross loss %: Short", ...). Keys missing here keep their TradingView name.
// Verified 2026-10-14 against strategy source _reportData.performance.
tv.PAGE_REPORT_SIDES = {all: 'All', long: 'Long', short: 'Short'}
tv.PAGE_REPORT_SIDE_METRICS = {
  netProfit: 'Net PnL', netProfitPercent: 'Net PnL %',
  grossProfit: 'Gross profit', grossProfitPercent: 'Gross profit %',
  grossLoss: 'Gross loss', grossLossPercent: 'Gross loss %',
  commissionPaid: 'Commission paid', profitFactor: 'Profit factor',
  avgTrade: ['Average PnL', 'Expected payoff'], avgTradePercent: 'Average PnL %',
  avgWinTrade: 'Average profit', avgWinTradePercent: 'Average profit %',
  avgLosTrade: 'Average loss', avgLosTradePercent: 'Average loss %',
  ratioAvgWinAvgLoss: 'Average profit / average loss',
  largestWinTrade: 'Largest profit', largestWinTradePercent: 'Largest profit %',
  largestLosTrade: 'Largest loss', largestLosTradePercent: 'Largest loss %',
  avgBarsInTrade: 'Average bars in trades', avgBarsInWinTrade: 'Average bars in winners',
  avgBarsInLossTrade: 'Average bars in losers',
  percentProfitable: 'Percent profitable', totalTrades: 'Total trades', totalOpenTrades: 'Total open trades',
  numberOfWiningTrades: 'Total winners', numberOfLosingTrades: 'Total losers',
  maxContractsHeld: 'Max contracts held', marginCalls: 'Margin calls',
}
tv.PAGE_REPORT_METRICS = {
  maxStrategyDrawDown: ['Max drawdown', 'Max drawdown (intrabar): All'],
  maxStrategyDrawDownPercent: ['Max drawdown %', 'Max drawdown as % of initial capital (intrabar): All'],
  maxStrategyRunUp: 'Max run-up (intrabar): All',
  maxStrategyRunUpPercent: 'Max run-up as % of initial capital (intrabar): All',
  openPL: 'Open PnL: All', openPLPercent: 'Open PnL %: All',
  buyHoldReturn: 'Buy and hold PnL: All', buyHoldReturnPercent: 'Buy and hold PnL %: All',
  buyHoldGainPercent: 'Buy and hold % gain: All',
  sharpeRatio: 'Sharpe ratio', sortinoRatio: 'Sortino ratio',
  maxMarginUsed: 'Max margin used', avgMarginUsed: 'Average margin used: All', openMarginUsed: 'Open margin used',
}
tv.lastReportSource = null

// TradingView keeps percents as fractions (0.0078 is shown as 0.78%)
tv._isPageReportPercentKey = (key) => key.endsWith('Percent') || key.startsWith('percent')
tv._toPageReportDisplayValue = (key, value) => {
  if (typeof value !== 'number')
    return value
  const displayValue = tv._isPageReportPercentKey(key) ? value * 100 : value
  return Math.round(displayValue * 1e8) / 1e8
}

tv._mapPageReport = (performance) => {
  if (!performance?.all || typeof performance.all !== 'object')
    throw new Error('the internal report has no "all" performance block')
  const report = {}
  for (const [side, sideLabel] of Object.entries(tv.PAGE_REPORT_SIDES)) {
    for (const [key, value] of Object.entries(performance[side] || {})) {
      if (value !== null && typeof value === 'object')
        continue
      for (const label of [].concat(tv.PAGE_REPORT_SIDE_METRICS[key] || key))
        report[`${label}: ${sideLabel}`] = tv._toPageReportDisplayValue(key, value)
    }
  }
  for (const [key, value] of Object.entries(performance)) {
    if (value === null || typeof value === 'object')
      continue
    for (const label of [].concat(tv.PAGE_REPORT_METRICS[key] || `${key}: All`))
      report[label] = tv._toPageReportDisplayValue(key, value)
  }
  // Key stats cards: Total PnL includes the open position, as TradingView shows it
  const all = performance.all
  if (typeof all.netProfit === 'number')
    report['Total PnL'] = tv._toPageReportDisplayValue('netProfit', all.netProfit + (performance.openPL || 0))
  if (typeof all.netProfitPercent === 'number')
    report['Total PnL %'] = tv._toPageReportDisplayValue('netProfitPercent', all.netProfitPercent + (performance.openPLPercent || 0))
  if (typeof all.profitFactor === 'number')
    report['Profit factor'] = tv._toPageReportDisplayValue('profitFactor', all.profitFactor)
  if (typeof all.percentProfitable === 'number')
    report['Profitable trades'] = tv._toPageReportDisplayValue('percentProfitable', all.percentProfitable)
  if (typeof all.numberOfWiningTrades === 'number' && typeof all.totalTrades === 'number') {
    report['Profitable trades ratio'] = `${all.numberOfWiningTrades}/${all.totalTrades}`
    report['Profitable trades count'] = all.numberOfWiningTrades
    report['Profitable trades total'] = all.totalTrades
  }
  if (typeof all.marginCalls === 'number')
    report['Margin calls'] = all.marginCalls
  return report
}

// The page parser reads the current UI names, which have no All/Long/Short split; the popup schema
// names ("Total trades: All") are added as aliases so the optimisation and filter parameters resolve.
tv._addPopupMetricAliases = (report) => {
  for (const label of Object.values(tv.PAGE_REPORT_SIDE_METRICS).flat())
    if (Object.hasOwn(report, label) && !Object.hasOwn(report, `${label}: All`))
      report[`${label}: All`] = report[label]
  return report
}

// Two independent stages, each with its own source: "ready" detects that TradingView finished the report,
// "read" takes its values. Each prefers TradingView page objects and falls back to the report page alone,
// so either stage keeps working when the other one's page objects break. A source that failed is not retried
// until the next test run: a broken path costs one timeout per run, not one per iteration.
tv.REPORT_SOURCE_OBJECTS = 'page_objects'
tv.REPORT_SOURCE_DOM = 'page_dom'
tv.reportSources = {ready: tv.REPORT_SOURCE_OBJECTS, read: tv.REPORT_SOURCE_OBJECTS}

tv.resetReportSources = () => {
  tv.reportSources = {ready: tv.REPORT_SOURCE_OBJECTS, read: tv.REPORT_SOURCE_OBJECTS}
  tv.lastReportSource = null
}

tv._switchReportSourceToDom = (stage, reason) => {
  if (tv.reportSources[stage] === tv.REPORT_SOURCE_DOM)
    return
  tv.reportSources[stage] = tv.REPORT_SOURCE_DOM
  const fallback = stage === 'ready' ? 'waiting by the report page signals (snackbars)' : 'parsing the report page'
  log.warn(`TradingView page objects failed for report ${stage} (${reason}), ${fallback} until the end of this test run. ` +
    'TradingView may have changed its page objects.')
}

tv.getPageReportState = async (strategyName = '') => {
  const response = await tv.callPageAction('getReportState', {strategyName}, 500)
  if (!response?.success)
    throw new Error(response?.error || 'no response data')
  return response.data
}

// Ready stage, page objects source: the report state ({version, isLoading}), or null when this source
// is switched off for the run - then only the report page signals are watched.
tv.captureReportState = async (strategyName = '') => {
  if (tv.reportSources.ready !== tv.REPORT_SOURCE_OBJECTS)
    return null
  try {
    return await tv.getPageReportState(strategyName)
  } catch (err) {
    tv._switchReportSourceToDom('ready', err.message)
    return null
  }
}

// Ready stage, page objects source: progress of the report since stateBefore, or null when unavailable
tv.getReportProgress = async (stateBefore, strategyName = '') => {
  if (!stateBefore)
    return null
  const state = await tv.captureReportState(strategyName)
  if (!state)
    return null
  const isChanged = state.version > stateBefore.version
  return {isStarted: state.isLoading || isChanged, isReady: !state.isLoading && isChanged}
}

// Ready stage, report page source: TradingView's snackbars
tv.getReportProgressBySnackbars = (isPrevMessageShowing = false) => {
  const isNeedUpdate = !!page.$(SEL.strategyReportNeedUpdate)
  const isInProcess = !!page.$(SEL.strategyReportInProcess)
  return {
    isStarted: isNeedUpdate || (isPrevMessageShowing ? isInProcess : !!page.$(SEL.strategyProcessMessage)),
    isInProcess,
    isReady: !!page.$(SEL.strategyReportReady),
  }
}

tv.getPageReport = async (testResults) => {
  const response = await tv.callPageAction('getPerformance', {strategyName: testResults?.shortName || testResults?.name || ''}, 1500)
  if (!response?.success)
    throw new Error(response?.error || 'no response data')
  return tv._mapPageReport(response.data?.performance)
}

// Read stage: the internal TradingView report first, the report page second. The page adds metrics the internal
// report lacks (CAGR, expectancy, outliers, streaks, periodical, time patterns) on every tab, including
// Breakdown and Distribution, so it is parsed whole and only on request: every tab costs a click and a render.
// Values of the internal report win over the page ones.
tv.readReport = async (testResults) => {
  let pageReport = null
  if (tv.reportSources.read === tv.REPORT_SOURCE_OBJECTS) {
    try {
      pageReport = await tv.getPageReport(testResults)
    } catch (err) {
      tv._switchReportSourceToDom('read', err.message)
    }
  }
  if (!pageReport) {
    tv.lastReportSource = tv.REPORT_SOURCE_DOM
    return tv._addPopupMetricAliases(await tv.parseReportTable())
  }
  if (tv.lastReportSource !== tv.REPORT_SOURCE_OBJECTS)
    log.info('Strategy report is read from TradingView page objects')
  tv.lastReportSource = tv.REPORT_SOURCE_OBJECTS
  if (!testResults?.parseExtraReportTabs)
    return pageReport
  const extraReport = await tv.parseReportTable()
  return {...extraReport, ...pageReport}
}

tv.backtestDelay = async (backtestDelay = 0, isRandom = true) => {
  let delayTime = backtestDelay * 1000
  const minimalDelay = 0.2 * 1000//, backtestDelay/2) // 20%
  if (backtestDelay) {
    if (isRandom) {
      const delayCorrection = delayTime/2 > minimalDelay ? delayTime/2 : minimalDelay * 1.1
      delayTime = randomInteger(Math.max(minimalDelay, delayTime/2), delayTime + delayCorrection) // from 0.1 value to 2x value - in average ~ delay == value
    }
    await page.waitForTimeout(delayTime)
  }
}

tv.getPerformance = async (testResults, ignoreWaiting = false) => {
  let reportData = {}
  let message = ''

  let isProcessStart = false
  let isProcessEnd = false
  let isDataChanged = false
  let sawStageSelector = false
  let isPrevMessageShowing = !!page.$(SEL.strategyProcessMessage) && !page.$(SEL.strategyReportNeedUpdate)
  let isProcessError = null
  const isStartProcessError = page.$(SEL.strategyReportError)
  const dataWaitingTime = testResults.isDeepTest ? testResults.dataLoadingTime * 2000 : testResults.dataLoadingTime * 1000
  // TradingView markup is a moving target, so changed report values are used as a
  // stage-selector-independent signal that the computation finished.
  const prevReport = tv._getLastStoredReport(testResults)
  const prevDataHash = tv._getReportDataHash(prevReport)
  // Snapshot of whatever tab happens to be visible right now, used only to notice a re-render -
  // cheap and click-free, see tv._getQuickReportSignature.
  const initialQuickSignature = prevDataHash ? tv._getQuickReportSignature() : ''
  let lastDataCheckTime = new Date()
  const dataCheckIntervalMs = 500
  // Ready stage: TradingView's own "report changed" counter is checked first, the snackbars second
  const pageStateBefore = ignoreWaiting ? null : tv.reportStateBeforeChange
  tv.reportStateBeforeChange = null
  const strategyName = testResults.shortName || testResults.name || ''
  let isPageSignal = false
  let isSnackbarReady = false
  let tikTime = 50
  let cycles = Math.ceil(5000 / tikTime)
  for (let i = 0; i < cycles; i++) {
    if ((await tv.getReportProgress(pageStateBefore, strategyName))?.isStarted) {
      isProcessStart = true
      break
    }
    isProcessStart = tv.getReportProgressBySnackbars(isPrevMessageShowing).isStarted
    if (ignoreWaiting || isProcessStart)
      break
    await page.waitForTimeout(tikTime)
  }
  let isDeepTestUpdateClicked = false
  let isNewUpdate = false
  if (ignoreWaiting) {
    isProcessStart = true
    isProcessEnd = true
  } else if (isProcessStart) {
    tikTime = 100
    const cycles = Math.ceil(dataWaitingTime / tikTime)
    for (let i = 0; i < cycles; i++) { // Waiting for an error 5000 ms
      const isDeepTestUpdateEl = page.$(SEL.strategyReportNeedUpdate)
      if (!isDeepTestUpdateClicked && isDeepTestUpdateEl !== null) {
        page.mouseClick(isDeepTestUpdateEl)
        await page.waitForSelector(SEL.strategyReportUpdate, 10000, true) // It shows succed some times (for current strategy update during deep test calculating)
        await page.waitForSelector(SEL.strategyReportInProcess, 1000, true)
        isDeepTestUpdateClicked = true
        testResults.isDeepTest = true
      }
      if (!isDeepTestUpdateClicked && (await tv.getReportProgress(pageStateBefore, strategyName))?.isReady) {
        isProcessEnd = true
        isPageSignal = true
        sawStageSelector = true
        break
      }
      if (!isStartProcessError || i * tikTime >= 5000)
        isProcessError = !!page.$(SEL.strategyReportError) && !page.$(SEL.strategyReportInProcess)
      const snackbarProgress = tv.getReportProgressBySnackbars()
      isProcessEnd = snackbarProgress.isReady
      isSnackbarReady = isSnackbarReady || snackbarProgress.isReady
      if (snackbarProgress.isInProcess || isProcessEnd)
        sawStageSelector = true
      if (!isProcessEnd && !isProcessError && prevDataHash &&
          (new Date() - lastDataCheckTime) >= dataCheckIntervalMs) {
        lastDataCheckTime = new Date()
        // Cheap, click-free check (see tv._getQuickReportSignature) - the authoritative
        // full parse (which does click through every report sub-tab) still runs exactly
        // once below, after the wait loop, via tv.parseReportTable().
        const tickSignature = tv._getQuickReportSignature()
        if (tickSignature && tickSignature !== initialQuickSignature) {
          isDataChanged = true
          isProcessEnd = true
        }
      }
      if (isProcessEnd && isDeepTestUpdateClicked && !isNewUpdate) {
        isNewUpdate = !!(await page.waitForSelector(SEL.strategyReportInProcess, 1000))
        isProcessEnd = !isNewUpdate
      } else {
        const isNotProcessMessage = !page.$(SEL.strategyProcessMessage) // it blinked after click on update or change stage
        if (isNotProcessMessage) {
          await page.waitForTimeout(1000) // waiting for process end message to disappear after update or stage change
          isProcessEnd = !page.$(SEL.strategyProcessMessage)
        }
      }
      if (isProcessError || isProcessEnd) {
        break
      }
      await page.waitForTimeout(tikTime)
    }
  }
  const startTime = new Date()
  // The internal report is complete once TradingView reports success, so only the user's delay applies;
  // reading the page needs a short render pause on top of it
  const isPageRenderNeeded = tv.reportSources.read !== tv.REPORT_SOURCE_OBJECTS || testResults.parseExtraReportTabs
  if(!ignoreWaiting && isProcessStart)
    await tv.backtestDelay(isPageRenderNeeded ? Math.max(testResults.backtestDelay, 0.25) : testResults.backtestDelay, testResults.randomDelay)
  let _waitTime = new Date() - startTime
  // A silent break of the page objects signal: TradingView finished the report (success snackbar),
  // but its report-changed counter did not move
  if (pageStateBefore && !isPageSignal && isSnackbarReady && !isDeepTestUpdateClicked &&
      tv.reportSources.ready === tv.REPORT_SOURCE_OBJECTS) {
    const progress = await tv.getReportProgress(pageStateBefore, strategyName)
    if (progress && !progress.isReady)
      tv._switchReportSourceToDom('ready', 'the report-changed counter did not change while TradingView showed the report ready')
  }
  const emptyState = tv._getReportEmptyState()
  isProcessError = !!document.querySelector(SEL.strategyReportError) && !emptyState
  reportData = await tv.readReport(testResults)
  const isNoTrades = tv.lastReportSource === tv.REPORT_SOURCE_OBJECTS
    ? reportData['Total trades: All'] === 0
    : emptyState?.type === 'no_trade_data'
  if (isNoTrades) {
    const noTradesReason = emptyState?.message || 'no closed trades'
    reportData['comment'] = tv._getReportDataHash(reportData)
      ? `No trades for these parameters (TradingView: "${noTradesReason}")`
      : `No report data: ${noTradesReason}`
    isProcessStart = true
    isProcessEnd = true
  }
  const finalDataHash = tv._getReportDataHash(reportData)
  if (prevDataHash && finalDataHash && finalDataHash !== prevDataHash)
    isDataChanged = true
  if (!isProcessError && !isProcessEnd && isDataChanged) {
    isProcessEnd = true
    isProcessStart = true
  }
  // Report data did not change vs the previous iteration and no genuine completion was detected
  // (TradingView did not recompute - typically because the candidate equals what is already set,
  // or the computation never started / timed out). The table still holds the previous numbers,
  // so this value is stale and must be marked, not trusted as a fresh result.
  // TradingView's own report-changed event proves a recompute, so equal values are then a genuine result
  const isStaleUnchanged = !isNoTrades && !isProcessError && !isDataChanged && !isPageSignal && !!prevDataHash && finalDataHash === prevDataHash
  try {
    if (testResults.perfomanceSummary.length && !isProcessError)
      log.debug('#', testResults.perfomanceSummary.length, testResults.perfomanceSummary[testResults.perfomanceSummary.length - 1][testResults.optParamName], '->', reportData[testResults.optParamName])
  } catch (err) {
    log.debug(err)
  }
  if (isStaleUnchanged)
    message += `${message ? '. ' : ''}WARNING: report not updated - value may be stale (TV did not recompute, parameters likely unchanged)`
  if (reportData['comment'])
    message += `${message ? '. ' : ''}${reportData['comment']}`
  const comment = message ? message : null
  if (comment)
    reportData['comment'] = comment
  return {
    error: isProcessError ? 2 : !isProcessStart ? 1 : !isProcessEnd ? 3 : null,
    message: message,
    data: reportData,
    isDataChanged: isDataChanged,
    isStaleUnchanged: isStaleUnchanged,
    isNoTrades: isNoTrades,
    sawStageSelector: sawStageSelector,
    isPageSignal: isPageSignal,
    _waitTime: _waitTime
  }
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
  window.postMessage({ name: 'iondvScript', action: actionName }, url) // TODO wait for data
  let iter = 0
  const tikTime = 50
  do {
    await page.waitForTimeout(tikTime)
    iter += 1
    if (tikTime * iter >= timeout)
      break
  } while (!tvPageMessageData.hasOwnProperty(actionName))
  return tvPageMessageData.hasOwnProperty(actionName) ? tvPageMessageData[actionName] : null
}

tv.callPageAction = async (actionName, payload = null, timeout = 4000) => {
  const url = window.location && window.location.origin ? window.location.origin : 'https://www.tradingview.com'
  const requestId = `${Date.now()}_${Math.random().toString(16).slice(2)}`
  const messageKey = `${actionName}#${requestId}`
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      if (tvPageMessageData.hasOwnProperty(messageKey))
        delete tvPageMessageData[messageKey]
      reject(new Error(`Timeout waiting for "${actionName}" response`))
    }, timeout)
    tvPageMessageData[messageKey] = (data) => {
      clearTimeout(timer)
      if (tvPageMessageData.hasOwnProperty(messageKey))
        delete tvPageMessageData[messageKey]
      resolve(data)
    }
    window.postMessage({ name: 'iondvScript', action: actionName, data: payload, requestId }, url)
  })
}
