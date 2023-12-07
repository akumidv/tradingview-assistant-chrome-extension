const csv = require('../../lib/csv')

const CSV_EXAMPLE = 'headerN,headerS,headerB\n1,"String",false\n4.23,"",\n,"String\tval",'
const OBJ_RECORDS_EXAMPLE = [
  {
    headerN: 1, headerS: 'String', headerB: false
  }, {
    headerN: 4.23, headerS: '', headerB: null
  }, {
    headerN: null, headerS: 'String\tval', headerB: null
  }]
const OBJ_ROW_EXAMPLE = [[1, 'String', false], [4.23, '', null], [null, 'String\tval', null]]

describe('CSV', () => {
  test('read testing example as recoreds', () => {
    const csvObj = new csv.CSV()
    csvObj.parseRecords(CSV_EXAMPLE)
    console.log(csvObj.rows)
    expect(csvObj.column_names).toStrictEqual(['headerN', 'headerS', 'headerB'])
    expect(csvObj.rows.length).toEqual(3)
    expect(csvObj.rows).toStrictEqual(OBJ_RECORDS_EXAMPLE)
  })

  test('read testing example as row', () => {
    const csvObj = new csv.CSV()
    csvObj.parseRows(CSV_EXAMPLE)
    console.log(csvObj.rows)
    expect(csvObj.column_names).toStrictEqual(['headerN', 'headerS', 'headerB'])
    expect(csvObj.rows.length).toEqual(3)
    expect(csvObj.rows).toStrictEqual(OBJ_ROW_EXAMPLE)
  })

  test('write testing example', () => {
    const csvObj = new csv.CSV()
    const csvTxt = csvObj.toRecords(OBJ_RECORDS_EXAMPLE)
    console.log(csvTxt)
    // expect(csvObj.column_names).toStrictEqual(['headerN', 'headerS', 'headerB'])
    // expect(csvObj.rows.length).toEqual(3)
    // expect(csvObj.rows).toStrictEqual([
    //   {
    //     headerN: 1, headerS: 'String', headerB: false
    //   }, {
    //     headerN: 4.23, headerS: '', headerB: null
    //   }, {
    //     headerN: null, headerS: 'String\tval', headerB: null
    //   }])
  })
})
