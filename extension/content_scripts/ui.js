const ui = {
  isMsgShown: false
}

const scriptFonts = document.createElement('style')
scriptFonts.innerHTML = '@font-face {' +
  '    font-family: "Font Awesome 5 Free";' +
  '    font-style: normal;\n' +
  '    font-weight: 900;' +
  '    font-display: block;' +
  `    src: url(${chrome.runtime.getURL('fonts/fa-solid-900.woff2')}) format('woff2');` +
  '}\n' +
  '.iondv_icon::before {\n' +
  '    display: inline-block;\n' +
  '    font-style: normal;\n' +
  '    font-variant: normal;\n' +
  '    text-rendering: auto;\n' +
  '    -webkit-font-smoothing: antialiased;\n' +
  '  }\n' +
  '.iondv_download::before {\n' +
  '    font-family: "Font Awesome 5 Free"; font-weight: 900; font-size: 1.25em; content: "\\f56d";\n' +
  '  }\n' +
  '.iondv_upload::before {\n' +
  '    font-family: "Font Awesome 5 Free"; font-weight: 900; font-size: 1.25em; content: "\\f574";\n' +
  '  }\n' +
  '.iondv_copy::before {\n' +
  '    font-family: "Font Awesome 5 Free"; font-weight: 900; font-size: 1.25em; content: "\\f0c5";\n' +
  '  }\n'
document.documentElement.appendChild(scriptFonts)

ui.checkInjectedElements = () => {
  if (action && !action.workerStatus) { // If there is not running process
    const strategyDefaultEl = document.querySelector(SEL.strategyDefaultElement)
    if (!strategyDefaultEl)
      return
    if (document.querySelector(SEL.strategyImportExport))
      return
    const importExportEl = document.createElement('div')
    importExportEl.id = 'iondvImportExport'
    importExportEl.setAttribute('style', 'padding-left: 10px;padding-right: 10px; padding-top: 8px;')
    importExportEl.innerHTML = '<a id="iondvImport" style="cursor: pointer;padding-right: 5px"><i class="iondv_icon iondv_upload"></i></a>' +
      '<a id="iondvExport" style="cursor: pointer;padding-left: 5px;"><i class="iondv_icon iondv_download"></i></a>'
    strategyDefaultEl.after(importExportEl)
    const exportBtn = document.getElementById('iondvExport')
    const importBtn = document.getElementById('iondvImport')
    if (exportBtn) {
      exportBtn.onclick = async () => {
        await action.saveParameters()
      }
    }
    if (importBtn) {
      importBtn.onclick = async () => {
        await action.loadParameters()
      }
    }

  }
}

ui.stylePopup = `<style>
  .iondvpopup {
    display: table;
    position: relative;
    margin: 40px auto 0;
    width: 500px;
    background-color: #8acaff;
    color: #000000;
    transition: all 0.2s ease;
  }
  .iondvpopup-orange {
    background-color: #ffdeb1;
  }
  .iondvpopup-red {
    background-color: #fab5af;
  }
  .iondvpopup-green {
    background-color: #aefdd7;
  }
  .iondvpopup-icon {
    display: table-cell;
    vertical-align: middle;
    width: 40px;
    padding: 20px;
    text-align: center;
    background-color: rgba(0, 0, 0, 0.25);
  }
  .iondvpopup-header {
    display: table-caption;
    vertical-align: middle;
    width: 500px;
    padding: 5px 0;
    text-align: center;
    background-color: {headerBgColor};
  }
  .iondvpopup-body {
    display: table-cell;
    vertical-align: middle;
    padding: 20px 20px 20px 10px;
  }
  .iondvpopup-body > p {
      line-height: 1.2;
      margin-top: 6px;
      white-space: pre-wrap;
    }
  .iondvpopup-button {
    position: relative;
    margin: 15px 5px -10px;
    background-color: rgba(0, 0, 0, 0.25);
    box-shadow: 0 3px rgba(0, 0, 0, 0.4);
    border:none;
    padding: 10px 15px;
    font-size: 16px;
    font-family: 'Source Sans Pro';
    color: #000000;
    outline: none;
    cursor: pointer;
  }
  .iondvpopup-button:hover {
      background: rgba(0, 0, 0, 0.3);
  }
  .iondvpopup-button:active {
      background: rgba(0, 0, 0, 0.3);
      box-shadow: 0 0 rgba(0, 0, 0, 0.4);
      top: 3px;
  }
  .iondvpopup-sub {
    font-style: italic;
  }
</style>`
ui.styleValWindowShadow = `background-color:rgba(0, 0, 0, 0.2);
position:absolute;
width:100%;
height:100%;
top:0px;
left:0px;
z-index:10000;`

