const tvIndicator = {}


tvIndicator.getStrategyInputs = async () => {
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

tvIndicator.setStrategyInputs = async (name, propVal, isCheckOpenedWindow = false) => {
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