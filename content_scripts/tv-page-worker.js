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
    async function(request, sender, reply) {
      if(sender.tab || !request.hasOwnProperty('action') || !request.action) {
        console.log('Not for action message received:', request)
        return
      }
      if(workerStatus !== null) {
        console.log('Waiting for end previous work. Status:', workerStatus)
        return
      }

      workerStatus = request.action

      switch (request.action) {
        case 'uploadSignals':
          await uploadFiles(parseTSSignalsAndGetMsg, `Please check if the ticker and timeframe are set like in the downloaded data and click on the parameters of the "iondvSignals" script to automatically enter new data on the chart.`, true)
          break;
        case 'uploadStrategyTestParameters':
          await uploadFiles(parsStrategyParamsAndGetMsg, `The data was saved in the storage. To use them for repeated testing, click on the "Test strategy" button in the extension pop-up window.`, false)
          break;
        case 'clearAll':
          const clearRes = await storageClearAll()
          alert(clearRes && clearRes.length ? `The data was deleted: \n${clearRes.map(item => '- ' + item).join('\n')}` : 'There was no data in the storage')
          break
        default:
          console.log('None of realisation for signal:', request)
      }
      workerStatus = null
    }
  );

  function parseCSVLine(text) {
    return text.match( /\s*(\".*?\"|'.*?'|[^,]+)\s*(,|$)/g ).map(function (text) {
      let m;
      if (m = text.match(/^\s*\"(.*?)\"\s*,?$/)) return m[1]; // Double Quoted Text
      if (m = text.match(/^\s*'(.*?)'\s*,?$/)) return m[1]; // Single Quoted Text
      if (m = text.match(/^\s*(true|false)\s*,?$/)) return m[1] === "true"; // Boolean
      if (m = text.match(/^\s*((?:\+|\-)?\d+)\s*,?$/)) return parseInt(m[1]); // Integer Number
      if (m = text.match(/^\s*((?:\+|\-)?\d*\.\d*)\s*,?$/)) return parseFloat(m[1]); // Floating Number
      if (m = text.match(/^\s*(.*?)\s*,?$/)) return m[1]; // Unquoted Text
      return text;
    } );
  }

  function parseCSV2JSON(s, sep=',') {
    const csv = s.split(/\r\n|\r|\n/g).filter(item => item).map(line => parseCSVLine(line))
    if(!csv || csv.length <= 1) return []
    const headers = csv[0].map(item => item.toLowerCase())
    const JSONData = csv.slice(1).map((line) => {
      const lineObj = {}
      line.forEach((value, line_index) => lineObj[headers[line_index]] = value)
      return lineObj
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
      const CSV_FILENAME = fileData.name
      const isCSV = CSV_FILENAME.toLowerCase().endsWith('.csv')
      if(!isCSV) return reject(`please upload correct file.`)
      const reader = new FileReader();
      reader.addEventListener('load', async (event) => {
        if(!event.target.result) return reject(`there error when loading content from the file ${CSV_FILENAME}`)
        const CSV_VALUE = event.target.result
        try {
          const csvData = parseCSV2JSON(CSV_VALUE)
          if (csvData && csvData.length)
            return resolve(csvData)
        } catch (err) {
          console.error(err)
          return reject(`CSV parsing error: ${err.message}`)
        }
        return reject(`there is no data in the file`)
      })
      return reader.readAsText(fileData);
    });
  }

  function shiftToTimeframe(data, tfValues, tfType) {
    switch (tfType.toLowerCase()) {
      case 'd':
        return data.map(dt => {
          console.log('#d>',tfValues, dt.getUTCDate() % tfValues, dt)
          if(dt.getUTCDate() % tfValues !== 0) {
            dt.setUTCDate(dt.getUTCDate() - dt.getUTCDate() % tfValues)
          }
          dt.setUTCHours(0, 0, 0, 0)
          console.log('#d<',tfValues, dt.getUTCDate() % tfValues, dt)
          return dt
        })
      case 'h':
        return data.map(dt => {
          console.log('#h>',tfValues, dt.getUTCHours() % tfValues, dt)
          if(dt.getUTCHours() % tfValues !== 0)
            dt.setUTCHours(dt.getUTCHours() - dt.getUTCHours() % tfValues, 0, 0, 0)
          else
            dt.setUTCMinutes( 0, 0, 0)
          console.log('#h<',tfValues, dt.getUTCHours() % tfValues, dt)
          return dt
        })
      case 'm':
        return data.map(dt => {
          console.log('#m>',tfValues, dt.getUTCMinutes() % tfValues, dt)
          if(dt.getUTCMinutes() % tfValues !== 0)
            dt.setUTCMinutes( dt.getUTCMinutes() - dt.getUTCMinutes() % tfValues, 0, 0)
          else
            dt.setUTCSeconds( 0, 0)
          console.log('#m<',tfValues, dt.getUTCMinutes() % tfValues, dt)
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
        return `  - ${fileData.name}: There is no column(s) "${missColumns.join(', ')}" in CSV. Please add all necessary columns to CSV like showed in the template. Uploading canceled.\n`
      const tickersAndTFSignals = {}
      for(let row of csvData) { // Prepare timestamp arrays
        if(row['timestamp'] && row['signal'] && row['ticker'] && row['timeframe'] && row['timeframe'].length >= 2) {
          try {
            const [tfVal, tfType] = parseTF(row['timeframe'])
            if(!['h', 'm', 'd'].includes(tfType) || !(tfVal > 0))
              return `  - ${fileData.name}: only minute(m) and hour(h) timeframes are supported. There is a timeframe '${row['timeframe']}' in the file. Uploading canceled.\n`
            const tktfName = `${row['ticker']}::${tfVal}${tfType}`.toLowerCase()
            if(!tickersAndTFSignals.hasOwnProperty(tktfName))
              tickersAndTFSignals[tktfName] = {tsBuy: [], tsSell: []}
            const ts = new Date(row['timestamp'])
            if(!isNaN(ts.getTime())) {
              if(row['signal'].toLowerCase().includes('buy'))
                tickersAndTFSignals[tktfName].tsBuy.push(ts)
              else if (row['signal'].toLowerCase().includes('sell'))
                tickersAndTFSignals[tktfName].tsSell.push(ts)
              console.log(`Timestamp ${row['timestamp']}  ${ts}`)
            } else {
              console.log(`Timestamp ${row['timestamp']} ${typeof(row['timestamp'])} isn't valid`)
            }


          } catch (err) {
            console.error(err)
          }
        }
      }
      let msgArr = []
      for(let tktfName of Object.keys(tickersAndTFSignals)) {
        try {
          const tf = tktfName.split('::').pop()
          const [tfVal, tfType] = parseTF(tf)
          if(!tfVal || !tfType) continue
          const buyArr = shiftToTimeframe(tickersAndTFSignals[tktfName].tsBuy, tfVal, tfType)
          const buyConv = buyArr.map(dt => dt.getTime())
          console.log('buyConv', tf, buyConv)
          const sellArr = shiftToTimeframe(tickersAndTFSignals[tktfName].tsSell,  tfVal, tfType)
          const sellConv = sellArr.map(dt => dt.getTime())
          console.log('sellConv', tf, sellConv)
          await storageSetKeys(tktfName,  {buy: buyConv.filter((item, idx) => buyConv.indexOf(item) === idx).join(','),
                                                sell: sellConv.filter((item, idx) => sellConv.indexOf(item) === idx).join(','),
                                                loadData: (new Date()).toISOString()})
          console.log(tktfName, tfVal, tfType, `Timestamps:  ${buyConv.length + sellConv.length}`)
          msgArr.push(`${tktfName} (${buyConv.length + sellConv.length})`)
        } catch (err) {
          console.error(err)
        }
      }
      return `- ${fileData.name}. Timestamps saved for tickers: ${msgArr.join(', ')}. Data saved in storage.\n`
    } catch (err) {
      console.error(fileData.name)
      console.error(err)
      return `- ${fileData.name}: ${err.message}\n`
    }
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
