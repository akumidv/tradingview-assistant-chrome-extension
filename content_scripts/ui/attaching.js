uiAttaching = {}


uiAttaching.injectIndicator = () => {
    const strategyDefaultEl = document.querySelector(SEL.strategyDefaultElement)
    if (strategyDefaultEl) {
      _attachToIndicatorWindow()
    }
}

function _attachToIndicatorWindow () {
  const strategyDefaultEl = document.querySelector(SEL.strategyDefaultElement)
  if (!strategyDefaultEl)
    return
  _attachToIndicatorWindowImportExportElements(strategyDefaultEl)
}

function _attachToIndicatorWindowImportExportElements (strategyDefaultEl) {
  if (document.querySelector(SEL.strategyImportExport))
    return


  const importExportEl = document.createElement('div')
  importExportEl.id = SEL_CONST.importExportId
  const exportId = `${SEL_CONST.elPrefix}-Export`
  const importId = `${SEL_CONST.elPrefix}-Import`
  importExportEl.setAttribute('style', 'padding-left: 10px;padding-right: 10px')
  importExportEl.innerHTML = `<a id="${exportId}" style="cursor: pointer;padding-left: 5px;"><i class="iondv_icon iondv_download"></i></a>` +
    `<a id="${importId}" style="cursor: pointer;padding-right: 5px"><i class="iondv_icon iondv_upload"></i></a>`

  strategyDefaultEl.after(importExportEl)
  const importBtn = document.getElementById(importId)
  const exportBtn = document.getElementById(exportId)
  if (exportBtn) {
    exportBtn.onclick = async () => {
      await action.saveParameters() // TODO unattach ui from direct request action to signals
    }
  }
  if (importBtn) {
    importBtn.onclick = async () => {
      await action.loadParameters() // TODO unattach ui from direct request action to signals
    }
  }
}