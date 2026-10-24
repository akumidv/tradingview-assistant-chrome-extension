const file = {}

file.saveAs = (text, filename) => {
  let aData = document.createElement('a');
  aData.setAttribute('href', 'data:text/plain;charset=urf-8,' + encodeURIComponent(text));
  aData.setAttribute('download', filename);
  aData.click();
  if (aData.parentNode)
    aData.parentNode.removeChild(aData);
}

// handler(file) returns {text, isError}: any failed file turns the result popup into a warning
// onDone(hasError, message), when set, is called after all files instead of the result message
file.upload = async (handler, endOfMsg, isMultiple = false, onDone = null) => {
  let fileUploadEl = document.createElement('input');
  fileUploadEl.type = 'file';
  if(isMultiple)
    fileUploadEl.multiple = 'multiple';
  fileUploadEl.addEventListener('change', async () => {
    let message = isMultiple ? 'File upload results:\n' : 'File upload result:\n'
    let hasError = false
    for(let file of fileUploadEl.files) {
      try {
        const result = await handler(file)
        message += result.text
        hasError = hasError || result.isError
      } catch (err) {
        log.error(`Upload of file "${file.name}" failed:`, err)
        message += `  - ${file.name}: ${err && err.message ? err.message : err}\n`
        hasError = true
      }
    }
    message += endOfMsg ? '\n' + endOfMsg : ''
    if (onDone) {
      await onDone(hasError, message)
      ui.isMsgShown = false
      return
    }
    if (hasError)
      await ui.showWarningPopup(message)
    else
      await ui.showPopup(message)
    ui.isMsgShown = false
  });
  // Chrome opens a file chooser only during a user click on the page. A click in the extension pop-up is not
  // one, so the chooser silently did not open unless the page had been clicked a few seconds before.
  // Then the user is asked for one click on the page first.
  if (navigator.userActivation && !navigator.userActivation.isActive) {
    const isConfirmed = await ui.alertPopup(`Click OK to choose the file${isMultiple ? 's' : ''} to upload.`, null, true)
    if (isConfirmed === false)
      return
    if (isConfirmed !== true) { // another message of the extension is still open on the page
      ui.showToast('Close the open message of the extension and try again.', 3000)
      return
    }
  }
  fileUploadEl.click();
}


file.parseCSV = async (fileData) => {
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
        log.error(`CSV parsing of file "${CSV_FILENAME}" failed:`, err)
        return reject(`CSV parsing error: ${err.message}`)
      }
      return reject(`there is no data in the file`)
    })
    return reader.readAsText(fileData);
  });
}


file.uploadHandler = async (fileData) => {
  const propVal = {}
  let strategyName = null
  const csvData = await file.parseCSV(fileData)
  const headers = Object.keys(csvData[0])
  const missColumns = ['Name','Value'].filter(columnName => !headers.includes(columnName.toLowerCase()))
  if(missColumns && missColumns.length)
    return {text: `  - ${fileData.name}: There is no column(s) "${missColumns.join(', ')}" in CSV.\nPlease add all necessary columns to CSV like showed in the template.\n\nSet parameters canceled.\n`, isError: true}
  csvData.forEach(row => {
    if(row['name'] === '__indicatorName')
      strategyName = row['value']
    else
      propVal[row['name']] = row['value']
  })
  if(!strategyName)
    return {text: 'The indicator name (row "__indicatorName") is missing in the CSV file.', isError: true}
  const res = await tv.setStrategyParams(strategyName, propVal, false, true)
  const lastSetResult = tv.lastSetStrategyResult || {}
  const rejected = lastSetResult.legacy?.rejected || {}
  if (res && Object.keys(rejected).length) {
    return {text: 'TradingView did not accept these values (out of the input limits), the dialog keeps:\n' +
      Object.keys(rejected).map(key => `  - ${key}: ${rejected[key].wanted} -> ${rejected[key].actual}`).join('\n') + '\n', isError: true}
  }
  if (res) {
    return {text: 'All settings applied successfully.', isError: false}
  }
  return {text: `The name "${strategyName}" of the indicator from the file does not match the name in the open window`, isError: true}
}

