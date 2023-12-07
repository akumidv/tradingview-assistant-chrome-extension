tvChart = {}

tvChart.getTicker = async () => {
  let tickerEl = document.querySelector(SEL.chartTicker)
  if (!tickerEl)
    throw new Error(`Can't get TradingView symbol element on chart`)

  let curTickerName = tickerEl.innerText
  // const fixCurTickerName = curTickerName.includes('\n') ?  curTickerName.split('\n')[1] : curTickerName
  return curTickerName.includes('\n') ?  curTickerName.split('\n')[1] : curTickerName
}

tvChart.getCurrentTimeFrame = async () => {
  const isFavoriteTimeframe = await document.querySelector(SEL.chartTimeframeFavorite)
  const curTimeFrameEl = isFavoriteTimeframe ? await page.waitForSelector(SEL.chartTimeframeActive, 500) :
    await page.waitForSelector(SEL.chartTimeframeMenuOrSingle, 500)

  if(!curTimeFrameEl || !curTimeFrameEl.innerText) {
    throw new Error('There is not timeframe element on page. Open correct page please')
    // return null
  }

  let curTimeFrameText = curTimeFrameEl.innerText
  curTimeFrameText = tvChart.correctTF(curTimeFrameText)
  return curTimeFrameText
}

tvChart.changeTimeFrame = async (setTF) => {
  const strategyTF = tvChart.correctTF(setTF)

  let curTimeFrameText = await tvChart.getCurrentTimeFrame()

  if(strategyTF === curTimeFrameText) // Timeframe already set
    return

  // Search timeframe among favorite timeframes
  const isFavoriteTimeframe = await document.querySelector(SEL.chartTimeframeFavorite)
  if(isFavoriteTimeframe) {
    await page.waitForSelector(SEL.chartTimeframeFavorite, 1000)
    const allTimeFrameEl = document.querySelectorAll(SEL.chartTimeframeFavorite)
    for(let tfEl of allTimeFrameEl) {
      const tfVal = !tfEl || !tfEl.innerText ? '' : tvChart.correctTF(tfEl.innerText)
      if(tfVal === strategyTF) {
        tfEl.click() // Timeframe changed
        return
      }
    }
  }

  // Search timeframe among timeframes menu items
  const timeFrameMenuEl = await document.querySelector(SEL.chartTimeframeMenuOrSingle)
  if(!timeFrameMenuEl)
    throw new Error('There is no timeframe selection menu element on the page')
  page.mouseClick(timeFrameMenuEl)
  const menuTFItem = await page.waitForSelector(SEL.chartTimeframeMenuItem, 1500)
  if(!menuTFItem)
    throw new Error('There is no items in timeframe menu on the page')

  let foundTF = await tvChart.selectTimeFrameMenuItem(strategyTF)
  if(foundTF) {
    curTimeFrameText = await tvChart.getCurrentTimeFrame()
    if(strategyTF !== curTimeFrameText)
      throw new Error(`Failed to set the timeframe value to "${strategyTF}", the current "${curTimeFrameText}"`)
    return //`Timeframe changed to ${alertTF}`
  }

  const tfValueEl = document.querySelector(SEL.chartTimeframeMenuInput)
  if(!tfValueEl)
    throw new Error(`There is no input element to set value of timeframe`)
  tfValueEl.scrollIntoView()
  page.setInputElementValue(tfValueEl, strategyTF.substr(0, strategyTF.length - 1))

  page.mouseClickSelector(SEL.chartTimeframeMenuType)
  const isTFTypeEl = page.waitForSelector(SEL.chartTimeframeMenuTypeItems, 1500)
  if(!isTFTypeEl)
    throw new Error(`The elements of the timeframe type did not appear while adding it`)
  switch (strategyTF[strategyTF.length-1]) {
    case 'm':
      page.mouseClickSelector(SEL.chartTimeframeMenuTypeItemsMin)
      break;
    case 'h':
      page.mouseClickSelector(SEL.chartTimeframeMenuTypeItemsHours)
      break;
    case 'D':
      page.mouseClickSelector(SEL.chartTimeframeMenuTypeItemsDays)
      break;
    case 'W':
      page.mouseClickSelector(SEL.chartTimeframeMenuTypeItemsWeeks)
      break;
    case 'M':
      page.mouseClickSelector(SEL.chartTimeframeMenuTypeItemsMonth)
      break;
    case 'r':
      page.mouseClickSelector(SEL.chartTimeframeMenuTypeItemsRange)
      break;
    default:
      return {error: 7, message: `Unknown timeframe type in "${strategyTF}"`}
  }
  page.mouseClickSelector(SEL.chartTimeframeMenuAdd)
  await page.waitForTimeout(1000)
  foundTF = await tvChart.selectTimeFrameMenuItem(strategyTF)
  curTimeFrameText = await tvChart.getCurrentTimeFrame()
  if (!foundTF)
    throw new Error( `Failed to add a timeframe "${strategyTF}" to the list`)
  else if(strategyTF !== curTimeFrameText)
    throw new Error(`Failed to set the timeframe value to "${strategyTF}" after adding it to timeframe list, the current "${curTimeFrameText}"`)
}


tvChart.selectTimeFrameMenuItem = async(alertTF) => {
  const allMenuTFItems = document.querySelectorAll(SEL.chartTimeframeMenuItem)
  for(let item of allMenuTFItems) {
    const tfVal = item.getAttribute('data-value')
    let tfNormValue = tfVal
    const isMinutes = tvChart.isTFDataMinutes(tfVal)
    tfNormValue = isMinutes && parseInt(tfVal) % 60 === 0 ? `${parseInt(tfVal) / 60}h` : isMinutes ? `${tfVal}m` : tfNormValue // If hours
    if (tfVal[tfVal.length-1] === 'S')
      tfNormValue = `${tfVal.substr(0,tfVal.length - 1)}s`
    if(tfNormValue === alertTF) {
      page.mouseClick(item)
      await page.waitForSelector(SEL.chartTimeframeMenuItem, 1500, true)
      return tfNormValue
    }
  }
  return null
}


tvChart.isTFDataMinutes = (tf) => !['S', 'D', 'M', 'W', 'R'].includes(tf[tf.length - 1])
tvChart.correctTF = (tf) => ['D', 'M', 'W'].includes(tf) ? `1${tf}` : tf
