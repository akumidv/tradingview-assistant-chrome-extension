/*
   Source code https://github.com/onyxfish/csvkit.js/blob/master/lib/csvkit.js
   // Examples https://github.com/onyxfish/csvkit.js/blob/master/test/object_reader.js
  // https://github.com/onyxfish/csvkit.js/blob/master/test/object_writer.js
 */
const CSV = class {
  constructor(options) {
    if (typeof options === 'undefined') {
      options = {}
    }
    this.separator = options.separator || ','
    this.quote_char = options.quote_char || '"'
    this.escape_char = options.escape_char || '"'
    // Reading
    this.column_names = options.column_names || []
    this.columns_from_header = 'columns_from_header' in options ? options.columns_from_header : true
    this.nested_quotes = 'nested_quotes' in options ? options.nested_quotes : false
    this.rows = []
    this.state = {
      rows: 0,
      open_record: [],
      open_field: '',
      last_char: '',
      in_quoted_field: false
    }
    // Writing
    this.quote_all = options.quote_all || false
    this.newline = '\n'
  }

  parse(data) {
    if (this.state.open_record.length === 0) {
      if (data.charCodeAt(0) === 0xFEFF) {
        data = data.slice(1)
      }
    }

    for (let i = 0; i < data.length; i++) {
      const c = data.charAt(i)
      let nextChar
      switch (c) {
        // escape and separator may be the same char, typically '"'
        case this.escape_char:
        case this.quote_char: {
          let isEscape = false

          if (c === this.escape_char) {
            nextChar = data.charAt(i + 1)

            if (this._is_escapable(nextChar)) {
              this._add_character(nextChar)
              i++
              isEscape = true
            }
          }
          if (!isEscape && (c === this.quote_char)) {
            if (this.state.open_field && !this.state.in_quoted_field) {
              this.state.in_quoted_field = true
              break
            }

            if (this.state.in_quoted_field) {
              // closing quote should be followed by separator unless the nested quotes option is set
              nextChar = data.charAt(i + 1)

              if (nextChar && nextChar !== '\r' && nextChar !== '\n' && nextChar !== this.separator && this.nested_quotes !== true) {
                throw new Error('separator expected after a closing quote; found ' + nextChar)
              } else {
                this.state.in_quoted_field = false
              }
            } else if (this.state.open_field === '') {
              this.state.in_quoted_field = true
            }
          }
          break
        }
        case this.separator: {
          if (this.state.in_quoted_field) {
            this._add_character(c)
          } else {
            this._add_field()
          }
          break
        }
        case '\n':
        case '\r':
          if (c === '\n' && (!this.state.in_quoted_field && (this.state.last_char === '\r'))) {
            break
          }
          if (this.state.in_quoted_field) {
            this._add_character(c)
          } else {
            this._add_field()
            this._add_record()
          }
          break
        default:
          this._add_character(c)
      }
      this.state.last_char = c
    }

    if (this.state.in_quoted_field) {
      throw new Error('Input stream ended but closing quotes expected')
    } else {
      if (this.state.open_field) {
        this._add_field()
      }

      if (this.state.open_record.length > 0) {
        this._add_record()
      }
    }
  }

  _is_escapable(c) {
    if ((c === this.escape_char) || (c === this.quote_char)) {
      return true
    }
    return false
  }

  _add_character(c) {
    this.state.open_field += c
  }

  _add_field() {
    console.log(typeof (this.state.open_field), this.state.open_field)
    // TODO parse types
    this.state.open_record.push(this.state.open_field)
    this.state.open_field = ''
    this.state.in_quoted_field = false
  }

  _add_record() {
    if (this.columns_from_header && this.state.rows === 0) {
      this.column_names = this.state.open_record
    } else {
      this.rows.push(this._serialize_record(this.state.open_record))
    }
    this.state.rows++
    this.state.open_record = []
    this.state.open_field = ''
    this.state.in_quoted_field = false
  }

  _serialize_record(record) {
    const obj = {}
    for (let i = 0; i < this.column_names.length; i++) {
      obj[this.column_names[i]] = record[i]
    }
    return obj
    // return record // List return
  }
}

if (typeof module !== 'undefined') {
  module.exports = {
    CSV
  }
}