ui.alertPopup =  async (msgText, isError = null, isConfirm = false) => {
  return new Promise(resolve => {
    function removeAlertPopup () {
      const iondvAlertPopupEl = document.getElementById('iondvAlertPopup')
      if (iondvAlertPopupEl)
        iondvAlertPopupEl.parentNode.removeChild(iondvAlertPopupEl)
      return resolve(true)
    }

    function cancelAlertPopup () {
      const iondvAlertPopupEl = document.getElementById('iondvAlertPopup')
      if (iondvAlertPopupEl)
        iondvAlertPopupEl.parentNode.removeChild(iondvAlertPopupEl)
      return resolve(false)
    }

    if (document.getElementById('iondvAlertPopup'))
      return resolve()

    const mObj = document.getElementsByTagName('body')[0].appendChild(document.createElement('div'))
    mObj.id = 'iondvAlertPopup'
    mObj.setAttribute('style', ui.styleValWindowShadow)
    mObj.style.height = document.documentElement.scrollHeight + 'px'
    const warnIcon = '<svg xmlns="http://www.w3.org/2000/svg"  width="40px" height="40px" viewBox="0 0 40 40" stroke-width="3" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"></path><circle cx="20" cy="20" r="18"></circle><line x1="20" y1="12" x2="20" y2="22"></line><line x1="20" y1="27" x2="20" y2="28"></line></svg>'
    const errorIcon = '<svg xmlns="http://www.w3.org/2000/svg" width="40px" height="40px" viewBox="0 0 40 40" stroke-width="3" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"></path><rect x="4" y="4" width="34" height="34" rx="2"></rect><path d="M14 14l14 14m0 -14l-14 14"></path></svg>'
    const okIcon = '<svg xmlns="http://www.w3.org/2000/svg" width="40px" height="40px" viewBox="0 0 40 40" stroke-width="3" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h40v40H0z" fill="none"></path><path d="M5 20l12 12l22 -20"></path></svg>'
    const icon = isError === null ? okIcon : isError ? errorIcon : warnIcon
    const headerText = isError === null ? 'Information' : isError ? 'Error' : 'Warning'
    const bgColorClass = isError === null ? 'iondvpopup-green' : isError ? 'iondvpopup-red' : 'iondvpopup-orange'
    const headerBgColor = isError === null ? '#80ffad' : isError ? '#ff9286' : '#fdc987'
    mObj.innerHTML = ui.stylePopup.replaceAll('{bgColorClass}', bgColorClass) + `
<div class="iondvpopup ${bgColorClass}">
    <div class="iondvpopup-header">${headerText}</div>
    <div class="display: table-row">
      <div class="iondvpopup-icon">
        ${icon}
      </div>
      <div class="iondvpopup-body">
        <p>${msgText}</p>
        <button class="iondvpopup-button" id="iondvPopupCloseBtn">OK</button>
        ${isConfirm ? '<button class="iondvpopup-button" id="iondvPopupCancelBtn">Cancel</button>' : ''}
      </div>
    </div>
</div>`
    const btnOk = document.getElementById('iondvPopupCloseBtn')
    if (btnOk) {
      btnOk.focus()
      btnOk.onclick = removeAlertPopup
    }
    const btnCancel = document.getElementById('iondvPopupCancelBtn')
    if (btnCancel) {
      btnCancel.onclick = cancelAlertPopup
    }
  })
}

ui.showPopup = async (msgText) => {
  return await ui.alertPopup(msgText, null)
}

ui.showErrorPopup = async (msgText) => {
  return await ui.alertPopup(msgText, true)
}

ui.showWarningPopup = async (msgText) => {
  return await ui.alertPopup(msgText, false)
}

ui.ISSUES_URL = 'https://github.com/akumidv/tradingview-assistant-chrome-extension/issues'

