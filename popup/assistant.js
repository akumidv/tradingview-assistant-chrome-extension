/*
 @license Copyright 2021 akumidv (https://github.com/akumidv/)
 SPDX-License-Identifier: Apache-2.0
*/
'use strict';

function getOptions(signal) {
    const iondvOptions = {}
    iondvOptions.isMaximizing = document.getElementById('optMinmax').checked
    iondvOptions.optParamName = document.getElementById('optParamName').value || 'Net Profit: All'
    iondvOptions.optMethod = document.getElementById('optMethod').value || 'random'

    iondvOptions.isMaximizing = document.getElementById('optMinmax').checked
    iondvOptions.optParamName = document.getElementById('optParamName').value || 'Net Profit: All'
    iondvOptions.optMethod = document.getElementById('optMethod').value || 'random'

    iondvOptions.optFilterAscending  = document.getElementById('optFilterMore').checked ? true : document.getElementById('optFilterLess').checked ? false : null
    iondvOptions.optFilterValue = document.getElementById('optFilterValue').value || '50'
    iondvOptions.optFilterParamName = document.getElementById('optFilterParamName').value || 'Total Closed Trades: All'

    iondvOptions.tabId = (signal === 'uploadSignals') ? 1 : 2
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
    let tabId = 1
    if(getResults['iondvOptions']) {
      const iondvOptions = getResults['iondvOptions']
      console.log('iondvOptions',iondvOptions)
      tabId = iondvOptions['tabId'] ? iondvOptions['tabId'] : 1
      if(document.getElementById('optMinmax') && iondvOptions.hasOwnProperty('isMaximizing'))
        document.getElementById('optMinmax').checked = iondvOptions.isMaximizing
      if(document.getElementById('optParamName') && iondvOptions.hasOwnProperty('optParamName'))
        document.getElementById('optParamName').value = iondvOptions.optParamName
      if(document.getElementById('optMethod') && iondvOptions.hasOwnProperty('optMethod'))
        document.getElementById('optMethod').value = iondvOptions.optMethod

      if(iondvOptions.hasOwnProperty('optFilterAscending') && document.getElementById('optFilterMore') &&
        document.getElementById('optFilterLess') && document.getElementById('optFilterOff')) {
        if(iondvOptions.optFilterAscending === true) {
          document.getElementById('optFilterOff').checked = false
          document.getElementById('optFilterMore').checked = true
          document.getElementById('optFilterLess').checked = false
        } else if (iondvOptions.optFilterAscending === false) {
          document.getElementById('optFilterOff').checked = false
          document.getElementById('optFilterMore').checked = false
          document.getElementById('optFilterLess').checked = true
        } else {
          document.getElementById('optFilterOff').checked = true
          document.getElementById('optFilterMore').checked = false
          document.getElementById('optFilterLess').checked = false
        }
      }
      if(document.getElementById('optFilterValue') && iondvOptions.hasOwnProperty('optFilterValue'))
        document.getElementById('optFilterValue').value = iondvOptions.optFilterValue
      if(document.getElementById('optFilterParamName') && iondvOptions.hasOwnProperty('optFilterParamName'))
        document.getElementById('optFilterParamName').value = iondvOptions.optFilterParamName
    }
    const link = document.querySelector(`div.tabs__links > a${typeof tabId === 'number' && tabId > 0 && tabId < 3 ? ':nth-child('+tabId+')' : ''}`);
    if (link) // Activate saved or fist tab
      link.click();
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
  document.getElementById('optFilterOff').addEventListener('change', () => {
    saveOptions('optFilterOff')
  });
  document.getElementById('optFilterMore').addEventListener('change', () => {
    saveOptions('optFilterMore')
  });
  document.getElementById('optFilterLess').addEventListener('change', () => {
    saveOptions('optFilterLess')
  });
  document.getElementById('optFilterValue').addEventListener('change', () => {
    saveOptions('optFilterValue')
  });
  document.getElementById('optFilterParamName').addEventListener('change', () => {
    saveOptions('optFilterParamName')
  });

});



