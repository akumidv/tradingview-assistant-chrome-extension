const tvIndicator = {}


tvIndicator.getStrategyProperties = async (isIndicatorSaving) => { // Properties
  return await tvIndicator._processInputs(tvIndicatorFieldAction.getter, null, null) //isIndicatorSaving
}

// TODO The main block should e the same as for set. So only action is changed. Should use the same logic - fox example processInputs and parameter setValues or getValues
tvIndicator.getStrategyInputs = async (isIndicatorSaving = false) => {
  return await tvIndicator._processInputs(tvIndicatorRowAction.getter, null)
}

tvIndicator._processInputs = async (fieldAction, strategyRow = null, parentEl = null, rowCellSelector = null) => {
  const strategyInputResult = []
  if (parentEl === null)
    parentEl = document
  if (rowCellSelector === null)
    rowCellSelector = SEL.indicatorPropertyRow
  const indicRowEls = parentEl.querySelectorAll(rowCellSelector)
  console.log('####indicRows len', indicRowEls.length)
  let idx = 0
  let rowIdx = 0
  let groupName = null
  let fieldName = null
  for (let rowEl of indicRowEls) {
    const rowClassName = rowEl.getAttribute('class')
    const rowType = tvIndicatorProperty.detectRowType(rowClassName)
    console.log('> rowType', rowType)
    let rowSrcData = tvIndicator._getRowData(strategyRow, rowIdx)
    let rowValue = null
    switch (rowType) {
      case 'group': {
        groupName = tvIndicatorRowAction.groupName(rowEl)
        continue;
      }
      case 'groupFooter': {
        groupName = null
        continue;
      }
      case 'name&value': {
        fieldName = tvIndicatorRowAction.inputName(rowEl)
        rowValue = tvIndicator._processFieldValue(rowEl, fieldAction, rowSrcData, fieldName, groupName)
        break;
      }
      case 'inputName': {
        fieldName = tvIndicatorRowAction.inputName(rowEl)
        continue
      }
      case 'value': {
        rowValue = tvIndicator._processFieldValue(rowEl, fieldAction, rowSrcData, fieldName, groupName)
        break;
      }
      case 'inlineRow': {
        rowValue = await tvIndicator._processInlineRow(fieldAction, rowSrcData, rowEl, groupName)
        break;
      }
      default:
        console.warn(`Unknown row type ${rowType}`)
        continue
    }
    if (Array.isArray(rowValue)) {
      for(let row of rowValue) {
        const rowData  = tvIndicator._prepareRowData(row, idx, rowIdx, groupName)
        strategyInputResult.push(rowData)
        console.log('Inline field', groupName, rowData)
        idx++
      }
    } else {
      const rowData = tvIndicator._prepareRowData(rowValue, idx, rowIdx, groupName, fieldName)
      fieldName = null
      strategyInputResult.push(rowData)
      console.log('  field val:', groupName, rowData)
      idx++
    }
    rowIdx++
  }
  console.log('###strategyInputResult', strategyInputResult)
  return strategyInputResult
}

tvIndicator._processInlineRow = async (rowAction, rowSrcData, rowEl, groupName) => {
  if (rowSrcData !== null) {
    if (!Array.isArray(rowSrcData))
        throw (`Incorrect type of input field values for inplace row`)
    if(rowSrcData.length === 0)
      throw (`Field inplace values have incorrect number of values ${rowSrcData.length}`)
    if(rowSrcData[0]['group'] !== groupName)
      throw (`The group "${rowSrcData[0]['group']}" of inline values is incorrect - expected "${groupName}"`)
  }
  return await tvIndicator._processInputs(rowAction, rowSrcData, rowEl, SEL.indicatorInlineCell)
}