// What to do when a failure is not the user's to fix: where to report it and what to attach
ui.issueHelpText = () => {
  const version = chrome.runtime.getManifest().version
  return 'If it repeats after reloading the page, TradingView may have changed its UI.\n' +
    `Please check <a href="${ui.ISSUES_URL}" target="_blank">GitHub issues</a> and open a new one if it is not reported yet. Include:\n` +
    `- extension version ${version} and your browser;\n` +
    '- TradingView UI language;\n' +
    '- the console log: F12 → Console, filter "[tv-assistant]", levels including "Verbose".'
}

ui.showIssuePopup = async (msgText) => {
  return await ui.alertPopup(`${msgText}\n\n${ui.issueHelpText()}`, true)
}

// Shows a caught error by kind: user-resolvable errors as is, everything else with the issue instructions
ui.showErrorByKind = async (err, context) => {
  const text = err && err.message ? err.message : `${err}`
  if (err instanceof UserActionError)
    return await ui.showErrorPopup(text)
  log.error(`${context} failed:`, err)
  if (err instanceof UiChangedError)
    return await ui.showIssuePopup(text)
  return await ui.showIssuePopup(`An unexpected error occurred while running "${context}":\n${text}`)
}

ui.statusMessageRemove = () => {
  const statusMessageEl = document.getElementById('iondvStatus')
  if (statusMessageEl)
    statusMessageEl.parentNode.removeChild(statusMessageEl)
}

ui.autoCloseAlert = (msg, duration = 3000) => {
  const altEl = document.createElement('div')
  altEl.setAttribute('style', 'background-color: #ffeaa7;color:black; width: 350px;height: 200px;position: absolute;top:0;bottom:0;left:0;right:0;margin:auto;border: 1px solid black;font-family:arial;font-size:15px;font-weight:bold;display: flex; align-items: center; justify-content: center; text-align: center;')
  altEl.setAttribute('id', 'iondvAlertAutoClose')
  altEl.innerHTML = msg
  setTimeout(function () {
    altEl.parentNode.removeChild(altEl)
  }, duration)
  document.body.appendChild(altEl)
}


// A short notice that does not block the page or the test: one element, replaced by the next notice
ui.showToast = (msgText, duration = 1500) => {
  let toastEl = document.getElementById('iondvToast')
  if (!toastEl) {
    toastEl = document.createElement('div')
    toastEl.id = 'iondvToast'
    toastEl.setAttribute('style', 'position: fixed; top: 60px; left: 50%; transform: translateX(-50%); z-index: 10000;' +
      'max-width: 600px; padding: 8px 14px; background-color: #fffde0; color: black; border: 1px solid lightblue;' +
      'box-shadow: 3px 3px 7px #777; font-family: arial; font-size: 13px; pointer-events: none;' +
      'white-space: nowrap; overflow: hidden; text-overflow: ellipsis;')
    document.body.appendChild(toastEl)
  }
  toastEl.textContent = msgText
  toastEl.style.display = 'block'
  clearTimeout(ui._toastTimer)
  ui._toastTimer = setTimeout(() => { toastEl.style.display = 'none' }, duration)
}

ui.styleValStausMessage = `
.button {
    background-color: white;
    border: none;
    color: white;
    padding: 10px 2px;
    text-align: center;
    text-decoration: none;
    font-size: 14px;
    margin-top:-10px;
    margin-right:-0px;
    -webkit-transition-duration: 0.4s; /* Safari */
    transition-duration: 0.4s;
    cursor: pointer;
    width: 50px;
    float: right;
    border-radius: 3px;
    display: inline-block;
    line-height: 0;
}
.button-close:hover {
    background-color: gray;
    color: white;
}
.button-close {
    background-color: white;
    color: black;
    border: 2px solid gray;
}`


ui.styleValStatusMessage = `background-color: #fffde0; color: black;
      width: 800px; height: 175px; position: fixed;       top: 50px;     right: 0;    left: 0;
      margin: auto;       border: 1px solid lightblue;       box-shadow: 3px 3px 7px #777;
      align-items: center;       justify-content: left;       text-align: left;`


