const tv = {
  reportNode: null,
  reportDeepNode: null,
  tickerTextPrev: null,
  timeFrameTextPrev: null,
  isReportChanged: false,
  _settingsMethod: null
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
  const url = window.location && window.location.origin ? window.location.origin : 'https://www.tradingview.com'
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


tv.getStrategy = async (strategyName = '', isIndicatorSave = false, isDeepTest = false) => {
  try {
    await tv.openStrategyTab(isDeepTest)
  } catch (err) {
    console.warn('checkAndOpenStrategy error', err)
  }
  let isOpened = false
  if (strategyName)
    isOpened = await tv.openStrategyParameters(strategyName, true)
  else
    isOpened = await tv.openStrategyParameters(null, false)
  if (!isOpened) {
    throw new Error('It was not possible open strategy. Add it to the chart and try again.')
  }

  const dialogTitle = await page.waitForSelector(SEL.indicatorTitle)
  if (!dialogTitle || dialogTitle.innerText === null)
    throw new Error('It was not possible to find a strategy with parameters among the indicators. Add it to the chart and try again.')
  const indicatorName = tv.getStrategyNameFromPopup()
  if (!await tv.changeDialogTabToInput())
    throw new Error(`Can\'t activate input tab in strategy parameters` + SUPPORT_TEXT)

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
      } else if (indicProperties[i].querySelector('span[role="button"]')) { // List
        const buttonEl = indicProperties[i].querySelector('span[role="button"]')
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

tv.setStrategyParams = async (name, propVal, isDeepTest = false, keepStrategyParamOpen = false) => {

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
  let setResultNumber = 0
  let setPropertiesNames = {}
  for (let i = 0; i < indicProperties.length; i++) {
    const propText = indicProperties[i].innerText
    if (propText && propKeys.includes(propText)) {
      try {
        const rect = indicProperties[i].getBoundingClientRect()
        if (rect.top < 0 || rect.bottom > popupVisibleHeight || !indicProperties[i].checkVisibility()) {
          indicProperties[i].scrollIntoView() // TODO scroll by hight and if not visible, than scroll Into - faster becouse for 5-10 elemetns at the time
          await page.waitForTimeout(10)
          if (indicProperties[i].getBoundingClientRect()?.bottom > popupVisibleHeight)
            await page.waitForTimeout(50)
        }
      } catch {
      }
      setPropertiesNames[propText] = true
      setResultNumber++
      const propClassName = indicProperties[i].getAttribute('class')
      if (propClassName.includes('first-')) {
        i++
        let inputEl = indicProperties[i].querySelector('input')
        if (inputEl) {
          page.setInputElementValue(inputEl, propVal[propText])
          inputEl = null
        } else {
          let buttonEl = indicProperties[i].querySelector('span[role="button"]')
          if (buttonEl?.innerText) { // DropDown List
            buttonEl.click()
            buttonEl = null
            await page.setSelByText(SEL.strategyListOptions, propVal[propText])
          }
        }
      } else if (propClassName.includes('fill-')) {
        let checkboxEl = indicProperties[i].querySelector('input[type="checkbox"]')

        if (checkboxEl) {
          // const isChecked = checkboxEl.getAttribute('checked') !== null ? checkboxEl.checked : false
          const isChecked = Boolean(checkboxEl.checked)
          if (Boolean(propVal[propText]) !== isChecked) {
            page.mouseClick(checkboxEl)
            checkboxEl.checked = Boolean(propVal[propText])
          }
          checkboxEl = null
        }
      }
      setResultNumber = Object.keys(setPropertiesNames).length
      if (propKeys.length === setResultNumber)
        break
    }
  }
  indicProperties = null
  // TODO check if not equal propKeys.length === setResultNumber, because there is none of changes too. So calculation doesn't start
  const elOkBtn = page.$(SEL.okBtn)
  if (!keepStrategyParamOpen && elOkBtn) {
   elOkBtn.click()
  }

  return true
}

tv.changeDialogTabToInput = async () => {
  let isInputTabActive = document.querySelector(SEL.tabInputActive)
  if (isInputTabActive) return true
  const inputTabEl = document.querySelector(SEL.tabInput)
  if (!inputTabEl) {
    throw new Error('There are no parameters in this strategy that can be optimized (There is no "Inputs" tab with input values)')
  }
  inputTabEl.click()
  isInputTabActive = await page.waitForSelector(SEL.tabInputActive, 2000)
  return !!isInputTabActive
}

tv._openStrategyByButtonNearTitle = async () => {
  if (tv._settingsMethod !== null && tv._settingsMethod !== 'setButton')
    return false
  const stratParamEl = page.$(SEL.strategyDialogParam) // Version before 2025.02.21 with param button near title
  if (!stratParamEl)
    return false
  tv._settingsMethod = 'setButton'
  page.mouseClick(stratParamEl) // stratParamEl.click()
  return true
}

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
  const strategyCaptionEl = page.$(SEL.strategyCaption)
  if (!strategyCaptionEl)
    return false
  page.mouseClick(strategyCaptionEl)
  const menuItemSettingsEl = await page.waitForSelector(SEL.strategyMenuItemSettings)
  if (!menuItemSettingsEl)
    return false
  tv._settingsMethod = 'setMenu'
  page.mouseClick(menuItemSettingsEl)
  return true
}

tv.getStrategyNameFromPopup = () => {
  const strategyTitleEl = page.$(SEL.indicatorTitle)
  if (strategyTitleEl)
    return strategyTitleEl.innerText
  return null
}

tv.openStrategyParameters = async (indicatorTitle, searchAgainstStrategies = false) => {
  const curStrategyTitle = tv.getStrategyNameFromPopup()
  let isOpened = !!curStrategyTitle
  if (!isOpened && (indicatorTitle && indicatorTitle !== curStrategyTitle) && searchAgainstStrategies) {
    isOpened = await tv._openStrategyParamsByStrategyDoubleClickBy(indicatorTitle)
    tv._settingsMethod = null
  } else if (!isOpened) {
    isOpened = await tv._openStrategyByButtonNearTitle()
    if (!isOpened)
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
    await ui.showErrorPopup('There is not strategy param button on the strategy tab. Test stopped. Open correct page please')
    return null
  }
  const stratIndicatorEl = await page.waitForSelector(SEL.indicatorTitle, 2000)
  if (!stratIndicatorEl) {
    await ui.showErrorPopup('There is not strategy parameters popup. If was not opened, probably TV UI changes. ' +
      'Reload page and try again. Test stopped. Open correct page please')
    return null
  }
  const tabInputEl = document.querySelector(SEL.tabInput)
  if (!tabInputEl) {
    await ui.showErrorPopup('There is not strategy parameters input tab. Test stopped. Open correct page please')
    return null
  }
  page.mouseClick(tabInputEl) //tabInputEl.click()

  const tabInputActiveEl = await page.waitForSelector(SEL.tabInputActive)
  if (!tabInputActiveEl) {
    await ui.showErrorPopup('There is not strategy parameters active input tab. Test stopped. Open correct page please')
    return null
  }
  return true
}

tv.setDeepTest = async (isDeepTest, deepStartDate = null) => {
  function isTurnedOn() {
    return page.$(SEL.strategyDeepTestCheckboxChecked)
  }

  function isTurnedOff() {
    return page.$(SEL.strategyDeepTestCheckboxUnchecked)
  }

  async function turnDeepModeOn() {
    const switchTurnedOffEl = isTurnedOff()
    if (switchTurnedOffEl)
      switchTurnedOffEl.click() // page.mouseClick(switchTurnedOffEl)
    const el = await page.waitForSelector(SEL.strategyDeepTestCheckboxChecked)
    if (!el)
      throw new Error('Can not switch to deep backtesting mode')
  }

  async function turnDeepModeOff() {
    const switchTurnedOnEl = isTurnedOn()
    if (switchTurnedOnEl)
      switchTurnedOnEl.click() //page.mouseClick(switchTurnedOnEl) // // switchTurnedOnEl.click()
    const el = await page.waitForSelector(SEL.strategyDeepTestCheckboxUnchecked)
    if (!el)
      throw new Error('Can not switch off from deep backtesting mode')
  }

  if ((typeof selStatus.userDoNotHaveDeepBacktest === 'undefined' || selStatus.userDoNotHaveDeepBacktest) && !isDeepTest)
    return // Do not check if user do not have userDoNotHaveDeepBacktest switch

  if (selStatus.isNewVersion === false) {
    console.log('[INFO] FOR PREVIOUS VERSION (Feb of 2025) DEEP BACKTEST SHOULD BE SET MANUALLY')
    return
  }

  /*
  let deepCheckboxEl = await page.waitForSelector(SEL.strategyDeepTestCheckbox)
  if (!deepCheckboxEl) {
    selStatus.userDoNotHaveDeepBacktest = true
    if (isDeepTest)
      throw new Error('Deep Backtesting mode switch not found. Do you have Premium subscription or may be TV UI changed?')
    return
  } else {
    selStatus.userDoNotHaveDeepBacktest = false
  }

  if (!isDeepTest) {
    await turnDeepModeOff()
    return
  }
  if (isTurnedOff())
    await turnDeepModeOn()
  */
  if (deepStartDate) {
    try {
      await tv.setDeepTestDateRange(deepStartDate)
    } catch (dateRangeError) {
      console.warn('Could not set deep test date range:', dateRangeError)
      // Continue with testing even if date range setting fails
    }
  }
}

/**
 * Sets the deep test date range using the new TradingView UI flow
 * New UI flow: 
 * 1. Click date range button (shows current range like "Jan 1, 2024 — Jul 4, 2025")
 * 2. Click "Custom date range..." button
 * 3. Set start and end date inputs
 * 4. Click "Select" button
 * 
 * @param {string} deepStartDate - Start date in YYYY-MM-DD format
 */
tv.setDeepTestDateRange = async (deepStartDate) => {
  try {
    console.log('[DEBUG] Starting setDeepTestDateRange with date:', deepStartDate)
    
    // First, try the old method as fallback
    const oldStartDateEl = await page.waitForSelector(SEL.strategyDeepTestStartDate, 1000)
    if (oldStartDateEl) {
      console.log('[DEBUG] Using old UI method for date setting')
      page.clearInputElementValue(oldStartDateEl)
      page.setInputElementValue(oldStartDateEl, deepStartDate)
      return
    }
    
    // Step 1: Click the date range button to open the date picker
    console.log('[DEBUG] Trying new UI method for date setting')
    let dateRangeButtonEl = null
    const dateRangeButtons = document.querySelectorAll(SEL.strategyDeepTestDateRangeButton)
    console.log('[DEBUG] Found', dateRangeButtons.length, 'potential date range buttons')
    
    // Find a date range button that contains a date range (e.g., "Jan 1, 2024 — Jul 4, 2025")
    for (let button of dateRangeButtons) {
      console.log('[DEBUG] Checking button text:', button.innerText)
      if (button.innerText && (button.innerText.includes('—') || button.innerText.includes('-') || button.innerText.includes('2024') || button.innerText.includes('2025'))) {
        dateRangeButtonEl = button
        console.log('[DEBUG] Found date range button')
        break
      }
    }
    
    if (!dateRangeButtonEl) {
      console.warn('[DEBUG] Date range button not found, skipping date setting')
      return
    }
    
    page.mouseClick(dateRangeButtonEl)
    await page.waitForTimeout(1000)

    // Step 2: Click "Custom date range..." button
    const customDateRangeButtons = document.querySelectorAll(SEL.strategyDeepTestCustomDateRangeButton)
    console.log('[DEBUG] Found', customDateRangeButtons.length, 'potential custom date range buttons')
    
    let customDateRangeButtonEl = null
    for (let button of customDateRangeButtons) {
      console.log('[DEBUG] Checking button text:', button.innerText)
      const buttonText = button.innerText || button.getAttribute('aria-label') || ''
      if (buttonText && (buttonText.includes('Custom date range') || buttonText.includes('custom date range'))) {
        customDateRangeButtonEl = button
        console.log('[DEBUG] Found custom date range button')
        break
      }
    }
    
    if (!customDateRangeButtonEl) {
      console.warn('[DEBUG] Custom date range button not found, skipping date setting')
      return
    }
    
    page.mouseClick(customDateRangeButtonEl)
    await page.waitForTimeout(500)

    // Step 3: Set start and end date inputs
    const dateInputs = document.querySelectorAll(SEL.strategyDeepTestDateInputs)
    console.log('[DEBUG] Found', dateInputs.length, 'date input fields')
    
    if (dateInputs.length >= 2) {
      const endDate = new Date()
      endDate.setFullYear(endDate.getFullYear()) // Add one year
      const endDateString = endDate.toISOString().split('T')[0] // Format as YYYY-MM-DD

      if (dateInputs[0].value === deepStartDate && dateInputs[1].value === endDateString) {
        console.log('[DEBUG] Dates already set correctly. Clicking Cancel.')
        const cancelButton = document.querySelector(SEL.strategyDeepTestCancelButton)
        if (cancelButton) {
          page.mouseClick(cancelButton)
          await page.waitForTimeout(250) // Wait for dialog to close
        }
        return // Dates are correct, no need to proceed
      }
      
      // Set start date (first input)
      console.log('[DEBUG] Setting start date to:', deepStartDate)
      page.clearInputElementValue(dateInputs[0])
      page.setInputElementValue(dateInputs[0], deepStartDate)
      
      // Set end date (second input) - use current date or a future date
      console.log('[DEBUG] Setting end date to:', endDateString)
      page.clearInputElementValue(dateInputs[1])
      page.setInputElementValue(dateInputs[1], endDateString)
      
      await page.waitForTimeout(200)
    } else if (dateInputs.length === 1) {
      // Only one input found, set it as start date
      console.log('[DEBUG] Only one date input found, setting start date')
      page.clearInputElementValue(dateInputs[0])
      page.setInputElementValue(dateInputs[0], deepStartDate)
      await page.waitForTimeout(200)
    } else {
      console.warn('[DEBUG] Date input fields not found, skipping date setting')
      return
    }

    // Step 4: Click "Select" button
    const selectButtons = document.querySelectorAll(SEL.strategyDeepTestSelectButton)
    console.log('[DEBUG] Found', selectButtons.length, 'potential select buttons')
    
    let selectButtonEl = null
    for (let button of selectButtons) {
      console.log('[DEBUG] Checking select button text:', button.innerText)
      if (button.innerText && (button.innerText.includes('Select') || button.innerText.includes('select'))) {
        selectButtonEl = button
        console.log('[DEBUG] Found Select button')
        break
      }
    }
    
    if (selectButtonEl) {
      if (selectButtonEl.disabled || selectButtonEl.getAttribute('aria-disabled') === 'true') {
        console.log('[DEBUG] Select button is disabled, attempting to select first available date.');
        const firstAvailableButton = document.querySelector(SEL.strategyDeepTestFirstAvailableDateButton);
        if (firstAvailableButton) {
          page.mouseClick(firstAvailableButton);
          await page.waitForTimeout(500); // Wait for UI to update
        } else {
          console.warn('[DEBUG] "Select first available date" button not found.');
        }
        
        // NOW, check again.
        if (selectButtonEl.disabled || selectButtonEl.getAttribute('aria-disabled') === 'true') {
            // Still disabled. Give up and cancel.
            console.warn('[DEBUG] Select button is still disabled. Clicking Cancel.');
            const cancelButton = document.querySelector(SEL.strategyDeepTestCancelButton)
            if (cancelButton) {
              page.mouseClick(cancelButton)
              await page.waitForTimeout(250) // Wait for dialog to close
            }
        } else {
            // It got enabled. Click it.
            console.log('[DEBUG] Clicking Select button');
            page.mouseClick(selectButtonEl);
            await page.waitForTimeout(500);
        }

      } else {
        // It was enabled from the start. Click it.
        console.log('[DEBUG] Clicking Select button');
        page.mouseClick(selectButtonEl);
        await page.waitForTimeout(500);
      }
    } else {
      console.warn('[DEBUG] Select button not found, skipping')
    }

  } catch (error) {
    console.error('Error setting deep test date range:', error)
    // Fallback to old method
    try {
      const startDateEl = await page.waitForSelector(SEL.strategyDeepTestStartDate, 1000)
      if (startDateEl) {
        console.log('[DEBUG] Using fallback method for date setting')
        page.clearInputElementValue(startDateEl)
        page.setInputElementValue(startDateEl, deepStartDate)
      } else {
        console.warn('[DEBUG] Neither new nor old UI method worked for date setting')
      }
    } catch (fallbackError) {
      console.warn('[DEBUG] Fallback method also failed:', fallbackError)
    }
  }
}



tv.checkAndOpenStrategy = async (name, isDeepTest = false) => {
  let indicatorTitleEl = page.$(SEL.indicatorTitle)
  if (!indicatorTitleEl || indicatorTitleEl.innerText !== name) {
    try {
      await tv.openStrategyTab(isDeepTest)
    } catch (err) {
      console.warn('checkAndOpenStrategy error', err)
      return null
    }
    const isOpened = await tv.openStrategyParameters(name)
    if (!isOpened) {
      console.warn('Can able to open current strategy parameters')
      await ui.showErrorPopup('Can able to open current strategy parameters Reload the page, leave one strategy on the chart and try again.')
      return null
    }
    if (name) {
      indicatorTitleEl = page.$(SEL.indicatorTitle)
      if (!indicatorTitleEl || indicatorTitleEl.innerText !== name) {
        await ui.showErrorPopup(`The ${name} strategy parameters could not opened. ${indicatorTitleEl.innerText ? 'Opened "' + indicatorTitleEl.innerText + '".' : ''} Reload the page, leave one strategy on the chart and try again.`)
        return null
      }
    }
  }
  await page.waitForSelector(SEL.indicatorProperty)
  return indicatorTitleEl
}

tv.checkIsNewVersion = async (timeout = 1000) => {
  // check by deepHistory element if it's present
  if (typeof selStatus === 'undefined' || selStatus.isNewVersion !== null) // Already checked
    return
  let element = await page.waitForSelector(SEL.strategyPerformanceTab, timeout)
  if (element) { // Old versions
    selStatus.isNewVersion = false
    console.log('[INFO] Prev TV UI by performance tab')
    return
  }
  selStatus.isNewVersion = true
  element = await page.waitForSelector(SEL.strategyPerformanceTab, timeout)
  if (element) { // New versions
    console.log('[INFO] New TV UI by performance tab')
    return
  }
  console.warn('[WARN] Can able to detect current TV UI changes. Probably Deep mode set. Set it to new one')
}

tv.openStrategyTab = async (isDeepTest = false) => {
  let isStrategyActiveEl = await page.waitForSelector(SEL.strategyTesterTabActive)
  if (!isStrategyActiveEl) {
    const strategyTabEl = await page.waitForSelector(SEL.strategyTesterTab)
    if (strategyTabEl) {
      strategyTabEl.click()
      await page.waitForSelector(SEL.strategyTesterTabActive)
    } else {
      throw new Error('There is not "Strategy Tester" tab on the page. Open correct page.' + SUPPORT_TEXT)
    }
  }
  let strategyCaptionEl = document.querySelector(SEL.strategyCaption) // 2023-02-24 Changed to more complicated logic - for single and multiple strategies in page
  if (!strategyCaptionEl) { // || !strategyCaptionEl.innerText) {
    throw new Error('There is not strategy name element on "Strategy Tester" tab.' + SUPPORT_TEXT)
  }
  await tv.checkIsNewVersion()
  let stratSummaryEl = await page.waitForSelector(SEL.strategyPerformanceTab, 1000)
  if (!stratSummaryEl) {
    await tv.setDeepTest(isDeepTest)
    if (isDeepTest) {
      const generateBtnEl = page.$(SEL.strategyDeepTestGenerateBtn)
      if (generateBtnEl)
        page.mouseClick(generateBtnEl)
    }
    stratSummaryEl = await page.waitForSelector(SEL.strategyPerformanceTab, 1000)
    if (!stratSummaryEl)
      throw new Error('There is not "Performance" tab on the page. Open correct page.' + SUPPORT_TEXT)

  }
  if (!page.$(SEL.strategyPerformanceTabActive))
    stratSummaryEl.click()
  const isActive = await page.waitForSelector(SEL.strategyPerformanceTabActive, 1000)
  if (!isActive) {
    console.error('The "Performance summary" tab is not active after click')
  }
  return true
}

tv.switchToStrategyTabAndSetObserveForReport = async (isDeepTest = false) => {
  await tv.openStrategyTab(isDeepTest)

  const testResults = {}
  testResults.ticker = await tvChart.getTicker()
  testResults.timeFrame = await tvChart.getCurrentTimeFrame()
  let strategyCaptionEl = document.querySelector(SEL.strategyCaption)
  testResults.name = strategyCaptionEl.getAttribute('data-strategy-title') //strategyCaptionEl.innerText

  const reportEl = await page.waitForSelector(SEL.strategyReportObserveArea, 10000)
  if (!tv.reportNode) {
    // TODO When user switch to deep backtest or minimize window - it should be deleted and created again. Or delete observer after every test
    tv.reportNode = await page.waitForSelector(SEL.strategyReportObserveArea, 10000)
    if (tv.reportNode) {
      const reportObserver = new MutationObserver(() => {
        tv.isReportChanged = true
      });
      reportObserver.observe(tv.reportNode, {
        childList: true,
        subtree: true,
        attributes: false,
        characterData: false
      });
      console.log('[INFO] Observer added to tv.reportNode')
    } else {
      throw new Error('The strategy report did not found.' + SUPPORT_TEXT)
    }
  }

  if (isDeepTest) {
    if (!tv.reportDeepNode) {
      tv.reportDeepNode = await page.waitForSelector(SEL.strategyReportDeepTestObserveArea, 5000)
      if (tv.reportDeepNode) {
        const reportObserver = new MutationObserver(() => {
          tv.isReportChanged = true
        });
        reportObserver.observe(tv.reportDeepNode, {
          childList: true,
          subtree: true,
          attributes: false,
          characterData: false
        });
        console.log('[INFO] Observer added to tv.reportDeepNode')
      } else {
        console.error('[INFO] The strategy deep report did not found.')
      }
    }
  }
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
      console.error(`Can't set parameters tab to input`)
      ui.isMsgShown = true
      return
    }

    console.log("Tradingview indicator parameters window opened for ticker:", tickerText);
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
      await ui.showErrorPopup(`One of the parameters named ${notFoundParam} was not found in the window. Check the script.\n`)
      ui.isMsgShown = true
      return
    }
    document.querySelector(SEL.okBtn).click()
    const allSignals = [].concat(tsData.buy.split(','), tsData.sell.split(',')).sort()
    await ui.showPopup(`${allSignals.length} signals are set.\n  - date of the first signal: ${new Date(parseInt(allSignals[0]))}.\n  - date of the last signal: ${new Date(parseInt(allSignals[allSignals.length - 1]))}`)
    ui.isMsgShown = true
  }
}

