const tvIndicatorProperty = {}

tvIndicatorProperty.detectRowType = (propClassName) => {
  if (propClassName.startsWith('cell-'))
    return 'field'
  else if (propClassName.startsWith('titleWrap-'))
    return 'group'
  else if (propClassName.startsWith('groupFooter-'))
    return 'groupFooter'
  else if (propClassName.startsWith('inlineRow-'))
    return 'inlineRow'
  else
    return 'unknown'
}

tvIndicatorProperty.getGroupName = (rowEl) => {
  return rowEl.innerText.trim()
}

tvIndicatorProperty.detectFieldType = (rowEl, propClassName) => {
  if (propClassName.includes('first-') && rowEl.innerText) {
    return 'field'
  } else if (propClassName.includes('fill-') && !rowEl.getAttribute('data-section-name')) {
    if (rowEl.querySelector('input[type="checkbox"]'))
      return 'checkbox'
    else if (rowEl.querySelector('textarea'))
      return 'textarea'
    else
      return 'unknown field'
  } else if (rowEl.getAttribute('data-section-name') || propClassName.includes('titleWrap-')) { // Titles bwtwen parameters
      // strategyInputs.push({idx: idx, name: propText, value: null, type: 'group'})
      return 'group'
  } else { // Undefined type of element
      return 'unknown'
  }
}


tvIndicatorProperty.getField = async() => {
  // i++
  //     if (indicProperties[i] && indicProperties[i].querySelector('input')) {
  //       try {
  //         if (indicProperties[i].querySelector('[class^="datePickerWrapper"] input') && indicProperties[i].querySelector('[class^="timePickerWrapper"] input')) {
  //           const dateValue = indicProperties[i].querySelector('[class^="datePickerWrapper"] input').value
  //           const timeValue = indicProperties[i].querySelector('[class^="timePickerWrapper"] input').value
  //           const inpValue = `${dateValue}T${timeValue}` //(new Date(`${dateValue}T${timeValue}`)).toISOString().substring(0, 16)
  //           strategyInputs.push({idx: idx, name: propText, value: inpValue, type: 'datetime'})
  //           idx++
  //         } else {
  //           if (indicProperties[i].querySelector('input[type="checkbox"]')) {// Strategy properties checkbox
  //             strategyInputs.push({
  //               idx: idx,
  //               name: propText,
  //               value: indicProperties[i].querySelector('input[type="checkbox"]').getAttribute('checked') !== null ? true : false,
  //               type: 'boolean'
  //             })
  //             idx++
  //           } else {
  //             let inpValue = indicProperties[i].querySelector('input').value
  //             const inptValeWoSpace = inpValue.replace(' ', '')
  //             const isNumber = parseFloat(inptValeWoSpace) == inptValeWoSpace || parseInt(inptValeWoSpace) == inptValeWoSpace
  //             const isNumeric = indicProperties[i].querySelector('input').getAttribute('inputmode') === 'numeric'
  //             if (isNumeric || isNumber) { // not only inputmode==numbers input have digits
  //               const isInt = parseFloat(inptValeWoSpace) == parseInt(inptValeWoSpace)
  //               const digPropValue = isInt ? parseInt(inptValeWoSpace) : parseFloat(inptValeWoSpace)  // Detection if float or int in the string
  //               if (isNaN(inpValue))
  //                 strategyInputs.push({idx: idx, name: propText, value: inpValue, type: 'string'})
  //               else
  //                 strategyInputs.push({idx: idx, name: propText, value: digPropValue, type: isInt ? 'int' : 'float'})
  //               idx++
  //             } else {
  //               strategyInputs.push({idx: idx, name: propText, value: inpValue, type: 'string'})
  //               idx++
  //             }
  //           }
  //         }
  //       } catch {
  //       }
}

tvIndicatorProperty.getList = async() => {
        // const buttonEl = indicProperties[i].querySelector('span[role="button"]')
        // if (!buttonEl)
        //   continue
        // const inpValue = buttonEl.innerText
        // if (inpValue) {
        //   buttonEl.scrollIntoView()
        //   await page.waitForTimeout(100)
        //   page.mouseClick(buttonEl)
        //   const isOptions = await page.waitForSelector(SEL.strategyListOptions, 1000)
        //   if (!isOptions) {
        //     strategyInputs.push({idx: idx, name: propText, value: inpValue, type: 'string'})
        //   } else {
        //     const ddListInput = {idx: idx, name: propText, value: inpValue, type: 'list', options: []}
        //     const allOptionsEl = document.querySelectorAll(SEL.strategyListOptions)
        //     for (let optionEl of allOptionsEl) {
        //       if (optionEl && optionEl.innerText) { //  && optionEl.innerText !== inpValue
        //         ddListInput['options'].push(optionEl.innerText)
        //       }
        //     }
        //     strategyInputs.push(ddListInput)
        //     page.mouseClick(buttonEl)
        //   }
        //   idx++
        // }
}

tvIndicatorProperty.getBool = async () => {
      //   const element = indicProperties[i].querySelector('input[type="checkbox"]')
      // if (element) {
      //   strategyInputs.push({
      //     idx: idx,
      //     name: propText,
      //     value: element.getAttribute('checked') !== null ? true : false,
      //     type: 'boolean'
      //   })
      //   idx++
      // } else { // Undefined type of element
      //   continue
      // }
}
