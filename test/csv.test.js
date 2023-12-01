const csv = require('../lib/csv')

describe('FizzBuzz', () => {
  test('testing example', () => {
    const csvObj = new csv.CSV()
    const res = csvObj.parse()
    expect(res).toBe(1)
  })
})
