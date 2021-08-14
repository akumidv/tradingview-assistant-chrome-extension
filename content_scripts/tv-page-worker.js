/*
 @license Copyright 2021 akumidv (https://github.com/akumidv/)
 SPDX-License-Identifier: Apache-2.0
*/

'use strict';

(async function() {

  let isMsgShown = false
  let workerStatus = null
  let tickerTextPrev = null
  let timeFrameTextPrev = null

  let strategy = {}

  const STORAGE_KEY_PREFIX = 'iondv'

  const SEL = {
    tvLegendIndicatorItem: 'div[data-name="legend"] div[class^="sourcesWrapper"] div[class^="sources"] div[data-name="legend-source-item"]',
    tvLegendIndicatorItemTitle: 'div[data-name="legend-source-title"]',
    tvDialogRoot: '#overlap-manager-root',
    indicatorTitle: '#overlap-manager-root div[data-name="indicator-properties-dialog"] div[class^="title"]',
    tabInput: 'div[data-name="indicator-properties-dialog"] div[data-value="inputs"]',
    tabInputActive: 'div[data-name="indicator-properties-dialog"] div[class*="active"][data-value="inputs"]',
    tabProperties: 'div[data-name="indicator-properties-dialog"] div[data-value="properties"]',
    ticker: '#header-toolbar-symbol-search > div[class*="text-"]',
    timeFrame: '#header-toolbar-intervals div[data-role^="button"][class*="isActive"]',
    indicatorScroll: 'div[data-name="indicator-properties-dialog"] div[class^="scrollable-"]',
    indicatorProperty: 'div[data-name="indicator-properties-dialog"] div[class^="content-"] div[class^="cell-"]',
    okBtn: 'div[data-name="indicator-properties-dialog"] div[class^="footer-"] button[name="submit"]'

  }

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
        case 'uploadStrategyTestParameters': // TODO
          await uploadFiles(parsStrategyParamsAndGetMsg, `The data was saved in the storage. To use them for repeated testing, click on the "Test strategy" button in the extension pop-up window.`, false)
          break;
        case 'getStrategyTemplate':
          const strategyData = await getStrategy()
          if(!strategyData || !strategyData.hasOwnProperty('name')) {
            alert('It was not possible to find a strategy among the indicators. Add it to the chart and try again.')
            break
          }
          const strategyRange = strategyToRange(strategyData)
          const strategyRangeTemplateCSV = strategyRangeToTemplate(strategyRange)
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
  function strategyRangeToTemplate(strategyData) {

  }
  function strategyRangeToTemplate(strategyData) {

  }
  async function getStrategy(strategyName) {
    strategy = {}
    const indicatorLegendsEl = document.querySelectorAll(SEL.tvLegendIndicatorItem)
    if(!indicatorLegendsEl)
      return null
    for(let indicatorItemEl of indicatorLegendsEl) {
      const indicatorTitleEl = indicatorItemEl.querySelector(SEL.tvLegendIndicatorItemTitle)
      if(!indicatorTitleEl)
        continue
      if(strategyName) {
       if(strategyName !== indicatorTitleEl.innerText)
         continue
      }
      mouseClick(indicatorTitleEl)
      mouseClick(indicatorTitleEl)
      await waitForTimeout(250)
      const dialogTitle = await waitForSelector(SEL.indicatorTitle, 5000, true)
      if(dialogTitle) {
        console.error(`Dialog window doesn't close`)
        break
      }
      if(strategy && strategy.hasOwnProperty('name'))
        break
    }
    return strategy
  }

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
          if(dt.getUTCDate() % tfValues !== 0) {
            dt.setUTCDate(dt.getUTCDate() - dt.getUTCDate() % tfValues)
          }
          dt.setUTCHours(0, 0, 0, 0)
          return dt
        })
      case 'h':
        return data.map(dt => {
          if(dt.getUTCHours() % tfValues !== 0)
            dt.setUTCHours(dt.getUTCHours() - dt.getUTCHours() % tfValues, 0, 0, 0)
          else
            dt.setUTCMinutes( 0, 0, 0)
          return dt
        })
      case 'm':
        return data.map(dt => {
          if(dt.getUTCMinutes() % tfValues !== 0)
            dt.setUTCMinutes( dt.getUTCMinutes() - dt.getUTCMinutes() % tfValues, 0, 0)
          else
            dt.setUTCSeconds( 0, 0)
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
            } else {
              console.error(`Timestamp ${row['timestamp']} ${typeof(row['timestamp'])} isn't valid`)
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
          const sellArr = shiftToTimeframe(tickersAndTFSignals[tktfName].tsSell,  tfVal, tfType)
          const sellConv = sellArr.map(dt => dt.getTime())
          await storageSetKeys(tktfName,  {buy: buyConv.filter((item, idx) => buyConv.indexOf(item) === idx).join(','),
                                                sell: sellConv.filter((item, idx) => sellConv.indexOf(item) === idx).join(','),
                                                loadData: (new Date()).toISOString()})
          console.log(`For ${tktfName} loaded ${buyConv.length + sellConv.length} timestamps`)
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
        resolve()
      })
    })
  }

  async function storageClearAll() {
    const allStorageKey = await storageGetKey(null)
    await storageRemoveKey(Object.keys(allStorageKey))
    return Object.keys(allStorageKey)
  }
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
  const waitForTimeout = async (timeout = 2500) => new Promise(resolve => setTimeout(resolve, timeout))
  async function waitForSelector(selector, timeout = 5000, isHide = false, parentEl) {
    parentEl = parentEl ? parentEl : document
    return new Promise(async (resolve) => {
      let iter = 0
      let elem
      const tikTime = 25
      do {
        await waitForTimeout(tikTime)
        elem = parentEl.querySelector(selector)
        iter += 1
      } while ( tikTime * iter < timeout && isHide ? !!elem : !elem)
      if(isHide ? elem : !elem ) {
        console.error(isHide ? `waitingForSelector: still present ${selector}` : `waitingForSelector: still absent ${selector}`)
      }
      resolve(elem)
    });
  }

  function getTextForSel(selector, elParent) {
    elParent = elParent ? elParent : document
    const element = elParent.querySelector(selector)
    return element ? element.innerText : null
  }

  const reactValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  const inputEvent = new Event('input', { bubbles: true});

  function setInputElementValue (element, value) {
    reactValueSetter.call(element, value)
    element.dispatchEvent(inputEvent);
  }

  async function tvDialogChangeTabToInput() {
    let isInputTabActive = document.querySelector(SEL.tabInputActive)
    if(isInputTabActive) return true
    document.querySelector(SEL.tabInput).click()
    isInputTabActive = await waitForSelector(SEL.tabInputActive, 2000)
    return isInputTabActive ? true : false
  }

  async function tvDialogHandler () {
    const indicatorTitle = getTextForSel(SEL.indicatorTitle)
    if(!document.querySelector(SEL.okBtn) || !document.querySelector(SEL.tabInput))
      return
    if(indicatorTitle === 'iondvSignals' && workerStatus === null) {
      let tickerText = document.querySelector(SEL.ticker).innerText
      let timeFrameText = document.querySelector(SEL.timeFrame).innerText
      if(!tickerText || !timeFrameText)
        return
      timeFrameText = timeFrameText.toLowerCase() === 'd' ? '1D' : timeFrameText
      if (isMsgShown && tickerText === tickerTextPrev && timeFrameText === timeFrameTextPrev)
        return
      tickerTextPrev = tickerText
      timeFrameTextPrev = timeFrameText

      if(await tvDialogChangeTabToInput()) {
        console.error(`Can't set parameters tab to input`)
        isMsgShown = true
        return
      }

      console.log("Tradingview indicator parameters window opened for ticker:", tickerText);
      const tsData = await storageGetKey(`${tickerText}::${timeFrameText}`.toLowerCase())
      if(tsData === null) {
        alert(`No data was loaded for the ${tickerText} and timeframe ${timeFrameText}.\n\n` +
          `Please change the ticker and timeframe to correct and reopen script parameter window.`)
        isMsgShown = true
        return
      }
      isMsgShown = false

      const indicProperties = document.querySelectorAll(SEL.indicatorProperty)

      const propVal = {
        TSBuy: tsData && tsData.hasOwnProperty('buy') ? tsData.buy : '',
        TSSell: tsData && tsData.hasOwnProperty('sell') ? tsData.sell : '',
        Ticker: tickerText,
        Timeframe: timeFrameText
      }
      const setResult = []
      const propKeys = Object.keys(propVal)
      for(let i = 0; i < indicProperties.length; i++) {
        const propText = indicProperties[i].innerText
        if(propKeys.includes(propText)) {
          setResult.push(propText)
          setInputElementValue(indicProperties[i + 1].querySelector('input'), propVal[propText])
          if(propKeys.length === setResult.length)
            break
        }
      }
      const notFoundParam = propKeys.filter(item => !setResult.includes(item))
      if(notFoundParam && notFoundParam.length) {
        alert(`One of the parameters named ${notFoundParam} was not found in the window. Check the script.\n`)
        isMsgShown = true
        return
      }
      document.querySelector(SEL.okBtn).click()
      const allSignals = [].concat(tsData.buy.split(','),tsData.sell.split(',')).sort()
      alert(`${allSignals.length} signals are set.\n  - date of the first signal: ${new Date(parseInt(allSignals[0]))}.\n  - date of the last signal: ${new Date(parseInt(allSignals[allSignals.length - 1]))}`)
      isMsgShown =  true
    }
    else if (workerStatus === 'getStrategyTemplate') {
      let isPropertiesTab = document.querySelector(SEL.tabProperties) // For strategy only
      if(isPropertiesTab) {
        strategy = {name: indicatorTitle, properties: {}}
        if(await tvDialogChangeTabToInput()) {
          const indicProperties = document.querySelectorAll(SEL.indicatorProperty)
          for(let i = 0; i < indicProperties.length; i++) {
            const propClassName = indicProperties[i].getAttribute('class')
            if(propClassName.includes('topCenter-')) {  // Two rows, also have first in class name
              i++ // Skip get the next cell because it content values
              continue // Doesn't realise to manage this kind of properties (two rows)
            } else if (propClassName.includes('first-')) {
              const propText = indicProperties[i].innerText
              i++
              if(indicProperties[i]) {
                if(indicProperties[i].querySelector('input')) {
                  let propValue = indicProperties[i].querySelector('input').value
                  if(indicProperties[i].querySelector('input').getAttribute('inputmode') === 'numeric') {
                    propValue = parseFloat(propValue) == parseInt(propValue) ? parseInt(propValue) : parseFloat(propValue)  // TODO how to get float from param or just  search point in string
                    if(!isNaN(propValue))
                      strategy.properties[propText] = propValue
                  } else {
                    strategy.properties[propText] = propValue // TODO get all other values from list
                  }

                } else if(indicProperties[i].querySelector('span[role="button"]')) {
                  strategy.properties[propText] = indicProperties[i].querySelector('span[role="button"]').innerText
                }
              }

            } else if (propClassName.includes('fill-')) {
              continue // Doesn't realise to manage this kind of properties (bool)
            }
          }
        } else {
          console.error(`Can't set parameters tab to input`)
        }
      }
      document.querySelector(SEL.okBtn).click()
    }
  }

  const dialogWindowNode = await waitForSelector(SEL.tvDialogRoot, 0)
  if(dialogWindowNode) {
    const tvObserver = new MutationObserver(tvDialogHandler);
    tvObserver.observe(dialogWindowNode, {
      childList: true,
      subtree: true,
      attributes: false,
      characterData: false
    });
    await tvDialogHandler() // First run
  }


})();
