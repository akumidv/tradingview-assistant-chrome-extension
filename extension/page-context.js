// TradingView page injection script for get data from window.TradingView object

// Runs in the page world without the content-script log helper: the same prefix keeps one console filter
const LOG_PREFIX = '[tv-assistant]'

const message = {
  errorsNoBacktest: 'There is no backtest data. Try to do a new backtest',
  errorNoDataMessage: 'Can\'t get test results data'
}

window.addEventListener('message', async function (event) {
  const url =  window.location && window.location.origin ? window.location.origin : 'https://www.tradingview.com'
  if (!event.origin.startsWith(url) || !event.data ||
    !event.data.hasOwnProperty('name') || event.data.name !== 'iondvScript' ||
    !event.data.hasOwnProperty('action'))
    return
  switch (event.data.action) {
    case 'getPerformance': {
      try {
        const reportData = getStrategyReportData(event.data.data?.strategyName)
        window.postMessage({name: 'iondvPage', action: event.data.action, requestId: event.data.requestId, success: true, data: reportData}, event.origin)
      } catch (err) {
        window.postMessage({name: 'iondvPage', action: event.data.action, requestId: event.data.requestId, success: false, error: `${err}`}, event.origin)
      }
      break
    }
    case 'getReportState': {
      try {
        const reportState = getStrategyReportState(event.data.data?.strategyName)
        window.postMessage({name: 'iondvPage', action: event.data.action, requestId: event.data.requestId, success: true, data: reportState}, event.origin)
      } catch (err) {
        window.postMessage({name: 'iondvPage', action: event.data.action, requestId: event.data.requestId, success: false, error: `${err}`}, event.origin)
      }
      break
    }
    case 'previewStrategyTestResults': {
      try {
        if (!event.data.hasOwnProperty('data'))
          window.postMessage({name: 'iondvPage', action: event.data.action, message: message.errorNoDataMessage }, event.origin)
        await previewStrategyTestResults(event.data.data)
        window.postMessage({name: 'iondvPage', action: event.data.action}, event.origin)
      } catch (err) {
        console.error(LOG_PREFIX, 'previewStrategyTestResults failed:', err)
        window.postMessage({name: 'iondvPage', action: event.data.action, data: null, message: `${err}`}, event.origin)
      }
      break
    }
    case 'show3DChart': {
      try {
        if (!event.data.hasOwnProperty('data'))
          window.postMessage({name: 'iondvPage', action: event.data.action, message: message.errorNoDataMessage }, event.origin)
        await show3DChart(event.data.data)
        window.postMessage({name: 'iondvPage', action: event.data.action}, event.origin)
      } catch (err) {
        console.error(LOG_PREFIX, 'show3DChart failed:', err)
        window.postMessage({name: 'iondvPage', action: event.data.action, data: null, message: `${err}`}, event.origin)
      }
      break
    }
    case 'setStrategyParams': {
      try {
        const setRes = setStrategyInputs(event.data.data)
        window.postMessage({
          name: 'iondvPage',
          action: event.data.action,
          requestId: event.data.requestId,
          success: true,
          data: setRes
        }, event.origin)
      } catch (err) {
        console.error(LOG_PREFIX, 'setStrategyParams failed:', err)
        window.postMessage({
          name: 'iondvPage',
          action: event.data.action,
          requestId: event.data.requestId,
          success: false,
          error: `${err}`
        }, event.origin)
      }
      break
    }
    default:
      console.warn(LOG_PREFIX, `Unknown action for get data from page "${event.data.action}". Skip processing`)
      window.postMessage({name: 'iondvPage', action: event.data.action, data: null, message: `${err}`}, event.origin)
  }
})

// Routes to the strategy sources of the active chart, most stable first: the public chart API
// (TradingViewApi, the Charting Library interface), then the exposed chart widget collection, then the
// one held by the Strategy Tester widget. Verified 2026-10-14.
const strategySourceRoutes = {
  chartApi: () => {
    const chart = window.TradingViewApi.activeChart()
    return chart.getAllStudies().map(study => chart.getStudyById(study.id).study())
  },
  exposedCollection: () => getModelDataSources(window._exposed_chartWidgetCollection),
  backtestingWidget: () => getModelDataSources(window.TradingView.bottomWidgetBar._widgets.backtesting._bridge.chartWidgetCollection),
}

