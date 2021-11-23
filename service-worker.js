// To activate need to add to manifest
//   "host_permissions": ["URL"],
// "background": {
//       "service_worker": "service-worker.js"
//     },
chrome.runtime.onMessage.addListener(async (request, sender, reply) => {
  console.log(
    sender.tab
      ? "from a content script:" + sender.tab.url
      : "from the extension"
  );
  try {
    const response = await fetch('', {
      method: 'POST', cache: 'no-cache', headers: {'Content-Type': 'application/json'},
      body: { "test": 123}
    });
    // console.log('###text',await response.text())
    // console.log('###json',await response.json())
    return await response.json()
  } catch (err) {
    console.error('###err', err)
    return { 'error': 1, message: err}
  }
});



// Intervals for check
// chrome.runtime.onInstalled.addListener(() => {
//   console.log('installed')
//   chrome.identity.getAuthToken({interactive: true}, function(token) {
//     console.log('got the token', token);
//   })
// });
