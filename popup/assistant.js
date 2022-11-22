/*
 @license Copyright 2021 akumidv (https://github.com/akumidv/)
 SPDX-License-Identifier: Apache-2.0
*/
'use strict';


document.addEventListener('DOMContentLoaded', () => {
  // chrome.storage.local.get('tabId', (getResults) => {
  checkIsTVChart()
  setPopupInputsByOptions()

  setClickEvents()

  setOptionsEvents()
});


function setOptionsEvents() {
  for(let elId of ['optMinmax', 'optParamName', 'optMethod', 'optFilterOff', 'optFilterMore', 'optFilterLess',
    'optFilterValue', 'optFilterParamName', 'randomDelay', 'shouldTestTF', 'shouldSkipInitBestResult']) {
    function saveOptListener() {
      saveOptions(elId)
    }
    document.getElementById(elId).addEventListener('click', saveOptListener)
  }
  for(let elId of ['deepStartDate', 'backtestDelay', 'dataLoadingTime', 'listOfTF']) {
    function saveOptListener() {
      saveOptions(elId)
    }
    document.getElementById(elId).addEventListener('blur', saveOptListener)
  }
}

function setClickEvents() {
  for(let elId of ['uploadSignals', 'testStrategy', 'deepTestStrategy', 'downloadStrategyTestResults', 'getStrategyTemplate', 'uploadStrategyTestParameters', 'clearAll', 'show3DChart']) {
    function signalListener() {
      sendSignalToActiveTab(elId)
    }
    if (document.getElementById(elId))
      document.getElementById(elId).addEventListener('click', signalListener);
    else
      console.error(`Can not find id ${elId}`)
  }
  document.getElementById('closeMsg').addEventListener('click', function () {
    document.getElementById('shim').style.display = 'none'
    document.getElementById('msgbx').style.display = 'none';
  });
}

function checkIsTVChart() {
  chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
    let message = null
    if(!tabs[0].url.includes('tradingview.com'))
      message = 'To work with the extension, activate it on the tab with the opened <a href="https://www.tradingview.com/chart" target="_blank">Tradingview chart</a>.'
    if(!tabs[0].url.includes('www.tradingview.com') && !tabs[0].url.includes('en.tradingview.com'))
      message = 'The extension works with the <a href="https://www.tradingview.com/chart" target="_blank">English version</a> of Tradingview.'
    if (message) {
      for(let elId of ['warningSignals', 'warningBacktest']) {
        if (document.getElementById(elId))
          document.getElementById(elId).innerHTML = message
      }
      const rootElement = document.querySelector(':root')
      if (rootElement) rootElement.style.setProperty('--warningVisible', 'block')
    }
  });
}


