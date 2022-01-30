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


async function alertPopup(msgText, isError = null, isConfirm = false) {
  return new Promise(resolve => {
    function removeAlertPopup() {
      const iondvAlertPopupEl = document.getElementById('iondvAlertPopup')
      if (iondvAlertPopupEl)
        iondvAlertPopupEl.parentNode.removeChild(iondvAlertPopupEl)
      return resolve(true)
    }

    function cancelAlertPopup() {
      const iondvAlertPopupEl = document.getElementById('iondvAlertPopup')
      if (iondvAlertPopupEl)
        iondvAlertPopupEl.parentNode.removeChild(iondvAlertPopupEl)
      return resolve(false)
    }

    if(document.getElementById('iondvAlertPopup'))
      return resolve()

    const mObj = document.getElementsByTagName('body')[0].appendChild(document.createElement("div"));
    mObj.id = "iondvAlertPopup";
    mObj.setAttribute("style","background-color:rgba(0, 0, 0, 0.4);" +
      "position:absolute;" +
      "width:100%;" +
      "height:100%;" +
      "top:0px;" +
      "left:0px;" +
      "z-index:10000;");
    mObj.style.height = document.documentElement.scrollHeight + "px";
    const warnIcon = '<svg xmlns="http://www.w3.org/2000/svg"  width="40px" height="40px" viewBox="0 0 40 40" stroke-width="3" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"></path><circle cx="20" cy="20" r="18"></circle><line x1="20" y1="12" x2="20" y2="22"></line><line x1="20" y1="27" x2="20" y2="28"></line></svg>'
    const errorIcon = '<svg xmlns="http://www.w3.org/2000/svg" width="40px" height="40px" viewBox="0 0 40 40" stroke-width="3" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"></path><rect x="4" y="4" width="34" height="34" rx="2"></rect><path d="M14 14l14 14m0 -14l-14 14"></path></svg>'
    const okIcon = '<svg xmlns="http://www.w3.org/2000/svg" width="40px" height="40px" viewBox="0 0 40 40" stroke-width="3" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h40v40H0z" fill="none"></path><path d="M5 20l12 12l22 -20"></path></svg>'
    const icon = isError === null ? okIcon : isError ? errorIcon : warnIcon
    const headerText = isError === null ? 'Information' : isError ? 'Error' : 'Warning'
    const bgColorClass = isError === null ? 'iondvpopup-green' : isError ? 'iondvpopup-red' : 'iondvpopup-orange'
    const headerBgColor = isError === null ? '#80ffad' : isError ? '#ff9286' : '#fdc987'
    mObj.innerHTML = `<style>
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
    background-color: ${headerBgColor};
  }
  .iondvpopup-body {
    display: table-cell;
    vertical-align: middle;
    padding: 20px 20px 20px 10px;
  }
  .iondvpopup-body > p {
      line-height: 1.2;
      margin-top: 6px;
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
</style>
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
    if(btnOk) {
      btnOk.focus()
      btnOk.onclick = removeAlertPopup
    }
    const btnCancel = document.getElementById('iondvPopupCancelBtn')
    if(btnCancel) {
      btnCancel.onclick = cancelAlertPopup
    }
  })
}


ui.showPopup = async (msgText) => {
  return await alertPopup(msgText, null)
}

ui.showErrorPopup = async (msgText) => {
  return await alertPopup(msgText, true)
}

ui.showWarningPopup = async (msgText) => {
  return await alertPopup(msgText, false)
}

ui.statusMessageRemove = () => {
  const statusMessageEl = document.getElementById('iondvStatus')
  if(statusMessageEl)
    statusMessageEl.parentNode.removeChild(statusMessageEl)
}

ui.autoCloseAlert = (msg, duration = 2000) => {
  console.log('autoCloseAlert')
  const altEl = document.createElement("div");
  altEl.setAttribute("style","background-color: #ffeaa7;color:black; width: 450px;height: 300px;position: absolute;top:0;bottom:0;left:0;right:0;margin:auto;border: 1px solid black;font-family:arial;font-size:25px;font-weight:bold;display: flex; align-items: center; justify-content: center; text-align: center;");
  altEl.setAttribute("id","iondvAlert");
  altEl.innerHTML = msg;
  setTimeout(function() {
    altEl.parentNode.removeChild(altEl);
  }, duration);
  document.body.appendChild(altEl);
}

ui.statusMessage = (msgText, extraHeader = null) => {
  const isStatusPresent = document.getElementById('iondvStatus')
  const mObj = isStatusPresent ? document.getElementById('iondvStatus') : document.createElement("div");
  let msgEl
  if(!isStatusPresent) {
    mObj.id = "iondvStatus";
    mObj.setAttribute("style","background-color:rgba(0, 0, 0, 0.2);" +
      "position:absolute;" +
      "width:100%;" +
      "height:100%;" +
      "top:0px;" +
      "left:0px;" +
      "z-index:10000;");
    mObj.style.height = document.documentElement.scrollHeight + "px";
    const msgStyleEl = mObj.appendChild(document.createElement("style"));
    msgStyleEl.innerHTML = ".button {\n" +
      "                background-color: white;\n" +
      "                border: none;\n" +
      "                color: white;\n" +
      "                padding: 10px 2px;\n" +
      "                text-align: center;\n" +
      "                text-decoration: none;\n" +
      "                font-size: 14px;\n" +
      "                margin-top:-10px;\n" +
      "                margin-right:-0px;\n" +
      "                -webkit-transition-duration: 0.4s; /* Safari */\n" +
      "                transition-duration: 0.4s;\n" +
      "                cursor: pointer;\n" +
      "                width: 50px;\n" +
      "                float:right;\n" +
      "                border-radius: 3px;\n" +
      "                display: inline-block;\n" +
      "                line-height: 0;\n" +
      "            }\n" +
      "            .button-close:hover {\n" +
      "                background-color: gray;\n" +
      "                color: white;\n" +
      "            }\n" +
      "            .button-close {\n" +
      "                background-color: white;\n" +
      "                color: black;\n" +
      "                border: 2px solid gray;\n" +
      "            }"
    msgEl = mObj.appendChild(document.createElement("div"));
    msgEl.setAttribute("style","background-color: #fffde0;" +
      "color: black;" +
      "width: 800px;" +
      "height: 175px;" +
      "position: fixed;" +
      "top: 50px;" +
      "right: 0;" +
      "left: 0;" +
      "margin: auto;" +
      "border: 1px solid lightblue;" +
      "box-shadow: 3px 3px 7px #777;" +
      // "display: flex;" +
      "align-items: center; " +
      "justify-content: left; " +
      "text-align: left;");
  } else {
    msgEl = mObj.querySelector('div')
  }
  if(isStatusPresent && msgEl && document.getElementById('iondvMsg') && !extraHeader) {
    document.getElementById('iondvMsg').innerHTML = msgText
  } else {
    extraHeader = extraHeader !== null ? `<div style="font-size: 12px;margin-left: 5px;margin-right: 5px;text-align: left;">${extraHeader}</div>` : '' //;margin-bottom: 10px
    msgEl.innerHTML = '<button class="button button-close" id="iondvBoxClose">stop</button>' +
      '<div style="color: blue;font-size: 26px;margin: 5px 5px;text-align: center;">Attention!</div>' +
      '<div style="font-size: 18px;margin-left: 5px;margin-right: 5px;text-align: center;">The page elements are controlled by the browser extension. Please do not click on the page elements. You can reload the page to stop it.</div>' +
      extraHeader +
      '<div id="iondvMsg" style="margin: 5px 10px">' +
      msgText + '</div>';
  }
  if(!isStatusPresent) {
    const tvDialog = document.getElementById('overlap-manager-root')
    if(tvDialog)
      document.body.insertBefore(mObj, tvDialog) // For avoid problem if msg overlap tv dialog window
    else
      document.body.appendChild(mObj);
  }
  const btnClose = document.getElementById('iondvBoxClose')
  if(btnClose) {
    btnClose.onclick = () => {
      console.log('Stop clicked')
      action.workerStatus = null
    }
  }
}