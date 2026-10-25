/*
 IndexedDB of the assistant. Loaded by the popup (window) and by the background service worker (importScripts):
 both run on the extension origin, so they share one database. Content scripts run on the TradingView origin and
 reach it through the service worker (content_scripts/dbClient.js).

 Stores, all keyed by strategy_id (the strategy name as in its parameters file name):
   optimization_settings - content_xml (parameter ranges and Active marks, see shared/optimizationSettings.js)
                           and the optimization options of the "Testing a strategy" tab
   strategy_settings     - content_csv: the strategy parameter values ("Name,Value" with the "__indicatorName" row)
   optimization_results  - content_results: {runs: [...]}, every test run of the strategy
*/
'use strict';

const tvaDb = {
  NAME: 'tv-assistant',
  VERSION: 1,
  OPTIMIZATION_SETTINGS: 'optimization_settings',
  STRATEGY_SETTINGS: 'strategy_settings',
  OPTIMIZATION_RESULTS: 'optimization_results',
  _openPromise: null
}

tvaDb.STORES = [tvaDb.OPTIMIZATION_SETTINGS, tvaDb.STRATEGY_SETTINGS, tvaDb.OPTIMIZATION_RESULTS]

tvaDb.open = () => {
  if (tvaDb._openPromise)
    return tvaDb._openPromise
  tvaDb._openPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(tvaDb.NAME, tvaDb.VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      for (const storeName of tvaDb.STORES) {
        if (!db.objectStoreNames.contains(storeName))
          db.createObjectStore(storeName, {keyPath: 'strategy_id'})
      }
    }
    request.onsuccess = () => {
      const db = request.result
      // Another page of the extension upgrades the database: this connection must not block it
      db.onversionchange = () => {
        db.close()
        tvaDb._openPromise = null
      }
      resolve(db)
    }
    request.onerror = () => {
      tvaDb._openPromise = null
      reject(request.error)
    }
  })
  return tvaDb._openPromise
}

tvaDb._checkStore = (storeName) => {
  if (!tvaDb.STORES.includes(storeName))
    throw new Error(`Unknown database table "${storeName}"`)
}

tvaDb._request = async (storeName, mode, makeRequest) => {
  tvaDb._checkStore(storeName)
  const db = await tvaDb.open()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, mode)
    const request = makeRequest(transaction.objectStore(storeName))
    let result
    request.onsuccess = () => { result = request.result }
    transaction.oncomplete = () => resolve(result)
    transaction.onerror = () => reject(transaction.error || request.error)
    transaction.onabort = () => reject(transaction.error || new Error('The database transaction was aborted'))
  })
}

tvaDb.get = async (storeName, strategyId) => {
  const record = await tvaDb._request(storeName, 'readonly', store => store.get(strategyId))
  return record === undefined ? null : record
}

tvaDb.getAll = async (storeName) => {
  return tvaDb._request(storeName, 'readonly', store => store.getAll())
}

// Creates or replaces the record; "created" is kept from the stored record, "updated" is set now
tvaDb.put = async (storeName, record) => {
  tvaDb._checkStore(storeName)
  if (!record || typeof record.strategy_id !== 'string' || !record.strategy_id)
    throw new Error('The record has no strategy_id')
  const db = await tvaDb.open()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readwrite')
    const store = transaction.objectStore(storeName)
    const now = new Date().toISOString()
    const getRequest = store.get(record.strategy_id)
    let saved = null
    getRequest.onsuccess = () => {
      const stored = getRequest.result
      saved = {...record, created: stored && stored.created ? stored.created : (record.created || now), updated: now}
      store.put(saved)
    }
    transaction.oncomplete = () => resolve(saved)
    transaction.onerror = () => reject(transaction.error)
    transaction.onabort = () => reject(transaction.error || new Error('The database transaction was aborted'))
  })
}

// Changes some fields of a stored record (the others are kept). Returns the saved record or null when there is none
tvaDb.update = async (storeName, strategyId, fields) => {
  const stored = await tvaDb.get(storeName, strategyId)
  if (!stored)
    return null
  return tvaDb.put(storeName, {...stored, ...fields, strategy_id: strategyId})
}

tvaDb.delete = async (storeName, strategyId) => {
  await tvaDb._request(storeName, 'readwrite', store => store.delete(strategyId))
  return true
}

// Removes the strategy from all tables
tvaDb.deleteStrategy = async (strategyId) => {
  for (const storeName of tvaDb.STORES)
    await tvaDb.delete(storeName, strategyId)
  return true
}

// Adds a test run to optimization_results of the strategy (the runs are accumulated)
tvaDb.appendRun = async (strategyId, run) => {
  if (!run || typeof run !== 'object')
    throw new Error('No test run to save')
  const stored = await tvaDb.get(tvaDb.OPTIMIZATION_RESULTS, strategyId)
  const runs = stored && stored.content_results && Array.isArray(stored.content_results.runs) ? stored.content_results.runs : []
  runs.push(run)
  await tvaDb.put(tvaDb.OPTIMIZATION_RESULTS, {strategy_id: strategyId, content_results: {runs}})
  return runs.length
}

// The whole database as one object, for a backup file, and back
tvaDb.exportAll = async () => {
  const data = {name: tvaDb.NAME, version: tvaDb.VERSION, exported: new Date().toISOString(), tables: {}}
  for (const storeName of tvaDb.STORES)
    data.tables[storeName] = await tvaDb.getAll(storeName)
  return data
}

tvaDb.importAll = async (data) => {
  if (!data || !data.tables)
    throw new Error('It is not a backup of the assistant database')
  let count = 0
  for (const storeName of tvaDb.STORES) {
    for (const record of (data.tables[storeName] || [])) {
      await tvaDb._request(storeName, 'readwrite', store => store.put(record))
      count++
    }
  }
  return count
}

// Operations the service worker runs for content scripts
tvaDb.REMOTE_OPERATIONS = ['get', 'getAll', 'put', 'update', 'delete', 'deleteStrategy', 'appendRun', 'exportAll', 'importAll']
