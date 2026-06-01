const page = {
  _inputEvent: new Event('input', { bubbles: true }),
  _changeEvent: new Event('change', { bubbles: true }),
}

const reactValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set

const _evtOpts = { bubbles: true, cancelable: true, view: window }
const _ptrOpts = { ..._evtOpts, isPrimary: true, pointerId: 1 }

page.$ = function (selector) {
  try {
    return document.querySelector(selector)
  } catch {
    return null
  }
}

page.waitForTimeout = async (timeout = 2500) => new Promise(resolve => setTimeout(resolve, timeout))

page.waitForSelector = async (selector, timeout = 5000, isHide = false, parentEl = null) => {
  const root = parentEl || document
  const tikTime = timeout === 0 ? 1000 : 50
  let elem = null
  try { elem = root.querySelector(selector) } catch {}
  let elapsed = 0
  while (timeout === 0 || (!isHide && !elem) || (isHide && !!elem)) {
    await page.waitForTimeout(tikTime)
    try { elem = root.querySelector(selector) } catch {}
    elapsed += tikTime
    if (timeout !== 0 && elapsed >= timeout)
      break
  }
  return elem || null
}

page.getTextForSel = function (selector, elParent) {
  elParent = elParent ? elParent : document
  const element = elParent.querySelector(selector)
  return element ? element.innerText : null
}

page.setInputElementValue = function (element, value, isChange = false) {
  reactValueSetter.call(element, value)
  element.dispatchEvent(page._inputEvent)
  if (isChange)
    element.dispatchEvent(page._changeEvent)
}

page.mouseClick = function (el) {
  el.dispatchEvent(new PointerEvent('pointerover', _ptrOpts))
  el.dispatchEvent(new MouseEvent('mouseover', _evtOpts))
  el.dispatchEvent(new PointerEvent('pointerdown', _ptrOpts))
  el.dispatchEvent(new MouseEvent('mousedown', _evtOpts))
  el.dispatchEvent(new PointerEvent('pointerup', _ptrOpts))
  el.dispatchEvent(new MouseEvent('mouseup', _evtOpts))
  el.dispatchEvent(new MouseEvent('click', _evtOpts))
}

page.mouseDoubleClick = function (el) {
  el.dispatchEvent(new PointerEvent('pointerover', _ptrOpts))
  el.dispatchEvent(new MouseEvent('mouseover', _evtOpts))
  el.dispatchEvent(new PointerEvent('pointerdown', _ptrOpts))
  el.dispatchEvent(new MouseEvent('mousedown', _evtOpts))
  el.dispatchEvent(new PointerEvent('pointerup', _ptrOpts))
  el.dispatchEvent(new MouseEvent('mouseup', _evtOpts))
  el.dispatchEvent(new MouseEvent('click', _evtOpts))
  el.dispatchEvent(new PointerEvent('pointerdown', _ptrOpts))
  el.dispatchEvent(new MouseEvent('mousedown', _evtOpts))
  el.dispatchEvent(new PointerEvent('pointerup', _ptrOpts))
  el.dispatchEvent(new MouseEvent('mouseup', _evtOpts))
  el.dispatchEvent(new MouseEvent('click', _evtOpts))
  el.dispatchEvent(new MouseEvent('dblclick', _evtOpts))
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
  const selectorAllVal = document.querySelectorAll(selector)
  if (!selectorAllVal || !selectorAllVal.length)
    return isSet
  for (const optionsEl of selectorAllVal) {
    if (optionsEl) {
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
        page.mouseClick(optionsEl)
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
    }
  }
  return isSet
}
