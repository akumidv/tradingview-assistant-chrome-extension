/*
 @license Copyright 2021 akumidv (https://github.com/akumidv/)
 SPDX-License-Identifier: Apache-2.0
*/
'use strict';
function sendSignalToActiveTab (signal) {
  chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
    chrome.tabs.sendMessage(tabs[0].id, {action: signal}
    //, function(response) {alert('Data deleted', response ? response.join(',') : ''); console.info(response);  window.close();}
    );
  });
}

document.addEventListener('DOMContentLoaded', () => {
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
});