function getModelDataSources(chartWidgetCollection) {
  const model = chartWidgetCollection.activeChartWidget.value().model()
  return model.model().dataSources()
}

function getStrategySourceTitle(source) {
  try {
    return String(source.title())
  } catch {
    return ''
  }
}

function isStrategySource(source) {
  return !!source && source.isStudyStrategy === true && typeof source.reportData === 'function'
}

// The strategy under test: the only strategy on the chart, or the one named strategyName.
// Throws when no route finds it, so the content script falls back to the report page.
function findStrategySource(strategyName = '') {
  const failures = []
  for (const [route, getSources] of Object.entries(strategySourceRoutes)) {
    let strategies
    try {
      strategies = getSources().filter(isStrategySource)
    } catch (err) {
      failures.push(`${route}: ${err.message || err}`)
      continue
    }
    if (strategies.length > 1 && strategyName)
      strategies = strategies.filter(source => getStrategySourceTitle(source).startsWith(strategyName))
    if (strategies.length === 1)
      return {route, source: strategies[0]}
    failures.push(`${route}: ${strategies.length} strategies${strategyName ? ` named "${strategyName}"` : ''}`)
  }
  throw new Error(`Strategy is not found in TradingView page objects (${failures.join('; ')})`)
}

// Counts TradingView's own "report changed" events of the watched strategy, so the content script can
// tell a recomputed report from the previous one without reading the page.
const reportWatch = {source: null, version: 0, changedAt: 0}

function onStrategyReportChanged() {
  reportWatch.version += 1
  reportWatch.changedAt = Date.now()
}

function watchStrategyReport(source) {
  if (reportWatch.source === source)
    return
  try {
    reportWatch.source?.reportChanged().unsubscribe(null, onStrategyReportChanged)
  } catch {
  }
  source.reportChanged().subscribe(null, onStrategyReportChanged)
  reportWatch.source = source
}

function getStrategyReportState(strategyName = '') {
  const {route, source} = findStrategySource(strategyName)
  watchStrategyReport(source)
  return {route, version: reportWatch.version, changedAt: reportWatch.changedAt, isLoading: source.isLoading()}
}

function getStrategyReportData(strategyName = '') {
  const {route, source} = findStrategySource(strategyName)
  watchStrategyReport(source)
  const reportData = source.reportData()
  if (!reportData?.performance)
    throw new Error('The strategy on the chart has no report data yet')
  return JSON.parse(JSON.stringify({
    route,
    title: getStrategySourceTitle(source),
    version: reportWatch.version,
    currency: reportData.currency,
    performance: reportData.performance
  }))
}

// Strategy inputs through the public chart API (verified 2026-10-14): getInputsInfo() names every input
// as the dialog's Inputs tab labels it, setInputValues() applies values without opening the dialog.
// The values come in the dialog's form ("(H + L)/2", "45 seconds"), the API takes the internal one ("hl2", "45S").
const STUDY_SOURCE_VALUES = {
  'open': 'open', 'high': 'high', 'low': 'low', 'close': 'close', 'volume': 'volume',
  '(h + l)/2': 'hl2', '(h + l + c)/3': 'hlc3', '(h + l + c + c)/4': 'hlcc4', '(o + h + l + c)/4': 'ohlc4',
  'hl2': 'hl2', 'hlc3': 'hlc3', 'hlcc4': 'hlcc4', 'ohlc4': 'ohlc4',
}
const STUDY_RESOLUTION_UNITS = {tick: 'T', second: 'S', minute: '', hour: 'H', day: 'D', week: 'W', month: 'M', range: 'R'}

function findStrategyStudyApi(strategyName = '') {
  const chart = window.TradingViewApi.activeChart()
  let studies = chart.getAllStudies().map(study => chart.getStudyById(study.id)).filter(studyApi => isStrategySource(studyApi.study()))
  if (studies.length > 1 && strategyName)
    studies = studies.filter(studyApi => getStrategySourceTitle(studyApi.study()).startsWith(strategyName))
  if (studies.length !== 1)
    throw new Error(`${studies.length} strategies${strategyName ? ` named "${strategyName}"` : ''} are found by the chart API`)
  return studies[0]
}

