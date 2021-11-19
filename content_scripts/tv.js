const tv = {
  reportNode: null
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
      alert('There is not strategy param button on the strategy tab. Test stopped. Open correct page please')
      return null
    }
    stratParamEl.click()
    const stratIndicatorEl = await page.waitForSelector(SEL.indicatorTitle, 2000)
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
    const tabInputActiveEl = await page.waitForSelector(SEL.tabInputActive)
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

tv.switchToStrategyTab = async () => {
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
  testResults.timeFrame = testResults.timeFrame.toLowerCase() === 'd' ? '1D' : testResults.timeFrame
  const strategyCaptionEl = document.querySelector(SEL.strategyCaption)
  if(!strategyCaptionEl || !strategyCaptionEl.innerText) {
    alert('There is not stratagy name element on page. Open correct page please')
    return null
  }
  testResults.name = strategyCaptionEl.innerText

  const stratSummaryEl = await page.waitForSelector(SEL.strategySummary, 1000)
  if(!stratSummaryEl) {
    alert('There is not strategy performance summary tab on the page. Open correct page please')
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