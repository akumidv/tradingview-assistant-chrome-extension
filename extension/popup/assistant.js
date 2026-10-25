/*
 @license Copyright 2021 akumidv (https://github.com/akumidv/)
 SPDX-License-Identifier: Apache-2.0
*/
'use strict';

// The popup does not load content_scripts/log.js, so it keeps the same console prefix locally
const LOG_PREFIX = '[tv-assistant]'


document.addEventListener('DOMContentLoaded', () => {
  METRICS.populate(document.getElementById('optParamName'), METRICS.DEFAULT_OPT_PARAM)
  METRICS.populate(document.getElementById('optFilterParamName'), METRICS.DEFAULT_FILTER_PARAM)
  checkIsTVChart()
  setTabEvents()
  setPopupInputsByOptions()
  setClickEvents()
  setOptionsEvents()
  setWhatsNew()
  setOptimizationTable()
});

const TAB_COUNT = 5
// Hash of the last "What's new" text the user closed: the notice shows again only when that text changes
const WHATS_NEW_SEEN_KEY = 'whatsNewSeenHash'
const CHANGELOG_SUBHEADING = /^###\s+/

function activateTab(tabId) {
  const activeId = Number.isInteger(tabId) && tabId >= 1 && tabId <= TAB_COUNT ? tabId : 1
  document.querySelectorAll('.tabs__links > a').forEach(link =>
    link.classList.toggle('active', Number(link.dataset.tab) === activeId))
  document.querySelectorAll('.tabs > div').forEach(panel =>
    panel.classList.toggle('active', panel.id === `content-${activeId}`))
  document.querySelector('.content').scrollTop = 0
}

function setTabEvents() {
  document.querySelectorAll('.tabs__links > a').forEach(link =>
    link.addEventListener('click', () => activateTab(Number(link.dataset.tab))))
}

// The popup reads its own packaged file; no manifest permission is needed for that
async function setWhatsNew() {
  let changelogText
  try {
    const response = await fetch('../CHANGELOG.md')
    changelogText = await response.text()
  } catch (err) {
    console.error(LOG_PREFIX, 'Can not read CHANGELOG.md', err)
    return
  }
  const sections = splitChangelog(changelogText)
  if (!sections.length)
    return
  document.getElementById('helpChangelog').innerHTML = sections.map(section => renderChangelogSection(section)).join('')
  // The notice shows only the summary part of the release; the details stay in the Help tab
  const latest = getChangelogSummary(sections[0])
  const latestHash = hashText(latest.title + '\n' + latest.lines.join('\n'))
  chrome.storage.local.get(null, (stored) => {
    if (stored[WHATS_NEW_SEEN_KEY] === latestHash)
      return
    // Nothing stored at all is a fresh install: the notice is only for users who had the extension before
    if (!stored.hasOwnProperty(WHATS_NEW_SEEN_KEY) && Object.keys(stored).length === 0) {
      chrome.storage.local.set({[WHATS_NEW_SEEN_KEY]: latestHash})
      return
    }
    showWhatsNew(latest, latestHash)
  })
}

function showWhatsNew(latest, latestHash) {
  const bar = document.getElementById('whatsNewBar')
  const panel = document.getElementById('whatsNewPanel')
  document.getElementById('whatsNewVersion').textContent = latest.title
  document.getElementById('whatsNewText').innerHTML = renderChangelogSection(latest)
  bar.hidden = false
  function dismiss() {
    bar.hidden = true
    panel.hidden = true
    chrome.storage.local.set({[WHATS_NEW_SEEN_KEY]: latestHash})
  }
  document.getElementById('whatsNewOpen').addEventListener('click', () => { panel.hidden = false })
  document.getElementById('whatsNewDismiss').addEventListener('click', dismiss)
  document.getElementById('whatsNewClose').addEventListener('click', dismiss)
}

