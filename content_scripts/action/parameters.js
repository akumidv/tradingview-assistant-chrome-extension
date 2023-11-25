action.saveParameters = async () => {
  const strategyData = await tv.getStrategy(null, true)
  if (!strategyData || !strategyData.hasOwnProperty('name') || !strategyData.hasOwnProperty('inputs') || !strategyData.inputs) {
    await ui.showErrorPopup('The current indicator/strategy is not contains inputs that can be saved.')
    return
  }
  const strategyParamsCSV = _convertInputs(strategyData)
  file.saveAs(strategyParamsCSV, `${strategyData.name}_inputs.csv`)
}


action.loadParameters = async () => {
  await file.upload(_loadParametersHandler, '', false)
}


const _convertInputs = (strategyData) => {
  let strategyParamsCSV = `Idx,Name,Value,Type\n,"__indicatorName",${JSON.stringify(strategyData.name)},\n`
  for (const propInput of strategyData['inputs']) {
    strategyParamsCSV += `${propInput['idx']},${JSON.stringify(propInput['name'])},${['int', 'float', 'boolean'].includes(propInput['type']) ? propInput['value'] : JSON.stringify(propInput['value'])},"${propInput['type']}"\n`
  }
  if (strategyData.hasOwnProperty('strategyProperties') && strategyData['strategyProperties']) {
    for (const propInput of strategyData['strategyProperties']) {
      strategyParamsCSV += `${propInput['idx']},${JSON.stringify('__' + propInput['name'])},${propInput['value'] === null ? '' : ['int', 'float', 'boolean'].includes(propInput['type']) ? propInput['value'] : JSON.stringify(propInput['value'])},"${propInput['type']}"\n`
    }
  }
  return strategyParamsCSV
}


_loadParametersHandler = async (fileData) => {
  let strategyName = null
  const csvData = await file.parseCSV(fileData)
  const headers = Object.keys(csvData[0])
  const missColumns = ['idx', 'Name', 'Value', 'Type'].filter(columnName => !headers.includes(columnName.toLowerCase()))
  if (missColumns && missColumns.length)
    return `  - ${fileData.name}: There is no column(s) "${missColumns.join(', ')}" in CSV.\nPlease add all necessary columns to CSV like showed in the template.\n\nSet parameters canceled.\n`
  const strategyInputs = []
  const strategyProperties = []
  csvData.forEach(row => {
    if (row['name'] === '__indicatorName')
      strategyName = row['value']
    else if (row['name'].startsWith('__'))
      strategyProperties.push({idx: row['idx'], name: row['name'], value: row['value'], type: row['type']})
    else
      strategyInputs.push({idx: row['idx'], name: row['name'], value: row['value'], type: row['type']})
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
