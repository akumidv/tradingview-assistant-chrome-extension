const csv = require('../../lib/csv')

const CSV_EXAMPLE = 'headerN,headerS,headerB\n1,"String",false\n4.23,string,true\n,"String\tval",'

describe('CSV read', () => {
  test('testing example', () => {
    const csvObj = new csv.CSV()
    csvObj.parse(CSV_EXAMPLE)
    console.log(csvObj.rows)
    expect(csvObj.column_names).toStrictEqual(['header1', 'header2', 'header3'])
    expect(csvObj.rows.length).toEqual(2)
    expect(csvObj.rows).toStrictEqual([{
     'header1': '1',
     'header2': '2',
     'header3': '3',
   },
   {
     'header1': '4',
     'header2': '5',
     'header3': '6',
   }])
  })
})
