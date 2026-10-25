/*
 Optimization settings of a strategy: the format of optimization_settings.content_xml and the helpers shared by the
 popup and the content scripts (both have DOMParser; the service worker only stores the text).

 content_xml:
   <optimization cycles="10" timeLimit="0">   (cycles 0 - no limit; timeLimit in minutes, 0 - no limit)
     <param name="ATR Length" active="true" type="number" from="7" to="28" step="2" default="14" priority="1"/>
     <param name="ATR TF" active="false" type="list" from="60;30;D" to="" step="0" default="60" priority="2"/>
     <param name="One trade per day" active="false" type="bool" from="true" to="false" step="0" default="true" priority="3"/>
   </optimization>
 A parameter in the code is {name, active, range}, where range is the extension's [from, to, step, default, priority].
*/
'use strict';

const optSettings = {
  DEFAULT_CYCLES: 10,
  // Fields of an optimization_settings record set on the "Testing a strategy" tab
  OPTION_FIELDS: ['isMaximizing', 'optParamName', 'optMethod', 'filterCondition', 'filterValue', 'filterParamName']
}

// strategy_id is the strategy name as it is in a file name: the browser replaces \ / : * ? " < > | by "_"
optSettings.strategyIdFromName = (name) => String(name || '').replace(/[\\/:*?"<>|]/g, '_').replace(/\s+/g, ' ').trim()

// "Strategy _ Previous Day Levels Breakout (2).csv" -> "Strategy _ Previous Day Levels Breakout"
optSettings.strategyIdFromFileName = (fileName) => String(fileName || '')
  .replace(/^.*[\\/]/, '').replace(/\.csv$/i, '').replace(/\s*\(\d+\)\s*$/, '').trim()

optSettings.getParamType = (range) => {
  if (!Array.isArray(range))
    return 'text'
  if (typeof range[0] === 'boolean')
    return 'bool'
  if (typeof range[0] === 'string' && range[0].includes(';'))
    return 'list'
  if (typeof range[0] === 'number')
    return 'number'
  return 'text'
}

// The default range of a parameter from its value: numbers from half to double the value with 10 steps,
// true/false for a checkbox, all options for a list ("current;option1;option2")
optSettings.getDefaultRange = (value, priority) => {
  if (typeof value === 'boolean')
    return [true, false, 0, value, priority]
  if (typeof value === 'string' && value.includes(';'))
    return [value, '', 0, value.split(';')[0], priority]
  if (typeof value === 'number' && value) {
    const isInteger = Number.isInteger(value)
    const from = isInteger ? Math.floor(value / 2) : value / 2
    const to = value * 2
    let step = isInteger ? Math.round((to - from) / 10) : Math.round((to - from) / 10 * 1e8) / 1e8
    step = step !== 0 ? step : to < 0 ? -1 : 1
    return [from, to, step, value, priority]
  }
  return [value, '', 0, value, priority]
}

// The Default of a parameter set to a strategy value; the range and the Active mark stay. A list gets the value as an
// option when it has no such one. Returns the new parameter, or null when the value does not fit its type.
optSettings.setParamDefault = (param, value) => {
  const range = [...param.range]
  const type = optSettings.getParamType(range)
  if (type === 'bool') {
    const bool = typeof value === 'boolean' ? value : String(value).trim().toLowerCase() === 'true' ? true :
      String(value).trim().toLowerCase() === 'false' ? false : null
    if (bool === null)
      return null
    range[3] = bool
  } else if (type === 'number') {
    const number = typeof value === 'number' ? value : String(value).trim() === '' ? NaN : Number(value)
    if (!Number.isFinite(number))
      return null
    range[3] = number
  } else if (type === 'list') {
    const text = String(typeof value === 'string' && value.includes(';') ? value.split(';')[0] : value).trim()
    const options = String(range[0]).split(';').map(item => item.trim()).filter(item => item.length)
    if (!options.includes(text))
      options.push(text)
    range[0] = options.join(';')
    range[3] = text
  } else { // a single value, not optimized
    range[0] = value
    range[3] = value
  }
  return {...param, range}
}

// Parameters with default ranges from the strategy values {name: value}
optSettings.getDefaultParams = (properties, isActive = true) => {
  return Object.keys(properties).map((name, idx) => ({
    name, active: isActive, range: optSettings.getDefaultRange(properties[name], idx + 1)
  }))
}

optSettings._escapeXml = (value) => String(value === null || typeof value === 'undefined' ? '' : value)
  .replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')

optSettings.toXml = (params, cycles, timeLimit = 0) => {
  const esc = optSettings._escapeXml
  const lines = params.map(param => {
    const range = param.range
    const type = optSettings.getParamType(range)
    return `  <param name="${esc(param.name)}" active="${param.active ? 'true' : 'false'}" type="${type}" ` +
      `from="${esc(range[0])}" to="${esc(range[1])}" step="${esc(range[2])}" default="${esc(range[3])}" priority="${esc(range[4])}"/>`
  })
  const cyclesValue = Number.isInteger(cycles) && cycles >= 0 ? cycles : optSettings.DEFAULT_CYCLES // 0 - no limit
  const timeLimitValue = Number.isFinite(Number(timeLimit)) && Number(timeLimit) > 0 ? Number(timeLimit) : 0
  return `<optimization cycles="${cyclesValue}" timeLimit="${timeLimitValue}">\n${lines.join('\n')}\n</optimization>`
}

optSettings.fromXml = (xmlText) => {
  const doc = new DOMParser().parseFromString(String(xmlText || ''), 'application/xml')
  const root = doc.documentElement
  if (!root || root.nodeName !== 'optimization' || doc.getElementsByTagName('parsererror').length)
    throw new Error('The optimization settings are damaged (content_xml is not valid)')
  const cycles = parseInt(root.getAttribute('cycles'))
  const toNumber = (text, fallback) => {
    const number = Number(String(text).trim())
    return String(text).trim() !== '' && Number.isFinite(number) ? number : fallback
  }
  const params = [...root.getElementsByTagName('param')].map((el, idx) => {
    const type = el.getAttribute('type')
    const from = el.getAttribute('from') ?? ''
    const to = el.getAttribute('to') ?? ''
    const step = el.getAttribute('step') ?? '0'
    const def = el.getAttribute('default') ?? ''
    const priority = toNumber(el.getAttribute('priority'), idx + 1)
    let range
    if (type === 'bool')
      range = [true, false, 0, def === 'true', priority]
    else if (type === 'list')
      range = [from, '', 0, def, priority]
    else if (type === 'number')
      range = [toNumber(from, 0), toNumber(to, toNumber(from, 0)), toNumber(step, 1), toNumber(def, toNumber(from, 0)), priority]
    else
      range = [from, to, toNumber(step, 0), def, priority]
    return {name: el.getAttribute('name'), active: el.getAttribute('active') === 'true', range}
  })
  const timeLimit = Number(root.getAttribute('timeLimit'))
  return {cycles: Number.isInteger(cycles) && cycles >= 0 ? cycles : optSettings.DEFAULT_CYCLES,
    timeLimit: Number.isFinite(timeLimit) && timeLimit > 0 ? timeLimit : 0, params}
}

// Strategy parameter values -> content_csv of strategy_settings, in the format of the parameters file
// that the import button in the strategy settings dialog loads
optSettings.toStrategyCsv = (indicatorName, properties) => {
  const toValue = (value) => typeof value === 'string' ? JSON.stringify(value) : String(value)
  let csv = `Name,Value\n"__indicatorName",${JSON.stringify(indicatorName)}\n`
  Object.keys(properties).forEach(name => {
    let value = properties[name]
    if (typeof value === 'string' && value.includes(';')) // a list with its options: the value is the selected one
      value = value.split(';')[0]
    csv += `${JSON.stringify(name)},${toValue(value)}\n`
  })
  return csv
}

// Options of the "Testing a strategy" tab as they are stored in optimization_settings
optSettings.getOptionFields = (iondvOptions) => {
  const options = iondvOptions || {}
  return {
    isMaximizing: options.hasOwnProperty('isMaximizing') ? Boolean(options.isMaximizing) : true,
    optParamName: options.optParamName || 'Total PnL',
    optMethod: options.optMethod || 'random',
    filterCondition: options.optFilterAscending === true ? 'more' : options.optFilterAscending === false ? 'less' : 'off',
    filterValue: options.hasOwnProperty('optFilterValue') ? String(options.optFilterValue) : '5',
    filterParamName: options.optFilterParamName || 'Total trades: All'
  }
}

// ...and back, in the form of the options the popup sends with an action
optSettings.toRequestOptions = (record) => {
  const options = {}
  if (!record)
    return options
  if (record.hasOwnProperty('isMaximizing')) options.isMaximizing = Boolean(record.isMaximizing)
  if (record.optParamName) options.optParamName = record.optParamName
  if (record.optMethod) options.optMethod = record.optMethod
  if (record.filterCondition)
    options.optFilterAscending = record.filterCondition === 'more' ? true : record.filterCondition === 'less' ? false : null
  if (record.hasOwnProperty('filterValue')) options.optFilterValue = record.filterValue
  if (record.filterParamName) options.optFilterParamName = record.filterParamName
  return options
}
