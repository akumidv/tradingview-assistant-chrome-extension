const backtest = {}


backtest.showAndUpdateStrategyParameters = async (testParams) => {
  return new Promise(resolve => {
    try{
      const isStratParamElPresent = document.getElementById(SEL_CONST.strategyParamId)
      let stratParamEl = isStratParamElPresent ? document.getElementById(SEL_CONST.strategyParamId) : document.createElement('div')
      let popupEl
      if (!isStratParamElPresent) {
        stratParamEl.id = SEL_CONST.strategyParamId
        stratParamEl.setAttribute('style', ui.styleValWindowShadow)
        stratParamEl.style.height = document.documentElement.scrollHeight + 'px'
        const stratParamStyleEl = stratParamEl.appendChild(document.createElement('style'))
        stratParamStyleEl.innerHTML = _styleParamWindow
        popupEl = stratParamEl.appendChild(document.createElement('div'))
        popupEl.setAttribute('style', _styleValParamWindow)
      } else {
        popupEl = stratParamEl.querySelector('div')
      }
      popupEl.innerHTML = _strategyParamHTML
      if (!isStratParamElPresent) {
        const tvDialog = document.getElementById(SEL_CONST.tvUIPopupRootId)
        if (tvDialog)
          document.body.insertBefore(stratParamEl, tvDialog) // For avoid problem if msg overlap tv dialog window
        else
          document.body.appendChild(stratParamEl)
      }
      const tbody = document.getElementById(SEL_CONST.strategyParamDataId)

      let paramRows = ''
      const processedParams = []
      for(let name in testParams.paramRange) {
        if (testParams.paramRange[name][0] === null || (isNaN(testParams.paramRange[name][0]) &&
          (typeof testParams.paramRange[name][0] !== 'string' || !testParams.paramRange[name][0].includes(';'))))
          continue
        paramRows += `\n<tr>${_prepareRow(name, testParams.paramRange[name], true)}</tr>`
        processedParams.push(name)
      }
      for(let name in testParams.paramRangeSrc) {
        if(!processedParams.includes(name) && testParams.paramRangeSrc[name][0] !== null && (
          !isNaN(testParams.paramRangeSrc[name][0]) ||
          (typeof testParams.paramRangeSrc[name][0] === 'string') && testParams.paramRangeSrc[name][0].includes(';')))
          paramRows += `\n<tr>${_prepareRow(name, testParams.paramRangeSrc[name], false)}</tr>`
      }
      if (paramRows)
        tbody.innerHTML = paramRows // tbody.appendChild(paramRows)

      _updateParamsAndSpace(testParams)
      tbody.addEventListener('change', (event) => _updateParamsAndSpace(testParams))
      const copyCycleBtn = document.getElementById('iondvCycleCopy')
      if (copyCycleBtn) {
        copyCycleBtn.onclick = async () => {
          const cylceEl = document.getElementById('stratParamCycles')
          const cyclesAllEl = document.getElementById('cyclesAll')
          if(cylceEl)
            cylceEl.value = isNaN(parseInt(cyclesAllEl.innerText)) ? 10 : parseInt(cyclesAllEl.innerText)
        }
      }
      const checkAllEl = document.getElementById('iondvCheckAll')
      if (checkAllEl) {
        checkAllEl.onchange = () => {
          const allCheckbox = document.getElementById('iondvCheckAll')
          const checkAllEl = document.querySelectorAll('[name="iondv-active-check-box"]')
          if(checkAllEl && allCheckbox) {
            for(const el of checkAllEl) {
              el.checked = allCheckbox.checked
            }
           _updateParamsAndSpace(testParams)
          }
        }
      }
      const btnClose = document.getElementById('stratParamCancel')
      if (btnClose) {
        btnClose.onclick = () => {
          console.log('Cancel')
          _removeParamWindow()
          return resolve(null)
        }
      }
      const btnSaveRun = document.getElementById('stratParamSaveRun')
      if (btnSaveRun) {
        btnSaveRun.onclick = () => {
          const paramRange = _updateParamsAndSpace(testParams)
          console.log('Save and run')
          const cycles = _getCycles()
          _removeParamWindow()
          return resolve({cycles: cycles, paramRange: paramRange })
        }
      }
      const btnDefRun = document.getElementById('stratParamDefRun')
      if (btnDefRun) {
        btnDefRun.onclick = () => {
          console.log('Run default')
          const cycles = _getCycles()
          _removeParamWindow()
          return resolve({cycles: cycles, paramRange: null })
        }
      }
    } catch (err) {
      _removeParamWindow()
      throw err
    }
  })
}

