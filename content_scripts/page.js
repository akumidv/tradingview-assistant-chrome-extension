const page = {}

page.waitForTimeout = async (timeout = 2500) => new Promise(resolve => setTimeout(resolve, timeout))

page.waitForSelector = async function (selector, timeout = 5000, isHide = false, parentEl) {
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

const reactValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
const inputEvent = new Event('input', { bubbles: true});
const changeEvent = new Event('change', { bubbles: true});

page.getTextForSel = function (selector, elParent) {
    elParent = elParent ? elParent : document
    const element = elParent.querySelector(selector)
    return element ? element.innerText : null
  }

page.setInputElementValue = function  (element, value, isChange = false) {
    reactValueSetter.call(element, value)
    element.dispatchEvent(inputEvent);
    if(isChange) element.dispatchEvent(changeEvent);
  }


function mouseTrigger (el, eventType) {
    const clickEvent = document.createEvent ('MouseEvents');
    clickEvent.initEvent (eventType, true, true);
    el.dispatchEvent(clickEvent);
  }

page.mouseClick = function (el) {
  mouseTrigger (el, "mouseover");
  mouseTrigger (el, "mousedown");
  mouseTrigger (el, "mouseup");
  mouseTrigger (el, "click");
}

page.mouseClickSelector = function (selector) {
  const el = document.querySelector(selector)
  if(el)
    page.mouseClick(el)
}

page.$ = function (selector) {
  return document.querySelector(selector)
}

page.setSelByText = (selector, textValue) => {
  let isSet = false
  const selectorAllVal = document.querySelectorAll(selector)
  if (!selectorAllVal || !selectorAllVal.length)
    return isSet
  for (let options of selectorAllVal) {
    if(options && options.innerText.startsWith(textValue)) {
      page.mouseClick(options)
      isSet = true
      break
    }
  }
  return isSet
}

