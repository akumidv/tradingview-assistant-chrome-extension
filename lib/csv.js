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
    this.isResultRecords = true
    this.column_names = options.column_names || []
    this.columns_from_header = 'columns_from_header' in options ? options.columns_from_header : true
    this.nested_quotes = 'nested_quotes' in options ? options.nested_quotes : false
    // this.rows = []
    // this.state = {
    //   rows: 0,
    //   open_record: [],
    //   open_field: '',
    //   last_char: '',
    //   in_quoted_field: false
    // }
    // Writing
    this.quote_all = options.quote_all || false
    this.newline = '\r\n'
  }

  parseRows(data) {
    this.isResultRecords = false
    this.parseRecords(data)
  }

  parseRecords(data) {
    this.rows = []
    this.state = {
      rows: 0,
      open_record: [],
      open_field: '',
      last_char: '',
      in_quoted_field: false
    }

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
      throw new Error('CSV row contain field with opening quote, but ending quote is missed')
    } else {
      // if (this.state.open_field) { // Otherwise - last cell without value will be undefined
      this._add_field()
      if (this.state.open_record.length > 0) {
        this._add_record()
      }
    }
  }

  _is_escapable(c) {
    return (c === this.escape_char) || (c === this.quote_char)
  }

  _add_character(c) {
    this.state.open_field += c
  }

  _add_field() {
    this.state.open_record.push(this._parseValue())
    this.state.open_field = ''
    this.state.in_quoted_field = false
  }

  _parseValue() {
    console.log(typeof (this.state.open_field), this.state.open_field, this.state.in_quoted_field)
    const integerNumberRegExp = /^\s*([+-]?\d+)\s*$/
    const floatingNumberRegExp = /^\s*([+-]?\d*\.\d*)\s*$/
    const value = this.state.open_field
    if (typeof (value) !== 'string') {
      return null
    }
    if (!this.state.in_quoted_field) {
      if (value === '') {
        return null
      }
      if (value === '"') {
        return ''
      }
      if (value === 'true') {
        return true
      } else if (value === 'false') {
        return false
      }
      let numVal = value.match(integerNumberRegExp)
      if (numVal) {
        return parseInt(numVal[1])
      }
      numVal = value.match(floatingNumberRegExp)
      if (numVal) {
        return parseFloat(numVal[1])
      }
    }
    return value
  }

  _add_record() {
    if (this.columns_from_header && this.state.rows === 0) {
      this.column_names = this.state.open_record
    } else {
      this.rows.push(this._serialize_csv_record(this.state.open_record))
    }
    this.state.rows++
    this.state.open_record = []
    this.state.open_field = ''
    this.state.in_quoted_field = false
  }

  _serialize_csv_record(record) {
    if (this.isResultRecords) {
      const obj = {}
      for (let i = 0; i < this.column_names.length; i++) {
        obj[this.column_names[i]] = record[i]
      }
      return obj
    }
    return record // List return
  }

  toRows(rows) {
    // [[0,1,2,3], [0,1,2,3]]
    if (this.column_names.length === 0) {
      throw new Error('Can not get headers from rows, set them in options')
    }
    console.log(this.column_names)
    console.log(rows)
    const header = {}

    for (let i = 0; i < this.column_names.length; i++) {
      header[this.column_names[i]] = this.column_names[i]
    }
    const formattedRows = [header]
    for (let i = 0; i < rows.length; i++) {
      formattedRows.push(this._serialize_row(rows[i]))
    }
    return formattedRows.join(this.newline)
  }

  toRecords(records) {
    // [{a: 1, b:2}, {a:2, b:3}]
    if (this.columns_from_header && this.column_names.length === 0) {
      this.column_names = Object.keys(records[0])
    }
    if (this.column_names.length === 0) {
      throw new Error('Can not get headers from option for object')
    }
    console.log(this.column_names)
    console.log(records)
    const formattedRows = []
    for (let i = 0; i < records.length; i++) {
      formattedRows.push(this._serialize_records(records[i]))
    }
    return formattedRows.join(this.newline)
  }

  _serialize_records(record) {
    const formattedCells = []
    for (const header of this.column_names) {
      const value = this._serialize_cell(record[header])
      formattedCells.push(value === 'null' ? '' : value)
    }
    return formattedCells.join(this.separator)
  }

  _serialize_row(row) {
    const formattedCells = []
    for (let i = 0; i < row.length; i++) {
      formattedCells.push(this._serialize_cell(row[i]))
    }
    return formattedCells.join(this.separator)
  }

  _serialize_cell(cell) {
    // console.log(cell)
    // // TODO by volume type
    // if (typeof cell === 'string') {
    //   if (cell.indexOf(this.quote_char) >= 0) {
    //     cell = cell.replace(new RegExp(this.quote_char, 'g'), this.escape_char + this.quote_char)
    //   }
    //   if (this.quote_all || cell.indexOf(this.separator) >= 0 || cell.indexOf(this.newline) >= 0) {
    //     return this.quote_char + cell + this.quote_char
    //   }
    // }
    return typeof (cell) === 'undefined' ? null : JSON.stringify(cell)
  }
}

if (typeof module !== 'undefined') {
  module.exports = {
    CSV
  }
}
