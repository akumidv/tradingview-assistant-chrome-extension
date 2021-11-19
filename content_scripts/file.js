const file = {}

file.saveAs = (text, filename) => {
  let aData = document.createElement('a');
  aData.setAttribute('href', 'data:text/plain;charset=urf-8,' + encodeURIComponent(text));
  aData.setAttribute('download', filename);
  aData.click();
  if (aData.parentNode)
    aData.parentNode.removeChild(aData);
}

file.upload = async (handler, endOfMsg, isMultiple = false) => {
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
    ui.alertMessage(message)
    ui.isMsgShown = false
  });
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
        console.error(err)
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
    return `  - ${fileData.name}: There is no column(s) "${missColumns.join(', ')}" in CSV.\nPlease add all necessary columns to CSV like showed in the template.\n\nSet parameters canceled.\n`
  csvData.forEach(row => {
    if(row['name'] === '__indicatorName')
      strategyName = row['value']
    else
      propVal[row['name']] = row['value']
  })
  if(!strategyName)
    return 'The name for indicator in row with name ""__indicatorName"" is missed in CSV file'
  const res = await tv.setStrategyParams(strategyName, propVal, true)
  if(res) {
    return `Parameters are set`
  }
  return `The name "${strategyName}" of the indicator from the file does not match the name in the open window`
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
  return text.match( /\s*(\".*?\"|'.*?'|[^,]+|)\s*(,|$)/g ).map(function (text) {
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

file.convertResultsToCSV = (testResults) => {
  if(!testResults || !testResults.perfomanceSummary || !testResults.perfomanceSummary.length)
    return 'There is no data for conversion'
  let headers = Object.keys(testResults.perfomanceSummary[0]) // The first test table can be with error and can't have rows with previous values when parsedReport
  if(testResults.hasOwnProperty('paramsNames') && headers.length <= (Object.keys(testResults.paramsNames).length + 1)) { // Find the another header if only params names and 'comment' in headers
    const headersAll = testResults.perfomanceSummary.find(report => Object.keys(report).length > headers.length)
    if(headersAll)
      headers = Object.keys(headersAll)
  }

  let csv = headers.map(header => JSON.stringify(header)).join(',')
  csv += '\n'
  // testResults.paramsNames.forEach(paramName => csv.replace(`__${paramName}`, paramName)) // TODO isFirst? or leave it as it is
  testResults.perfomanceSummary.forEach(row => {
    const rowData = headers.map(key => typeof row[key] !== 'undefined' ? JSON.stringify(row[key]) : '')
    csv += rowData.join(',').replaceAll('\\"', '""')
    csv += '\n'
  })
  if(testResults.filteredSummary && testResults.filteredSummary.length) {
    csv += headers.map(key => key !== 'comment' ? '' : 'Bellow filtered results of tests') // Empty line
    csv += '\n'
    testResults.filteredSummary.forEach(row => {
      const rowData = headers.map(key => typeof row[key] !== 'undefined' ? JSON.stringify(row[key]) : '')
      csv += rowData.join(',').replaceAll('\\"', '""')
      csv += '\n'
    })
  }
  return csv
}