tvIndicator._processFieldValue = (rowEl, rowAction, rowSrcData, fieldName, groupName) => {
  const fieldType = tvIndicatorProperty.detectFieldType(rowEl)
  if (Array.isArray(rowSrcData)) {
    if(rowSrcData.length !== 1)
      throw (`Field value have incorrect number of values ${rowSrcData.length}`)
    rowSrcData= rowSrcData[0]
    if(groupName!== null && rowSrcData['group'] !== groupName)
      throw (`The group "${rowSrcData['group']}" of value is incorrect - expected "${groupName}"`)
    if(rowSrcData['name'] !== fieldName)
      throw (`The name "${rowSrcData['name']}" of value is incorrect - expected "${fieldName}"`)
  } else if (rowSrcData !== null) {
    throw (`Incorrect type of input field value`)
  }
  let rowData = null
  if (rowSrcData !== null && rowSrcData.hasOwnProperty('_changed') && !rowSrcData['_changed']) {
    return null // if setting value and parameter do not changed - skip setting
  }
  switch (fieldType) {
    case 'checkbox': {
      rowData = rowAction.checkbox(rowEl, rowSrcData)
      break;
    }
    case 'textarea': {
      rowData = rowAction.checkbox(rowEl, rowSrcData)
      break;
    }
    default:
      console.warn(`Unknown field type ${fieldType}`)
  }
  return rowData
}


tvIndicator._prepareRowData = (rowValue, idx, rowIdx, groupName, fieldName = null) => {
  if (rowValue !== null) {
    rowValue['idx'] = idx
    rowValue['rowIdx'] = rowIdx
    if (fieldName != null)
      rowValue['name'] = fieldName
    rowValue['group'] = groupName
  }
  return rowValue
}

tvIndicator._getRowData = (strategyRows, rowIdx) => {
  if (!Array.isArray(strategyRows)) {
    return null
  }
  return strategyRows.filter(row => row['rowIdx'] === rowIdx).sort((row0, row1) => row0['idx'] - row1['idx'])
}


tvIndicator.getStrategyInputsOld = async (isIndicatorSaving = false) => {
  const strategyInputs = [] // TODO to list of values and set them in the same order
  const indicProperties = document.querySelectorAll(SEL.indicatorProperty)
  console.log('####indicProperties', indicProperties.length)
  let idx = 0
  for (let i = 0; i < indicProperties.length; i++) {
    const propClassName = indicProperties[i].getAttribute('class')
    const propText = indicProperties[i].innerText.trim()

    const propertyType = tvIndicatorProperty.detectType(indicProperties[i], propClassName)
    console.log('###propClassName, propText', propText, propertyType)
    if (!propClassName || !propText) // Undefined type of element
      continue
    if (propClassName.includes('first-') && indicProperties[i].innerText) {
      i++
      if (indicProperties[i] && indicProperties[i].querySelector('input')) {
        try {
          if (indicProperties[i].querySelector('[class^="datePickerWrapper"] input') && indicProperties[i].querySelector('[class^="timePickerWrapper"] input')) {
            const dateValue = indicProperties[i].querySelector('[class^="datePickerWrapper"] input').value
            const timeValue = indicProperties[i].querySelector('[class^="timePickerWrapper"] input').value
            const inpValue = `${dateValue}T${timeValue}` //(new Date(`${dateValue}T${timeValue}`)).toISOString().substring(0, 16)
            strategyInputs.push({idx: idx, name: propText, value: inpValue, type: 'datetime'})
            idx++
          } else {
            if (indicProperties[i].querySelector('input[type="checkbox"]')) {// Strategy properties checkbox
              strategyInputs.push({
                idx: idx,
                name: propText,
                value: indicProperties[i].querySelector('input[type="checkbox"]').getAttribute('checked') !== null ? true : false,
                type: 'boolean'
              })
              idx++
            } else {
              let inpValue = indicProperties[i].querySelector('input').value
              const inptValeWoSpace = inpValue.replace(' ', '')
              const isNumber = parseFloat(inptValeWoSpace) == inptValeWoSpace || parseInt(inptValeWoSpace) == inptValeWoSpace
              const isNumeric = indicProperties[i].querySelector('input').getAttribute('inputmode') === 'numeric'
              if (isNumeric || isNumber) { // not only inputmode==numbers input have digits
                const isInt = parseFloat(inptValeWoSpace) == parseInt(inptValeWoSpace)
                const digPropValue = isInt ? parseInt(inptValeWoSpace) : parseFloat(inptValeWoSpace)  // Detection if float or int in the string
                if (isNaN(inpValue))
                  strategyInputs.push({idx: idx, name: propText, value: inpValue, type: 'string'})
                else
                  strategyInputs.push({idx: idx, name: propText, value: digPropValue, type: isInt ? 'int' : 'float'})
                idx++
              } else {
                strategyInputs.push({idx: idx, name: propText, value: inpValue, type: 'string'})
                idx++
              }
            }
          }
        } catch {
        }
      } else if (indicProperties[i].querySelector('span[role="button"]')) { // List
        const buttonEl = indicProperties[i].querySelector('span[role="button"]')
        if (!buttonEl)
          continue
        const inpValue = buttonEl.innerText
        if (inpValue) {
          buttonEl.scrollIntoView()
          await page.waitForTimeout(100)
          page.mouseClick(buttonEl)
          const isOptions = await page.waitForSelector(SEL.strategyListOptions, 1000)
          if (!isOptions) {
            strategyInputs.push({idx: idx, name: propText, value: inpValue, type: 'string'})
          } else {
            const ddListInput = {idx: idx, name: propText, value: inpValue, type: 'list', options: []}
            const allOptionsEl = document.querySelectorAll(SEL.strategyListOptions)
            for (let optionEl of allOptionsEl) {
              if (optionEl && optionEl.innerText) { //  && optionEl.innerText !== inpValue
                ddListInput['options'].push(optionEl.innerText)
              }
            }
            strategyInputs.push(ddListInput)
            page.mouseClick(buttonEl)
          }
          idx++
        }
      } else { // Undefined
        continue
      }
    } else if (propClassName.includes('fill-') && !indicProperties[i].getAttribute('data-section-name')) {
      const element = indicProperties[i].querySelector('input[type="checkbox"]')
      if (element) {
        strategyInputs.push({
          idx: idx,
          name: propText,
          value: element.getAttribute('checked') !== null ? true : false,
          type: 'boolean'
        })
        idx++
      } else { // Undefined type of element
        continue
      }
    } else if (indicProperties[i].getAttribute('data-section-name') || propClassName.includes('titleWrap-')) { // Titles bwtwen parameters
      strategyInputs.push({idx: idx, name: propText, value: null, type: 'group'})
      continue
    } else { // Undefined type of element
      continue
    }
  }
  return strategyInputs
}

