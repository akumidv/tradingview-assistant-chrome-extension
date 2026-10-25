/*
 Background service worker: owns the assistant database (shared/db.js) for the content scripts, which run on the
 TradingView origin and can not open the extension's IndexedDB themselves.
 Message: {type: 'tvaDb', op: <tvaDb.REMOTE_OPERATIONS item>, args: [...]} -> {ok: true, result} | {ok: false, error}
*/
'use strict';

importScripts('shared/db.js')

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (!request || request.type !== 'tvaDb')
    return false
  ;(async () => {
    try {
      if (!tvaDb.REMOTE_OPERATIONS.includes(request.op))
        throw new Error(`Unknown database operation "${request.op}"`)
      const result = await tvaDb[request.op](...(Array.isArray(request.args) ? request.args : []))
      sendResponse({ok: true, result})
    } catch (err) {
      console.error('[tv-assistant]', `Database operation "${request.op}" failed:`, err)
      sendResponse({ok: false, error: err && err.message ? err.message : String(err)})
    }
  })()
  return true // the response is sent asynchronously
})
