// One console prefix for every extension log, so a user can filter the console and attach it to a GitHub issue.
// Per-iteration detail goes to debug: hidden by default, shown with the DevTools "Verbose" level.
const LOG_PREFIX = '[tv-assistant]'

const log = {
  debug: (...args) => console.debug(LOG_PREFIX, ...args),
  info: (...args) => console.log(LOG_PREFIX, ...args),
  warn: (...args) => console.warn(LOG_PREFIX, ...args),
  error: (...args) => console.error(LOG_PREFIX, ...args),
}

// A TradingView page element the extension relies on is missing: most likely TradingView changed its UI.
// The top-level handler shows the GitHub issue instructions for it.
class UiChangedError extends Error {
  constructor (message) {
    super(message)
    this.name = 'UiChangedError'
  }
}

// An expected condition the user resolves (add a strategy, fix parameters, load data): shown without the issue block.
class UserActionError extends Error {
  constructor (message) {
    super(message)
    this.name = 'UserActionError'
  }
}
