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
        console.log('Not for action message received:', request)
        return sendResponse()
      }
      if(action.workerStatus !== null) {
        console.log('Waiting for end previous work. Status:', action.workerStatus)
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
          case 'uploadStrategyTestParameters':
            await action.uploadStrategyTestParameters()
            break
          case 'getStrategyTemplate':
            await action.getStrategyTemplate()
            break
          case 'testStrategy':
            await action.testStrategy(request)
            break
          case 'downloadStrategyTestResults':
            await action.downloadStrategyTestResults()
            break
          case 'clearAll':
            await action.clearAll()
            break
          case 'testAction':
            await ui.showStrategyParameters(20)
            break
          case 'show3DChart':
            const url = window.location && window.location.origin ? window.location.origin : 'https://www.tradingview.com'
            window.postMessage({name: 'iondvScript', action: 'show3DChart'}, url)
            break
          default:
            console.log('None of realisation for signal:', request)
        }
      } catch (err) {
        console.error(err)
        await ui.showErrorPopup(`An error has occurred.\n\nReload the page and try again.\nYou can describe the problem by following <a href="https://github.com/akumidv/tradingview-assistant-chrome-extension/" target="_blank">the link</a>.\n\nError message: ${err.message}`)
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
