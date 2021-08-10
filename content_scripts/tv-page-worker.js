/*
 @license Copyright 2021 akumidv (https://github.com/akumidv/)
 SPDX-License-Identifier: Apache-2.0
*/
'use strict';

(async function() {
  let isMsgShown = false
  const STORAGE_KEY_PREFIX = 'iondv'

  chrome.runtime.onMessage.addListener(
    async function(msg, sender, sendResponse) {
      console.log('Message recieved:', msg)
      if (!sender.tab && msg.hasOwnProperty('action') && msg.action === 'uploadSignals') {
        let fileUploadSig = document.createElement('input');
        fileUploadSig.type = 'file';
        fileUploadSig.multiple = 'multiple';
        fileUploadSig.addEventListener('change', async () => {
          let message = ''
          for(let file of fileUploadSig.files) {
            message += await parseTSSignalsAndGetMsg(file) + '\n'
          }
          message += `Please check if the ticker and timeframe are set like in the downloaded data and click on the parameters of the "iondvSignals" script to enter new data on the chart.`
          alert(message)
          isMsgShown = false
        });
        fileUploadSig.click();
      } else if (!sender.tab && msg.hasOwnProperty('action') && msg.action === 'clearAll') {
        const clearRes = await storageClearAll()
        alert(clearRes && clearRes.length ? `The data was deleted: ${clearRes.join(',')}` : 'There was no data in the storage')
      } else if (!sender.tab && msg.hasOwnProperty('action') && msg.action === 'uploadStrategyTestParameters') {
        let fileUploadStrParam = document.createElement('input');
        fileUploadSig.type = 'file';
        fileUploadStrParam.addEventListener('change', async () => {
          const file = fileUploadStrParam.files[0]
          let message = await parsStrategyParamsAndGetMsg(file) + '\n'
          message += `The data was saved in the storage. To use them for repeated testing, click on the "Test strategy" button in the extension pop-up window.`
          alert(message)
          isMsgShown = false
        });
        fileUploadStrParam.click();
      }
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
