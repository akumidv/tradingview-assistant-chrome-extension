/*
 @license Copyright 2021 akumidv (https://github.com/akumidv/)
 SPDX-License-Identifier: Apache-2.0
*/

'use strict';

(async function() {
  let isMsgShown = false
  let workerStatus = null
  const STORAGE_KEY_PREFIX = 'iondv'

  async function uploadFiles (handler, endOfMsg, isMultiple = false) {
    let fileUploadEl = document.createElement('input');
    fileUploadEl.type = 'file';
    if(isMultiple)
      fileUploadEl.multiple = 'multiple';
    fileUploadEl.addEventListener('change', async () => {
      let message = ''
      for(let file of fileUploadEl.files) {
        message += await handler(file) + '\n'
      }
      message += endOfMsg
      alert(message)
      isMsgShown = false
    });
    fileUploadEl.click();
  }

  chrome.runtime.onMessage.addListener(
    async function(msg, sender, sendResponse) {
      if(sender.tab || !msg.hasOwnProperty('action')) {
        console.log('Not for action message received:', msg)
        return
      }
      if(workerStatus !== null) {
        console.log('Waiting for end previous work. Status:', workerStatus)
        return
      }

      workerStatus = msg.action

      switch (msg.action) {
        case 'uploadSignals':
          await uploadFiles(parseTSSignalsAndGetMsg, `Please check if the ticker and timeframe are set like in the downloaded data and click on the parameters of the "iondvSignals" script to enter new data on the chart.`, true)
          break;
        case 'uploadStrategyTestParameters':
          await uploadFiles(parsStrategyParamsAndGetMsg, `The data was saved in the storage. To use them for repeated testing, click on the "Test strategy" button in the extension pop-up window.`, false)
          break;
        case 'clearAll':
          const clearRes = await storageClearAll()
          alert(clearRes && clearRes.length ? `The data was deleted: ${clearRes.join(',')}` : 'There was no data in the storage')
          break
        default:
          console.log('None of realisation for signal:', msg)
      }
      workerStatus = null
    }
  );
  async function parseTSSignalsAndGetMsg (filename) { // TODO
    console.log('parseTSSignalsAndGetMsg filename', filename)
    return filename
  }
  async function parsStrategyParamsAndGetMsg (filename) { // TODO
    console.log('parsStrategyParamsAndGetMsg filename', filename)
    return filename
  }

  async function storageSetKeys(storageKey, value) {
    const storageData = {}
    storageData[`${STORAGE_KEY_PREFIX}_${storageKey}`] = value
    return new Promise (resolve => {
      chrome.storage.local.set(storageData, () => {
        resolve()
      })
    })
  }

  async function storageGetKey(storageKey) {
    const getParam = storageKey === null ? null : Array.isArray(storageKey) ? storageKey.map(item => `${STORAGE_KEY_PREFIX}_${item}`) : `${STORAGE_KEY_PREFIX}_${storageKey}`
    return new Promise (resolve => {
      chrome.storage.local.get(getParam, (getResults) => {
        if(storageKey === null) {
          const storageData = {}
          Object.keys(getResults).filter(key => key.startsWith(STORAGE_KEY_PREFIX)).forEach(key => storageData[key] = getResults[key])
          return resolve(storageData)
        } else if(!getResults.hasOwnProperty(`${STORAGE_KEY_PREFIX}_${storageKey}`)) {
          return resolve(null)
        }
        return resolve(getResults[`${STORAGE_KEY_PREFIX}_${storageKey}`])
      })
    })
  }

  async function storageRemoveKey(storageKey) {
    return new Promise (resolve => {
      chrome.storage.local.remove(storageKey, () => {
        console.log('Key removed', storageKey) // TODO 2del
        resolve()
      })
    })
  }

  async function storageClearAll() {
    const allStorageKey = await storageGetKey(null)
    await storageRemoveKey(Object.keys(allStorageKey))
    return Object.keys(allStorageKey)
  }

  const waitForTimeout = async (timeout = 2500) => new Promise(resolve => setTimeout(resolve, timeout))

  function mouseTrigger (el, eventType) {
    var clickEvent = document.createEvent ('MouseEvents');
    clickEvent.initEvent (eventType, true, true);
    el.dispatchEvent (clickEvent);
  }
  function mouseClick (el) {
    mouseTrigger (el, "mouseover");
    mouseTrigger (el, "mousedown");
    mouseTrigger (el, "mouseup");
    mouseTrigger (el, "click");
  }



  // Example click on react object
  // var element = document.querySelector('div[data-name="legend"] ')
  // // CLICK
  // mouseClick(element)
  //
  // // DOUBLE_CLICK
  // mouseClick(element)
  // mouseClick(element)
})();