// "45 seconds" -> "45S", "2 hours" -> "120", "1 day" -> "D", "Chart" -> "" (the chart's own timeframe)
function toStudyResolution(value) {
  const text = String(value).trim()
  if (text.toLowerCase() === 'chart')
    return ''
  const match = text.match(/^(\d+)\s+(tick|second|minute|hour|day|week|month|range)s?$/i)
  if (!match)
    return normalizeStudyResolution(text)
  const count = Number(match[1])
  const unit = STUDY_RESOLUTION_UNITS[match[2].toLowerCase()]
  if (unit === 'H')
    return String(count * 60)
  if (['D', 'W', 'M'].includes(unit))
    return count === 1 ? unit : `${count}${unit}`
  return `${count}${unit}`
}

function normalizeStudyResolution(value) {
  const text = String(value ?? '').trim().toUpperCase()
  return /^1[DWM]$/.test(text) ? text.slice(1) : text
}

// The API value of one input, or throws when the value can not be converted - then the dialog sets it
function toStudyInputValue(inputInfo, value) {
  if (value === undefined || value === null)
    throw new Error('no value')
  switch (inputInfo.type) {
    case 'integer':
    case 'float':
    case 'price': {
      const number = Number(value)
      if (!Number.isFinite(number) || (inputInfo.type === 'integer' && !Number.isInteger(number)))
        throw new Error(`"${value}" is not a valid ${inputInfo.type}`)
      if ((typeof inputInfo.min === 'number' && number < inputInfo.min) || (typeof inputInfo.max === 'number' && number > inputInfo.max))
        throw new Error(`${number} is out of the input range ${inputInfo.min}..${inputInfo.max}`)
      return number
    }
    case 'bool':
      if (typeof value === 'boolean')
        return value
      if (['true', 'false'].includes(String(value).toLowerCase()))
        return String(value).toLowerCase() === 'true'
      throw new Error(`"${value}" is not a boolean`)
    case 'source': {
      const source = STUDY_SOURCE_VALUES[String(value).trim().toLowerCase()]
      if (!source || (Array.isArray(inputInfo.options) && !inputInfo.options.includes(source)))
        throw new Error(`source "${value}" has no chart API value (only price and volume sources are supported)`)
      return source
    }
    case 'resolution':
      return toStudyResolution(value)
    case 'text':
    case 'session': {
      const text = String(value)
      if (Array.isArray(inputInfo.options) && !inputInfo.options.includes(text))
        throw new Error(`"${value}" is not among the options ${inputInfo.options.join(', ')}`)
      return text
    }
    default:
      throw new Error(`input type "${inputInfo.type}" is not supported by the chart API setter`)
  }
}

function isSameStudyInputValue(inputInfo, current, wanted) {
  if (inputInfo.type === 'resolution')
    return normalizeStudyResolution(current) === normalizeStudyResolution(wanted)
  return current === wanted
}