const paramNamePrevVersionMap = {
  // Prev version: New version from set parameters
  'Net Profit': 'Net profit',
  'Gross Profit': 'Gross profit',
  'Gross Loss': 'Gross loss',
  'Max Drawdown': 'Max equity drawdown',
  'Buy & Hold Return': 'Buy & hold return',
  'Sharpe Ratio': 'Sharpe ratio',
  'Sortino Ratio': 'Sortino ratio',
  'Max Contracts Held': 'Max contracts held',
  'Open PL': 'Open P&L',
  'Commission Paid': 'Commission paid',
  'Total Closed Trades': 'Total trades',
  'Total Open Trades': 'Total open trades',
  'Number Winning Trades': 'Winning trades',
  'Number Losing Trades': 'Losing trades',
  'Avg Trade': 'Avg P&L',
  'Avg Winning Trade': 'Avg winning trade',
  'Avg Losing Trade': 'Avg losing trade',
  'Ratio Avg Win / Avg Loss': 'Ratio avg win / avg loss',
  'Largest Winning Trade': 'Largest winning trade',
  'Percent Profitable': 'Percent profitable',
  'Largest Losing Trade': 'Largest losing trade',
  'Avg # Bars in Trades': 'Avg # bars in trades',
  'Avg # Bars in Winning Trades': 'Avg # bars in winning trades',
  'Avg # Bars in Losing Trades': 'Avg # bars in losing trades',
  'Margin Calls': 'Margin calls',
}

