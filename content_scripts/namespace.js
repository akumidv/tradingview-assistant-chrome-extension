/**
 * @type {IndicatorParameter}
 * @param {string|null} name
 * @param {string|number|null} value
 * @param {string} type
 * @param {Array|null} options
 * @param {string|null} group
 * @param {number|null} idx
 * @param {number|null} rowIdx
 */
const IndicatorParameter = class {
  constructor (name, value, type, group = null, idx = null, rowIdx = null, options = null) {
    this.name = name
    this.value = value
    this.type = type
    this.group = group
    this.idx = idx
    this.rowIdx = rowIdx
    this.options = options
  }
}

/**
 * @type {StrategyData}
 * @param {string} name
 * @param {Array} inputs
 * @param {Array|null} properties
 */
const StrategyData = class {
  constructor (name, inputs, properties = null) {
    this.name = name
    this.inputs = inputs
    this.properties = properties
  }
}

if (typeof module !== 'undefined') {
  module.exports = { IndicatorParameter, StrategyData }
}
