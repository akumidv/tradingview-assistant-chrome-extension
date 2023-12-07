
const actionParameters = {}
if (typeof module !== 'undefined') {
  module.exports = {
    actionParameters
  }
}

actionParameters.saveParameters = async () => {
  const strategyData = await tv.getStrategy(null, true)
  if (!strategyData || !strategyData.hasOwnProperty('name') || !strategyData.hasOwnProperty('inputs') || !strategyData.inputs) {
    await ui.showErrorPopup('The current indicator/strategy is not contains inputs that can be saved.')
    return
  }
  const strategyParamsCSV = _convertInputsAndProperties(strategyData)
  file.saveAs(strategyParamsCSV, `${strategyData.name}_inputs.csv`)
}

actionParameters.loadParameters = async () => {
  await file.upload(_loadParametersHandler, '', false)
}

/**
 * @param {StrategyData} strategyData
 * @return {string}
 */
function _convertInputsAndProperties (strategyData) {
  // TODO
  // 2,"Signal","9","input",TODO "null","2"
  // 3,"Timeframe inp",TODO undefined,"list","null","3"
  // 4,"Source inp",undefined,"list","null","4"
  // 5,"Group string inp",undefined,"list","📈 TRADE TYPE 📉","5"
  // 6,"Float inp","0.002","input","null","6"
  // Parameters(!)

  let strategyParamsCSV = `Idx,Name,Value,Type,Group,RowIdx\n,"__indicatorName",${JSON.stringify(strategyData.name)},\n`
  for (const param of strategyData['inputs']) {
    let row = [file.toCSVCell(param['idx'])]
    row.push(file.toCSVCell(param['name']))
    row.push(file.toCSVCell(param['value']))
    row.push(file.toCSVCell(param['type']))
    row.push(file.toCSVCell(param['group']))
    row.push(file.toCSVCell(param['rowIdx']))
    // strategyParamsCSV += `${param['idx']},${JSON.stringify(param['name'])},` +
    //   `${['int', 'float', 'boolean'].includes(param['type']) ? param['value'] : JSON.stringify(param['value'])},` +
    //   `"${param['type']}","${param['group']}","${param['rowIdx']}"\n`
    // strategyParamsCSV += row
    strategyParamsCSV += row.join(config.sep) + '\n'
  }

  if (strategyData.hasOwnProperty('strategyProperties') && strategyData['strategyProperties']) {
    for (const param of strategyData['strategyProperties']) {
      strategyParamsCSV += `${param['idx']},${JSON.stringify('__' + param['name'])},` +
        `${param['value'] === null ? '' : ` + 
        `['int', 'float', 'boolean'].includes(param['type']) ? param['value'] : JSON.stringify(param['value'])},` +
        `"${param['type']}","${param['group']}","${param['rowIdx']}"\n`
    }
  }
  return strategyParamsCSV
}


async function _loadParametersHandler (fileData) {
  let strategyName = null
  const csvData = await file.parseCSV(fileData)
  const headers = Object.keys(csvData[0])
  const missColumns = ['idx', 'Name', 'Value', 'Type', 'Group', 'RowIdx'].filter(columnName => !headers.includes(columnName.toLowerCase()))
  if (missColumns && missColumns.length)
    return `  - ${fileData.name}: There is no column(s) "${missColumns.join(', ')}" in CSV.\nPlease add all necessary columns to CSV like showed in the template.\n\nSet parameters canceled.\n`
  const strategyInputs = []
  const strategyProperties = []
  csvData.forEach(row => {
    if (row['name'] === '__indicatorName')
      strategyName = row['value']
    else if (row['name'].startsWith('__'))
      // strategyProperties.push({idx: row['idx'], name: row['name'], value: row['value'], type: row['type']})
      strategyProperties.push(new IndicatorParameter(row['name'], row['value'], row['type'], row['group'], row['idx'], row['rowidx']))
    else
      // strategyInputs.push({idx: row['idx'], name: row['name'], value: row['value'], type: row['type']})
      strategyInputs.push(new IndicatorParameter(row['name'], row['value'], row['type'], row['group'], row['idx'], row['rowidx']))
  })
  if (!strategyName)
    return 'The name for indicator in row with name "__indicatorName" is missed in CSV file'
  let errMsg = await tvIndicator.setStrategyInputs(strategyName, strategyInputs, true)
  if (errMsg)
    return `The "${strategyName}" inputs are not set: ${errMsg}`
  if (strategyProperties.length) {
    errMsg = await tvIndicator.setStrategyProperties(strategyName, strategyProperties, true)
    if (errMsg)
      return errMsg
  }
  return `Parameters are set`
}
