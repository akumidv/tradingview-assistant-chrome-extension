/*
 @license Copyright 2021 akumidv (https://github.com/akumidv/)
 SPDX-License-Identifier: Apache-2.0
*/

'use strict';

(async function() {

  setInterval(ui.checkInjectedElements, 1000); // Add action to set strategy parameters window

  chrome.runtime.onMessage.addListener(
    async function(request, sender, sendResponse) {
      if(sender.tab || !request.hasOwnProperty('action') || !request.action) {
        log.debug('Not for action message received:', request)
        return sendResponse()
      }
      if(action.workerStatus !== null) {
        ui.autoCloseAlert('The previous task is still running. Wait for it to finish or press Stop.')
        return sendResponse()
      }

      action.workerStatus = request.action
      try {
        sendResponse()
        switch (request.action) {
          case 'saveParameters': {
            await action.saveParameters()
            break;
          }
          case 'loadParameters': {
            await action.loadParameters()
            break;
          }
          case 'uploadSignals':
            await action.uploadSignals()
            break
          case 'uploadStrategyParameters':
            await action.uploadStrategyParameters()
            break
          case 'getStrategyParameters':
            await action.getStrategyParameters()
            break
          case 'editOptimizationSettings':
            await action.editOptimizationSettings(request)
            break
          case 'exportDatabase':
            await action.exportDatabase()
            break
          case 'importDatabase':
            await action.importDatabase()
            break
          case 'testStrategy':
            await action.testStrategy(request, false)
            break
          case 'deepTestStrategy':
            await action.testStrategy(request, true)
            break
          case 'previewStrategyTestResults':
            await action.previewStrategyTestResults(request)
            break
          case 'downloadStrategyTestResults':
            await action.downloadStrategyTestResults(request)
            break
          case 'uploadStrategyTestResults':
            await action.uploadStrategyTestResults(request)
            break
          case 'clearAll':
            await action.clearAll()
            break
          case 'show3DChart':
            await action.show3DChart(request)
            break
          default:
            log.warn(`Unknown action "${request.action}"`)
        }
      } catch (err) {
        await ui.showErrorByKind(err, request.action)
      }
      action.workerStatus = null
      ui.statusMessageRemove()
    }
  );


  const dialogWindowNode = await page.waitForSelector(SEL.tvDialogRoot, 0)
  if(dialogWindowNode) {
    const tvObserver = new MutationObserver(tv.dialogHandler);
    tvObserver.observe(dialogWindowNode, {
      childList: true,
      subtree: true,
      attributes: false,
      characterData: false
    });
    await tv.dialogHandler() // First run
  }

})();
