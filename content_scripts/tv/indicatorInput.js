const tvIndicatorInput = {}

const tvIndicatorRow = {
  groupName: (rowEl) => {
    return rowEl.innerText.trim()
  },
  groupFooter: (_) => {
    return null
  },
  inputName: (rowEl) => {
    return rowEl.innerText.trim()
  },
}

tvIndicatorInput.detectRowType = (propClassName) => {
  if (propClassName.startsWith('cell-')) {
    if (propClassName.includes('first-')) {
      return 'inputName'
    } else if (propClassName.includes('fill-')) {
      return 'name&value'
    }
    return 'value'
  } else if (propClassName.startsWith('titleWrap-'))
    return 'group'
  else if (propClassName.startsWith('groupFooter-'))
    return 'groupFooter'
  else if (propClassName.startsWith('inlineRow-'))
    return 'inlineRow'
  else
    return 'unknown'
}

class _tvIndicatorField {
  element = null

  constructor(element) {
    this.element = element;
  }
  async getValue() {
    return {value: this.element.value, type: 'unknown'};
  }
  async setValue(val) {
    page.setInputElementValue(this.element, val['value']);
  }
}

class _tvIndicatorCheckBoxField extends _tvIndicatorField {
  async getValue() {
    return {value: this.element.getAttribute('checked') !== null, type: 'boolean'};
  }
  async setValue(val) {
    if (Boolean(val['value']) !== this.value)
      page.mouseClick(this.element)
  }
}

class _tvIndicatorTexAreaField extends _tvIndicatorField {
  async getValue() {
    return {value: this.element.value, type: 'textarea', options: []};
  }
  async setValue(val) {
    page.setInputElementValue(this.element, val['value']);
  }
}


class _tvIndicatorListField extends _tvIndicatorField {
  async getValue() {
    return {value: this.element.value, type: 'list', options: []};
  }
  async setValue(val) {
    const value = val['value']
    page.setInputElementValue(this.element, value);
  }
}

class _tvIndicatorDateTimeField extends _tvIndicatorField {
  async getValue() {
    const dateEl = this.element.querySelector('[class^="datePickerWrapper"] input')
    const timeEl = this.element.querySelector('[class^="timePickerWrapper"] input')
    return {value: `${dateEl.value}T${timeEl.value}`, type: 'datetime', options: []};
  }
  async setValue(val) {
    const dateEl = this.element.querySelector('[class^="datePickerWrapper"] input')
    const timeEl = this.element.querySelector('[class^="timePickerWrapper"] input')
    const value = val['value']
    page.setInputElementValue(dateEl, value.substring(0, 10));
    page.setInputElementValue(timeEl, value.substring(11, 16));
  }
}

class _tvIndicatorColorField extends _tvIndicatorField {
  static warning = false;
  async getValue() {
    const colorEl = this.element.querySelector('[class^="swatch"]')
    const colorVal = colorEl === null ? null :  colorEl.getAttribute('style')
                                                       .replace('background-color:', '')
                                                       .replace(';','').trim()
    if (colorEl === null || colorVal) {
      if(!this.warning) {
        this.warning = true
         console.error('TV UI changed. Color element not have subclass swatch')
      }
      return null
    }
    return {value: colorVal, type: 'color'};
  }
  async setValue(val) {
    if(!this.warning) {
        this.warning = true
        console.error('The color field setting is not implemented. Skipped')
    }
  }
}

class _tvIndicatorInputField extends _tvIndicatorField {
  async getValue() {
    return {value: this.element.value, type: 'input'};
  }
  async setValue(val) {
    const value = val['value']
    page.setInputElementValue(this.element, value);
  }
}

tvIndicatorInput.getFieldActionObj = (rowEl) => {
  let element = rowEl.querySelector('input[type="checkbox"]')
  if (element)
    return new _tvIndicatorCheckBoxField(element)
  element = rowEl.querySelector('input[type="checkbox"]')
  if (element)
    return new _tvIndicatorCheckBoxField(element)

  element = rowEl.querySelector('textarea')
  if (element)
    return new _tvIndicatorTexAreaField(element)

  element = rowEl.querySelector('span[role="button"]')
  if (element)
    return new _tvIndicatorListField(element)

  element = rowEl.querySelector('[data-name="color-select"]')
  if (element)
    return new _tvIndicatorColorField(element)

  element = rowEl.querySelector('[class^="datePickerWrapper"] input')
  if (element) {
    if (rowEl.querySelector('[class^="timePickerWrapper"] input') === null) {
      if(!_tvIndicatorDateTimeField.warning) {
        _tvIndicatorDateTimeField.warning = true
        console.error(`UI changed for datepicker`)
      }
      return null
    }
    return new _tvIndicatorDateTimeField(rowEl)
  }

  element = rowEl.querySelector('input')
  if (element) {
    return new _tvIndicatorInputField(element)
  }
  return null
}