ui.statusMessage = (msgText, extraHeader = null) => {
  const isStatusPresent = document.getElementById('iondvStatus')
  const mObj = isStatusPresent ? document.getElementById('iondvStatus') : document.createElement('div')
  let msgEl
  if (!isStatusPresent) {
    mObj.id = 'iondvStatus'
    mObj.setAttribute('style', ui.styleValWindowShadow)
    mObj.style.height = document.documentElement.scrollHeight + 'px'
    const msgStyleEl = mObj.appendChild(document.createElement('style'))
    msgStyleEl.innerHTML = ui.styleValStausMessage
    msgEl = mObj.appendChild(document.createElement('div'))
    msgEl.setAttribute('style', ui.styleValStatusMessage)
  } else {
    msgEl = mObj.querySelector('div')
  }
  if (isStatusPresent && msgEl && document.getElementById('iondvMsg') && !extraHeader) {
    document.getElementById('iondvMsg').innerHTML = msgText
  } else {
    extraHeader = extraHeader !== null ? `<div style="font-size: 12px;margin-left: 5px;margin-right: 5px;text-align: left;">${extraHeader}</div>` : '' //;margin-bottom: 10px
    msgEl.innerHTML = '<button class="button button-close" id="iondvBoxClose">stop</button>' +
      '<div style="color: blue;font-size: 26px;margin: 5px 5px;text-align: center;">Attention!</div>' +
      '<div style="font-size: 18px;margin-left: 5px;margin-right: 5px;text-align: center;">The page elements are controlled by the browser extension. Please do not click on the page elements.You can reload the page and the results for the last iteration will be saved.</div>' +
      extraHeader +
      '<div id="iondvMsg" style="margin: 5px 10px">' +
      msgText + '</div>'
  }
  if (!isStatusPresent) {
    const tvDialog = document.getElementById('overlap-manager-root')
    if (tvDialog)
      document.body.insertBefore(mObj, tvDialog) // For avoid problem if msg overlap tv dialog window
    else
      document.body.appendChild(mObj)
  }
  const btnClose = document.getElementById('iondvBoxClose')
  if (btnClose) {
    btnClose.onclick = () => {
      log.info('Stop clicked')
      action.workerStatus = null
    }
  }
}