function _prepareRow(name, param, status) {
  const isBoolean = typeof param[0] === 'boolean'
  return `<td><input type="checkbox" ${status? 'checked' : ''} style="width:1em; background-color : #f1f1f1;" name="iondv-active-check-box"></td><td>${name}</td>
          <td><input type="text" value="${isBoolean ? 'true' : param[0]}" style="width:4em; ${!isBoolean? 'background-color :#f1f1f1;':''}" ${isBoolean ? 'disabled' :''}></td>
          <td><input type="text" value="${isBoolean ? 'false' : param[1]}" style="width:4em; ${!isBoolean? 'background-color :#f1f1f1;':''}" ${isBoolean ? 'disabled' :''}></td>
          <td><input type="number"  step="any" value="${param[2]}" style="width:4em; ${!isBoolean? 'background-color :#f1f1f1;':''}" ${isBoolean ? 'disabled' :''}></td>
          <td><input type="text" value="${param[3]}" style="width:4em; background-color : #f1f1f1;" ></td>
          <td><input type="number" value="${param[4]}" style="width:4em; background-color : #f1f1f1;"></td>`
}

function _removeParamWindow() {
  const stratParamWindowEl = document.getElementById('iondvStratParam')
  if (stratParamWindowEl)
    stratParamWindowEl.parentNode.removeChild(stratParamWindowEl)
}

function _getCycles() {
  try {
    const cyclesEl = document.getElementById('stratParamCycles')
    return cyclesEl && cyclesEl.value ? parseInt(cyclesEl.value) : 100
  } catch {}
  return 100
}

function _updateParamsAndSpace(testParams) {
  const paramRange = {}
  let allFiltersRows = document.getElementById(SEL_CONST.strategyParamDataId).getElementsByTagName('tr')
  let space = null
  if (allFiltersRows) {
    for(let row of allFiltersRows) {
      const cells = row.getElementsByTagName('td')
      if (!cells || cells.length !== 7)
        continue
      const activeEl = cells[0].getElementsByTagName('input')
      if (!activeEl || !activeEl[0] || !activeEl[0].checked)
        continue
      const nameEl = cells[1] // const nameEl = cells[1].getElementsByTagName('input')
      const fromEl = cells[2].getElementsByTagName('input')
      const toEl = cells[3].getElementsByTagName('input')
      const stepEl = cells[4].getElementsByTagName('input')
      const defEl = cells[5].getElementsByTagName('input')
      const priorityEl = cells[6].getElementsByTagName('input')
      if(!nameEl || !nameEl.innerText || !fromEl || !fromEl.length || !toEl || !toEl.length || !stepEl || !stepEl.length)
        continue
      try {
        const key = nameEl.innerText
        let paramSpace = 1
        const priority = parseInt(priorityEl[0].value)
        if(typeof testParams.paramRangeSrc[key][0] === 'boolean') {
          paramRange[key] = [true, false, 0, defEl[0].value.toLowerCase() === 'true', priority]
          paramSpace = 2
        } else if (typeof testParams.paramRangeSrc[key][0] === 'string' && testParams.paramRangeSrc[key][0].includes(';')) {
          paramRange[key] = [fromEl[0].value, '', 0, fromEl[0].value.split(';')[0], priority]
          paramSpace = fromEl[0].value.split(';').length
        } else {
          let isInteger = testParams.paramRangeSrc[key][0] === Math.round(testParams.paramRangeSrc[key][0]) &&
            testParams.paramRangeSrc[key][1] === Math.round(testParams.paramRangeSrc[key][1]) &&
            testParams.paramRangeSrc[key][2] === Math.round(testParams.paramRangeSrc[key][2])
          if (!Number.isNaN(Number(fromEl[0].value))) { // Not 0 or Nan
            if (parseInt(fromEl[0].value) !== Number(fromEl[0].value) ||
               (Number(toEl[0].value) && parseInt(toEl[0].value) !== Number(toEl[0].value)) ||
               (Number(stepEl[0].value) && parseInt(stepEl[0].value) !== Number(stepEl[0].value)))
              isInteger = false
            paramRange[key] = [isInteger ? parseInt(fromEl[0].value) : Number(fromEl[0].value),
              Number(toEl[0].value)]
            let step = isInteger ? parseInt(stepEl[0].value) : Number(stepEl[0].value)
            step = step !== 0 ? step : paramRange[key][1] < paramRange[key][0] ? -1 : 1
            paramRange[key].push(step)
            paramRange[key].push(isInteger ? parseInt(defEl[0].value) : Number(defEl[0].value))
            paramRange[key].push(priority)
            paramSpace = Math.floor(Math.abs(paramRange[key][0] - paramRange[key][1]) / paramRange[key][2]) + 1
          } else {
            paramRange[key] = [fromEl[0].value, '', 0, fromEl[0].value, priority]
            paramSpace = 1
          }
        }
        space = space == null ? paramSpace : space * paramSpace
      } catch {}
    }
  }
  document.getElementById('cyclesAll').innerHTML=String(space !== null ? space : 0)
  // TODO update cells?
  return paramRange
}