tv.convertParameterName = (field) => {
  if (selStatus.isNewVersion)  // new version
    return field
  if (Object.hasOwn(paramNamePrevVersionMap, field))
    return paramNamePrevVersionMap[field]
  return field
}


tv.isParsed = false

tv._parseRows = (allReportRowsEl, strategyHeaders, report) => {
  function parseNumTypeByRowName(rowName, value) {
    const digitalValues = value.replaceAll(/([\-\d\.\n])|(.)/g, (a, b) => b || '')
    return rowName.toLowerCase().includes('trades') || rowName.toLowerCase().includes('contracts held')
      ? parseInt(digitalValues)
      : parseFloat(digitalValues)
  }

  for (let rowEl of allReportRowsEl) {
    if (rowEl) {
      const allTdEl = rowEl.querySelectorAll('td')
      if (!allTdEl || allTdEl.length < 2 || !allTdEl[0]) {
        continue
      }
      let paramName = allTdEl[0].innerText || ''
      paramName = tv.convertParameterName(paramName)
      let isSingleValue = allTdEl.length === 3 || ['Buy & hold return', 'Max equity run-up', 'Max equity drawdown',
        'Open P&L', 'Sharpe ratio', 'Sortino ratio'
      ].includes(paramName)
      for (let i = 1; i < allTdEl.length; i++) {
        if (isSingleValue && i >= 2)
          continue
        let values = allTdEl[i].innerText
        const isNegative = ['Gross loss', 'Commission paid', 'Max equity run-up', 'Max equity drawdown',
          'Losing trades', 'Avg losing trade', 'Largest losing trade', 'Largest losing trade percent',
          'Avg # bars in losing trades', 'Margin calls'
        ].includes(paramName.toLowerCase())// && allTdEl[i].querySelector('[class^="negativeValue"]')
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
                if (report[nameDigits] > 0 && isNegative)
                  report[nameDigits] = report[nameDigits] * -1
              } else {
                report[nameDigits] = valuesPair[0]
              }
              if (Boolean(digitVal1)) {
                report[namePercents] = parseNumTypeByRowName(namePercents, digitVal1)
                if (report[namePercents] > 0 && isNegative)
                  report[namePercents] = report[namePercents] * -1
              } else {
                report[namePercents] = valuesPair[1]
              }
            }
          } else if (Boolean(digitOfValues)) {
            report[nameDigits] = parseNumTypeByRowName(namePercents, digitalValues)
            if (report[nameDigits] > 0 && isNegative)
              report[nameDigits] = report[nameDigits] * -1
          } else
            report[nameDigits] = values
        }
      }
    }
  }
  return report
}


