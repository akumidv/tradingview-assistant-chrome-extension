const CSV = class {
  constructor (options) {
    this.options = options
  }

  parse (data) {
    console.log('####')
    return 1
  }
}

if (typeof module !== 'undefined') {
  module.exports = { CSV }
}
