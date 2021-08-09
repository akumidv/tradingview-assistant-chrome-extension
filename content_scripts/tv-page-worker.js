/*
 @license Copyright 2021 akumidv (https://github.com/akumidv/)
 SPDX-License-Identifier: Apache-2.0
*/
'use strict';

(async function() {
  const waitForTimeout = async (timeout = 5000) => new Promise(resolve => setTimeout(resolve, timeout))

  function triggerME (el, eventType) {
    var clickEvent = document.createEvent ('MouseEvents');
    clickEvent.initEvent (eventType, true, true);
    el.dispatchEvent (clickEvent);
  }

  function mouseClick (el) {
    triggerME (el, "mouseover");
    triggerME (el, "mousedown");
    triggerME (el, "mouseup");
    triggerME (el, "click");
  }

  // Example click on react object
  // var element = document.querySelector('div[data-name="legend"] ')
  // // CLICK
  // mouseClick(element)
  //
  // // DOUBLE_CLICK
  // mouseClick(element)
  // mouseClick(element)
})();
