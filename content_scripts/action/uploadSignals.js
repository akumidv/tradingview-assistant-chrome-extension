actionSignal = {

}

actionSignal.dialogHandler = async () => {
  const indicatorTitle = page.getTextForSel(SEL.indicatorTitle)
  if(!document.querySelector(SEL.okBtn) || !document.querySelector(SEL.tabInput))
    return
  if(indicatorTitle === 'iondvSignals' && action.workerStatus === null) {
    let tickerText = document.querySelector(SEL.ticker).innerText
    let timeFrameEl = document.querySelector(SEL.timeFrameActive)
    if(!timeFrameEl)
      timeFrameEl = document.querySelector(SEL.timeFrame)


    let timeFrameText = timeFrameEl.innerText
    if(!tickerText || !timeFrameText)
      // ui.alertMessage('There is not timeframe element on page. Open correct page please')
      return

    timeFrameText = timeFrameText.toLowerCase() === 'd' ? '1D' : timeFrameText
    if (ui.isMsgShown && tickerText === tv.tickerTextPrev && timeFrameText === tv.timeFrameTextPrev)
      return
    tv.tickerTextPrev = tickerText
    tv.timeFrameTextPrev = timeFrameText

    if(!await tv.changeDialogTabToInput()) {
      console.error(`Can't set parameters tab to input`)
      ui.isMsgShown = true
      return
    }

    console.log("Tradingview indicator parameters window opened for ticker:", tickerText);
    const tsData = await storage.getKey(`${storage.SIGNALS_KEY_PREFIX}_${tickerText}::${timeFrameText}`.toLowerCase())
    if(tsData === null) {
      await ui.showErrorPopup(`No data was loaded for the ${tickerText} and timeframe ${timeFrameText}.\n\n` +
        `Please change the ticker and timeframe to correct and reopen script parameter window.`)
      ui.isMsgShown = true
      return
    }
    ui.isMsgShown = false

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
        page.setInputElementValue(indicProperties[i + 1].querySelector('input'), propVal[propText])
        if(propKeys.length === setResult.length)
          break
      }
    }
    const notFoundParam = propKeys.filter(item => !setResult.includes(item))
    if(notFoundParam && notFoundParam.length) {
      await ui.showErrorPopup(`One of the parameters named ${notFoundParam} was not found in the window. Check the script.\n`)
      ui.isMsgShown = true
      return
    }
    document.querySelector(SEL.okBtn).click()
    const allSignals = [].concat(tsData.buy.split(','),tsData.sell.split(',')).sort()
    await ui.showPopup(`${allSignals.length} signals are set.\n  - date of the first signal: ${new Date(parseInt(allSignals[0]))}.\n  - date of the last signal: ${new Date(parseInt(allSignals[allSignals.length - 1]))}`)
    ui.isMsgShown = true
  }
}

actionSignal.parseTSSignalsAndGetMsg = async (fileData) => {
  try {
    const csvData = await file.parseCSV(fileData)
    const headers = Object.keys(csvData[0])
    const missColumns = ['timestamp', 'ticker', 'timeframe', 'signal'].filter(columnName => !headers.includes(columnName))
    if(missColumns && missColumns.length)
      return `  - ${fileData.name}: There is no column(s) "${missColumns.join(', ')}" in CSV. Please add all necessary columns to CSV like showed in the template. Uploading canceled.\n`
    const tickersAndTFSignals = {}
    for(let row of csvData) { // Prepare timestamp arrays
      if(row['timestamp'] && row['actionSignal'] && row['ticker'] && row['timeframe'] && row['timeframe'].length >= 2) {
        try {
          const [tfVal, tfType] = _parseTF(row['timeframe'])
          if(!['h', 'm', 'd'].includes(tfType) || !(tfVal > 0))
            return `  - ${fileData.name}: only minute(m) and hour(h) timeframes are supported. There is a timeframe "${row['timeframe']}" in the file. Uploading canceled.\n`
          const tktfName = `${row['ticker']}::${tfVal}${tfType}`.toLowerCase()
          if(!tickersAndTFSignals.hasOwnProperty(tktfName))
            tickersAndTFSignals[tktfName] = {tsBuy: [], tsSell: []}
          const ts = new Date(row['timestamp'])
          if(!isNaN(ts.getTime())) {
            if(row['actionSignal'].toLowerCase().includes('buy'))
              tickersAndTFSignals[tktfName].tsBuy.push(ts)
            else if (row['actionSignal'].toLowerCase().includes('sell'))
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
        const [tfVal, tfType] = _parseTF(tf)
        if(!tfVal || !tfType) continue
        const buyArr = _shiftToTimeframe(tickersAndTFSignals[tktfName].tsBuy, tfVal, tfType)
        const buyConv = buyArr.map(dt => dt.getTime())
        const sellArr = _shiftToTimeframe(tickersAndTFSignals[tktfName].tsSell,  tfVal, tfType)
        const sellConv = sellArr.map(dt => dt.getTime())
        await storage.setKeys(`${storage.SIGNALS_KEY_PREFIX}_${tktfName}`,  {buy: buyConv.filter((item, idx) => buyConv.indexOf(item) === idx).join(','),
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


function _parseTF(tf) {
  if(tf.length < 2)
    return [null, null]
  const tfType = (tf[tf.length - 1]).toLowerCase()
  const tfVal = parseInt(tf.substring(0, tf.length - 1), 10)
  if(tfVal)
    return [tfVal, tfType]
  return [null, null]
}


function _shiftToTimeframe(data, tfValues, tfType) {
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