// Sections start with "## <version>"; the text before the first one is a note for the file editors
function splitChangelog(changelogText) {
  const sections = []
  for (const line of changelogText.split(/\r?\n/)) {
    const heading = line.match(/^##\s+(.+)$/)
    if (heading)
      sections.push({title: heading[1].trim(), lines: []})
    else if (sections.length)
      sections[sections.length - 1].lines.push(line)
  }
  return sections
}

// A release section is a short summary, optionally followed by "### " parts (Details) for readers of the full log
function getChangelogSummary(section) {
  const detailsIdx = section.lines.findIndex(line => CHANGELOG_SUBHEADING.test(line))
  return detailsIdx < 0 ? section : {title: section.title, lines: section.lines.slice(0, detailsIdx)}
}

function hashText(text) {
  let hash = 5381
  for (let i = 0; i < text.length; i++)
    hash = ((hash << 5) + hash + text.charCodeAt(i)) | 0
  return (hash >>> 0).toString(16)
}

function escapeHtml(text) {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

// The Markdown subset CHANGELOG.md uses: "### " subheadings, "- " list items (indented lines continue them),
// paragraphs, **bold** and [text](https://link). A "### " part (Details) renders collapsed, so the Help tab shows the
// summaries and opens the details on a click.
function renderInlineMarkdown(text) {
  return escapeHtml(text)
    .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
    .replace(/\[([^\]]+)\]\((https:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank">$1</a>')
}

function renderChangelogSection(section) {
  const blocks = []
  for (const line of section.lines) {
    if (!line.trim())
      continue
    const heading = line.match(/^###\s+(.+)$/)
    const item = line.match(/^\s*-\s+(.*)$/)
    const last = blocks[blocks.length - 1]
    if (heading)
      blocks.push({type: 'h5', text: heading[1].trim()})
    else if (item)
      blocks.push({type: 'li', text: item[1]})
    else if (last && /^\s/.test(line))
      last.text += ' ' + line.trim()
    else
      blocks.push({type: 'p', text: line.trim()})
  }
  let html = `<h4>${escapeHtml(section.title)}</h4>`
  let isListOpen = false
  let isPartOpen = false
  for (const block of blocks) {
    if (block.type !== 'li' && isListOpen)
      html += '</ul>'
    if (block.type === 'h5') {
      html += (isPartOpen ? '</details>' : '') + `<details><summary>${renderInlineMarkdown(block.text)}</summary>`
      isPartOpen = true
      isListOpen = false
      continue
    }
    if (block.type === 'li' && !isListOpen)
      html += '<ul>'
    isListOpen = block.type === 'li'
    html += `<${block.type}>${renderInlineMarkdown(block.text)}</${block.type}>`
  }
  return html + (isListOpen ? '</ul>' : '') + (isPartOpen ? '</details>' : '')
}


function setOptionsEvents() {
  for(let elId of ['optMinmax', 'optParamName', 'optMethod', 'optFilterOff', 'optFilterMore', 'optFilterLess',
    'optFilterValue', 'optFilterParamName', 'randomDelay', 'shouldTestTF', 'shouldSkipInitBestResult', 'parseExtraReportTabs', 'setParamsByApi']) {
    function saveOptListener() {
      saveOptions(elId)
    }
    document.getElementById(elId).addEventListener('click', saveOptListener)
  }
  for(let elId of ['deepStartDate', 'backtestDelay', 'dataLoadingTime', 'listOfTF']) {
    function saveOptListener() {
      saveOptions(elId)
    }
    // deepStartDate is commented out in the popup for now
    if (document.getElementById(elId))
      document.getElementById(elId).addEventListener('blur', saveOptListener)
  }
}

function setClickEvents() {
  for(let elId of ['uploadSignals', 'testStrategy', 'previewStrategyTestResults', 'downloadStrategyTestResults', 'uploadStrategyTestResults',
    'getStrategyParameters', 'uploadStrategyParameters', 'clearAll', 'show3DChart', 'exportDatabase', 'importDatabase']) {
    function signalListener() {
      sendSignalToActiveTab(elId)
    }
    if (document.getElementById(elId))
      document.getElementById(elId).addEventListener('click', signalListener);
    else
      console.error(LOG_PREFIX, `Can not find id ${elId}`)
  }
  document.getElementById('closeMsg').addEventListener('click', function () {
    document.getElementById('shim').style.display = 'none'
    document.getElementById('msgbx').style.display = 'none';
  });
}

function checkIsTVChart() {
  chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
    let message = null
    if(!tabs[0].url.includes('tradingview.com'))
      message = 'To work with the extension, activate it on the tab with the opened <a href="https://www.tradingview.com/chart" target="_blank">Tradingview chart</a>.'
    if(!tabs[0].url.includes('www.tradingview.com') && !tabs[0].url.includes('en.tradingview.com'))
      message = 'The extension works with the <a href="https://www.tradingview.com/chart" target="_blank">English version</a> of Tradingview.'
    if (message) {
      for(let elId of ['warningSignals', 'warningBacktest']) {
        if (document.getElementById(elId))
          document.getElementById(elId).innerHTML = message
      }
      const rootElement = document.querySelector(':root')
      if (rootElement) rootElement.style.setProperty('--warningVisible', 'block')
    }
  });
}


let resolvePopupOptionsLoaded
const popupOptionsLoaded = new Promise(resolve => resolvePopupOptionsLoaded = resolve)

function setPopupInputsByOptions(getResults) {
  chrome.storage.local.get('iondvOptions', (getResults) => {
    let tabId = 1
    if (getResults.hasOwnProperty('iondvOptions')) {
      const iondvOptions = getResults['iondvOptions']
      console.debug(LOG_PREFIX, 'iondvOptions', iondvOptions)
      tabId = iondvOptions['tabId'] ? iondvOptions['tabId'] : 1
      if (document.getElementById('optMinmax') && iondvOptions.hasOwnProperty('isMaximizing'))
        document.getElementById('optMinmax').checked = iondvOptions.isMaximizing
      if (document.getElementById('optParamName') && iondvOptions.hasOwnProperty('optParamName')) {
        const saved = iondvOptions.optParamName
        document.getElementById('optParamName').value = METRICS.isValid(saved) ? saved : METRICS.DEFAULT_OPT_PARAM
      }
      if (document.getElementById('optMethod') && iondvOptions.hasOwnProperty('optMethod'))
        document.getElementById('optMethod').value = iondvOptions.optMethod

      if (iondvOptions.hasOwnProperty('optFilterAscending') && document.getElementById('optFilterMore') &&
        document.getElementById('optFilterLess') && document.getElementById('optFilterOff')) {
        if (iondvOptions.optFilterAscending === true) {
          document.getElementById('optFilterOff').checked = false
          document.getElementById('optFilterMore').checked = true
          document.getElementById('optFilterLess').checked = false
        } else if (iondvOptions.optFilterAscending === false) {
          document.getElementById('optFilterOff').checked = false
          document.getElementById('optFilterMore').checked = false
          document.getElementById('optFilterLess').checked = true
        } else {
          document.getElementById('optFilterOff').checked = true
          document.getElementById('optFilterMore').checked = false
          document.getElementById('optFilterLess').checked = false
        }
      }
      if (document.getElementById('optFilterValue') && iondvOptions.hasOwnProperty('optFilterValue'))
        document.getElementById('optFilterValue').value = iondvOptions.optFilterValue
      if (document.getElementById('optFilterParamName') && iondvOptions.hasOwnProperty('optFilterParamName')) {
        const saved = iondvOptions.optFilterParamName
        document.getElementById('optFilterParamName').value = METRICS.isValid(saved) ? saved : METRICS.DEFAULT_FILTER_PARAM
      }

      if(document.getElementById('deepStartDate') && iondvOptions.hasOwnProperty('deepStartDate'))
        document.getElementById('deepStartDate').value = iondvOptions.deepStartDate
      if(document.getElementById('dataLoadingTime') && iondvOptions.hasOwnProperty('dataLoadingTime')) {
        document.getElementById('dataLoadingTime').value = iondvOptions.dataLoadingTime !== null ? iondvOptions.dataLoadingTime : 30
      }
      if(document.getElementById('backtestDelay') && iondvOptions.hasOwnProperty('backtestDelay')) {
        if (iondvOptions.backtestDelay !== null)
          document.getElementById('backtestDelay').value = iondvOptions.backtestDelay
      }
      if(document.getElementById('randomDelay') && iondvOptions.hasOwnProperty('randomDelay')) {
        document.getElementById('randomDelay').checked = Boolean(iondvOptions.randomDelay)
      }
      if(document.getElementById('shouldTestTF') && iondvOptions.hasOwnProperty('shouldTestTF')) {
        document.getElementById('shouldTestTF').checked = Boolean(iondvOptions.shouldTestTF)
      }
      if(document.getElementById('shouldSkipInitBestResult') && iondvOptions.hasOwnProperty('shouldSkipInitBestResult')) {
        document.getElementById('shouldSkipInitBestResult').checked = Boolean(iondvOptions.shouldSkipInitBestResult)
      }
      if(document.getElementById('parseExtraReportTabs') && iondvOptions.hasOwnProperty('parseExtraReportTabs')) {
        document.getElementById('parseExtraReportTabs').checked = Boolean(iondvOptions.parseExtraReportTabs)
      }
      if(document.getElementById('setParamsByApi') && iondvOptions.hasOwnProperty('setParamsByApi')) {
        document.getElementById('setParamsByApi').checked = Boolean(iondvOptions.setParamsByApi)
      }
      if(document.getElementById('shouldSkipWaitingForDownload') && iondvOptions.hasOwnProperty('shouldSkipWaitingForDownload')) {
        document.getElementById('shouldSkipWaitingForDownload').checked = Boolean(iondvOptions.shouldSkipWaitingForDownload)
      }
      if(document.getElementById('listOfTF') && iondvOptions.hasOwnProperty('listOfTF')) {
        if (iondvOptions.listOfTF !== null)
          document.getElementById('listOfTF').value = iondvOptions.listOfTF
      }
    }
    activateTab(tabId) // Saved or first tab
    resolvePopupOptionsLoaded()
  })
}

function getOptions(signal) {
  const iondvOptions = {}
  iondvOptions.isMaximizing = document.getElementById('optMinmax').checked
  iondvOptions.optParamName = document.getElementById('optParamName').value || METRICS.DEFAULT_OPT_PARAM
  iondvOptions.optMethod = document.getElementById('optMethod').value || 'random'

  iondvOptions.isMaximizing = document.getElementById('optMinmax').checked
  iondvOptions.optParamName = document.getElementById('optParamName').value || METRICS.DEFAULT_OPT_PARAM
  iondvOptions.optMethod = document.getElementById('optMethod').value || 'random'

  iondvOptions.optFilterAscending  = document.getElementById('optFilterMore').checked ? true : document.getElementById('optFilterLess').checked ? false : null
  iondvOptions.optFilterValue = document.getElementById('optFilterValue').value || '50'
  iondvOptions.optFilterParamName = document.getElementById('optFilterParamName').value || METRICS.DEFAULT_FILTER_PARAM
  const deepStartDateEl = document.getElementById('deepStartDate')
  if (deepStartDateEl) {
    if (deepStartDateEl.value === '' || (deepStartDateEl.value && deepStartDateEl.value.match(/^20\d{2}-[0-1][0-9]-[0-3][0-9]/))) {
      deepStartDateEl.style.removeProperty('color')
      iondvOptions.deepStartDate = deepStartDateEl.value
    } else {
      deepStartDateEl.style.setProperty('color', 'red')
      iondvOptions.deepStartDate = null
    }
  }
  if(document.getElementById('dataLoadingTime')) {
    const dataLoadingTime =  document.getElementById('dataLoadingTime').value
    iondvOptions.dataLoadingTime = dataLoadingTime === '' ? null : isNaN(parseInt(dataLoadingTime)) ? 45 : Math.abs(parseInt(dataLoadingTime))
  }
  if(document.getElementById('backtestDelay')) {
    const delayValue =  document.getElementById('backtestDelay').value
    iondvOptions.backtestDelay = delayValue === '' ? null : isNaN(parseFloat(delayValue)) ? 0.5 : Math.abs(parseFloat(delayValue))
  }
  iondvOptions.randomDelay = document.getElementById('randomDelay').checked
  iondvOptions.shouldTestTF = document.getElementById('shouldTestTF').checked
  iondvOptions.shouldSkipInitBestResult = document.getElementById('shouldSkipInitBestResult').checked
  iondvOptions.parseExtraReportTabs = document.getElementById('parseExtraReportTabs').checked
  iondvOptions.setParamsByApi = document.getElementById('setParamsByApi').checked

  if(document.getElementById('listOfTF')) {
    const listOfTF =  document.getElementById('listOfTF').value
    iondvOptions.listOfTF = listOfTF === '' ? null : listOfTF
  }

  iondvOptions.tabId = (signal === 'uploadSignals') ? 3 : RESULTS_ACTIONS.includes(signal) ? 2 :
    ['exportDatabase', 'importDatabase'].includes(signal) ? 4 : 1
  return iondvOptions
}

function saveOptions(signal) {
  const iondvOptions = getOptions(signal)
  chrome.storage.local.set({'iondvOptions': iondvOptions})
  console.debug(LOG_PREFIX, 'Saved options', iondvOptions)
}

function showPopupMessage(html) {
  document.getElementById('msg-text').innerHTML = html
  document.getElementById('shim').style.display = 'block'
  document.getElementById('msgbx').style.display = 'block'
}

function sendSignalToActiveTab(signal) {
  if (STRATEGY_ACTIONS.includes(signal) && !selectedStrategyId) {
    showPopupMessage('Select a strategy in the optimization settings table of the "Testing a strategy" tab first.<br><br>' +
      'If the table is empty, add a strategy with "Upload strategy parameters" or "Get strategy parameters".')
    return
  }
  let iondvOptions = null
  if(signal !== 'clearAll') {
    iondvOptions = getOptions(signal)
    chrome.storage.local.set({'iondvOptions': iondvOptions})
  }

  chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
    if(!tabs[0].url.includes('tradingview.com')) {
      document.getElementById('msg-text').innerHTML = 'To work with the extension, activate it on the tab with the opened <a href="https://www.tradingview.com/chart" target="_blank">Tradingview chart</a>.'
      document.getElementById('shim').style.display = 'block'
      document.getElementById('msgbx').style.display = 'block'
      return
    }
    const message = {action: signal}
    if(iondvOptions)
      message.options = iondvOptions
    if (selectedStrategyId)
      message.strategyId = selectedStrategyId
    chrome.tabs.sendMessage(tabs[0].id, message, function() {
      // No receiver: the extension was reloaded or updated after the tab was opened, so the tab still runs
      // the old, disconnected content scripts. Without this check the click silently did nothing.
      if (chrome.runtime.lastError) {
        console.warn(LOG_PREFIX, 'The message was not delivered to the tab:', chrome.runtime.lastError.message)
        document.getElementById('msg-text').innerHTML = 'The extension is not connected to this TradingView tab ' +
          '(it was reloaded or updated after the tab was opened).<br><br>Reload the TradingView page (F5) and try again.'
        document.getElementById('shim').style.display = 'block'
        document.getElementById('msgbx').style.display = 'block'
        return
      }
      window.close()
    });
  });
}

// ---------------------------------------------------------------------------------------------------------------------
// Optimization settings table: the strategies of the database (shared/db.js). The selected one is the strategy of the
// actions; its optimization options are shown in the form of the tab, and changes of the form are saved for it.
// ---------------------------------------------------------------------------------------------------------------------

const SELECTED_STRATEGY_KEY = 'iondvSelectedStrategy'
const RESULTS_ACTIONS = ['previewStrategyTestResults', 'downloadStrategyTestResults', 'uploadStrategyTestResults', 'show3DChart']
const STRATEGY_ACTIONS = ['testStrategy', 'editOptimizationSettings', ...RESULTS_ACTIONS]
const OPTION_ELEMENT_IDS = ['optMinmax', 'optParamName', 'optMethod', 'optFilterOff', 'optFilterMore', 'optFilterLess',
  'optFilterValue', 'optFilterParamName']
let selectedStrategyId = null
let optimizationRecords = []

async function setOptimizationTable() {
  try {
    const stored = await new Promise(resolve => chrome.storage.local.get(SELECTED_STRATEGY_KEY, resolve))
    selectedStrategyId = stored && stored[SELECTED_STRATEGY_KEY] ? stored[SELECTED_STRATEGY_KEY] : null
    await renderOptimizationTable()
    if (selectedStrategyId && !optimizationRecords.some(record => record.strategy_id === selectedStrategyId))
      selectedStrategyId = null
    await popupOptionsLoaded // the stored form is set first, the options of the selected strategy replace it
    if (selectedStrategyId)
      setFormByRecord(optimizationRecords.find(record => record.strategy_id === selectedStrategyId))
  } catch (err) {
    console.error(LOG_PREFIX, 'Can not read the optimization settings from the database', err)
    document.getElementById('optSettingsEmpty').hidden = false
    document.getElementById('optSettingsEmpty').textContent = `The database is not available: ${err && err.message ? err.message : err}`
  }
  // A change of the form is saved for the selected strategy
  for (const elId of OPTION_ELEMENT_IDS) {
    const el = document.getElementById(elId)
    if (!el)
      continue
    el.addEventListener('change', saveFormToSelectedStrategy)
    if (el.type === 'radio' || el.type === 'checkbox')
      el.addEventListener('click', saveFormToSelectedStrategy)
  }
}

function describeRecord(record) {
  let paramsText = '?'
  let cycles = ''
  try {
    const parsed = optSettings.fromXml(record.content_xml)
    paramsText = `${parsed.params.filter(param => param.active).length}/${parsed.params.length}`
    cycles = (parsed.cycles > 0 ? String(parsed.cycles) : '\u221e') + (parsed.timeLimit > 0 ? ` / ${parsed.timeLimit}m` : '')
  } catch (err) {
    paramsText = 'damaged'
  }
  const filter = record.filterCondition === 'more' ? `${record.filterParamName} ≥ ${record.filterValue}` :
    record.filterCondition === 'less' ? `${record.filterParamName} ≤ ${record.filterValue}` : 'off'
  return {
    paramsText, cycles, filter,
    valueOf: `${record.isMaximizing === false ? 'min' : 'max'} ${record.optParamName || ''}`,
    method: record.optMethod || '',
    updated: record.updated ? String(record.updated).slice(5, 16).replace('T', ' ') : ''
  }
}

async function renderOptimizationTable() {
  optimizationRecords = (await tvaDb.getAll(tvaDb.OPTIMIZATION_SETTINGS))
    .sort((a, b) => String(b.updated || '').localeCompare(String(a.updated || '')))
  const tbody = document.getElementById('optSettingsBody')
  tbody.innerHTML = ''
  document.getElementById('optSettingsEmpty').hidden = optimizationRecords.length > 0
  for (const record of optimizationRecords) {
    const info = describeRecord(record)
    const row = document.createElement('tr')
    row.dataset.strategyId = record.strategy_id
    row.classList.toggle('selected', record.strategy_id === selectedStrategyId)
    row.title = `${record.indicator_name || record.strategy_id}\nCreated: ${record.created || ''}\nUpdated: ${record.updated || ''}`
    const cells = [record.strategy_id, info.paramsText, info.valueOf, info.method, info.filter, info.cycles, info.updated]
    cells.forEach((text, idx) => {
      const cell = document.createElement('td')
      cell.textContent = text
      if (idx === 0)
        cell.className = 'opt-strategy'
      row.appendChild(cell)
    })
    const deleteCell = document.createElement('td')
    const deleteBtn = document.createElement('button')
    deleteBtn.className = 'opt-delete'
    deleteBtn.title = 'Delete the strategy with its settings and results'
    deleteBtn.textContent = '✕'
    deleteBtn.addEventListener('click', async (event) => {
      event.stopPropagation()
      if (!confirm(`Delete "${record.strategy_id}" with its strategy parameters, optimization settings and all test results?`))
        return
      await tvaDb.deleteStrategy(record.strategy_id)
      if (selectedStrategyId === record.strategy_id)
        await selectStrategy(null)
      await renderOptimizationTable()
    })
    deleteCell.appendChild(deleteBtn)
    row.appendChild(deleteCell)
    row.addEventListener('click', () => selectStrategy(record.strategy_id))
    row.addEventListener('dblclick', async () => {
      await selectStrategy(record.strategy_id)
      sendSignalToActiveTab('editOptimizationSettings')
    })
    tbody.appendChild(row)
  }
}

async function selectStrategy(strategyId) {
  selectedStrategyId = strategyId
  await new Promise(resolve => chrome.storage.local.set({[SELECTED_STRATEGY_KEY]: strategyId}, resolve))
  document.querySelectorAll('#optSettingsBody tr').forEach(row =>
    row.classList.toggle('selected', row.dataset.strategyId === strategyId))
  const record = optimizationRecords.find(item => item.strategy_id === strategyId)
  if (record) {
    setFormByRecord(record)
    saveOptions('selectStrategy') // the form of the selected strategy is the current form
  }
}

function setFormByRecord(record) {
  if (!record)
    return
  if (record.hasOwnProperty('isMaximizing'))
    document.getElementById('optMinmax').checked = record.isMaximizing !== false
  if (record.optParamName)
    document.getElementById('optParamName').value = METRICS.isValid(record.optParamName) ? record.optParamName : METRICS.DEFAULT_OPT_PARAM
  if (record.optMethod)
    document.getElementById('optMethod').value = record.optMethod
  const condition = record.filterCondition || 'off'
  document.getElementById('optFilterOff').checked = condition === 'off'
  document.getElementById('optFilterMore').checked = condition === 'more'
  document.getElementById('optFilterLess').checked = condition === 'less'
  if (record.hasOwnProperty('filterValue'))
    document.getElementById('optFilterValue').value = record.filterValue
  if (record.filterParamName)
    document.getElementById('optFilterParamName').value = METRICS.isValid(record.filterParamName) ? record.filterParamName : METRICS.DEFAULT_FILTER_PARAM
}

let saveFormTimer = null
function saveFormToSelectedStrategy() {
  if (!selectedStrategyId)
    return
  clearTimeout(saveFormTimer)
  // The click on a radio button comes before its "checked" state is shown: the form is read a moment later
  saveFormTimer = setTimeout(async () => {
    const strategyId = selectedStrategyId
    try {
      const saved = await tvaDb.update(tvaDb.OPTIMIZATION_SETTINGS, strategyId, optSettings.getOptionFields(getOptions('saveForm')))
      if (saved) {
        const idx = optimizationRecords.findIndex(record => record.strategy_id === strategyId)
        if (idx >= 0)
          optimizationRecords[idx] = saved
        const row = document.querySelector(`#optSettingsBody tr[data-strategy-id="${CSS.escape(strategyId)}"]`)
        if (row) {
          const info = describeRecord(saved)
          const cells = row.querySelectorAll('td')
          ;[info.valueOf, info.method, info.filter, info.cycles, info.updated].forEach((text, i) => cells[i + 2].textContent = text)
        }
      }
    } catch (err) {
      console.error(LOG_PREFIX, 'Saving the optimization options of the strategy failed', err)
    }
  }, 50)
}