ui.styleParamWindow = `<style>
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

ui.styleValParamWindow = `background-color: white; color: black;
width: 800px; height: 800px; position: fixed; top: 50px; right: 0; left: 0;
margin: auto; border: 1px solid lightblue; box-shadow: 3px 3px 7px #777;
align-items: center;  justify-content: left; text-align: left;`

// The "Strategy parameters" window: ranges and Active marks of the optimization settings of one strategy.
// params: [{name, active, range: [from, to, step, default, priority]}] in the order to show; cycles: the cycles value.
// timeLimit: minutes, 0 - no limit. The test stops at the limit reached first: cycles or time; both 0 - no limit.
// onSave(state) is called by the Save and Save&Run buttons, state = {params (same form, row order), cycles, timeLimit}.
// Resolves {action: 'run', state} for Save&Run, {action: 'skip', state} for Skip&Run (the stored parameters, only
// cycles taken from the window) and null for Cancel.
ui.showOptimizationSettingsDialog = async (strategyTitle, params, cycles, timeLimit, onSave) => {
  return new Promise(resolve => {
    const escapeHtml = (value) => String(value === null || typeof value === 'undefined' ? '' : value)
      .replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
    // Decimal comma is accepted as a decimal point
    const toNumberText = (text) => String(text || '').trim().replace(',', '.')
    const sourceRanges = Object.fromEntries(params.map(param => [param.name, param.range]))

    // Reads every row of the window, in the row order
    function readRows() {
      const rowParams = []
      let space = null
      const allRows = document.getElementById('stratParamData').getElementsByTagName('tr')
      let rowIdx = 0
      for (let row of allRows) {
        rowIdx++
        const cells = row.getElementsByTagName('td')
        if (!cells || cells.length !== 7)
          continue
        const key = row.dataset.param ? decodeURIComponent(row.dataset.param) : cells[1].innerText
        const isActive = !!cells[0].querySelector('input')?.checked
        const fromEl = cells[2].querySelector('input')
        const toEl = cells[3].querySelector('input')
        const stepEl = cells[4].querySelector('input')
        const defEl = cells[5].querySelector('input')
        const priorityEl = cells[6].querySelector('input')
        if (!key || !fromEl || !toEl || !stepEl || !defEl)
          continue
        const src = sourceRanges[key] || []
        let priority = parseInt(priorityEl?.value)
        if (Number.isNaN(priority))
          priority = rowIdx
        let range
        let paramSpace = 1
        try {
          if (typeof src[0] === 'boolean') {
            range = [true, false, 0, defEl.value.trim().toLowerCase() === 'true', priority]
            paramSpace = 2
          } else if (typeof src[0] === 'string' && (src[0].includes(';') || fromEl.value.includes(';'))) {
            const options = fromEl.value.split(';').map(item => item.trim()).filter(item => item.length)
            const def = options.includes(defEl.value.trim()) ? defEl.value.trim() : options[0]
            range = [options.join(';'), '', 0, def, priority]
            paramSpace = options.length || 1
          } else {
            const fromText = toNumberText(fromEl.value), toText = toNumberText(toEl.value)
            const stepText = toNumberText(stepEl.value), defText = toNumberText(defEl.value)
            if (fromText !== '' && !Number.isNaN(Number(fromText))) {
              const nums = [fromText, toText, stepText, defText].filter(item => item !== '' && !Number.isNaN(Number(item)))
              const isInteger = nums.every(item => Number.isInteger(Number(item)))
              const from = Number(fromText)
              const to = toText === '' || Number.isNaN(Number(toText)) ? from : Number(toText)
              let step = stepText === '' || Number.isNaN(Number(stepText)) ? 0 : Number(stepText)
              step = step !== 0 ? step : to < from ? -1 : 1
              const def = defText === '' || Number.isNaN(Number(defText)) ? from : Number(defText)
              range = isInteger ? [parseInt(from), parseInt(to), parseInt(step) || 1, parseInt(def), priority] : [from, to, step, def, priority]
              paramSpace = Math.floor(Math.abs(range[0] - range[1]) / Math.abs(range[2])) + 1
            } else {
              range = [fromEl.value, '', 0, defEl.value === '' ? fromEl.value : defEl.value, priority]
            }
          }
        } catch (err) {
          log.debug(`Reading the range of "${key}" failed:`, err)
          continue
        }
        rowParams.push({name: key, active: isActive, range})
        if (isActive)
          space = space == null ? paramSpace : space * paramSpace
      }
      document.getElementById('cyclesAll').innerHTML = String(space !== null ? space : 0)
      return rowParams
    }

    function prepareRow(name, param, status) {
      const isBoolean = typeof param[0] === 'boolean'
      const v = escapeHtml
      return `<td><input type="checkbox" ${status? 'checked' : ''} style="width:1em; background-color : #f1f1f1;" name="iondv-active-check-box"></td><td>${v(name)}</td>
              <td><input type="text" value="${isBoolean ? 'true' : v(param[0])}" style="width:4em; ${!isBoolean? 'background-color :#f1f1f1;':''}" ${isBoolean ? 'disabled' :''}></td>
              <td><input type="text" value="${isBoolean ? 'false' : v(param[1])}" style="width:4em; ${!isBoolean? 'background-color :#f1f1f1;':''}" ${isBoolean ? 'disabled' :''}></td>
              <td><input type="text" value="${v(param[2])}" style="width:4em; ${!isBoolean? 'background-color :#f1f1f1;':''}" ${isBoolean ? 'disabled' :''}></td>
              <td><input type="text" value="${v(param[3])}" style="width:4em; background-color : #f1f1f1;" ></td>
              <td><input type="number" value="${v(param[4])}" style="width:4em; background-color : #f1f1f1;"></td>`
    }

    function removeParamWindow() {
      const stratParamWindowEl = document.getElementById('iondvStratParam')
      if (stratParamWindowEl)
        stratParamWindowEl.parentNode.removeChild(stratParamWindowEl)
    }

    function getCycles() {
      const cyclesEl = document.getElementById('stratParamCycles')
      const value = cyclesEl ? parseInt(cyclesEl.value) : NaN
      return Number.isInteger(value) && value >= 0 ? value : 100 // 0 - no limit
    }

    function getTimeLimit() {
      const timeLimitEl = document.getElementById('stratParamTimeLimit')
      const value = timeLimitEl ? Number(String(timeLimitEl.value).replace(',', '.')) : 0
      return Number.isFinite(value) && value > 0 ? value : 0
    }

    async function save(btn) {
      const state = {params: readRows(), cycles: getCycles(), timeLimit: getTimeLimit()}
      await onSave(state)
      if (btn) {
        btn.textContent = 'Saved ✓'
        setTimeout(() => { btn.textContent = 'Save' }, 1500)
      }
      return state
    }

    try {
      removeParamWindow()
      const stratParamEl = document.createElement('div')
      stratParamEl.id = 'iondvStratParam'
      stratParamEl.setAttribute('style', ui.styleValWindowShadow)
      stratParamEl.style.height = document.documentElement.scrollHeight + 'px'
      const stratParamStyleEl = stratParamEl.appendChild(document.createElement('style'))
      stratParamStyleEl.innerHTML = ui.styleParamWindow
      const popupEl = stratParamEl.appendChild(document.createElement('div'))
      popupEl.setAttribute('style', ui.styleValParamWindow)
      popupEl.innerHTML = `<div style="height: 150px; overflow-y: hidden; vertical-align:top;">
  <h1 style="padding: 20px 25px 4px 25px">Strategy parameters</h1>
  <div style="padding: 0 25px 10px 25px; color: #555;">${escapeHtml(strategyTitle)}</div>
  <div style="align-content: center"><span style="padding:5px 15px">
  Cycles <input id="stratParamCycles" type="number" min="0" title="0 - no limit: the test runs until the whole space is tested or the Stop button is pressed" value="${Number.isInteger(cycles) && cycles >= 0 ? cycles : 10}" style="width:8em; background-color :#f1f1f1;">
  <a id="iondvCycleCopy" style="cursor: pointer;padding-right: 5px"><i class="iondv_icon iondv_copy"></i></a>
  from ~<span id="cyclesAll">100</span></span>
  <span style="padding:5px 15px 5px 0">Time limit <input id="stratParamTimeLimit" type="number" min="0" step="any" title="Minutes; 0 - no limit. The test stops at the limit reached first: cycles or time" value="${Number(timeLimit) > 0 ? Number(timeLimit) : 0}" style="width:5em; background-color :#f1f1f1;"> min</span>
  <button id="stratParamSave" class="iondv-button iondv-button-def">Save</button>
  <button id="stratParamSaveRun" class="iondv-button iondv-button-run">Save&Run</button>
  <button id="stratParamDefRun" class="iondv-button iondv-button-def">Skip&Run</button>
  <button id="stratParamCancel" class="iondv-button iondv-button-close">Cancel</button>
  </div>
  </div>
  <div style="height: 640px; overflow-y: auto; vertical-align:top;">
  <table class="stratParamTable">
   <thead><td style="width: 10%"><input type="checkbox" id="iondvCheckAll" style="width:1em;background-color :#f1f1f1;">Active</td><td style="width: 40%">Parameter</td><td>From</td><td>To</td><td>Step</td><td>Default</td><td>Priority</td></thead>
   <tbody id="stratParamData"></tbody>
  </table></div>`
      const tvDialog = document.getElementById('overlap-manager-root')
      if (tvDialog)
        document.body.insertBefore(stratParamEl, tvDialog) // For avoid problem if msg overlap tv dialog window
      else
        document.body.appendChild(stratParamEl)
      const tbody = document.getElementById('stratParamData')
      tbody.innerHTML = params.map(param =>
        `\n<tr data-param="${encodeURIComponent(param.name)}">${prepareRow(param.name, param.range, param.active)}</tr>`).join('')

      readRows()
      tbody.addEventListener('change', readRows)
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
          document.querySelectorAll('[name="iondv-active-check-box"]').forEach(el => el.checked = checkAllEl.checked)
          readRows()
        }
      }
      document.getElementById('stratParamCancel').onclick = () => {
        removeParamWindow()
        return resolve(null)
      }
      // Save: stores the window state in the optimization settings; the window stays open
      const btnSave = document.getElementById('stratParamSave')
      btnSave.onclick = async () => {
        try {
          await save(btnSave)
        } catch (err) {
          log.error('Saving the optimization settings failed:', err)
          btnSave.textContent = 'Save failed'
          setTimeout(() => { btnSave.textContent = 'Save' }, 2500)
        }
      }
      document.getElementById('stratParamSaveRun').onclick = async () => {
        try {
          const state = await save(null)
          removeParamWindow()
          return resolve({action: 'run', state})
        } catch (err) {
          log.error('Saving the optimization settings failed:', err)
          await ui.showErrorPopup(`The optimization settings were not saved: ${err.message}`)
        }
      }
      document.getElementById('stratParamDefRun').onclick = () => {
        const state = {params, cycles: getCycles(), timeLimit: getTimeLimit()}
        removeParamWindow()
        return resolve({action: 'skip', state})
      }
    } catch (err) {
      removeParamWindow()
      throw err
    }
  })
}
