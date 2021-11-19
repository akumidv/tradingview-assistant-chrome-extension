signal = {

}

signal.parseTSSignalsAndGetMsg = async (fileData) => {
  try {
    const csvData = await file.parseCSV(fileData)
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
            return `  - ${fileData.name}: only minute(m) and hour(h) timeframes are supported. There is a timeframe "${row['timeframe']}" in the file. Uploading canceled.\n`
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