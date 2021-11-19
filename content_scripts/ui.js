const ui = {
  isMsgShown: false
}

const scriptFonts = document.createElement('style');
scriptFonts.innerHTML = '@font-face {' +
  '    font-family: "Font Awesome 5 Free";' +
  '    font-style: normal;\n' +
  '    font-weight: 900;' +
  '    font-display: block;' +
  `    src: url(${chrome.runtime.getURL("fonts/fa-solid-900.woff2")}) format('woff2');` +
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
  '  }'

document.documentElement.appendChild(scriptFonts);

ui.checkInjectedElements = () => {
  if (action && !action.workerStatus) { // If do not running process
    const strategyDefaultEl = document.querySelector(SEL.strategyDefaultElement)
    if (!strategyDefaultEl)
      return
    if (document.querySelector(SEL.strategyImportExport))
      return
    const importExportEl = document.createElement('div')
    importExportEl.id = 'iondvImportExport'
    importExportEl.setAttribute('style', 'padding-left: 10px;padding-right: 10px')
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

ui.alertMessage = (message) => {
  alert(message)
}