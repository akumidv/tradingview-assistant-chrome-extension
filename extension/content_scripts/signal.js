signal = {

}

signal.parseTSSignalsAndGetMsg = async (fileData) => {
  try {
    const csvData = await file.parseCSV(fileData)
    const headers = Object.keys(csvData[0])
    const missColumns = ['timestamp', 'ticker', 'timeframe', 'signal'].filter(columnName => !headers.includes(columnName))
    if(missColumns && missColumns.length)
      return {text: `  - ${fileData.name}: There is no column(s) "${missColumns.join(', ')}" in CSV. Please add all necessary columns to CSV like showed in the template. Uploading canceled.\n`, isError: true}
    const tickersAndTFSignals = {}
    let invalidTimestampCount = 0
    let invalidTimestampExample = null
    for(let row of csvData) { // Prepare timestamp arrays
      if(row['timestamp'] && row['signal'] && row['ticker'] && row['timeframe'] && row['timeframe'].length >= 2) {
        try {
          const [tfVal, tfType] = parseTF(row['timeframe'])
          if(!['h', 'm', 'd'].includes(tfType) || !(tfVal > 0))
            return {text: `  - ${fileData.name}: only minute(m) and hour(h) timeframes are supported. There is a timeframe "${row['timeframe']}" in the file. Uploading canceled.\n`, isError: true}
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
            invalidTimestampCount += 1
            if (invalidTimestampExample === null)
              invalidTimestampExample = row['timestamp']
          }
        } catch (err) {
          log.error(`Signal file "${fileData.name}": row parse failed:`, row, err)
        }
      }
    }
    if (invalidTimestampCount)
      log.warn(`Signal file "${fileData.name}": ${invalidTimestampCount} row(s) with an invalid timestamp skipped, e.g.`, invalidTimestampExample)
    let msgArr = []
    let failedArr = []
    for(let tktfName of Object.keys(tickersAndTFSignals)) {
      try {
        const tf = tktfName.split('::').pop()
        const [tfVal, tfType] = parseTF(tf)
        if(!tfVal || !tfType) continue
        const buyArr = shiftToTimeframe(tickersAndTFSignals[tktfName].tsBuy, tfVal, tfType)
        const buyConv = buyArr.map(dt => dt.getTime())
        const sellArr = shiftToTimeframe(tickersAndTFSignals[tktfName].tsSell,  tfVal, tfType)
        const sellConv = sellArr.map(dt => dt.getTime())
        await storage.setKeys(`${storage.SIGNALS_KEY_PREFIX}_${tktfName}`,  {buy: buyConv.filter((item, idx) => buyConv.indexOf(item) === idx).join(','),
          sell: sellConv.filter((item, idx) => sellConv.indexOf(item) === idx).join(','),
          loadData: (new Date()).toISOString()})
        log.info(`For ${tktfName} loaded ${buyConv.length + sellConv.length} timestamps`)
        msgArr.push(`${tktfName} (${buyConv.length + sellConv.length})`)
      } catch (err) {
        log.error(`Signal file "${fileData.name}": saving signals for "${tktfName}" failed:`, err)
        failedArr.push(tktfName)
      }
    }
    const failedText = failedArr.length ? ` Saving failed for: ${failedArr.join(', ')}.` : ''
    return {text: `- ${fileData.name}. Timestamps saved for tickers: ${msgArr.join(', ')}. Data saved in storage.${failedText}\n`, isError: failedArr.length > 0}
  } catch (err) {
    log.error(`Signal file "${fileData.name}" parse failed:`, err)
    return {text: `- ${fileData.name}: ${err && err.message ? err.message : err}\n`, isError: true}
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