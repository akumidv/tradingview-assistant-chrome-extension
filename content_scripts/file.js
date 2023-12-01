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
  const fileUploadEl = document.createElement('input');
  fileUploadEl.type = 'file';
  if (isMultiple)
    fileUploadEl.multiple = isMultiple;
  fileUploadEl.addEventListener('change', async () => {
    let message = isMultiple ? 'File upload results:\n' : 'File upload result:\n'

    for (let file of fileUploadEl.files) {
      const msgRes = await handler(file)
      message += msgRes
    }
    message += endOfMsg ? '\n' + endOfMsg : ''
    await ui.showPopup(message)
    ui.isMsgShown = false
  });
  fileUploadEl.click();
}


file.uploadCSV = async (endOfMsg, isMultiple = false) => {
  let fileUploadEl = document.createElement('input');
  fileUploadEl.type = 'file';
  if (isMultiple)
    fileUploadEl.multiple = isMultiple;
  fileUploadEl.addEventListener('change', async () => {
    let message = isMultiple ? 'File upload results:\n' : 'File upload result:\n'

    for (let file of fileUploadEl.files) {
      message += await handler(file)
    }
    message += endOfMsg ? '\n' + endOfMsg : ''
    await ui.showPopup(message)
    ui.isMsgShown = false
  });
  fileUploadEl.click();
}