// Parses a results CSV made by file.convertResultsToCSV ("Download results"): the column names keep their case,
// rows after the "Bellow filtered results of tests" line are the filtered ones
file.parseResultsFile = async (fileData) => {
  if (!fileData.name.toLowerCase().endsWith('.csv'))
    throw new Error('please upload a CSV file of the test results.')
  const text = await fileData.text()
  const lines = text.split(/\r\n|\r|\n/g).filter(line => line.trim())
  if (lines.length < 2)
    throw new Error('there are no results in the file.')
  const headers = parseCSVLine(lines[0]).map(item => String(item)).filter((item, idx, arr) => item !== '' || idx < arr.length - 1)
  const paramsNames = headers.filter(key => key.startsWith('__') && !key.startsWith('___')).map(key => key.slice(2))
  if (!paramsNames.length)
    throw new Error('there are no parameter columns ("__<parameter name>") in the file: it is not a results file.')
  const perfomanceSummary = []
  const filteredSummary = []
  let isFilteredPart = false
  for (const line of lines.slice(1)) {
    const values = parseCSVLine(line)
    if (values.some(value => typeof value === 'string' && value.startsWith('Bellow filtered results'))) {
      isFilteredPart = true
      continue
    }
    const row = {}
    headers.forEach((key, idx) => {
      if (key !== '' && idx < values.length && values[idx] !== '')
        row[key] = values[idx]
    })
    if (Object.keys(row).length)
      (isFilteredPart ? filteredSummary : perfomanceSummary).push(row)
  }
  // Files saved before the fix wrote false as 0: a parameter that has true in some rows is a boolean one
  const allRows = perfomanceSummary.concat(filteredSummary)
  paramsNames.forEach(name => {
    if (allRows.some(row => row[`__${name}`] === true))
      allRows.forEach(row => { if (row[`__${name}`] === 0) row[`__${name}`] = false })
  })
  // The file name is "<ticker>:<timeframe> <strategy> - <cycles>_<max|min>_<metric>_<method>.csv",
  // where the browser replaces ":" by "_"
  const nameMatch = fileData.name.replace(/\s*\(\d+\)(?=\.csv$)/i, '')
    .match(/^(\S+?)[_:](\S+)(?: deep backtesting)? (.+) - \d+_(max|min)_(.+)_[^_]+\.csv$/i)
  const shortName = nameMatch ? nameMatch[3].replaceAll('_', '/').replace(/\s+\/\s+/g, ' / ') : fileData.name.replace(/\.csv$/i, '')
  return {
    name: shortName,
    shortName: shortName,
    ticker: nameMatch ? nameMatch[1] : '',
    timeFrame: nameMatch ? nameMatch[2] : '',
    isMaximizing: nameMatch ? nameMatch[4].toLowerCase() === 'max' : true,
    optParamName: nameMatch ? nameMatch[5] : '',
    paramsNames,
    perfomanceSummary,
    filteredSummary
  }
}

function parseCSV2JSON(s, sep= ',') {
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


function parseCSVLine(text) {
  function replaceEscapedSymbols(textVal) {
    return textVal.replaceAll('\\"', '"')
  }

  return text.match( /\s*(".*?"|'.*?'|[^,]+|)\s*(,(?!\s*\\")|$)/g ).map(function (subText) { // \s*(\".*?\"|'.*?'|[^,]+|)\s*(,|$)
    let m;
    if (m = subText.match(/^\s*\"(.*?)\"\s*,?(?!\s*\\")$/))
      return replaceEscapedSymbols(m[1])//m[1] // Double Quoted Text // /^\s*\"(.*?)\"\s*,?$/
    if (m = subText.match(/^\s*'(.*?)'\s*,?$/))
      return replaceEscapedSymbols(m[1]); // Single Quoted Text
    if (m = subText.match(/^\s*(true|false)\s*,?$/i))
      return m[1].toLowerCase() === 'true'; // Boolean
    if (m = subText.match(/^\s*((?:\+|\-)?\d+)\s*,?$/))
      return parseInt(m[1]); // Integer Number
    if (m = subText.match(/^\s*((?:\+|\-)?\d*\.\d*)\s*,?$/))
      return parseFloat(m[1]); // Floating Number
    if (m = subText.match(/^\s*(.*?)\s*,?$/))
      return replaceEscapedSymbols(m[1]); // Unquoted Text
    return subText;
  } );
}



file.convertResultsToCSV = (testResults) => {
  function prepareValToCSV(value) {
    if (value === null || typeof value === 'undefined' || value === '')
      return ''
    if (typeof value === 'boolean')
      return String(value)
    if (!value)
      return 0
    if (typeof value !== 'number')
      return JSON.stringify(value)
    return parseFloat(value) === parseInt(value) ? parseInt(value) : parseFloat(value)
    // return (Math.round(value * 100)/100).toFixed(2)
  }

  if(!testResults || !testResults.perfomanceSummary || !testResults.perfomanceSummary.length)
    return 'There is no data for conversion'
  // A failed iteration may have left an empty (null) row: it has no values to export
  const isRow = row => row !== null && typeof row === 'object'
  testResults = {...testResults,
    perfomanceSummary: testResults.perfomanceSummary.filter(isRow),
    filteredSummary: (testResults.filteredSummary || []).filter(isRow)}
  if(!testResults.perfomanceSummary.length)
    return 'There is no data for conversion'
  let headers = Object.keys(testResults.perfomanceSummary[0]) // The first test table can be with error and can't have rows with previous values when parsedReport
  if(testResults.hasOwnProperty('paramsNames') && headers.length <= (Object.keys(testResults.paramsNames).length + 1)) { // Find the another header if only params names and 'comment' in headers
    const headersAll = testResults.perfomanceSummary.find(report => Object.keys(report).length > headers.length)
    if(headersAll)
      headers = Object.keys(headersAll)
  }

  let csv = headers.map(header => JSON.stringify(header)).join(',')
  csv += '\n'
  testResults.perfomanceSummary.forEach(row => {
    const rowData = headers.map(key => typeof row[key] === 'undefined' ? '' : prepareValToCSV(row[key]))
    csv += rowData.join(',').replaceAll('\\"', '""')
    csv += '\n'
  })
  if(testResults.filteredSummary && testResults.filteredSummary.length) {
    csv += headers.map(key => key !== 'comment' ? '' : 'Bellow filtered results of tests') // Empty line
    csv += '\n'
    testResults.filteredSummary.forEach(row => {
      const rowData = headers.map(key => typeof row[key] === 'undefined' ? '' : prepareValToCSV(row[key]))
      csv += rowData.join(',').replaceAll('\\"', '""')
      csv += '\n'
    })
  }
  return csv
}
