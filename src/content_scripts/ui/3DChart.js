if (typeof exports === 'object' && typeof module === 'object') {
  // eslint no-var: "ignore"
  var Plotly = require('plotly.js-gl3d-dist-min')
}

const ui3DChart = {}

ui3DChart.show3DChart = async (testResults) => {
  testResults.ticker ='123'  // TODO remove
  testResults.timeFrame = '1h'
  testResults.method = 'a'
  testResults.filteredSummary = []
  testResults.cycles= 3
  testResults.paramSpace= 'paramSpace'
  testResults.filterAscending = null
  _create3DPopup(testResults)
  const iondv3DChartEl1 = document.getElementById('iondv3DChart')
  _showPlotlyData(iondv3DChartEl1, [1,20, 30], [2,30, 40], [3,40, 50])
  return

  if (typeof testResults === 'undefined' || !testResults.hasOwnProperty('performanceSummary') || testResults.performanceSummary.length === 0) {
    throw new Error('Do not exist backtesting results, please try backtest again')
  }
  if (typeof Plotly === 'undefined') {
    throw new Error("3D Chart library hadn't loaded. Please wait and try again")
  }

  return new Promise(resolve => {
    _create3DPopup(testResults)
    const btnClose = document.getElementById('iondvBoxClose')
    if (btnClose) {
      btnClose.onclick = () => {
        const iondv3DChartEl = document.getElementById('iondv3DChart')
        if (iondv3DChartEl) {
          iondv3DChartEl.parentNode.removeChild(iondv3DChartEl)
        }
        return resolve()
      }
    }
    const [paramNames, resultsNames] = _prepareAxisList(testResults)
    let xSelVal = paramNames[0]
    let ySelVal = paramNames[1]
    let zSelVal = testResults.hasOwnProperty('optParamName') ? testResults.optParamName : resultsNames[0]

    _setAxisOptions('iondvX', paramNames, xSelVal, ySelVal)
    _setAxisOptions('iondvY', paramNames, ySelVal, xSelVal)
    _setAxisOptions('iondvZ', resultsNames, zSelVal)
    let aproxType = document.getElementById('iondvAprox').value

    document.getElementById('iondvX').onclick = () => {
      const curVal = document.getElementById('iondvX').value
      if (xSelVal !== curVal) {
        xSelVal = curVal
        _updateParamList('iondvY', paramNames, xSelVal)
        _updateChart(testResults.performanceSummary, xSelVal, ySelVal, zSelVal, aproxType)
      }
    }
    document.getElementById('iondvY').onclick = () => {
      const curVal = document.getElementById('iondvY').value
      if (ySelVal !== curVal) {
        ySelVal = curVal
        _updateParamList('iondvX', paramNames, ySelVal)
        _updateChart(testResults.performanceSummary, xSelVal, ySelVal, zSelVal, aproxType)
      }
    }
    document.getElementById('iondvZ').onclick = () => {
      const curVal = document.getElementById('iondvZ').value
      if (zSelVal !== curVal) {
        zSelVal = curVal
        _updateChart(testResults.performanceSummary, xSelVal, ySelVal, zSelVal, aproxType)
      }
    }

    document.getElementById('iondvAprox').onclick = () => {
      const curVal = document.getElementById('iondvAprox').value
      if (aproxType !== curVal) {
        aproxType = curVal
        _updateChart(testResults.performanceSummary, xSelVal, ySelVal, zSelVal, aproxType)
      }
    }
    _updateChart(testResults.performanceSummary, xSelVal, ySelVal, zSelVal)
  })
}

