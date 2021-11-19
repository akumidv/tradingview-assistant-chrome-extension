const tv = {
  reportNode: null,
  tickerTextPrev: null,
  timeFrameTextPrev: null,
  isReportChanged: false
}

tv.getStrategy = async (strategyName, isIndicatorSave = false) => {
  let strategyData = {}
  let indicatorName = null
  if(strategyName !== null) {
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
  } else {
    const dialogTitle = await page.waitForSelector(SEL.indicatorTitle, 2500)
    if (!dialogTitle || !dialogTitle.innerText) {
      if (document.querySelector(SEL.cancelBtn))
        document.querySelector(SEL.cancelBtn).click()
    } else {
      let isStrategyPropertiesTab = document.querySelector(SEL.tabProperties) // For strategy only
      if (isIndicatorSave || isStrategyPropertiesTab) {
        indicatorName = dialogTitle.innerText
      }
    }
  }
  if(indicatorName === null)
    return strategyData
  strategyData = {name: indicatorName, properties: {}}
  if(await tv.changeDialogTabToInput()) {
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
            const digPropValue = parseFloat(propValue) == parseInt(propValue) ? parseInt(propValue) : parseFloat(propValue)  // TODO how to get float from param or just search point in string
            if(!isNaN(propValue))
              strategyData.properties[propText] = digPropValue
            else
              strategyData.properties[propText] = propValue
          } else {
            strategyData.properties[propText] = propValue
          }
        } else if(indicProperties[i].querySelector('span[role="button"]')) { // List
          const buttonEl = indicProperties[i].querySelector('span[role="button"]')
          if(!buttonEl)
            continue
          const propValue = buttonEl.innerText
          if(propValue) {
            if(isIndicatorSave) {
              strategyData.properties[propText] = propValue
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
                strategyData.properties[propText] = allOptionsList
              page.mouseClick(buttonEl)
            } else {
              strategyData.properties[propText] = propValue
            }
          }
        } else { // Undefined
          continue
        }
      } else if (propClassName.includes('fill-')) {
        const element = indicProperties[i].querySelector('input[type="checkbox"]')
        if(element)
          strategyData.properties[propText] = element.getAttribute('checked') !== null ? element.checked : false
        else { // Undefined type of element
          continue
        }
      } else if (propClassName.includes('titleWrap-')) { // Titles bwtwen parameters
        continue
      } else { // Undefined type of element
        continue
      }
    }

    // const indicProperties = document.querySelectorAll(SEL.indicatorProperty)
    // for(let i = 0; i < indicProperties.length; i++) {
    //   if(!indicProperties[i])
    //     continue
    //   const propClassName = indicProperties[i].getAttribute('class')
    //   const propText = indicProperties[i].innerText
    //   if(!propClassName || !propText)
    //     continue
    //   if(propClassName.includes('topCenter-')) {  // Two rows, also have first in class name
    //     i++ // Skip get the next cell because it content values
    //     continue // Doesn't realise to manage this kind of properties (two rows)
    //   } else if (propClassName.includes('first-')) {
    //     i++
    //     if(indicProperties[i].querySelector('input')) {
    //       let propValue = indicProperties[i].querySelector('input').value
    //       if(indicProperties[i].querySelector('input').getAttribute('inputmode') === 'numeric') {
    //         propValue = parseFloat(propValue) == parseInt(propValue) ? parseInt(propValue) : parseFloat(propValue)  // TODO how to get float from param or just search point in string
    //         if(!isNaN(propValue))
    //           strategyData.properties[propText] = propValue
    //       } else {
    //         strategyData.properties[propText] = propValue  // TODO not only inputmode==numbers input have digits
    //       }
    //     } else if(indicProperties[i].querySelector('span[role="button"]')) { // List
    //       const buttonEl = indicProperties[i].querySelector('span[role="button"]')
    //       if(!buttonEl)
    //         continue
    //       const propValue = buttonEl.innerText
    //       if(propValue) {
    //         buttonEl.scrollIntoView()
    //         await page.waitForTimeout(100)
    //         page.mouseClick(buttonEl)
    //         const isOptions = await page.waitForSelector(SEL.strategyListOptions, 1000)
    //         if(isOptions) {
    //           const allOptionsEl = document.querySelectorAll(SEL.strategyListOptions)
    //           let allOptionsList = propValue
    //           for(let optionEl of allOptionsEl) {
    //             if(optionEl && optionEl.innerText && optionEl.innerText !== propValue) {
    //               allOptionsList += optionEl.innerText + ';'
    //             }
    //           }
    //           if(allOptionsList)
    //             strategyData.properties[propText] = allOptionsList
    //           page.mouseClick(buttonEl)
    //         } else {
    //           strategyData.properties[propText] = propValue
    //         }
    //       }
    //     }
    //   } else if (propClassName.includes('fill-')) {
    //     if(indicProperties[i].querySelector('input[type="checkbox"]'))
    //       strategyData.properties[propText] = indicProperties[i].querySelector('input[type="checkbox"]').getAttribute('checked') !== null
    //   }
    // }
  } else {
    console.error(`Can't set parameters tab to input`)
  }
  if (document.querySelector(SEL.cancelBtn)) {
    document.querySelector(SEL.cancelBtn).click()
    await page.waitForSelector(SEL.cancelBtn, 1000, true)
  }

  return strategyData
}