// Sets the strategy inputs named as in the dialog. Returns {isApplied: false, ...} without changing anything when
// some value can not be converted (the dialog sets this iteration then); throws when the chart API itself fails.
function setStrategyInputs(request) {
  const {strategyName, values} = request || {}
  if (!values || typeof values !== 'object' || !Object.keys(values).length)
    throw new Error('There are no parameters to set')
  const studyApi = findStrategyStudyApi(strategyName)
  const userInputs = studyApi.getInputsInfo().filter(info => !info.isHidden && info.groupId !== 'strategy_props')
  const currentValues = Object.fromEntries(studyApi.getInputValues().map(input => [input.id, input.value]))
  const result = {isApplied: false, changed: [], unchanged: [], missing: [], unsupported: []}
  const newValues = []
  for (const [name, value] of Object.entries(values)) {
    const matched = userInputs.filter(info => info.name === name || info.localizedName === name)
    if (matched.length !== 1) {
      result.missing.push(`${name} (${matched.length} inputs with this name)`)
      continue
    }
    const inputInfo = matched[0]
    let apiValue
    try {
      apiValue = toStudyInputValue(inputInfo, value)
    } catch (err) {
      result.unsupported.push(`${name}: ${err.message}`)
      continue
    }
    if (isSameStudyInputValue(inputInfo, currentValues[inputInfo.id], apiValue)) {
      result.unchanged.push(name)
      continue
    }
    newValues.push({id: inputInfo.id, value: apiValue, name, inputInfo})
  }
  if (result.missing.length || result.unsupported.length)
    return result
  if (newValues.length)
    studyApi.setInputValues(newValues.map(({id, value}) => ({id, value})))
  const appliedValues = Object.fromEntries(studyApi.getInputValues().map(input => [input.id, input.value]))
  const notApplied = newValues.filter(({id, value, inputInfo}) => !isSameStudyInputValue(inputInfo, appliedValues[id], value))
  if (notApplied.length)
    throw new Error(`The chart API did not apply ${notApplied.map(({name, value, id}) => `${name}=${value} (now ${appliedValues[id]})`).join(', ')}`)
  result.changed = newValues.map(({name}) => name)
  result.isApplied = true
  return result
}

async function previewStrategyTestResults(testResults) {
  if (typeof testResults === 'undefined' || !testResults.hasOwnProperty('perfomanceSummary') || testResults.perfomanceSummary.length === 0)
    throw (message.errorsNoBacktest)

  return new Promise(resolve => {
    createPreviewTestResultsPopup(testResults)
    const btnClose = document.getElementById('iondvBoxClose')
    if (btnClose) {
      btnClose.onclick = () => {
        const iondvPreviewResultsEl = document.getElementById('iondvPreviewResults')
        if (iondvPreviewResultsEl)
        iondvPreviewResultsEl.parentNode.removeChild(iondvPreviewResultsEl)
        return resolve()
      }
    }

  })
}

async function show3DChart(testResults) {
  if (typeof testResults === 'undefined' || !testResults.hasOwnProperty('perfomanceSummary') || testResults.perfomanceSummary.length === 0)
    throw (message.errorsNoBacktest)
  if (typeof Plotly === 'undefined')
    throw ("3D Chart library hadn't loaded. Please wait and try again")

  return new Promise(resolve => {
    create3DPopup(testResults)
    const btnClose = document.getElementById('iondvBoxClose')
    if (btnClose) {
      btnClose.onclick = () => {
        const iondv3DChartEl = document.getElementById('iondv3DChart')
        if (iondv3DChartEl)
          iondv3DChartEl.parentNode.removeChild(iondv3DChartEl)
        return resolve()
      }
    }
    const [paramNames, resultsNames] = prepareAxisList(testResults)
    let xSelVal = paramNames[0]
    let ySelVal = paramNames[1]
    let zSelVal = testResults.hasOwnProperty('optParamName') ? testResults.optParamName : resultsNames[0]

    setAxisOptions('iondvX', paramNames, xSelVal, ySelVal)
    setAxisOptions('iondvY', paramNames, ySelVal, xSelVal)
    setAxisOptions('iondvZ', resultsNames, zSelVal)
    let aproxType = document.getElementById('iondvAprox').value

    document.getElementById('iondvX').onclick = () => {
      const curVal = document.getElementById('iondvX').value
      if (xSelVal !== curVal) {
        xSelVal = curVal
        updateParamList('iondvY', paramNames, xSelVal)
        updateChart(testResults.perfomanceSummary, xSelVal, ySelVal, zSelVal, aproxType)
      }
    }

    document.getElementById('iondvY').onclick = () => {
      const curVal = document.getElementById('iondvY').value
      if (ySelVal !== curVal) {
        ySelVal = curVal
        updateParamList('iondvX', paramNames, ySelVal)
        updateChart(testResults.perfomanceSummary, xSelVal, ySelVal, zSelVal, aproxType)
      }
    }
    document.getElementById('iondvZ').onclick = () => {
      const curVal = document.getElementById('iondvZ').value
      if (zSelVal !== curVal) {
        zSelVal = curVal
        updateChart(testResults.perfomanceSummary, xSelVal, ySelVal, zSelVal, aproxType)
      }
    }

    document.getElementById('iondvAprox').onclick = () => {
      const curVal = document.getElementById('iondvAprox').value
      if (aproxType !== curVal) {
        aproxType = curVal
        updateChart(testResults.perfomanceSummary, xSelVal, ySelVal, zSelVal, aproxType)
      }
    }
    updateChart(testResults.perfomanceSummary, xSelVal, ySelVal, zSelVal)

  })
}

