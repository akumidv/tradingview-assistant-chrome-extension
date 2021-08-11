/*
 @license Copyright 2021 akumidv (https://github.com/akumidv/)
 SPDX-License-Identifier: Apache-2.0
*/

'use strict';

(async function() {
  let isMsgShown = false
  let workerStatus = null
  const STORAGE_KEY_PREFIX = 'iondv'

  chrome.runtime.onMessage.addListener(
    async function(msg, sender, sendResponse) {
      if(sender.tab || !msg.hasOwnProperty('action') || !msg.action) {
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
          await uploadFiles(parseTSSignalsAndGetMsg, `Please check if the ticker and timeframe are set like in the downloaded data and click on the parameters of the "iondvSignals" script to automatically enter new data on the chart.`, true)
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

  function parseCSV2JSON(s, sep=',') {
    const newline = /\r\n|\r|\n/g;
    let a = s.split(newline);
    let csv = []
    for(let line of a){
      if(!line) continue
      let f = line.split(sep = sep || ",")
      for (let x = f.length - 1; x >= 0; x--) {
        if (f[x].replace(/"\s+$/, '"').charAt(f[x].length - 1) == '"') {
          const tl = f[x].replace(/^\s+"/, '"')
          if (tl.length > 1 && tl.charAt(0) == '"') {
            f[x] = f[x].replace(/^\s*"|"\s*$/g, '').replace(/""/g, '"');
          } else if (x) {
            f.splice(x - 1, 2, [f[x - 1], f[x]].join(sep));
          } else {
            f = f.shift().split(sep).concat(f);
          }
        } else {
          f[x].replace(/""/g, '"');
        }
      }
      csv.push(f);
    }
    const JSONData = []
    if(!csv || csv.length <= 1)
      return JSONData
    const headers = csv[0].map(item => item.toLowerCase())
    csv.slice(1).forEach((line) => {
      const lineObj = {}
      line.forEach((value, line_index) => lineObj[headers[line_index]] = value)
      JSONData.push(lineObj)
    })
    return JSONData;
  }

  async function uploadFiles (handler, endOfMsg, isMultiple = false) {
    let fileUploadEl = document.createElement('input');
    fileUploadEl.type = 'file';
    if(isMultiple)
      fileUploadEl.multiple = 'multiple';
    fileUploadEl.addEventListener('change', async () => {
      let message = isMultiple ? 'File upload results:\n' : 'File upload result:\n'
      for(let file of fileUploadEl.files) {
        message += await handler(file)
      }
      message += endOfMsg ? '\n' + endOfMsg : ''
      alert(message)
      isMsgShown = false
    });
    fileUploadEl.click();
  }

  async function parseCSVFile (fileData) {
    return new Promise((resolve, reject) => {
      const isCSV = fileData.name.toLowerCase().endsWith('.csv')
      console.log(fileData.name, isCSV)
      if(!isCSV)
        return reject(`please upload correct file.`)
      const CSV_FILENAME = fileData.name
      const reader = new FileReader();
      reader.addEventListener('load', async (event) => {
        if(!event.target.result)
          return reject(`there error when loading content from the file ${CSV_FILENAME}`)
        const CSV_VALUE = event.target.result
        try {
          const csvData = parseCSV2JSON(CSV_VALUE)
          if (csvData && csvData.length)
            return resolve(csvData)
        } catch (err) {
          console.error(err)
          return resolve(`CSV parsing error: ${err.message}`)
        }
        return reject(`there is no data in the file`)
      })
      return reader.readAsText(fileData);
    });
  }

  function convertToTimeframe(data, tfValues, tfType) {
    switch (tfType.toLowerCase()) {
      case 'h':
        return data.map(dt => {
          if(dt.getUTCHours() % tfValues !== 0) {
            const tfCoreсtion = dt.getUTCHours() - dt.getUTCHours() % tfValues
            dt.setUTCHours(tfCoreсtion, 0, 0, 0)
            return dt
          }
          return dt
        })
      case 'm':
        return data.map(dt => {
          if(dt.getUTCMinutes() % tfValues !== 0) {
            const tfCoreсtion = dt.getUTCMinutes() - dt.getUTCMinutes() % tfValues
            dt.setUTCMinutes(tfCoreсtion, 0, 0)
            return dt
          }
          return dt
        })
      default:
        return []
    }
  }

  function parseTF(tf) {
    if(tf.length < 2)
      return [null, null]
    const tfType = (tf[tf.length - 1]).toLowerCase()
    const tfVal = parseInt(tf.substring(0, tf.length - 1), 10)
    if(tfVal)
      return [tfVal, tfType]
    return [null, null]
  }

  async function parseTSSignalsAndGetMsg (fileData) {
    try {
      const csvData = await parseCSVFile(fileData)
      console.log(csvData)
      const headers = Object.keys(csvData[0])
      const missColumns = ['timestamp', 'ticker', 'timeframe', 'signal'].filter(columnName => !headers.includes(columnName))
      if(missColumns && missColumns.length)
        return `  - ${fileData.name}: There is no column(s) "${missColumns.join(', ')}" in CSV. Please add all necessary columns to CSV like showed in the template.\n`
      const tickersAndTFSignals = {}
      for(let row of csvData) {
        if(row['timestamp'] && row['signal'] && row['ticker'] &&
          row['timeframe'] && row['timeframe'].length >= 2) {
          try {
            const [tfVal, tfType] = parseTF(row['timeframe'])
            console.log(tfVal, tfType, !['h','m'].includes(tfType) || !(tfVal > 0))
            if(!['h','m'].includes(tfType) || !(tfVal > 0))
              return `  - ${fileData.name}: only minute(m) and hour(h) timeframes are supported. There is a timeframe '${row['timeframe']}' in the file.\n`
            const tktfName = `${row['ticker']}#${tfVal}${tfType}`.toLowerCase()
            if(!tickersAndTFSignals.hasOwnProperty(tktfName))
              tickersAndTFSignals[tktfName] = {tsBuy: [], tsSell: []}
            if(row['signal'].toLowerCase().includes('buy'))
              tickersAndTFSignals[tktfName].tsBuy.push(new Date(row['timestamp']))
            else if (row['signal'].toLowerCase().includes('sell'))
              tickersAndTFSignals[tktfName].tsSell.push(new Date(row['timestamp']))
          } catch {}
        }
      }
      let fileMessage = ``
      const allTickersAndTF = Object.keys(tickersAndTFSignals)
      // for(let tktfName of allTickersAndTF) { // TODO convert timeframes
      //   const tsBuyPrepared = convertToTimeframe(tickersAndTFSignals[tktfName].tsBuy, TIME_FRAME_VAL, TIME_FRAME_TYPE)
      //   const tsBuyConverted = tsBuyPrepared.map(dt => dt.getTime())
      //   let tsBuyFiltered =  tsBuyConverted.filter((item, idx) => tsBuyConverted.indexOf(item) == idx)
      //   const buyDoubletsNumber = tsBuyConverted.length - tsBuyFiltered.length
      //   const tsBuyLimited = tsBuyFiltered //tsBuyFiltered.length > 1500 ? tsBuyFiltered.slice(tsBuyFiltered.length - 1500) : tsBuyFiltered
      //   tsBuyStr = !tsBuyLimited ? '' : tsBuyLimited.join(',')
      //
      //   const tsSellPrepared = convertToTimeframe(tickersAndTFSignals[tktfName].tsSell, TIME_FRAME_VAL, TIME_FRAME_TYPE)
      //   const tsSellConverted = tsSellPrepared.map(dt => dt.getTime())
      //   let tsSellFiltered =  tsSellConverted.filter((item, idx) => tsSellConverted.indexOf(item) == idx)
      //   const sellDoubletsNumber = tsSellConverted.length - tsSellFiltered.length
      //   const tsSellLimited = tsSellFiltered //tsSellFiltered.length > 1500 ? tsSellFiltered.slice(tsSellFiltered.length - 1500) : tsSellFiltered
      //   tsSellStr = !tsSellLimited ? '' : tsSellLimited.join(',')
      //
      //   const tsData = {buy: tsBuyStr, sell: tsSellStr, loadData: (new Date()).toISOString()}
      //   await storageSetTickerTF(tktfName, tsData)
      //   console.log(tktfName, TIME_FRAME_VAL, TIME_FRAME_TYPE, `Timestamps:  ${tsBuyFiltered.length + tsSellFiltered.length} (prepared to ${tsBuyLimited.length + tsSellLimited.length}) uploaded out of ${sourceData.length}, param srt len ${tsBuyStr.length + tsSellStr.length}`)
      //   fileMessage += `  - for ticker ${tktfName}, there are ${tsBuyConverted.length + tsSellConverted.length} timestamps (prepared for uploading ${tsBuyLimited.length + tsSellLimited.length}). ` +
      //     `${sellDoubletsNumber === 0  && buyDoubletsNumber === 0 ? '' : 'Removed doublets ' + (buyDoubletsNumber + sellDoubletsNumber) + ' of signals in the same timeframe.'}\n`
      //   //   `${(tsBuyFiltered.length + tsSellFiltered.length) >= 1500 ? '    The number of timestamps exceeds the limit of 1500 pieces. Only the last 1500 timestamps will be shown.' : ''}\n`
      // }
      return `- ${fileMessage}Data saved in storage.\n`


    } catch (err) {
      console.error(fileData.name)
      console.error(err)
      return `- ${fileData.name}: ${err.message}\n`
    }
    console.log('parseTSSignalsAndGetMsg filename', fileData.name)
    return `- ${fileData.name}: data saved in storage\n`
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