tv.setStrategyParams = async (name, propVal, isCheckOpenedWindow = false) => {
  if(isCheckOpenedWindow) {
    let indicatorTitleEl = document.querySelector(SEL.indicatorTitle)
    if(!indicatorTitleEl || indicatorTitleEl.innerText !== name) {
      return null
    }
  } else {
    const indicatorTitle = await tv.checkAndOpenStrategy(name) // In test.name - ordinary strategy name but in strategyData.name short one as in indicator title
    if(!indicatorTitle)
      return null
  }
  const indicProperties = document.querySelectorAll(SEL.indicatorProperty)
  const propKeys = Object.keys(propVal)
  let setResultNumber = 0
  for(let i = 0; i < indicProperties.length; i++) {
    const propText = indicProperties[i].innerText
    if(propText && propKeys.includes(propText)) {
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
          page.mouseClick(buttonEl)
          page.setSelByText(SEL.strategyListOptions, propVal[propText])
        }
      } else if (propClassName.includes('fill-')) {
        const checkboxEl = indicProperties[i].querySelector('input[type="checkbox"]')
        if(checkboxEl) {
          const isChecked = checkboxEl.getAttribute('checked') !== null ? checkboxEl.checked : false
          if(propVal[propText] !== isChecked) {
            page.mouseClick(checkboxEl)
          }
        }
      }
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
  document.querySelector(SEL.tabInput).click()
  isInputTabActive = await page.waitForSelector(SEL.tabInputActive, 2000)
  return isInputTabActive ? true : false
}

tv.checkAndOpenStrategy = async (name) => {
  let indicatorTitleEl = document.querySelector(SEL.indicatorTitle)
  if(!indicatorTitleEl || indicatorTitleEl.innerText !== name) {
    const res = await tv.switchToStrategyTab()
    if(!res)
      return null
    const stratParamEl = document.querySelector(SEL.strategyDialogParam)
    if(!stratParamEl) {
      ui.alertMessage('There is not strategy param button on the strategy tab. Test stopped. Open correct page please')
      return null
    }
    stratParamEl.click()
    const stratIndicatorEl = await page.waitForSelector(SEL.indicatorTitle, 2000)
    if(!stratIndicatorEl) {
      ui.alertMessage('There is not strategy parameters. Test stopped. Open correct page please')
      return null
    }
    const tabInputEl = document.querySelector(SEL.tabInput)
    if(!tabInputEl) {
      ui.alertMessage('There is not strategy parameters input tab. Test stopped. Open correct page please')
      return null
    }
    tabInputEl.click()
    const tabInputActiveEl = await page.waitForSelector(SEL.tabInputActive)
    if(!tabInputActiveEl) {
      ui.alertMessage('There is not strategy parameters active input tab. Test stopped. Open correct page please')
      return null
    }
    indicatorTitleEl = document.querySelector(SEL.indicatorTitle)
    if(!indicatorTitleEl || indicatorTitleEl.innerText !== name) {
      ui.alertMessage(`The ${name} strategy parameters could not be opened. Reload the page, leave one strategy on the chart and try again.`)
      return null
    }
  }
  return indicatorTitleEl
}