function formatFilterThreshold(value) {
  const num = Number(value)
  if (Number.isFinite(num))
    return (Math.round(num * 100) / 100).toFixed(2)
  if (typeof value === 'string' && value.trim().length)
    return value
  return 'N/A'
}

function buildFilterSummary(testResults) {
  if (!testResults)
    return ''
  if (typeof testResults.filterSummary === 'string' && testResults.filterSummary.length)
    return `Filters: ${testResults.filterSummary}`
  const parts = []
  if (testResults.filterAscending === true || testResults.filterAscending === false) {
    const name = typeof testResults.filterParamName === 'string' ? testResults.filterParamName.trim() : ''
    if (name)
      parts.push(`${name} ${testResults.filterAscending ? '>=' : '<='} ${formatFilterThreshold(testResults.filterValue)}`)
  }
  if (testResults.filter2Ascending === true || testResults.filter2Ascending === false) {
    const name = typeof testResults.filterParamName2 === 'string' ? testResults.filterParamName2.trim() : ''
    if (name)
      parts.push(`${name} ${testResults.filter2Ascending ? '>=' : '<='} ${formatFilterThreshold(testResults.filterValue2)}`)
  }
  if (!parts.length)
    return ''
  return `Filters: ${parts.join(' & ')}`
}

function createPreviewTestResultsPopup(testResults) {
  function paramRowContent(row, paramsNames) {
    return paramsNames.map((param) => `<td style="text-align: right; padding: 4px;">${formatCell(row['__' + param])}</td>`)
  }
  function getId(col) {
    return col.replaceAll(' ', '_')
  }
  function formatCell(value) {
    return typeof value === 'undefined' ? 'N/A' : value
  }
  // 2026-08 TradingView keeps renaming the report metrics - resolve each column against the
  // row's actual keys (exact match first, then a fuzzy case-insensitive contains match) instead
  // of trusting one hardcoded label, so a future rename shows a wrong-but-visible column rather
  // than silently rendering "undefined" everywhere.
  function resolveColumnKey(row, exactName, fuzzyIncludes) {
    if (row && row.hasOwnProperty(exactName))
      return exactName
    if (!row)
      return exactName
    const found = Object.keys(row).find(key => !key.startsWith('__') &&
      fuzzyIncludes.every(part => key.toLowerCase().includes(part)))
    return found || exactName
  }
  const preview = document.createElement('div')
  preview.id = 'iondvPreviewResults'
  preview.setAttribute("style", `background-color:rgba(0, 0, 0, 0.4); position:absolute; width:100%; height:100%; top:0px; left:0px; z-index:10000;`);
  preview.style.height = document.documentElement.scrollHeight + "px";
  // Show every result, same as the CSV export (file.js) does: the passing ones (perfomanceSummary)
  // plus the filtered-out ones (filteredSummary) - picking only one of the two used to silently
  // drop the other set from the preview whenever any filtered result existed.
  const arraySummary = testResults.perfomanceSummary.concat(testResults.filteredSummary || [])
  const sampleRow = arraySummary[0]
  const col1 = resolveColumnKey(sampleRow, 'Total PnL %', ['pnl', '%']),
    col2 = resolveColumnKey(sampleRow, 'Max drawdown %', ['drawdown', '%']),
    col3 = resolveColumnKey(sampleRow, 'Average bars in trades: All', ['bars in trades', 'all']),
    col4 = resolveColumnKey(sampleRow, 'Total trades: All', ['total trades', 'all']),
    // 2026-08 TradingView dropped Sharpe/Sortino Ratio from the scraped report data (the tab
    // that used to hold them, "risk-adjusted-performance-table", is gone) - show these two
    // available metrics instead of two permanently-N/A columns.
    col5 = resolveColumnKey(sampleRow, 'Percent profitable: All', ['percent profitable', 'all']),
    col6 = resolveColumnKey(sampleRow, 'Average profit / average loss: All', ['average profit / average loss', 'all']),
    col7 = resolveColumnKey(sampleRow, 'Profit factor', ['profit factor'])
  const col1Id = getId(col1), col2Id = getId(col2), col3Id = getId(col3),
  col4Id = getId(col4), col5Id = getId(col5), col6Id = getId(col6), col7Id = getId(col7)
  const style = 'style="text-align: right; padding: 4px;"'
  const styleHeader = 'style="text-align: right; padding: 4px; cursor: pointer;"'
  const styleParam = 'style="text-align: right; padding: 4px; color: gray;"'
  const title = testResults.filteredSummary && testResults.filteredSummary.length
    ? `Preview ${arraySummary.length} results (${testResults.filteredSummary.length} filtered out)`
    : `Preview ${arraySummary.length} results`
  const subtitle = `${testResults.name} ${testResults.ticker} ${testResults.timeFrame}`
  const headerParams = testResults.paramsNames.map((param) => `<th ${styleParam}>${param}</th>`)
  const tableContent = arraySummary.map((row) => `<tr><td ${style}>${formatCell(row[col1])}</td>
    <td ${style}>${formatCell(row[col2])}</td><td ${style}>${formatCell(row[col3])}</td><td ${style}>${formatCell(row[col4])}</td>
    <td ${style}>${formatCell(row[col5])}</td><td ${style}>${formatCell(row[col6])}</td><td ${style}>${formatCell(row[col7])}</td>
    ${paramRowContent(row, testResults.paramsNames)}</tr>`)
    preview.innerHTML = `<button id="iondvBoxClose" style="position: absolute;left: 50%;top: 50%;
    margin-top: -325px;margin-left: 465px;">Close</button>
    <div style="position: absolute; left: 50%;top: 50%; padding: 5px;
        width: 900px;height:600px; margin-top: -300px; margin-left: -400px;
        background: #fff; border: 1px solid #ccc; box-shadow: 3px 3px 7px #777;
        -webkit-box-shadow: 3px 3px 7px #777;-moz-border-radius: 22px; -webkit-border-radius: 22px;
        z-index: 999; overflow-y: auto">
      <div style="margin:0;padding: 0px;clear: both;width: 100%;">
        <div style="display:inline-block;vertical-align: middle;padding: 0px;width: 100%;">
          <h3 style="padding-bottom: 10px">${title}</h3>
          <h2 style="padding-bottom: 10px">${subtitle}</h2>
          <table id="tablePreviewResults" style="width: 100%;">
            <tr>
              <th id="${col1Id}" ${styleHeader}>${col1}</th>
              <th id="${col2Id}" ${styleHeader}>${col2}</th>
              <th id="${col3Id}" ${styleHeader}>${col3}</th>
              <th id="${col4Id}" ${styleHeader}>${col4}</th>
              <th id="${col5Id}" ${styleHeader}>${col5}</th>
              <th id="${col6Id}" ${styleHeader}>${col6}</th>
              <th id="${col7Id}" ${styleHeader}>${col7}</th>
              ${headerParams.join(' ')}
            </tr>
            ${tableContent.join(' ')}
          </table>
        </div>
      </div>
    </div>`
  document.getElementsByTagName('body')[0].appendChild(preview)
  document.getElementById(col1Id).onclick = () => sortTable(0)
  document.getElementById(col2Id).onclick = () => sortTable(1)
  document.getElementById(col3Id).onclick = () => sortTable(2)
  document.getElementById(col4Id).onclick = () => sortTable(3)
  document.getElementById(col5Id).onclick = () => sortTable(4)
  document.getElementById(col6Id).onclick = () => sortTable(5)
  document.getElementById(col7Id).onclick = () => sortTable(6)
}