function setPopupInputsByOptions(getResults) {
  chrome.storage.local.get('iondvOptions', (getResults) => {
    console.log('iondvOptions', getResults)
    let tabId = 1
    if (getResults.hasOwnProperty('iondvOptions')) {
      const iondvOptions = getResults['iondvOptions']
      console.log('iondvOptions', iondvOptions)
      tabId = iondvOptions['tabId'] ? iondvOptions['tabId'] : 1
      if (document.getElementById('optMinmax') && iondvOptions.hasOwnProperty('isMaximizing'))
        document.getElementById('optMinmax').checked = iondvOptions.isMaximizing
      if (document.getElementById('optParamName') && iondvOptions.hasOwnProperty('optParamName'))
        document.getElementById('optParamName').value = iondvOptions.optParamName
      if (document.getElementById('optMethod') && iondvOptions.hasOwnProperty('optMethod'))
        document.getElementById('optMethod').value = iondvOptions.optMethod

      if (iondvOptions.hasOwnProperty('optFilterAscending') && document.getElementById('optFilterMore') &&
        document.getElementById('optFilterLess') && document.getElementById('optFilterOff')) {
        if (iondvOptions.optFilterAscending === true) {
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
      if (document.getElementById('optFilterValue') && iondvOptions.hasOwnProperty('optFilterValue'))
        document.getElementById('optFilterValue').value = iondvOptions.optFilterValue
      if (document.getElementById('optFilterParamName') && iondvOptions.hasOwnProperty('optFilterParamName'))
        document.getElementById('optFilterParamName').value = iondvOptions.optFilterParamName

      if(document.getElementById('deepStartDate') && iondvOptions.hasOwnProperty('deepStartDate'))
        document.getElementById('deepStartDate').value = iondvOptions.deepStartDate
      if(document.getElementById('dataLoadingTime') && iondvOptions.hasOwnProperty('dataLoadingTime')) {
        document.getElementById('dataLoadingTime').value = iondvOptions.dataLoadingTime !== null ? iondvOptions.dataLoadingTime : 30
      }
      if(document.getElementById('backtestDelay') && iondvOptions.hasOwnProperty('backtestDelay')) {
        if (iondvOptions.backtestDelay !== null)
          document.getElementById('backtestDelay').value = iondvOptions.backtestDelay
      }
      if(document.getElementById('randomDelay') && iondvOptions.hasOwnProperty('randomDelay')) {
        document.getElementById('randomDelay').checked = Boolean(iondvOptions.randomDelay)
      }
      if(document.getElementById('shouldTestTF') && iondvOptions.hasOwnProperty('shouldTestTF')) {
        document.getElementById('shouldTestTF').checked = Boolean(iondvOptions.shouldTestTF)
      }
      if(document.getElementById('shouldSkipInitBestResult') && iondvOptions.hasOwnProperty('shouldSkipInitBestResult')) {
        document.getElementById('shouldSkipInitBestResult').checked = Boolean(iondvOptions.shouldSkipInitBestResult)
      }
      if(document.getElementById('listOfTF') && iondvOptions.hasOwnProperty('listOfTF')) {
        if (iondvOptions.listOfTF !== null)
          document.getElementById('listOfTF').value = iondvOptions.listOfTF
      }
    }
    const link = document.querySelector(`div.tabs__links > a${typeof tabId === 'number' && tabId > 0 && tabId < 3 ? ':nth-child(' + tabId + ')' : ''}`);
    if (link) // Activate saved or fist tab
      link.click();
  })
}

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
  const deepStartDateEl = document.getElementById('deepStartDate')
  if (deepStartDateEl) {
    if (deepStartDateEl.value === '' || (deepStartDateEl.value && deepStartDateEl.value.match(/^20\d{2}-[0-1][0-9]-[0-3][0-9]/))) {
      deepStartDateEl.style.removeProperty('color')
      iondvOptions.deepStartDate = deepStartDateEl.value
    } else {
      deepStartDateEl.style.setProperty('color', 'red')
      iondvOptions.deepStartDate = null
    }
  }
  if(document.getElementById('dataLoadingTime')) {
    const dataLoadingTime =  document.getElementById('dataLoadingTime').value
    iondvOptions.dataLoadingTime = dataLoadingTime === '' ? null : isNaN(parseInt(dataLoadingTime)) ? 30 : Math.abs(parseInt(dataLoadingTime))
  }
  if(document.getElementById('backtestDelay')) {
    const delayValue =  document.getElementById('backtestDelay').value
    iondvOptions.backtestDelay = delayValue === '' ? null : isNaN(parseFloat(delayValue)) ? null : Math.abs(parseFloat(delayValue))
  }
  iondvOptions.randomDelay = document.getElementById('randomDelay').checked
  iondvOptions.shouldTestTF = document.getElementById('shouldTestTF').checked
  iondvOptions.shouldSkipInitBestResult = document.getElementById('shouldSkipInitBestResult').checked

  if(document.getElementById('listOfTF')) {
    const listOfTF =  document.getElementById('listOfTF').value
    iondvOptions.listOfTF = listOfTF === '' ? null : listOfTF
  }

  iondvOptions.tabId = (signal === 'uploadSignals') ? 3 : 1
  return iondvOptions
}

function saveOptions(signal) {
  const iondvOptions = getOptions(signal)
  chrome.storage.local.set({'iondvOptions': iondvOptions})
  console.log('Saved options', iondvOptions)
}

function sendSignalToActiveTab (signal) {
  let iondvOptions = null
  if(signal !== 'clearAll') {
    iondvOptions = getOptions(signal)
    chrome.storage.local.set({'iondvOptions': iondvOptions})
  }

  chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
    if(!tabs[0].url.includes('tradingview.com')) {
      document.getElementById('msg-text').innerHTML = 'To work with the extension, activate it on the tab with the opened <a href="https://www.tradingview.com/chart" target="_blank">Tradingview chart</a>.'
      document.getElementById('shim').style.display = 'block'
      document.getElementById('msgbx').style.display = 'block'
      return
    }
    const message = {action: signal}
    if(iondvOptions)
      message.options = iondvOptions
    chrome.tabs.sendMessage(tabs[0].id, message, function() {window.close()});
  });
}