tv.switchToStrategyTab = async () => {
  let isStrategyActiveEl = document.querySelector(SEL.strategyTesterTabActive)
  if(!isStrategyActiveEl) {
    const strategyTabEl = document.querySelector(SEL.strategyTesterTab)
    if(strategyTabEl) {
      strategyTabEl.click()
    } else {
      ui.alertMessage('There is not strategy tester tab on the page. Open correct page please')
      return null
    }
  }
  const testResults = {}
  const tickerEl = document.querySelector(SEL.ticker)
  if(!tickerEl || !tickerEl.innerText) {
    ui.alertMessage('There is not symbol element on page. Open correct page please')
    return null
  }
  testResults.ticker = tickerEl.innerText
  let timeFrameEl = document.querySelector(SEL.timeFrameActive)
  if(!timeFrameEl)
    timeFrameEl = document.querySelector(SEL.timeFrame)
  if(!timeFrameEl || !timeFrameEl.innerText) {
    ui.alertMessage('There is not timeframe element on page. Open correct page please')
    return null
  }
  testResults.timeFrame = timeFrameEl.innerText
  testResults.timeFrame = testResults.timeFrame.toLowerCase() === 'd' ? '1D' : testResults.timeFrame
  const strategyCaptionEl = document.querySelector(SEL.strategyCaption)
  if(!strategyCaptionEl || !strategyCaptionEl.innerText) {
    ui.alertMessage('There is not stratagy name element on page. Open correct page please')
    return null
  }
  testResults.name = strategyCaptionEl.innerText

  const stratSummaryEl = await page.waitForSelector(SEL.strategySummary, 1000)
  if(!stratSummaryEl) {
    ui.alertMessage('There is not strategy performance summary tab on the page. Open correct page please')
    return null
  }
  stratSummaryEl.click()
  await page.waitForSelector(SEL.strategySummaryActive, 1000)

  await page.waitForSelector(SEL.strategyReport, 0)
  if(!tv.reportNode) {
    tv.reportNode = await page.waitForSelector(SEL.strategyReport, 0)
    if(tv.reportNode) {
      const reportObserver = new MutationObserver(()=> {
        isReportChanged = true
      });
      reportObserver.observe(tv.reportNode, {
        childList: true,
        subtree: true,
        attributes: false,
        characterData: false
      });
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
      ui.alertMessage(`No data was loaded for the ${tickerText} and timeframe ${timeFrameText}.\n\n` +
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
      ui.alertMessage(`One of the parameters named ${notFoundParam} was not found in the window. Check the script.\n`)
      ui.isMsgShown = true
      return
    }
    document.querySelector(SEL.okBtn).click()
    const allSignals = [].concat(tsData.buy.split(','),tsData.sell.split(',')).sort()
    ui.alertMessage(`${allSignals.length} signals are set.\n  - date of the first signal: ${new Date(parseInt(allSignals[0]))}.\n  - date of the last signal: ${new Date(parseInt(allSignals[allSignals.length - 1]))}`)
    ui.isMsgShown = true
  }
}


tv.parseReportTable = () => {
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
              report[`${paramName}: ${strategyHeaders[i]}`] = Boolean(digitVal0) ? parseFloat(digitVal0[0]) : valuesPair[0]
              report[`${paramName}: ${strategyHeaders[i]} %`] = Boolean(digitVal1) ? parseFloat(digitVal1[0]) : valuesPair[0]
              continue
            }
          } else if(digitOfValues)
            report[`${paramName}: ${strategyHeaders[i]}`] = parseFloat(digitOfValues)
          else
            report[`${paramName}: ${strategyHeaders[i]}`] = values
        }
      }
    }
  }
  return report
}
