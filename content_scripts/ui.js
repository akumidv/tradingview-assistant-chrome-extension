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