function create3DPopup(testResults) {
  const chart3d = document.createElement('div')
  chart3d.id = 'iondv3DChart'
  chart3d.setAttribute("style", `background-color:rgba(0, 0, 0, 0.4);
    position:absolute; width:100%; height:100%; top:0px; left:0px; z-index:10000;`);
  chart3d.style.height = document.documentElement.scrollHeight + "px";

  chart3d.innerHTML = `<button id="iondvBoxClose" style="position: absolute;left: 50%;top: 50%;margin-top: -325px;margin-left: 465px;">Close</button>
    <div style="position: absolute; left: 50%;top: 50%; padding: 5px;
        width: 900px;height:600px; margin-top: -300px; margin-left: -400px;
        background: #fff; border: 1px solid #ccc; box-shadow: 3px 3px 7px #777;
        -webkit-box-shadow: 3px 3px 7px #777;-moz-border-radius: 22px; -webkit-border-radius: 22px;
        z-index: 999;">
    <div style="margin:0;padding: 0px;clear: both;width: 100%;">
      <div style="display:inline-block;vertical-align: middle;padding: 0px;width: 175px;">
        <h3 style="padding-bottom: 10px">Backtesting Results</h3>
        <p>Strategy name: ${testResults['name']}<br>
        Symbol: ${testResults['ticker']}<br>
        Timeframe: ${testResults['timeFrame']}<br>
        Backtest method: ${testResults['method']}<br>
        Backtest cycles: ${testResults['perfomanceSummary'].length + testResults['filteredSummary'].length}(${testResults['cycles']})<br>
        Parameter space: ${testResults['paramSpace']}<br>
        ${buildFilterSummary(testResults)}<br>
        </p>
        <div>Parameter on the x-axis <br><select id="iondvX" name="x" style="width: 170px"></select></div>
        <div>Parameter on the y-axis <br><select id="iondvY" name="t" style="width: 170px"></select></div>
        <div>Result on the z-axis <br><select id="iondvZ" name="z" style="width: 170px"></select></div>
        <div>Aproximation type<br><select id="iondvAprox" name="aprox" style="width: 170px"><option value="minmax" selected="selected">MinMax</option><option value="max">Max</option><option value="min">Min</option><option value="avg">Average</option><</select></div>
      </div>
      <div style="display:inline-block;vertical-align: middle;padding: 0px;width:700px;height:600px">
        <div id="iondvPlotly" style="width:100%;height:100%"></div>
      </div>
    </div>
  </div>`
  document.getElementsByTagName('body')[0].appendChild(chart3d)
}