const _strategyParamHTML =  `<div style="height: 150px; overflow-y: hidden; vertical-align:top;">
  <h1 style="padding: 25px">Strategy parameters</h1>
  <div style="align-content: center"><span style="padding:5px 15px">
  Cycles <input id="stratParamCycles" type="number" value="10" style="width:8em; background-color :#f1f1f1;"> 
  <a id="iondvCycleCopy" style="cursor: pointer;padding-right: 5px"><i class="iondv_icon iondv_copy"></i></a>
  from ~<span id="cyclesAll">100</span></span>
  <button id="stratParamSaveRun" class="iondv-button iondv-button-run">Save&Run</button>
  <button id="stratParamDefRun" class="iondv-button iondv-button-def">Skip&Run</button>
  <button id="stratParamCancel" class="iondv-button iondv-button-close">Cancel</button>
  </div>
  </div>
  <div style="height: 640px; overflow-y: auto; vertical-align:top;">
  <table class="stratParamTable">
   <thead><td style="width: 10%"><input type="checkbox" id="iondvCheckAll" style="width:1em;background-color :#f1f1f1;">Active</td><td style="width: 40%">Parameter</td><td>From</td><td>To</td><td>Step</td><td>Default</td><td>Priority</td></thead>
   <tbody id="${SEL_CONST.strategyParamDataId}"></tbody>
  </table></div>`


const _styleParamWindow = `<style>
.iondv-button {
  background-color: white;
  border: 1px;
  color: black;
  padding: 10px 10px;
  text-align: center;
  text-decoration: none;
  font-size: 14px;
  -webkit-transition-duration: 0.4s; /* Safari */
  transition-duration: 0.4s;
  cursor: pointer;
  width: 75px;      
  border-radius: 3px;
  line-height: 0;
}
.iondv-button-close:hover {
  background-color: gray;
  color: white;
}
.iondv-button-close {
  background-color: white;
  color: black;
  border: 2px solid gray;
}
.iondv-button-run:hover {
  background-color: lightgreen;
}
.iondv-button-run {
  background-color: white;
  border: 2px solid lightgreen;
}
.iondv-button-def:hover {
  background-color: skyblue;
}
.iondv-button-def {
  background-color: white;
  border: 2px solid skyblue;
}
table.stratParamTable {
    width: 100%;
     border-collapse: collapse;
    border: 2px solid grey;
    empty-cells: show;
    table-layout: fixed;
}
.stratParamTable thead {
    caption-side: bottom;
   text-align: center;
   padding: 5px 0;
   font-size: 100%;
}
.stratParamTable td {
   border: 1px solid grey;
    font-size: 90%;
    padding: 2px 2px;
}
</style>`

const _styleValParamWindow = `background-color: white; color: black;
width: 800px; height: 800px; position: fixed; top: 50px; right: 0; left: 0;
margin: auto; border: 1px solid lightblue; box-shadow: 3px 3px 7px #777;
align-items: center;  justify-content: left; text-align: left;`