file.parseCSV = async (fileData) => {

  // Change to https://github.com/onyxfish/csvkit.js/blob/master/lib/csvkit.js toClass
  // Examples https://github.com/onyxfish/csvkit.js/blob/master/test/object_reader.js
  // https://github.com/onyxfish/csvkit.js/blob/master/test/object_writer.js
  return new Promise((resolve, reject) => {
    const csvFilename = fileData.name
    const isCSV = csvFilename.toLowerCase().endsWith('.csv')
    if (!isCSV) return reject(`please upload correct file.`)
    const reader = new FileReader();
    reader.addEventListener('load', async (event) => {
      if (!event.target.result) return reject(`there error when loading content from the file ${csvFilename}`)
      const csvValue = event.target.result
      try {
        const csvData = _parseCSV2JSON(csvValue)
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


function _parseCSV2JSON(s, sep = ',') {
  const csv = s.split(/\r\n|\r|\n/g).filter(item => item).map(line => _parseCSVLine(line))
  if (!csv || csv.length <= 1) return []
  const headers = csv[0].map(item => item.toLowerCase())
  const JSONData = csv.slice(1).map((line) => {
    const lineObj = {}
    line.forEach((value, line_index) => lineObj[headers[line_index]] = value)
    return lineObj
  })
  return JSONData;
}


function _parseCSVLine(text) {

  function replaceEscapedSymbols(textVal) {
    console.log('  >:', typeof (textVal), textVal, textVal.hasOwnProperty('replaceAll'))
    if(typeof textVal === 'string')
      return textVal.replaceAll('\\"', '"')
    return textVal
  }

  // return text.match(/\s*(".*?"|'.*?'|[^,]+|)\s*(,(?!\s*\\")|$)/g).map(function (subText) { // \s*(\".*?\"|'.*?'|[^,]+|)\s*(,|$) // \s*(\".*?\"|'.*?'|[^,]+|)\s*(,|$)
  // const cellSpitRegExp = new RegExp(`\s*(".*?"|'.*?'|[^${config.sep}]+|)\s*(${config.sep}(?!\s*")|$)`, 'g')
  const cellSpitRegExp = new RegExp(`\s*(".*?"|'.*?'|[^,]+|)\s*(,(?!\s*\\")|$)`, 'g')
  const doubleQuotedTextRegExp = new RegExp(`^\s*\"(.*?)\"\s*${config.sep}?(?!\s*\\")$`)
  const singleQuotedTextRegExp = new RegExp(`^\s*'(.*?)'\s*${config.sep}?$`)
  const booleanRegExp = new RegExp(`^\s*(true|false)\s*${config.sep}?$`, 'i')
  const integerNumberRegExp = new RegExp(`^\s*((?:\\+|\-)?\d+)\s*${config.sep}?$`)
  const floatingNumberRegExp = new RegExp(`^\s*((?:\\+|\-)?\d*\.\d*)\s*${config.sep}?$`)
  const unquotedTextRegExp = new RegExp(`^\s*(.*?)\s*${config.sep}?$`)
  console.log('!', text, text.match(cellSpitRegExp).length)
  return text.match(cellSpitRegExp).map(function (subText) {
    let m;
    console.log('  -', subText)
    // if (m = subText.match(/^\s*\"(.*?)\"\s*,?(?!\s*\\")$/))
    if (m = subText.match(doubleQuotedTextRegExp))
      return replaceEscapedSymbols(m[1])//m[1] // Double Quoted Text // /^\s*\"(.*?)\"\s*,?$/
    // if (m = subText.match(/^\s*'(.*?)'\s*,?$/))
    if (m = subText.match(singleQuotedTextRegExp))
      return replaceEscapedSymbols(m[1]); // Single Quoted Text
    // if (m = subText.match(/^\s*(true|false)\s*,?$/i))
    if (m = subText.match(booleanRegExp))
      return m[1].toLowerCase() === 'true'; // Boolean
    // if (m = subText.match(/^\s*((?:\+|\-)?\d+)\s*,?$/))
    if (m = subText.match(integerNumberRegExp))
      return parseInt(m[1]); // Integer Number
    // if (m = subText.match(/^\s*((?:\+|\-)?\d*\.\d*)\s*,?$/))
    if (m = subText.match(floatingNumberRegExp))
      return parseFloat(m[1]); // Floating Number
    // if (m = subText.match(/^\s*(.*?)\s*,?$/))
    if (m = subText.match(unquotedTextRegExp))
      return subText === '' ? null : m[1] //replaceEscapedSymbols(m[1]); // Unquoted Text
    return subText;
  });
}

file.toCSVCell = (value) => {
  if (typeof (value) === 'undefined')
    return ''
  if (value === null)
    return ''
  if (typeof value === 'boolean')
    return value.toString()

  if (typeof value !== 'number')
      return JSON.stringify(value.toString().replaceAll('\\"', '""'))
  return (parseFloat(value) === parseInt(value) ? parseInt(value) : parseFloat(value)).toString()
}

file.convertResultsToCSV = (testResults) => {
  // function prepareValToCSV(value) {
  //   if (!value)
  //     return 0
  //   if (typeof value !== 'number')
  //     return JSON.stringify(value)
  //   return parseFloat(value) === parseInt(value) ? parseInt(value) : parseFloat(value)
  // }

  if (!testResults || !testResults.performanceSummary || !testResults.performanceSummary.length)
    return 'There is no data for conversion'
  let headers = Object.keys(testResults.performanceSummary[0]) // The first test table can be with error and can't have rows with previous values when parsedReport
  if (testResults.hasOwnProperty('paramsNames') && headers.length <= (Object.keys(testResults.paramsNames).length + 1)) { // Find the another header if only params names and 'comment' in headers
    const headersAll = testResults.performanceSummary.find(report => Object.keys(report).length > headers.length)
    if (headersAll)
      headers = Object.keys(headersAll)
  }

  let csv = headers.map(header => JSON.stringify(header)).join(config.sep)
  csv += '\n'
  testResults.performanceSummary.forEach(row => {
    // const rowData = headers.map(key => typeof row[key] === 'undefined' ? '' : prepareValToCSV(row[key]))
    const rowData = headers.map(key => file.toCSVCell(row[key]))
    // csv += rowData.join(',').replaceAll('\\"', '""')
    csv += rowData.join(config.sep)
    csv += '\n'
  })
  if (testResults.filteredSummary && testResults.filteredSummary.length) {
    csv += headers.map(key => key !== 'comment' ? '' : 'Bellow filtered results of tests') // Empty line
    csv += '\n'
    testResults.filteredSummary.forEach(row => {
      // const rowData = headers.map(key => typeof row[key] === 'undefined' ? '' : prepareValToCSV(row[key]))
      const rowData = headers.map(key => file.toCSVCell(row[key]))
      // csv += rowData.join(',').replaceAll('\\"', '""')
      csv += rowData.join(config.sep)
      csv += '\n'
    })
  }
  return csv
}