function generateOptionsHtml (values, defVal = null) {
  defVal = defVal === null ? values[0] : defVal
  return  values.reduce((text, item) => `${text}<option value="${item}"${item === defVal ? ' selected="selected"' : ''}>${item}</option>`, '')
}


function setAxisOptions(elId, values, defVal, excludedVal = null) {
  const filteredValues = excludedVal !== null ? values.filter(item => item !== excludedVal) : values
  let optionsHtml = generateOptionsHtml(filteredValues, defVal)
  const axis = document.getElementById(elId)
  axis.value = defVal
  axis.innerHTML = optionsHtml
}


function prepareAxisList(testResults) {
  const paramNames = []
  Object.keys(testResults.perfomanceSummary[0]).forEach(item => {
    if(item.startsWith('__'))
      paramNames.push(item.substring(2))
  })
  if (paramNames.length === 0)
    throw('None of parameters present in data')
  else if (paramNames.length === 1)
    paramNames.push('none')
  const resultsNames = Object.keys(testResults.perfomanceSummary[0]).filter(item => !item.startsWith('__') && item !== 'comment')
  if (resultsNames.length === 0)
    throw('None of results present in data')
  return [paramNames,resultsNames]
}


function updateParamList(elId, paramNames, excludedVal) {
  const curVal = document.getElementById(elId).value
  setAxisOptions(elId, paramNames, curVal, excludedVal)
}


function showPlotlyData(chartPlotlyEl, xData, yData, zData){//rawData) {
  const data = [{
    x: xData, y: yData, z: zData,
    type: 'surface',
    contours: {z: {show:true}}
  }];
  const layout = {
    // xaxis: {title: {text: 'x Axis'}},
    // yaxis: {title: {text: 't Axis'}},
    // zaxis: {title: {text: 'z Axis'}},
    autosize: true,
    width: 700,
    height: 600,
    // highlightcolor: "limegreen",
    showlegend: false,
    margin: { l: 65, r: 50, b: 65, t: 90 }
  };
  Plotly.newPlot(chartPlotlyEl, data, layout);
}