tv.parseReportTable = async (isDeepTest) => {
  const selHeader = isDeepTest ? SEL.strategyReportDeepTestHeader : SEL.strategyReportHeader
  const selRow = isDeepTest ? SEL.strategyReportDeepTestRow : SEL.strategyReportRow
  await page.waitForSelector(selHeader, 2500)

  let allHeadersEl = document.querySelectorAll(selHeader)
  if (!allHeadersEl || !(allHeadersEl.length === 4 || allHeadersEl.length === 5)) { // 5 - Extra column for full screen
    if (!tv.isParsed)
      throw new Error('Can\'t get performance headers.' + SUPPORT_TEXT)
    else
      return {}
  }
  let strategyHeaders = []
  for (let headerEl of allHeadersEl) {
    if (headerEl)
      strategyHeaders.push(headerEl.innerText)
  }
  let report = {}
  await page.waitForSelector(selRow, 2500)
  let allReportRowsEl = document.querySelectorAll(selRow)
  if (!allReportRowsEl || allReportRowsEl.length === 0) {
    if (!tv.isParsed)
      throw new Error('Can\'t get performance rows.' + SUPPORT_TEXT)
  } else {
    tv.isParsed = true
  }
  report = tv._parseRows(allReportRowsEl, strategyHeaders, report)
  if (selStatus.isNewVersion) {
    const tabs = [
      [SEL.strategyTradeAnalysisTab, SEL.strategyTradeAnalysisTabActive],
      [SEL.strategyRatiosTab, SEL.strategyRatiosTabActive]]
    for (const sel of tabs) {
      page.mouseClickSelector(sel[0])
      const tabEl = await page.waitForSelector(sel[1], 1000)
      if (tabEl) {
        strategyHeaders = []
        allHeadersEl = document.querySelectorAll(selHeader)
        for (let headerEl of allHeadersEl) {
          if (headerEl)
            strategyHeaders.push(headerEl.innerText)
        }
        await page.waitForSelector(selRow, 2500)
        let allReportRowsEl = document.querySelectorAll(selRow)
        if (allReportRowsEl && allReportRowsEl.length !== 0) {
          report = tv._parseRows(allReportRowsEl, strategyHeaders, report)
        }
      }
    }
    page.mouseClickSelector(SEL.strategyPerformanceTab)
    await page.waitForSelector(SEL.strategyPerformanceTabActive, 1000)
  }
  return report
}

