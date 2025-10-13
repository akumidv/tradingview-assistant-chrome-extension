const page = {
  _inputEvent: new Event('input', { bubbles: true }),
  _changeEvent: new Event('change', { bubbles: true }),
  _mouseEvents: {}
};

["mouseover", "mousedown", "mouseup", "click",
  "dblclick", "contextmenu"].forEach(eventType => {
  page._mouseEvents[eventType] = new MouseEvent(eventType, {
    bubbles: true,
    cancelable: true,
    view: window,
  })
})

const reactValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;

page.$ = function (selector) {
  try {
    return document.querySelector(selector)
  } catch {
    return null
  }
}

page.waitForTimeout = async (timeout = 2500) => new Promise(resolve => setTimeout(resolve, timeout))


page.waitForSelector = async (selector, timeout = 5000, isHide = false, parentEl = null) => {
  return new Promise(async (resolve) => {
    parentEl = parentEl ? parentEl : document
    let iter = 0
    let elem = null
    try {
      elem = parentEl.querySelector(selector)
    } catch {
    }
    const tikTime = timeout === 0 ? 1000 : 50
    while (timeout === 0 || (!isHide && !elem) || (isHide && !!elem)) {
      await page.waitForTimeout(tikTime)
      try {
        elem = parentEl.querySelector(selector)
      } catch {
      }

      iter += 1
      if (timeout !== 0 && tikTime * iter >= timeout)
        break
      // throw new Error(`Timeout ${timeout} waiting for ${isHide ? 'hide ' : '' } ${selector}`) // break
    }
    return resolve(elem ? elem : null)
  })
}


page.getTextForSel = function (selector, elParent) {
  elParent = elParent ? elParent : document
  const element = elParent.querySelector(selector)
  return element ? element.innerText : null
}

page.setInputElementValue = function (element, value, isChange = false) {
  reactValueSetter.call(element, value)
  element.dispatchEvent(page._inputEvent);
  if (isChange)
    element.dispatchEvent(page._changeEvent);
}


page.mouseClick = function (el) {
  ["mouseover", "mousedown", "mouseup", "click"].forEach((eventType) =>
    el.dispatchEvent(page._mouseEvents[eventType])
  )
}

page.mouseDoubleClick = function (el) {
  ["mouseover", "mousedown", "mouseup", "click", "mousedown", "mouseup", "click"].forEach((eventType) =>
    el.dispatchEvent(page._mouseEvents[eventType])
  )
}

page.mouseClickSelector = function (selector) {
  const el = page.$(selector)
  if (el)
    page.mouseClick(el)
}


page.getElText = (element) => {
  return element.innerText.replaceAll('​', '')
}


page.setSelByText = async (selector, textValue) => {
  let isSet = false
  await page.waitForSelector(selector, 1000)
  await page.waitForTimeout(15) // Some times if list quite long, TV is not filled values yet and it generate an error
  let selectorAllVal = document.querySelectorAll(selector)
  if (!selectorAllVal || !selectorAllVal.length)
    return isSet
  for (let optionsEl of selectorAllVal) {
    if (optionsEl) {//&& options.innerText.startsWith(textValue)) {
      let itemValue = page.getElText(optionsEl)
      if (!itemValue) {
        const ariaLabel = optionsEl.getAttribute('aria-label') || optionsEl.getAttribute('data-label') || optionsEl.getAttribute('data-name')
        if (ariaLabel)
          itemValue = ariaLabel
      }
      if (!itemValue && optionsEl.dataset) {
        if (optionsEl.dataset.value)
          itemValue = optionsEl.dataset.value
        else if (optionsEl.dataset.label)
          itemValue = optionsEl.dataset.label
      }
      const normalizedItem = itemValue ? itemValue.trim().toLowerCase() : ''
      const normalizedTarget = textValue ? textValue.trim().toLowerCase() : ''
      if (normalizedItem && normalizedTarget && (normalizedItem === normalizedTarget || normalizedItem.startsWith(normalizedTarget))) {
        page.mouseClick(optionsEl) // optionsEl.click()
        await page.waitForSelector(selector, 1000, true)
        isSet = true
        break
      }
      if (!normalizedItem && optionsEl.textContent) {
        const fallback = optionsEl.textContent.trim().toLowerCase()
        if (fallback && normalizedTarget && (fallback === normalizedTarget || fallback.startsWith(normalizedTarget))) {
          page.mouseClick(optionsEl)
          await page.waitForSelector(selector, 1000, true)
          isSet = true
          break
        }
      }
      itemValue = null
    }
  }
  selectorAllVal = null
  return isSet
}
