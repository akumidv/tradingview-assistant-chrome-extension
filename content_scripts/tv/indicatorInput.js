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
  /**
    @returns: {IndicatorParameter} param
  */
  async getValue() {
    return new IndicatorParameter(null, this.element.value, 'unknown') //{value: this.element.value, type: 'unknown'};
  }
  /**
    @param: {IndicatorParameter} param
  */
  async setValue(param) {
    page.setInputElementValue(this.element, param['value']);
  }
}

class _tvIndicatorCheckBoxField extends _tvIndicatorField {
  async getValue() {
    return new IndicatorParameter(null, this.element.getAttribute('checked') !== null, 'boolean')  //{value: this.element.getAttribute('checked') !== null, type: 'boolean'};
  }
  async setValue(param) {
    if (Boolean(param['value']) !== this.value)
      page.mouseClick(this.element)
  }
}

class _tvIndicatorTexAreaField extends _tvIndicatorField {
  async getValue() {
    return new IndicatorParameter(null, this.element.value, 'textarea') //{value: this.element.value, type: 'textarea', options: []};
  }
  async setValue(param) {
    page.setInputElementValue(this.element, param['value']);
  }
}


class _tvIndicatorListField extends _tvIndicatorField {
  async getValue() { // TODO
    return new IndicatorParameter(null, this.element.value, 'list', []) //{value: this.element.value, type: 'list', options: []};
  }
  async setValue(param) {
    page.setInputElementValue(this.element, param['value']);
  }
}

class _tvIndicatorDateTimeField extends _tvIndicatorField {
  async getValue() {
    const dateEl = this.element.querySelector('[class^="datePickerWrapper"] input')
    const timeEl = this.element.querySelector('[class^="timePickerWrapper"] input')
    return new IndicatorParameter(null, `${dateEl.value}T${timeEl.value}`, 'datetime') //{value: `${dateEl.value}T${timeEl.value}`, type: 'datetime', options: []};
  }
  async setValue(param) {
    const dateEl = this.element.querySelector('[class^="datePickerWrapper"] input')
    const timeEl = this.element.querySelector('[class^="timePickerWrapper"] input')
    page.setInputElementValue(dateEl, param['value'].substring(0, 10));
    page.setInputElementValue(timeEl, param['value'].substring(11, 16));
  }
}

class _tvIndicatorColorField extends _tvIndicatorField {
  static warning = false;
  async getValue() {
    const colorEl = this.element.querySelector('[class^="swatch"]')
    const colorVal = colorEl === null ? null :  colorEl.getAttribute('style')
                                                       .replace('background-color:', '')
                                                       .replace(';','').trim()
    console.log('####', colorEl, colorVal)
    if (colorEl === null || colorVal) {
      if(!this.warning) {
        this.warning = true
         console.error('TV UI changed. Color element not have subclass swatch')
      }
      // return null
    }
    return new IndicatorParameter(null, colorVal, 'color') //{value: colorVal, type: 'color'};
  }
  async setValue(param) {
    if(!this.warning) {
        this.warning = true
        console.error('The color field setting is not implemented. Skipped')
    }
  }
}

class _tvIndicatorInputField extends _tvIndicatorField {
  async getValue() {
    return new IndicatorParameter(null, this.element.value, 'input') //{value: this.element.value, type: 'input'};
  }

  async setValue(param) {
    page.setInputElementValue(this.element, param['value']);
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