function updateChart(perfomanceSummary, xSelVal, ySelVal, zName, aproxType) {
  const xName = `__${xSelVal}`
  const yName = `__${ySelVal}`
  const chartPlotly = document.getElementById('iondvPlotly');
  const yAxisDict = {}
  const zAxisDict = {}
  let missedKeysCount = 0
  let missedKeysExample = null
  perfomanceSummary.forEach(item => {
    if (item.hasOwnProperty(xName) && item.hasOwnProperty(yName) && item.hasOwnProperty(zName)) {
      if(!yAxisDict.hasOwnProperty(item[yName]))
        yAxisDict[item[yName]] = null
      if (!zAxisDict.hasOwnProperty(item[xName]))
        zAxisDict[item[xName]] = {}
      if (!zAxisDict[item[xName]].hasOwnProperty(item[yName]))
        zAxisDict[item[xName]][item[yName]] = []
      zAxisDict[item[xName]][item[yName]].push(item[zName])
      // zAxisDict[item[xName]][item[yName]] = item[zName]
    } else {
      missedKeysCount += 1
      if (missedKeysExample === null)
        missedKeysExample = item
    }
  })
  if (missedKeysCount)
    console.warn(LOG_PREFIX, `3D chart: ${missedKeysCount} results miss one of the keys "${xName}", "${yName}", "${zName}", ` +
      'first example:', missedKeysExample)

  const xAxis = Object.keys(zAxisDict).sort((a,b) => a - b)
  const yAxis = Object.keys(yAxisDict).sort((a,b) => a - b)
  const zAxis = []
  yAxis.forEach(y => {
    const row = []
    xAxis.forEach(x => {
      if (zAxisDict.hasOwnProperty(x) && zAxisDict[x].hasOwnProperty(y)) {
        if (!zAxisDict[x][y]) {
          row.push(0)
        }  else if (zAxisDict[x][y].length === 1) {
          row.push(zAxisDict[x][y][0])
        } else {
          let val
          switch (aproxType){
            case 'max':
              val = Math.max(...zAxisDict[x][y])
              break
            case 'min':
              val = Math.min(...zAxisDict[x][y])
              break
            case 'avg':
              val = zAxisDict[x][y].reduce((acc,v,i,a)=>(acc+v/a.length),0)
              break
            case 'minmax':
            default:
              val = Math.max(...zAxisDict[x][y]) > Math.abs(Math.min(...zAxisDict[x][y])) ? Math.max(...zAxisDict[x][y]) : Math.min(...zAxisDict[x][y])
          }
          row.push(val)
        }
      } else {
        row.push(0)
      }
    })
    zAxis.push(row)
  })

  showPlotlyData(chartPlotly,  xAxis, yAxis, zAxis)
}

function sortTable(n) {
  let table, rows, switching, i, x, y, shouldSwitch, dir, switchcount = 0;
  table = document.getElementById('tablePreviewResults');
  switching = true;
  dir = 'asc';
  while (switching) {
    switching = false;
    rows = table.rows;
    for (i = 1; i < (rows.length - 1); i++) {
      shouldSwitch = false;
      x = rows[i].getElementsByTagName('TD')[n];
      y = rows[i + 1].getElementsByTagName('TD')[n];
      if (dir == 'asc') {
        if (x.innerHTML.toLowerCase() > y.innerHTML.toLowerCase()) {
          shouldSwitch = true;
          break;
        }
      } else if (dir == 'desc') {
        if (x.innerHTML.toLowerCase() < y.innerHTML.toLowerCase()) {
          shouldSwitch = true;
          break;
        }
      }
    }
    if (shouldSwitch) {
      rows[i].parentNode.insertBefore(rows[i + 1], rows[i]);
      switching = true;
      switchcount ++;
    } else {
      if (switchcount == 0 && dir == 'asc') {
        dir = 'desc';
        switching = true;
      }
    }
  }
}
