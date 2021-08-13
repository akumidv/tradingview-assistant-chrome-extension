// To activate need to add to manifest
// "background": {
//       "service_worker": "service-worker.js"
//     },
chrome.runtime.onMessage.addListener(async (request, sender, reply) => {
  console.log(
    sender.tab
      ? "from a content script:" + sender.tab.url
      : "from the extension"
  );
  switch (request.action) {
    case 'test':
      console.log(request)
      break;
    default:

  }
  return true;
});