tvIndicator.setStrategyProperties = async (name, propVal, shouldCheckOpenedWindow) => {
  if (await tv.changeDialogTabToProperties()) {
    return await tvIndicator.setStrategyInputs(name, propVal, shouldCheckOpenedWindow)
  }
}


tvIndicator.setStrategyInputs = async (name, propVal, shouldCheckOpenedWindow = false) => {
  if (shouldCheckOpenedWindow) {
    const indicatorTitleEl = document.querySelector(SEL.indicatorTitle)
    if (!indicatorTitleEl) {
      return 'The strategy title element do not found'
    } else if (indicatorTitleEl.innerText !== name) {
      return `The strategy title ${indicatorTitleEl.innerText} do not match ${name}`
    }
  } else {
    const indicatorTitleEl = await tv.checkAndOpenStrategy(name) // In test.name - ordinary strategy name but in strategyData.name short one as in indicator title
    if (!indicatorTitleEl)
      return 'The strategy inputs window did not open'
  }
  const indicProperties = document.querySelectorAll(SEL.indicatorProperty)
  let idx = 0
  let errMsg = null
  for (let i = 0; i < indicProperties.length; i++) {
    const stratInputName = indicProperties[i].innerText.trim()
    if (idx >= propVal.length) {
      errMsg = 'There are more strategy inputs than in prepared parameters. You can try to reload strategy parameters.'
      break
    }
    const inputName = propVal[idx]['name']
    if (stratInputName !== inputName) {
      errMsg = `The ordr of strategy inputs are incorrect, current input name ${stratInputName}, but from parameters ${inputName}. You can try to reload strategy parameters.`
      break
    }
    if (propVal[idx]['shouldSkip'] || propVal[idx]['value'] === null || propVal[idx]['type'] === 'group') { // Skip parameter to set
      idx++
      continue
    }
    const propClassName = indicProperties[i].getAttribute('class')
    if (propClassName.includes('first-')) {
      i++
      if (indicProperties[i].querySelector('input')) {
        try {
          if (indicProperties[i].querySelector('[class^="datePickerWrapper"] input') && indicProperties[i].querySelector('[class^="timePickerWrapper"] input')) {
            // page.mouseClick(indicProperties[i].querySelector('[class^="datePickerWrapper"] input'))
            page.setInputElementValue(indicProperties[i].querySelector('[class^="datePickerWrapper"] input'), propVal[idx]['value'].substring(0, 10))
            // page.mouseClick(indicProperties[i].querySelector('[class^="timePickerWrapper"] input'))
            page.setInputElementValue(indicProperties[i].querySelector('[class^="timePickerWrapper"] input'), propVal[idx]['value'].substring(11, 16))
            idx++
          } else {
            page.setInputElementValue(indicProperties[i].querySelector('input'), propVal[idx]['value'])
            idx++
          }
        } catch {
        }

      } else if (indicProperties[i].querySelector('span[role="button"]')) { // List
        const buttonEl = indicProperties[i].querySelector('span[role="button"]')
        if (!buttonEl || !buttonEl.innerText)
          continue
        buttonEl.scrollIntoView()
        await page.waitForTimeout(100)
        page.mouseClick(buttonEl)
        page.setSelByText(SEL.strategyListOptions, propVal[idx]['value'])
        idx++
      }
    } else if (propClassName.includes('fill-')) {
      const checkboxEl = indicProperties[i].querySelector('input[type="checkbox"]')
      if (checkboxEl) {
        // const isChecked = checkboxEl.getAttribute('checked') !== null ? checkboxEl.checked : false
        // const isChecked = Boolean(checkboxEl.checked)
        const isChecked = checkboxEl.getAttribute('checked') !== null
        if (Boolean(propVal[idx]['value']) !== isChecked) {
          page.mouseClick(checkboxEl)
          idx++
        }
      }
    }
  }
  if (!shouldCheckOpenedWindow && document.querySelector(SEL.okBtn)) {
    console.log('###shouldCheckOpenedWindow', shouldCheckOpenedWindow)
    document.querySelector(SEL.okBtn).click()
  }

  return errMsg
}


