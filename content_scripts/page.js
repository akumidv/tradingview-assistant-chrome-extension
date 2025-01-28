const page = {}

page.$ = function (selector) {
  try {
    return document.querySelector(selector)
  } catch {
    return null
  }
}


page.getElBySelNameWithCheckIsNewUI = async (selectorName, timeout = 1000) => {
  const selector = SEL[selectorName]
  if (typeof selStatus !== 'undefined' && selStatus.isNewVersion === null) {
    const element = await page.waitForSelector(selector, timeout)
    if (element) {
      selStatus.isNewVersion = false
      console.log('[INFO] Prev version UI')
      return element
    }
    selStatus.isNewVersion = true
    const selectorNew = SEL[selectorName]
    const newVerElement = page.$(selectorNew)
    if (!newVerElement) {
      selStatus.isNewVersion = false
      console.log('[INFO] Prev version UI')
    } else {
      console.log('[INFO] New version UI')
    }
    return newVerElement
  }
  return await page.waitForSelector(selector, timeout)
}

page.waitForTimeout = async (timeout = 2500) => new Promise(resolve => setTimeout(resolve, timeout))

page.waitForSelectorOld2del = async function (selector, timeout = 5000, isHide = false, parentEl) { //2023-04-18
  parentEl = parentEl ? parentEl : document
  return new Promise(async (resolve) => {
    let iter = 0
    let elem
    const tikTime = timeout === 0 ? 1000 : 50
    do {
      await page.waitForTimeout(tikTime)
      elem = parentEl.querySelector(selector)
      iter += 1
    } while ((timeout === 0 ? true : (tikTime * iter) < timeout) && (isHide ? !!elem : !elem))
    resolve(elem)
  });
}


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

const reactValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
page._inputEvent = new Event('input', { bubbles: true });
page._changeEvent = new Event('change', { bubbles: true });

page._mouseEvents = {};
["mouseover", "mousedown", "mouseup", "click",
  "dblclick", "contextmenu"].forEach(eventType => {
  page._mouseEvents[eventType] = document.createEvent('MouseEvents')
  page._mouseEvents[eventType].initEvent(eventType, true, true)
})

page.getTextForSel = function (selector, elParent) {
  elParent = elParent ? elParent : document
  const element = elParent.querySelector(selector)
  return element ? element.innerText : null
}

page.setInputElementValue = function (element, value, isChange = false) {
  reactValueSetter.call(element, value)
  element.dispatchEvent(page._inputEvent);
  if (isChange) element.dispatchEvent(page._changeEvent);
}


// function mouseTrigger (el, eventType) {
//   // const clickEvent = document.createEvent ('MouseEvents');
//   // clickEvent.initEvent (eventType, true, true);
//   // el.dispatchEvent(clickEvent);
//
//   // if (!el.hasOwnProperty('iondvEvents'))
//   //   el.iondvEvents = {};
//   // if(!el.iondvEvents.hasOwnProperty(eventType)) {
//   //   const clickEvent = document.createEvent ('MouseEvents');
//   //   clickEvent.initEvent (eventType, true, true);
//   //   el.iondvEvents[eventType] = clickEvent
//   // }
//   el.dispatchEvent(iondvMouseEvents[eventType]);
// }


page.mouseClick = function (el) {
  ["mouseover", "mousedown", "mouseup", "click"].forEach((eventType) =>
    el.dispatchEvent(page._mouseEvents[eventType])
  )
  // mouseTrigger (el, "mouseover");
  // mouseTrigger (el, "mousedown");
  // mouseTrigger (el, "mouseup");
  // mouseTrigger (el, "click");
}


page.mouseClickSelector = function (selector) {
  // const el = document.querySelector(selector)
  const el = page.$(selector)
  if (el)
    page.mouseClick(el)
}


page.getElText = (element) => {
  return element.innerText.replaceAll('​', '')
}

page.setSelByText = (selector, textValue) => {
  let isSet = false
  const selectorAllVal = document.querySelectorAll(selector)
  if (!selectorAllVal || !selectorAllVal.length)
    return isSet
  for (let optionsEl of selectorAllVal) {
    if (optionsEl) {//&& options.innerText.startsWith(textValue)) {
      const itemValue = page.getElText(optionsEl).toLowerCase()
      if (itemValue && textValue && itemValue.startsWith(textValue.toLowerCase())) {
        page.mouseClick(optionsEl)
        isSet = true
        break
      }
    }
  }
  return isSet
}
