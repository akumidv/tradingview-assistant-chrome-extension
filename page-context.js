// TradingView page injection script for get data from window.TradingView object
let isBaseTradingView = true

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
      let tvData = {}
      try {
        if(isBaseTradingView)
          tvData = window.TradingView.bottomWidgetBar._widgets.backtesting._reportWidgetsSet.reportWidget._data.performance
        else if (isBaseTradingView === false)
          tvData = window.TradingView.bottomWidgetBar._options.backtestingStrategyDispatcher._modelStrategies[0]._reportData.performance // First strategy, for new TV (deep history)
      } catch (err) {
        if (isBaseTradingView !== false) {
          try {
            tvData = window.TradingView.bottomWidgetBar._options.backtestingStrategyDispatcher._modelStrategies[0]._reportData.performance
          } catch (e) {
            isBaseTradingView = null
            console.error("Can't get TV API perfomance data, please write to developer")
            console.error(err)
            console.error(e)
          }
        }
      }
      window.postMessage({name: 'iondvPage', action: event.data.action, data: tvData}, event.origin)
      break
    }
    case 'previewStrategyTestResults': {
      try {
        if (!event.data.hasOwnProperty('data'))
          window.postMessage({name: 'iondvPage', action: event.data.action, message: message.errorNoDataMessage }, event.origin)
        await previewStrategyTestResults(event.data.data)
        window.postMessage({name: 'iondvPage', action: event.data.action}, event.origin)
      } catch (err) {
        console.error(`[error] previewStrategyTestResults`, err)
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
        console.error(`[error] show3DChart`, err)
        window.postMessage({name: 'iondvPage', action: event.data.action, data: null, message: `${err}`}, event.origin)
      }
      break
    }
    case 'setStrategyParams': {
      try {
        const setRes = await setStrategyParamsFromPage(event.data.data)
        window.postMessage({
          name: 'iondvPage',
          action: event.data.action,
          requestId: event.data.requestId,
          success: true,
          data: setRes
        }, event.origin)
      } catch (err) {
        console.error(`[error] setStrategyParams`, err)
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
      console.error(`[error] Unknown action for get data from page"${event.data.action}". Skip processing`)
      window.postMessage({name: 'iondvPage', action: event.data.action, data: null, message: `${err}`}, event.origin)
  }
})

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
    return paramsNames.map((param) => `<td style="text-align: right; padding: 4px;">${row['__' + param]}</td>`)
  }
  function getId(col) {
    return col.replaceAll(' ', '_')
  }
  const preview = document.createElement('div')
  preview.id = 'iondvPreviewResults'
  preview.setAttribute("style", `background-color:rgba(0, 0, 0, 0.4); position:absolute; width:100%; height:100%; top:0px; left:0px; z-index:10000;`);
  preview.style.height = document.documentElement.scrollHeight + "px";
  const col1 = 'Net Profit %: All', col2 = 'Max Drawdown %', col3 = 'Avg # Bars in Trades: All',
  col4 = 'Total Closed Trades: All', col5 = 'Sharpe Ratio', col6 = 'Sortino Ratio', col7 = 'Profit Factor: All'
  const col1Id = getId(col1), col2Id = getId(col2), col3Id = getId(col3),
  col4Id = getId(col4), col5Id = getId(col5), col6Id = getId(col6), col7Id = getId(col7)
  const arraySummary = testResults.filteredSummary.length ? testResults.filteredSummary : testResults.perfomanceSummary
  const style = 'style="text-align: right; padding: 4px;"'
  const styleHeader = 'style="text-align: right; padding: 4px; cursor: pointer;"'
  const styleParam = 'style="text-align: right; padding: 4px; color: gray;"'
  const title = `Preview ${arraySummary.length} results`
  const subtitle = `${testResults.name} ${testResults.ticker} ${testResults.timeFrame}`
  const headerParams = testResults.paramsNames.map((param) => `<th ${styleParam}>${param}</th>`)
  const tableContent = arraySummary.map((row) => `<tr><td ${style}>${row[col1]}</td>
    <td ${style}>${row[col2]}</td><td ${style}>${row[col3]}</td><td ${style}>${row[col4]}</td>
    <td ${style}>${row[col5]}</td><td ${style}>${row[col6]}</td><td ${style}>${row[col7]}</td>
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
      console.log('MISSED ONE OF KEYS',  xSelVal, ySelVal, zSelVal, item)
    }
  })

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

async function getStrategyDispatcher(timeout = 4000) {
  const dispatcher = locateStrategyDispatcher()
  if (!dispatcher)
    return null
  await ensureDispatcherReady(dispatcher, timeout)
  return dispatcher
}

function locateStrategyDispatcher() {
  const tvRoot = window.TradingView
  if (!tvRoot)
    return null

  const fromOptions = tvRoot?.bottomWidgetBar?._options?.backtestingStrategyDispatcher
  if (fromOptions)
    return fromOptions

  const fromWidgets = tvRoot?.bottomWidgetBar?._widgets?.backtesting?._strategyDispatcher
  if (fromWidgets)
    return fromWidgets

  const fromChartPage = tvRoot?.onChartPage?.backtestingStrategyDispatcher
  if (fromChartPage)
    return fromChartPage

  const candidates = [
    tvRoot?.bottomWidgetBar,
    tvRoot?.onChartPage,
    tvRoot?.onWidget
  ].filter(Boolean)

  const visited = new WeakSet()
  for (const candidate of candidates) {
    try {
      const found = walkForDispatcher(candidate, 3, visited)
      if (found)
        return found
    } catch {
    }
  }

  return null
}

function walkForDispatcher(root, depth, visited) {
  if (!root || depth < 0 || typeof root !== 'object')
    return null
  if (visited && visited.has(root))
    return null
  if (visited)
    visited.add(root)
  if (Array.isArray(root)) {
    for (const item of root) {
      const found = walkForDispatcher(item, depth, visited)
      if (found)
        return found
    }
    return null
  }
  if (Array.isArray(root._modelStrategies) || Array.isArray(root._strategies))
    return root

  const keys = Object.keys(root)
  for (const key of keys) {
    if (!key || key === '__proto__')
      continue
    if (key[0] === '_' && key.length > 32)
      continue
    const value = root[key]
    if (!value || typeof value !== 'object')
      continue
    const found = walkForDispatcher(value, depth - 1, visited)
    if (found)
      return found
  }
  return null
}

async function ensureDispatcherReady(dispatcher, timeout = 4000) {
  if (!dispatcher)
    return null

  const pending = []
  const pushThenable = (maybe) => {
    if (maybe && typeof maybe.then === 'function')
      pending.push(maybe)
  }

  try {
    if (typeof dispatcher.ready === 'function')
      pushThenable(dispatcher.ready())
  } catch {
  }
  try {
    if (typeof dispatcher.whenReady === 'function')
      pushThenable(dispatcher.whenReady())
  } catch {
  }
  pushThenable(dispatcher._ready)
  pushThenable(dispatcher._filled)
  pushThenable(dispatcher._initPromise)
  pushThenable(dispatcher._applyModelPromise)

  for (const promise of pending) {
    try {
      await promise
    } catch (err) {
      console.warn('[TV-ASS] Strategy dispatcher readiness wait rejected:', err)
    }
  }

  const waitTime = Number.isFinite(timeout) ? Math.max(timeout, 0) : 0
  const deadline = Date.now() + waitTime
  while (Date.now() < deadline) {
    const strategies = extractStrategies(dispatcher)
    if (strategies.length) {
      if (!Array.isArray(dispatcher._modelStrategies) || !dispatcher._modelStrategies.length)
        dispatcher._modelStrategies = strategies
      return dispatcher
    }
    await new Promise(resolve => setTimeout(resolve, 50))
  }

  const strategies = extractStrategies(dispatcher)
  if (strategies.length && (!Array.isArray(dispatcher._modelStrategies) || !dispatcher._modelStrategies.length))
    dispatcher._modelStrategies = strategies

  return dispatcher
}

function extractStrategies(dispatcher) {
  if (!dispatcher)
    return []
  if (Array.isArray(dispatcher._modelStrategies) && dispatcher._modelStrategies.length)
    return dispatcher._modelStrategies
  if (Array.isArray(dispatcher._strategies) && dispatcher._strategies.length)
    return dispatcher._strategies
  if (dispatcher._strategies && typeof dispatcher._strategies.values === 'function') {
    try {
      return Array.from(dispatcher._strategies.values()).filter(Boolean)
    } catch {
    }
  }
  if (dispatcher._strategies && typeof dispatcher._strategies === 'object') {
    const out = []
    for (const value of Object.values(dispatcher._strategies)) {
      if (!value)
        continue
      if (Array.isArray(value))
        out.push(...value.filter(Boolean))
      else if (typeof value === 'object')
        out.push(value)
    }
    if (out.length)
      return out
  }
  return []
}

async function setStrategyParamsFromPage(request) {
  if (!request || typeof request !== 'object')
    throw new Error('Invalid strategy payload')
  const { name, values } = request
  if (!values || typeof values !== 'object' || !Object.keys(values).length)
    throw new Error('There are no parameters to set')

  const dispatcher = await getStrategyDispatcher(6000)
  if (!dispatcher)
    throw new Error('TradingView strategy dispatcher is unavailable')

  const strategies = extractStrategies(dispatcher)
  if (!strategies.length)
    throw new Error('No strategies are attached to the current chart')

  const strategy = findStrategyEntry(strategies, name)
  if (!strategy)
    throw new Error(name ? `Strategy "${name}" is not found on the current chart` : 'Strategy is not found on the current chart')

  const inputsRoot = strategy?._properties?.inputs
  if (!inputsRoot)
    throw new Error('Strategy inputs are not accessible')

  const catalog = buildInputCatalog(inputsRoot)
  const result = {
    strategyMatched: getStrategyTitle(strategy),
    total: Object.keys(values).length,
    updated: [],
    unchanged: [],
    missing: [],
    errors: [],
    catalogSize: catalog.size || 0,
    catalogSample: catalog.friendly && catalog.friendly.length
      ? catalog.friendly.slice(0, 100)
      : (catalog.list ? catalog.list.slice(0, 100) : []),
    catalogFallback: catalog.list ? catalog.list.slice(0, 100) : []
  }

  for (const [rawKey, rawVal] of Object.entries(values)) {
    const lookupKey = normalizeLookupKey(rawKey)
    if (!lookupKey) {
      result.missing.push(rawKey)
      continue
    }
    const node = catalog.find(lookupKey)
    if (!node) {
      result.missing.push(rawKey)
      continue
    }
    try {
      const changed = applyNodeValue(node, rawVal)
      if (changed)
        result.updated.push(rawKey)
      else
        result.unchanged.push(rawKey)
    } catch (err) {
      console.warn(`[TV-ASS] Failed to set value for "${rawKey}":`, err)
      result.errors.push({ name: rawKey, message: err?.message || String(err) })
    }
  }

  if (typeof strategy.updateAllViews === 'function') {
    try {
      strategy.updateAllViews()
    } catch (err) {
      console.warn('[TV-ASS] Unable to refresh strategy views after applying parameters', err)
    }
  }

  try {
    window.__tvAssLastSetResult = result
  } catch {}

  return result
}

function findStrategyEntry(strategies, targetName) {
  if (!Array.isArray(strategies) || !strategies.length)
    return null
  const normalizedTarget = normalizeLooseKey(targetName)
  let fallback = strategies[0]
  for (const strategy of strategies) {
    const title = getStrategyTitle(strategy)
    if (!title)
      continue
    if (!normalizedTarget || normalizeLooseKey(title) === normalizedTarget)
      return strategy
  }
  return fallback
}

function getStrategyTitle(strategy) {
  if (!strategy)
    return null
  try {
    const propsStrategy = strategy._properties?.strategy
    if (propsStrategy) {
      if (typeof propsStrategy.title === 'function') {
        const title = propsStrategy.title()
        if (isMeaningfulString(title))
          return title
      }
      if (typeof propsStrategy.value === 'function') {
        const title = propsStrategy.value()
        if (isMeaningfulString(title))
          return title
      }
      if (isMeaningfulString(propsStrategy._value))
        return propsStrategy._value
      if (isMeaningfulString(propsStrategy._title))
        return propsStrategy._title
    }
  } catch {
  }
  const metaInfo = strategy._model?._metaInfo || strategy._model?.metaInfo || strategy._originalMetaInfo
  if (metaInfo) {
    if (isMeaningfulString(metaInfo.description))
      return metaInfo.description
    if (isMeaningfulString(metaInfo.shortDescription))
      return metaInfo.shortDescription
    if (isMeaningfulString(metaInfo.name))
      return metaInfo.name
    if (isMeaningfulString(metaInfo.fullName))
      return metaInfo.fullName
  }
  if (isMeaningfulString(strategy._titleStrCache))
    return strategy._titleStrCache
  const partsCache = strategy._titleInPartsCache
  if (partsCache) {
    if (isMeaningfulString(partsCache.title))
      return partsCache.title
    if (isMeaningfulString(partsCache.name))
      return partsCache.name
  }
  if (typeof strategy.title === 'function') {
    try {
      const title = strategy.title()
      if (isMeaningfulString(title))
        return title
    } catch {
    }
  }
  return null
}

function buildInputCatalog(root) {
  const exactMap = new Map()
  const looseMap = new Map()
  const titleMap = new Map()
  const friendlyList = []
  const orderedNodes = []
  const visited = new Set()
  const stack = [root]

  while (stack.length) {
    const node = stack.pop()
    if (!node || visited.has(node))
      continue
    visited.add(node)

    const schema = node._schema || {}
    const nodeType = typeof schema.type === 'string' ? schema.type.toLowerCase() : null
    const hasSetter = typeof node.setValue === 'function' || typeof node.setValueSilently === 'function'

    const fallbackKeys = []
    const title = getNodeTitle(node)
    if (isMeaningfulString(title))
      fallbackKeys.push(title)
    if (schema) {
      if (isMeaningfulString(schema.name))
        fallbackKeys.push(schema.name)
      if (isMeaningfulString(schema.shortName))
        fallbackKeys.push(schema.shortName)
      if (isMeaningfulString(schema.caption))
        fallbackKeys.push(schema.caption)
      if (isMeaningfulString(schema.displayName))
        fallbackKeys.push(schema.displayName)
      if (isMeaningfulString(schema.id))
        fallbackKeys.push(schema.id)
      if (isMeaningfulString(schema.internalId))
        fallbackKeys.push(schema.internalId)
    }
    if (isMeaningfulString(node?._name))
      fallbackKeys.push(node._name)
    if (isMeaningfulString(node?._title))
      fallbackKeys.push(node._title)

    if (hasSetter && nodeType !== 'object' && nodeType !== 'session') {
      if (!fallbackKeys.length)
        fallbackKeys.push(`in_${orderedNodes.length}`)
      for (const key of fallbackKeys)
        registerCatalogEntry(exactMap, looseMap, titleMap, key, node)
      orderedNodes.push(node)
    }

    const children = getNodeChildren(node)
    for (let i = children.length - 1; i >= 0; i--)
      stack.push(children[i])
  }

  const friendlyNames = collectDomInputNames()
  if (friendlyNames.length) {
    for (const friendlyName of friendlyNames) {
      if (!isMeaningfulString(friendlyName))
        continue
      const normalized = normalizeKey(friendlyName)
      const loose = normalizeLooseKey(friendlyName)
      const node =
        (normalized && exactMap.has(normalized) ? exactMap.get(normalized) : null) ||
        (loose && looseMap.has(loose) ? looseMap.get(loose) : null)
      if (!node)
        continue
      registerCatalogEntry(exactMap, looseMap, titleMap, friendlyName, node)
      friendlyList.push(friendlyName)
    }
  }

  return {
    size: titleMap.size,
    list: Array.from(titleMap.values()),
    friendly: friendlyList,
    find(rawKey) {
      const directKey = normalizeKey(rawKey)
      if (directKey && exactMap.has(directKey))
        return exactMap.get(directKey)
      const looseKey = normalizeLooseKey(rawKey)
      if (looseKey && looseMap.has(looseKey))
        return looseMap.get(looseKey)
      return null
    }
  }
}

function registerCatalogEntry(exactMap, looseMap, titleMap, key, node) {
  if (!isMeaningfulString(key) || !node)
    return
  const normalized = normalizeKey(key)
  if (normalized && !exactMap.has(normalized))
    exactMap.set(normalized, node)
  if (normalized && !titleMap.has(normalized))
    titleMap.set(normalized, key)
  const loose = normalizeLooseKey(key)
  if (loose && !looseMap.has(loose))
    looseMap.set(loose, node)
}

function getNodeChildren(node) {
  if (!node)
    return []
  const out = []

  if (typeof node.childs === 'function') {
    try {
      const res = node.childs()
      const normalized = normalizeCollection(res)
      if (normalized.length)
        out.push(...normalized)
    } catch {
    }
  }

  if (Array.isArray(node._childs))
    out.push(...node._childs)
  if (Array.isArray(node._items))
    out.push(...node._items)

  return out.filter(Boolean)
}

function normalizeCollection(collection) {
  if (!collection)
    return []
  if (Array.isArray(collection))
    return collection.filter(Boolean)
  if (typeof collection.toArray === 'function') {
    try {
      const arr = collection.toArray()
      if (Array.isArray(arr))
        return arr.filter(Boolean)
    } catch {
    }
  }
  if (typeof collection.values === 'function') {
    try {
      return Array.from(collection.values()).filter(Boolean)
    } catch {
    }
  }
  if (typeof collection[Symbol.iterator] === 'function') {
    try {
      return Array.from(collection).filter(Boolean)
    } catch {
    }
  }
  if (typeof collection.length === 'number' && collection.length >= 0) {
    const arr = []
    for (let i = 0; i < collection.length; i++) {
      if (collection[i])
        arr.push(collection[i])
    }
    if (arr.length)
      return arr
  }
  if (typeof collection === 'object') {
    const arr = []
    for (const key of Object.keys(collection)) {
      if (/^\d+$/.test(key) || key.startsWith('in_') || key.startsWith('child'))
        if (collection[key])
          arr.push(collection[key])
    }
    return arr
  }
  return []
}

function applyNodeValue(node, incomingValue) {
  if (!node)
    throw new Error('Invalid node reference')
  const schema = node._schema || {}
  const type = typeof schema.type === 'string' ? schema.type.toLowerCase() : null
  let valueToApply = incomingValue

  if (Array.isArray(schema.options) && schema.options.length) {
    const options = normalizeOptions(schema.options)
    const match = chooseOption(options, incomingValue)
    if (!match)
      throw new Error(`Option "${incomingValue}" is not available`)
    valueToApply = match.value
  } else if (type === 'integer' || type === 'int') {
    const num = Number(incomingValue)
    if (!Number.isFinite(num))
      throw new Error(`Invalid integer value "${incomingValue}"`)
    valueToApply = Math.trunc(num)
  } else if (type === 'float' || type === 'number' || type === 'double') {
    const num = Number(incomingValue)
    if (!Number.isFinite(num))
      throw new Error(`Invalid number value "${incomingValue}"`)
    valueToApply = num
  } else if (type === 'bool' || type === 'boolean') {
    valueToApply = normalizeBoolean(incomingValue)
  } else if (type === 'string' || type === 'text' || type === 'source' || type === 'symbol' || type === 'resolution' || type === 'session') {
    valueToApply = String(incomingValue)
  }

  const currentValue = typeof node.value === 'function' ? node.value() : node._value
  if (valuesEqual(currentValue, valueToApply))
    return false

  if (typeof node.setValue === 'function') {
    node.setValue(valueToApply)
    return true
  }
  if (typeof node.setValueSilently === 'function') {
    node.setValueSilently(valueToApply)
    if (node._owner && typeof node._owner._childChanged === 'function')
      node._owner._childChanged(node)
    return true
  }
  throw new Error('Setter is not available for this parameter')
}

function normalizeOptions(options) {
  const result = []
  for (const opt of options) {
    if (opt === null || typeof opt === 'undefined')
      continue
    if (Array.isArray(opt)) {
      const value = opt[0]
      const label = opt.length > 1 ? opt[1] : opt[0]
      result.push({ value, label })
      continue
    }
    if (typeof opt === 'object') {
      const value = opt.value ?? opt.val ?? opt.id ?? opt.name ?? opt.label
      const label = opt.title ?? opt.text ?? opt.caption ?? opt.label ?? opt.name ?? opt.shortName ?? value
      result.push({ value, label })
      continue
    }
    result.push({ value: opt, label: opt })
  }
  return result
}

function chooseOption(options, desired) {
  if (!options || !options.length)
    return null
  const candidates = buildComparableStrings(desired)
  if (!candidates.length)
    candidates.push(desired)

  for (const candidate of candidates) {
    for (const opt of options) {
      if (matchesOptionField(opt.value, candidate) || matchesOptionField(opt.label, candidate))
        return opt
    }
  }

  // As a final fallback, try comparing using aggressively normalized tokens.
  const normalizedTarget = normalizeOptionToken(desired)
  if (normalizedTarget) {
    for (const opt of options) {
      const valueNorm = normalizeOptionToken(opt.value)
      const labelNorm = normalizeOptionToken(opt.label)
      if (stringsLooselyMatch(normalizedTarget, valueNorm) || stringsLooselyMatch(normalizedTarget, labelNorm))
        return opt
    }
  }

  return null
}

function normalizeBoolean(value) {
  if (typeof value === 'boolean')
    return value
  if (typeof value === 'number')
    return value !== 0
  if (typeof value === 'string') {
    const lowered = value.trim().toLowerCase()
    if (['1', 'true', 'yes', 'on'].includes(lowered))
      return true
    if (['0', 'false', 'no', 'off', ''].includes(lowered))
      return false
  }
  return Boolean(value)
}

function valuesEqual(a, b) {
  if (a === b)
    return true
  if (typeof a === 'number' && typeof b === 'number')
    return Math.abs(a - b) < 1e-9
  if (typeof a === 'string' && typeof b === 'string')
    return a.trim() === b.trim()
  return false
}

function getNodeTitle(node) {
  if (!node)
    return null
  try {
    if (typeof node.title === 'function') {
      const title = node.title()
      if (isMeaningfulString(title))
        return title
    }
  } catch {
  }
  const schema = node._schema || {}
  const schemaFields = ['title', 'caption', 'display', 'displayName', 'shortTitle', 'shortName', 'name', 'description']
  for (const field of schemaFields) {
    if (isMeaningfulString(schema[field]))
      return schema[field]
  }
  if (isMeaningfulString(node._title))
    return node._title
  if (isMeaningfulString(node._name))
    return node._name
  if (typeof node.name === 'function') {
    try {
      const title = node.name()
      if (isMeaningfulString(title))
        return title
    } catch {
    }
  }
  return null
}

function isMeaningfulString(value) {
  return typeof value === 'string' && value.trim().length > 0
}

function normalizeKey(value) {
  if (!isMeaningfulString(value))
    return ''
  return value.replace(/\s+/g, ' ').trim()
}

function normalizeLooseKey(value) {
  const normalized = normalizeKey(value)
  if (!normalized)
    return ''
  return normalized.toLowerCase().replace(/[^a-z0-9]+/g, '')
}

function normalizeLookupKey(value) {
  if (!isMeaningfulString(value))
    return ''
  return value.replace(/\s+/g, ' ').trim()
}

const SUPERSCRIPT_DIGITS = {
  '⁰': '0',
  '¹': '1',
  '²': '2',
  '³': '3',
  '⁴': '4',
  '⁵': '5',
  '⁶': '6',
  '⁷': '7',
  '⁸': '8',
  '⁹': '9'
}

const OPTION_SYNONYMS = {
  s: ['short'],
  l: ['long'],
  b: ['both', 'buy'],
  both: ['b'],
  short: ['s'],
  long: ['l']
}

function buildComparableStrings(value) {
  if (typeof value === 'undefined' || value === null)
    return []
  const str = String(value)
  const variants = new Set()
  const push = (val) => {
    if (typeof val === 'undefined' || val === null)
      return
    const out = String(val)
    if (!out.trim())
      return
    variants.add(out)
  }

  const replaceSuperscripts = (input) => input.replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹]/g, ch => SUPERSCRIPT_DIGITS[ch] || '')

  push(str)

  const trimmed = str.trim()
  push(trimmed)

  const withoutSup = replaceSuperscripts(trimmed)
  push(withoutSup)

  const withoutParens = trimmed.replace(/\s*\([^)]*\)\s*/g, ' ').replace(/\s+/g, ' ').trim()
  push(withoutParens)

  const withoutParensSup = replaceSuperscripts(withoutParens)
  push(withoutParensSup)

  const parenMatch = trimmed.match(/\(([^)]+)\)/)
  if (parenMatch && parenMatch[1]) {
    const inner = parenMatch[1].trim()
    push(inner)
    const innerSup = replaceSuperscripts(inner)
    push(innerSup)
    const synonymList = OPTION_SYNONYMS[inner.toLowerCase()]
    if (synonymList)
      synonymList.forEach(push)
  }

  const tokens = trimmed.split(/[\/\|\-]/).map(token => token.trim()).filter(Boolean)
  tokens.forEach(push)

  return Array.from(variants)
}

function normalizeOptionToken(value) {
  if (typeof value === 'undefined' || value === null)
    return ''
  let str = String(value)
  try {
    str = str.normalize('NFKD')
  } catch {
  }
  str = str.replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹]/g, ch => SUPERSCRIPT_DIGITS[ch] || '')
  str = str.replace(/[\u0300-\u036f]/g, '')
  return str.replace(/[^a-z0-9]+/gi, '').toLowerCase()
}

function matchesOptionField(fieldValue, candidate) {
  if (typeof fieldValue === 'undefined' || fieldValue === null)
    return false
  if (typeof candidate === 'undefined' || candidate === null)
    return false
  const fieldStr = String(fieldValue)
  const candidateStr = String(candidate)
  if (!fieldStr || !candidateStr)
    return false
  if (fieldStr === candidateStr)
    return true

  const fieldTrim = fieldStr.trim()
  const candidateTrim = candidateStr.trim()
  if (!fieldTrim || !candidateTrim)
    return false
  if (fieldTrim === candidateTrim)
    return true

  const fieldLower = fieldTrim.toLowerCase()
  const candidateLower = candidateTrim.toLowerCase()
  if (fieldLower === candidateLower)
    return true
  if (fieldLower.startsWith(candidateLower) || candidateLower.startsWith(fieldLower))
    return true

  const fieldNum = Number(fieldTrim)
  const candidateNum = Number(candidateTrim)
  if (Number.isFinite(fieldNum) && Number.isFinite(candidateNum) && Math.abs(fieldNum - candidateNum) < 1e-9)
    return true

  const fieldNorm = normalizeOptionToken(fieldTrim)
  const candidateNorm = normalizeOptionToken(candidateTrim)
  if (fieldNorm && candidateNorm && (fieldNorm === candidateNorm || fieldNorm.startsWith(candidateNorm) || candidateNorm.startsWith(fieldNorm)))
    return true

  return false
}

function stringsLooselyMatch(a, b) {
  if (!a || !b)
    return false
  if (a === b)
    return true
  if (a.startsWith(b) || b.startsWith(a))
    return true
  return false
}

function collectDomInputNames() {
  const selector = '#overlap-manager-root div[data-name="indicator-properties-dialog"] div[class^="content-"] div[class^="cell-"]'
  let cells
  try {
    cells = document.querySelectorAll(selector)
  } catch {
    cells = null
  }
  if (!cells || !cells.length)
    return []
  const names = []
  for (let i = 0; i < cells.length; i++) {
    const cell = cells[i]
    if (!cell)
      continue
    const className = cell.getAttribute('class') || ''
    const rawText = cell.innerText || ''
    const text = rawText.replace(/\s+/g, ' ').trim()
    if (!text)
      continue
    if (className.includes('topCenter-')) {
      i++
      continue
    }
    if (className.includes('first-')) {
      names.push(text)
      i++
      continue
    }
    if (className.includes('fill-')) {
      names.push(text)
      continue
    }
  }
  return names
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
