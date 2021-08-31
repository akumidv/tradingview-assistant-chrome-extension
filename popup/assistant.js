/*
 @license Copyright 2021 akumidv (https://github.com/akumidv/)
 SPDX-License-Identifier: Apache-2.0
*/
'use strict';

 function getOptions(signal) {
    const iondvOptions = {signal}
    iondvOptions.isMaximizing = document.getElementById('optMinmax').checked
    iondvOptions.optParamName = document.getElementById('optParamName').value || 'Net Profit: All'
    iondvOptions.optMethod = document.getElementById('optMethod').value || 'random'
    iondvOptions.tabId = signal === 'uploadSignals' ? 1 : 2
    return iondvOptions
}

function saveOptions(signal) {
  const iondvOptions = getOptions(signal)
  chrome.storage.local.set({'iondvOptions': iondvOptions})
  console.log('Saved options', iondvOptions)
}

async function sendSignalToActiveTab (signal) {
  let iondvOptions = null
  if(signal !== 'clearAll') {
    iondvOptions = getOptions(signal)
    chrome.storage.local.set({'iondvOptions': iondvOptions})
  }

  chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
    if(!tabs[0].url.includes('tradingview.com')) {
      document.getElementById('msg-text').innerHTML = 'To work with the extension, activate it on the tab with the opened <a href="https://www.tradingview.com/chart" target="_blank">Tradingview chart</a>.'
      document.getElementById('shim').style.display= 'block'
      document.getElementById('msgbx').style.display = 'block'
      return
    }
    const message = {action: signal}
    if(iondvOptions)
      message.options = iondvOptions
    chrome.tabs.sendMessage(tabs[0].id, message
        //, function(response) {alert('Data deleted', response ? response.join(',') : ''); console.info(response);  window.close();}
      );
  });
}

document.addEventListener('DOMContentLoaded', () => {
  // chrome.storage.local.get('tabId', (getResults) => {
  chrome.storage.local.get('iondvOptions', (getResults) => {
    console.log('iondvOptions',getResults)
    if(getResults['iondvOptions']) {
      const iondvOptions = getResults['iondvOptions']
      console.log('iondvOptions',iondvOptions)
      const tabId = iondvOptions['tabId'] ? iondvOptions['tabId'] : 1
      const link = document.querySelector(`div.tabs__links > a${typeof tabId === 'number' && tabId > 0 && tabId < 3 ? ':nth-child('+tabId+')' : ''}`);
      if (link) // Activate saved or fist tab
        link.click();
      if(document.getElementById('optMinmax') && iondvOptions.hasOwnProperty('isMaximizing'))
        document.getElementById('optMinmax').checked = iondvOptions.isMaximizing
      if(document.getElementById('optParamName') && iondvOptions.hasOwnProperty('optParamName'))
        document.getElementById('optParamName').value = iondvOptions.optParamName
      if(document.getElementById('optMethod') && iondvOptions.hasOwnProperty('optMethod'))
        document.getElementById('optMethod').value = iondvOptions.optMethod
    }
  })
  document.getElementById('uploadSignals').addEventListener('click', () => {
    sendSignalToActiveTab('uploadSignals')
  });
  document.getElementById('testStrategy').addEventListener('click', function () {
    sendSignalToActiveTab('testStrategy')
  });
  document.getElementById('downloadStrategyTestResults').addEventListener('click', function () {
    sendSignalToActiveTab('downloadStrategyTestResults')
  });
  document.getElementById('getStrategyTemplate').addEventListener('click', function () {
    sendSignalToActiveTab('getStrategyTemplate')
  });
  document.getElementById('uploadStrategyTestParameters').addEventListener('click', function () {
    sendSignalToActiveTab('uploadStrategyTestParameters')
  });
  document.getElementById('clearAll').addEventListener('click', function () {
    sendSignalToActiveTab('clearAll')
  });
  document.getElementById('closeMsg').addEventListener('click', function () {
    document.getElementById('shim').style.display = 'none'
    document.getElementById('msgbx').style.display = 'none';
  });
  document.getElementById('optMinmax').addEventListener('click', () => {
    saveOptions('optMinmax')
  });
  document.getElementById('optParamName').addEventListener('change', () => {
    saveOptions('optParamName')
  });
  document.getElementById('optMethod').addEventListener('change', () => {
    saveOptions('optMethod')
  });
});