function _create3DPopup(testResults) {
  const chart3d = document.createElement('div')
  chart3d.id = 'iondv3DChart'
  chart3d.setAttribute('style', `background-color:rgba(0, 0, 0, 0.4);
    position:absolute; width:100%; height:100%; top:0px; left:0px; z-index:10000;`)
  chart3d.style.height = document.documentElement.scrollHeight + 'px'

  chart3d.innerHTML = `<button id="iondvBoxClose" style="position: absolute;left: 50%;top: 50%;margin-top: -325px;margin-left: 465px;">Close</button>
    <div style="position: absolute; left: 50%;top: 50%; padding: 5px;
        width: 900px;height:600px; margin-top: -300px; margin-left: -400px;
        background: #fff; border: 1px solid #ccc; box-shadow: 3px 3px 7px #777;
        -webkit-box-shadow: 3px 3px 7px #777;-moz-border-radius: 22px; -webkit-border-radius: 22px;
        z-index: 999;">
    <div style="margin:0;padding: 0px;clear: both;width: 100%;">
      <div style="display:inline-block;vertical-align: middle;padding: 0px;width: 175px;">
        <h3 style="padding-bottom: 10px">Backtesting Results</h3>
        <p>Strategy name: ${testResults.name}<br>
        Symbol: ${testResults.ticker}<br>
        Timeframe: ${testResults.timeFrame}<br>
        Backtest method: ${testResults.method}<br>
        Backtest cycles: ${testResults.performanceSummary.length + testResults.filteredSummary.length}(${testResults.cycles})<br>
        Parameter space: ${testResults.paramSpace}<br>
        ${testResults.filterAscending !== null ? 'Filter by "' + testResults.filterParamName + '", value ' + testResults.filterValue : ''}<br>
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

function _generateOptionsHtml(values, defVal = null) {
  defVal = defVal === null ? values[0] : defVal
  return values.reduce((text, item) => `${text}<option value="${item}"${item === defVal ? ' selected="selected"' : ''}>${item}</option>`, '')
}

function _setAxisOptions(elId, values, defVal, excludedVal = null) {
  const filteredValues = excludedVal !== null ? values.filter(item => item !== excludedVal) : values
  const optionsHtml = _generateOptionsHtml(filteredValues, defVal)
  const axis = document.getElementById(elId)
  axis.value = defVal
  axis.innerHTML = optionsHtml
}

function _prepareAxisList(testResults) {
  const paramNames = []
  Object.keys(testResults.performanceSummary[0]).forEach(item => {
    if (item.startsWith('__')) {
      paramNames.push(item.substring(2))
    }
  })
  if (paramNames.length === 0) {
    throw new Error('None of parameters present in data')
  } else if (paramNames.length === 1) {
    paramNames.push('none')
  }
  const resultsNames = Object.keys(testResults.performanceSummary[0]).filter(item => !item.startsWith('__') && item !== 'comment')
  if (resultsNames.length === 0) {
    throw new Error('None of results present in data')
  }
  return [paramNames, resultsNames]
}

function _updateParamList(elId, paramNames, excludedVal) {
  const curVal = document.getElementById(elId).value
  _setAxisOptions(elId, paramNames, curVal, excludedVal)
}

function _showPlotlyData(chartPlotlyEl, xData, yData, zData) {
  const data = [{
    x: xData,
    y: yData,
    z: zData,
    type: 'surface',
    contours: {z: {show: true}}
  }]
  const layout = {
    // xaxis: {title: {text: 'x Axis'}},
    // yaxis: {title: {text: 't Axis'}},
    // zaxis: {title: {text: 'z Axis'}},
    autosize: true,
    width: 700,
    height: 600,
    // highlightcolor: "limegreen",
    showlegend: false,
    margin: {l: 65, r: 50, b: 65, t: 90}
  }
  Plotly.newPlot(chartPlotlyEl, data, layout)
}

function _updateChart(performanceSummary, xSelVal, ySelVal, zName, aproxType) {
  const xName = `__${xSelVal}`
  const yName = `__${ySelVal}`
  const chartPlotly = document.getElementById('iondvPlotly')
  const yAxisDict = {}
  const zAxisDict = {}
  performanceSummary.forEach(item => {
    if (item.hasOwnProperty(xName) && item.hasOwnProperty(yName) && item.hasOwnProperty(zName)) {
      if (!yAxisDict.hasOwnProperty(item[yName])) {
        yAxisDict[item[yName]] = null
      }
      if (!zAxisDict.hasOwnProperty(item[xName])) {
        zAxisDict[item[xName]] = {}
      }
      if (!zAxisDict[item[xName]].hasOwnProperty(item[yName])) {
        zAxisDict[item[xName]][item[yName]] = []
      }
      zAxisDict[item[xName]][item[yName]].push(item[zName])
      // zAxisDict[item[xName]][item[yName]] = item[zName]
    } else {
      console.log('MISSED ONE OF KEYS', xSelVal, ySelVal, item)
    }
  })

  const xAxis = Object.keys(zAxisDict).sort((a, b) => a - b)
  const yAxis = Object.keys(yAxisDict).sort((a, b) => a - b)
  const zAxis = []
  yAxis.forEach(y => {
    const row = []
    xAxis.forEach(x => {
      if (zAxisDict.hasOwnProperty(x) && zAxisDict[x].hasOwnProperty(y)) {
        if (!zAxisDict[x][y]) {
          row.push(0)
        } else if (zAxisDict[x][y].length === 1) {
          row.push(zAxisDict[x][y][0])
        } else {
          let val
          switch (aproxType) {
            case 'max':
              val = Math.max(...zAxisDict[x][y])
              break
            case 'min':
              val = Math.min(...zAxisDict[x][y])
              break
            case 'avg':
              val = zAxisDict[x][y].reduce((acc, v, i, a) => (acc + v / a.length), 0)
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

  _showPlotlyData(chartPlotly, xAxis, yAxis, zAxis)
}
