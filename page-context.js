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
        ${testResults['filterAscending'] !== null ? 'Filter by "' + testResults['filterParamName'] + '", value ' + testResults['filterValue']: ''}<br>
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