tvIndicator.getStrategyInputsPREV = async () => {
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

tvIndicator.setStrategyInputsPrev = async (name, propVal, isCheckOpenedWindow = false) => {
  if (isCheckOpenedWindow) {
    const indicatorTitleEl = document.querySelector(SEL.indicatorTitle)
    if (!indicatorTitleEl || indicatorTitleEl.innerText !== name) {
      return null
    }
  } else {
    const indicatorTitleEl = await tv.checkAndOpenStrategy(name) // In test.name - ordinary strategy name but in strategyData.name short one as in indicator title
    if (!indicatorTitleEl)
      return null
  }
  const indicProperties = document.querySelectorAll(SEL.indicatorProperty)
  const propKeys = Object.keys(propVal)
  let setResultNumber = 0
  let setPropertiesNames = {}
  for (let i = 0; i < indicProperties.length; i++) {
    const propText = indicProperties[i].innerText
    if (propText && propKeys.includes(propText)) {
      setPropertiesNames[propText] = true
      setResultNumber++
      const propClassName = indicProperties[i].getAttribute('class')
      if (propClassName.includes('first-')) {
        i++
        if (indicProperties[i].querySelector('input')) {
          page.setInputElementValue(indicProperties[i].querySelector('input'), propVal[propText])
        } else if (indicProperties[i].querySelector('span[role="button"]')) { // List
          const buttonEl = indicProperties[i].querySelector('span[role="button"]')
          if (!buttonEl || !buttonEl.innerText)
            continue
          buttonEl.scrollIntoView()
          await page.waitForTimeout(100)
          page.mouseClick(buttonEl)
          page.setSelByText(SEL.strategyListOptions, propVal[propText])
        }
      } else if (propClassName.includes('fill-')) {
        const checkboxEl = indicProperties[i].querySelector('input[type="checkbox"]')
        if (checkboxEl) {
          // const isChecked = checkboxEl.getAttribute('checked') !== null ? checkboxEl.checked : false
          const isChecked = Boolean(checkboxEl.checked)
          if (Boolean(propVal[propText]) !== isChecked) {
            page.mouseClick(checkboxEl)
            checkboxEl.checked = Boolean(propVal[propText])
          }
        }
      }
      setResultNumber = Object.keys(setPropertiesNames).length
      if (propKeys.length === setResultNumber)
        break
    }
  }
  // TODO check if not equal propKeys.length === setResultNumber, because there is none of changes too. So calculation doesn't start
  if (!isCheckOpenedWindow && document.querySelector(SEL.okBtn))
    document.querySelector(SEL.okBtn).click()
  return true
}