tv.generateDeepTestReport = async () => { //loadingTime = 60000) => {
  let generateBtnEl = await page.waitForSelector(SEL.strategyDeepTestGenerateBtn)
  if (generateBtnEl) {
    // page.mouseClick(generateBtnEl) // // generateBtnEl.click()
    generateBtnEl.click()
    await page.waitForSelector(SEL.strategyDeepTestGenerateBtnDisabled, 1000) // Some times is not started
    let progressEl = await page.waitForSelector(SEL.strategyReportDeepTestInProcess, 1000)
    generateBtnEl = await page.$(SEL.strategyDeepTestGenerateBtn)
    if (!progressEl && generateBtnEl) { // Some time button changed, but returned
      generateBtnEl.click()
    }

  } else if (page.$(SEL.strategyDeepTestGenerateBtnDisabled)) {
    // Check for update report button even if no generation needed
    await tv.handleUpdateReportButton()
    return 'Deep backtesting strategy parameters are not changed'
  } else {
    throw new Error('Error for generate deep backtesting report due the button is not exist.' + SUPPORT_TEXT)
  }
  return ''
}


tv.getPerformance = async (testResults, isIgnoreError = false) => {
  let reportData = {}
  let message = ''
  let isProcessError = null
  let selProgress = SEL.strategyReportInProcess
  let selReady = SEL.strategyReportReady
  const dataWaitingTime = testResults.isDeepTest ? testResults.dataLoadingTime * 2000 : testResults.dataLoadingTime * 1000
  if (testResults.isDeepTest) {
//    message = await tv.generateDeepTestReport() //testResults.dataLoadingTime * 2000)
//    if (message)
//      isProcessError = true
    selProgress = SEL.strategyReportDeepTestInProcess
    selReady = SEL.strategyReportDeepTestReady
  }

  let isProcessStart = await page.waitForSelector(selProgress, 2500)
  let isProcessEnd = tv.isReportChanged
  if (isProcessStart) {
    const tick = 100
    for (let i = 0; i < 5000 / tick; i++) { // Waiting for an error 5000 ms      // isProcessEnd = await page.waitForSelector(SEL.strategyReportError, 5000)
      isProcessError = await page.waitForSelector(SEL.strategyReportError, tick)
      isProcessEnd = page.$(selReady)
      if (isProcessError || isProcessEnd) {
        break
      }
    }
    if (isProcessError == null)
      isProcessEnd = await page.waitForSelector(selReady, dataWaitingTime)
  } else if (isProcessEnd)
    isProcessStart = true

  isProcessError = isProcessError || document.querySelector(SEL.strategyReportError)
  console.log('[DEBUG] Process error check:', isProcessError)
  await page.waitForTimeout(250) // Waiting for update digits. 150 is enough but 250 for reliable TODO Another way?

  // Handle "Update report" button if it appears - integrated into main process flow
  if (!isProcessError) {
    // Wait for loading snackbar to appear
    let loadingSnackbar = await page.waitForSelector(SEL.strategyReportLoadingSnackbar, 2000)
    if (loadingSnackbar) {
      console.log('[INFO] Report update loading started, waiting for completion...')
      isProcessStart = true
    } else {
      console.log('[INFO] Report update loading not started, Checking for Update report button...')
      const updateReportButtons = document.querySelectorAll(SEL.strategyDeepTestUpdateReportButton)
      let updateReportButtonEl = null
      
      for (let button of updateReportButtons) {
        if (button.innerText && button.innerText.includes('Update report')) {
          updateReportButtonEl = button
          isProcessStart = true
          break
        }
      }

      if (updateReportButtonEl) {
        console.log('[INFO] Found Update report button, clicking and waiting for completion...')
        page.mouseClick(updateReportButtonEl)
      }

      // Wait for loading snackbar to appear
      loadingSnackbar = await page.waitForSelector(SEL.strategyReportLoadingSnackbar, 3000)
      if (loadingSnackbar) {
        console.log('[INFO] Report update loading started, waiting for completion...')
        isProcessStart = true
      }
    }

    if (isProcessStart) {
      // Wait for loading to complete - integrated into main process detection
      const maxWaitTime = 30000 // 30 seconds max wait
      const startTime = Date.now()
      
      while (Date.now() - startTime < maxWaitTime) {
        const isStillLoading = document.querySelector(SEL.strategyReportLoadingSnackbar)
        const isSuccess = document.querySelector(SEL.strategyReportSuccessSnackbar)
        
        if (!isStillLoading || isSuccess) {
          console.log('[INFO] Report update completed')
          isProcessEnd = true
          break
        }
        await page.waitForTimeout(500)
      }
      // Give a little extra time for the report to fully render
      await page.waitForTimeout(1000)
    }
  }

  if (!isProcessError) {
    console.log('[DEBUG] No process error, parsing report table...')
    reportData = await tv.parseReportTable(testResults.isDeepTest)
    console.log('[DEBUG] Parsed report data:', reportData)
  } else {
    console.log('[DEBUG] Process error detected, skipping report parsing')
  }
  
  if (!isProcessError && !isProcessEnd && testResults.perfomanceSummary.length && !testResults.isDeepTest) {
    const lastRes = testResults.perfomanceSummary[testResults.perfomanceSummary.length - 1] // (!) Previous value maybe in testResults.filteredSummary
    console.log('[DEBUG] Checking for data changes - last result:', lastRes)
    console.log('[DEBUG] Current report data:', reportData)
    console.log('[DEBUG] Optimizing parameter name:', testResults.optParamName)
    
    if (reportData.hasOwnProperty(testResults.optParamName) && lastRes.hasOwnProperty(testResults.optParamName) &&
      reportData[testResults.optParamName] !== lastRes[testResults.optParamName]) {
      console.log('[DEBUG] Data changed - setting process end and start to true')
      console.log('[DEBUG] Old value:', lastRes[testResults.optParamName], 'New value:', reportData[testResults.optParamName])
      isProcessEnd = true
      isProcessStart = true
    } else {
      console.log('[DEBUG] No data change detected')
    }
  }
  
  if (reportData['comment']) {
    console.log('[DEBUG] Adding report comment to message:', reportData['comment'])
    message += '. ' + reportData['comment']
  }
  
  const comment = message ? message : testResults.isDeepTest ? 'Deep BT. ' : null
  console.log('[DEBUG] Final comment:', comment)
  
  if (comment) {
    if (reportData['comment']) {
      console.log('[DEBUG] Merging comments')
      reportData['comment'] = comment ? comment + ' ' + reportData['comment'] : reportData['comment']
    } else {
      console.log('[DEBUG] Setting new comment')
      reportData['comment'] = comment
    }
  }
  
  const result = {
    error: isProcessError ? 2 : !isProcessStart ? 1 : !isProcessEnd ? 3 : null,
    message: message,
    data: reportData
  }
  console.log('[DEBUG] Returning result:', result)
  return result
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
