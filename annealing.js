const MAX_PARAM_NAME = 'test'
function randomInteger (min = 0, max = 10) {
  return Math.floor( min + Math.random() * (max + 1 - min))
}

function randomNormalDistribution(min, max) {
  let u = 0, v = 0;
  while(u === 0) u = Math.random(); //Converting [0,1) to (0,1)
  while(v === 0) v = Math.random();
  let num = Math.sqrt( -2.0 * Math.log( u ) ) * Math.cos( 2.0 * Math.PI * v );
  num = num / 10.0 + 0.5; // Translate to 0 -> 1
  if (num > 1 || num < 0) return randomNormalDistribution() // resample between 0 and 1
  else{
    num *= max - min // Stretch to fill range
    num += min // offset to min
  }
  return num
}


async function optAnnealingIteration(allRangeParams, testResults, bestValue, optimizationState) {
  const initTemp = 1// TODO to param? Find teh best match?
  const sign = optimizationState.hasOwnProperty('sign') && typeof optimizationState.sign === 'number' ? optimizationState.sign : 1
  if (!optimizationState.isInit) {
    optimizationState.currentTemp = initTemp

    const propVal = optAnnealingNewState(allRangeParams) // Random value
    optimizationState.lastState = propVal

    // const res = await getTestIterationResult(testResults, optimizationState.lastState)
    const res = await optAnnealingGetEnergy(testResults, optimizationState.lastState)
    if(!res || !res.data)
      return res
    // console.log('Init', res.data[MAX_PARAM_NAME], propVal)

    optimizationState.lastEnergy = res.data[MAX_PARAM_NAME]
    optimizationState.bestState = optimizationState.lastState;
    optimizationState.bestEnergy = optimizationState.lastEnergy;
    optimizationState.isInit = true
  }
  const iteration = testResults.perfomanceSummary.length

  const propVal = optAnnealingNewState(allRangeParams, optimizationState.currentTemp, optimizationState.lastState)
  const currentState = propVal
  // const res = await getTestIterationResult(testResults, currentState)
  const res = await optAnnealingGetEnergy(testResults, currentState)
  if(!res || !res.data)
    return res
  // console.log('         ITER', testResults.perfomanceSummary.length, 'RES', res.data[MAX_PARAM_NAME], optimizationState.bestEnergy, optimizationState.currentTemp)

  if(res.data.hasOwnProperty(MAX_PARAM_NAME)) {
    const currentEnergy = res.data[MAX_PARAM_NAME]
    res.currentValue = currentEnergy
    if (sign > 0 ? currentEnergy < optimizationState.lastEnergy : currentEnergy > optimizationState.lastEnergy) {
      optimizationState.lastState = currentState;
      optimizationState.lastEnergy = currentEnergy;
    } else {
      const randVal = Math.random()
      const expVal = Math.exp(-(currentEnergy - optimizationState.lastEnergy)/optimizationState.currentTemp) // Math.exp(-10) ~0,000045,  Math.exp(-1) 0.3678 Math.exp(0); => 1
      if (randVal <= expVal) {
        optimizationState.lastState = currentState;
        optimizationState.lastEnergy = currentEnergy;
      }
    }

    if (sign > 0 ? optimizationState.lastEnergy < optimizationState.bestEnergy : optimizationState.lastEnergy > optimizationState.bestEnergy ) {
      // console.log('!!!Found best better then last', optimizationState.lastEnergy, optimizationState.bestEnergy)
      optimizationState.bestState = optimizationState.lastState;
      optimizationState.bestEnergy = optimizationState.lastEnergy;
    }
    // optimizationState.currentTemp = optAnnealingGetTemp(optimizationState.currentTemp, testResults.cycles);
    // optimizationState.currentTemp = optAnnealingGetBoltzmannTemp(initTemp, iteration);
    optimizationState.currentTemp = optAnnealingGetExpTemp(initTemp, iteration, Object.keys(allRangeParams).length);

    res.bestValue = optimizationState.bestEnergy
  } else {
    res.bestValue = bestValue
    res.currentValue = 'error'
  }
  // console.log(optimizationState)
  // console.log(res)
  return res
}

function optAnnealingGetTemp(prevTemperature, cylces) {
  return prevTemperature * 1-1/cylces;
}

function optAnnealingGetBoltzmannTemp(initTemperature, iter) {
  return iter === 1 ? 1 : initTemperature/Math.log(1 + iter);
}

function optAnnealingGetExpTemp(initTemperature, iter, dimensionSize) {
  return initTemperature/Math.pow(iter, 1 / dimensionSize);
}


function optAnnealingNewState(allRangeParams, temperature, curState) {
  const res = {}
  if(!curState){ // || randomInteger(0,1)) {  // for more variable search
    Object.keys(allRangeParams).forEach(paramName => {
      res[paramName] = allRangeParams[paramName][randomInteger(0, allRangeParams[paramName].length - 1)]
    })
  } else {
    Object.keys(allRangeParams).forEach(paramName => {
      const curIndex = allRangeParams[paramName].indexOf(curState[paramName])
      const sign = randomInteger(0,1) === 0 ? -1 : 1
      // Is not proportional chances for edges of array
      // const offset = sign * Math.floor(temperature * randomNormalDistribution(0, (allRangeParams[paramName].length - 1)))
      // const newIndex = curIndex + offset > allRangeParams[paramName].length - 1 ? allRangeParams[paramName].length - 1 : // TODO +/-
      //   curIndex + offset < 0 ? 0 : curIndex + offset
      // res[paramName] = allRangeParams[paramName][newIndex]

      const baseOffset = Math.floor(temperature * randomNormalDistribution(0, (allRangeParams[paramName].length - 1)))
      const offsetIndex = (curIndex + sign*baseOffset) % (allRangeParams[paramName].length)
      const newIndex2 = offsetIndex >= 0 ?offsetIndex : allRangeParams[paramName].length + offsetIndex
      res[paramName] = allRangeParams[paramName][newIndex2]
    })
  }
  return res
}

async function optAnnealingGetEnergy(testResults, propVal) { // TODO 2del
  const allDimensionVal = Object.keys(propVal).map(name => Math.abs(propVal[name] * propVal[name] - 16))
  testResults.perfomanceSummary.push(allDimensionVal)
  const resData = {}
  resData[MAX_PARAM_NAME] = allDimensionVal.reduce((sum, item) => item + sum, 0)
  return {error: 0, data: resData};
}

async function testStrategy(testResults, strategyData, allRangeParams, method = 'random') {
  testResults.perfomanceSummary = []
  testResults.shortName = strategyData.name
  testResults.paramsNames = Object.keys(allRangeParams)
  let bestValue = null
  const optimizationState = {sign: 1}
  let bestFoundIter = testResults.cycles
  for(let i = 0; i < testResults.cycles; i++) {
    let optRes = {}
    switch(method) {
      case 'annealing':
        optRes = await optAnnealingIteration(allRangeParams, testResults, bestValue, optimizationState)
        break
      case 'random':
      default:
        optRes = await optRandomIteration(allRangeParams, testResults, bestValue, optimizationState)
    }
    if(!optRes.hasOwnProperty('data'))
      continue
    bestValue = optRes.hasOwnProperty('bestValue') ? optRes.bestValue : bestValue
    // console.log(bestValue, Object.keys(allRangeParams).length * Math.abs( 9 * 9 - 16))
    if(optimizationState.sign >= 0 ? bestValue === 0 : bestValue === Object.keys(allRangeParams).length * 65) { // TODO 2 del
      bestFoundIter = i
      break
    }

  }
  console.log(optimizationState.bestState)
  testResults.bestValue = bestValue
  testResults.bestFoundIter = bestFoundIter
  return testResults
}


(async () => {
  const allRangeParams = {}

  const res = []
  for(let i = 0; i < 10; i++) {
    allRangeParams[`dim${i+1}`] = [0,1,2,3,4,5,6,7,8,9]
    let sum = 0
    let sumRes = 0
    for(let j = 0; j < 10; j++) {
      const testResults = await testStrategy({cycles: Math.pow(4, i) + 200}, {name: 'test'}, allRangeParams, `annealing`)
      sum += testResults.bestFoundIter
      sumRes += testResults.bestValue
    }
    res.push(`dim ${i+1}, avg: ${sum/10}, res: ${sumRes/10}`)
    // console.log('din', i, 'avg', sum)
  }
  console.log(res)

  // for(let i = 0; i < 100; i++) {
  //   console.log(randomInteger(0,1))
    // console.log(randomNormalDistribution(-10,9))
  // }

})()

  // [optAnnealingGetExpTemp  Is not proportional chances for edges of array +
  // 'dim 0, avg: 42.5',
  //   'dim 1, avg: 58.5',
  //   'dim 2, avg: 66.3',
  //   'dim 3, avg: 217.2',
  //   'dim 4, avg: 451.1',
  //   'dim 5, avg: 1224.0',
  //   'dim 6, avg: 4296.0',
  //   'dim 7, avg: 16584.0',
  //   'dim 8, avg: 65736.0',
  //   'dim 9, avg: 262344.0'
  // ]

  // [ optAnnealingGetExpTemp
  // 'dim 1, avg: 101.1',
  //   'dim 2, avg: 38',
  //   'dim 3, avg: 77.5',
  //   'dim 4, avg: 242.8',
  //   'dim 5, avg: 456',
  //   'dim 6, avg: 1200.1',
  //   'dim 7, avg: 4296',
  //   'dim 8, avg: 16584',
  //   'dim 9, avg: 65736',
  //   'dim 10, avg: 262344'
  // ]

//sign -1 optAnnealingGetExpTemp  Is not proportional chances for edges of array +
//   [
//   'dim 1, avg: 160.8, res: 35.7',
//     'dim 2, avg: 147.1, res: 85.8',
//     'dim 3, avg: 163.4, res: 156.5',
//     'dim 4, avg: 264, res: 202.4',
//     'dim 5, avg: 456, res: 242.4',
//     'dim 6, avg: 1224, res: 314.8',
//     'dim 7, avg: 4296, res: 365.9',
//     'dim 8, avg: 16584, res: 421.5',
//     'dim 9, avg: 65736, res: 485.7',
//     'dim 10, avg: 262344, res: 539.2'
//   ]

  // [ s0gn -1 optAnnealingGetExpTemp
  // 'dim 1, avg: 80.6, res: 50.3',
  //   'dim 2, avg: 164.3, res: 93.3',
  //   'dim 3, avg: 216, res: 154.7',
  //   'dim 4, avg: 254.1, res: 216.9',
  //   'dim 5, avg: 446.4, res: 262.8',
  //   'dim 6, avg: 1224, res: 310.8',
  //   'dim 7, avg: 4296, res: 369.9',
  //   'dim 8, avg: 16584, res: 425.4',
  //   'dim 9, avg: 65736, res: 479.3',
  //   'dim 10, avg: 262344, res: 534.6'
  // ]

  // [rand 0,1' sign -1 optAnnealingGetExpTemp  Is not proportional chances for edges of array +
  // 'dim 1, avg: 26.7, res: 65',
  //   'dim 2, avg: 93.6, res: 128.3',
  //   'dim 3, avg: 181.8, res: 161.5',
  //   'dim 4, avg: 264, res: 218',
  //   'dim 5, avg: 456, res: 244.7',
  //   'dim 6, avg: 1214.8, res: 321.4',
  //   'dim 7, avg: 4296, res: 370.5',
  //   'dim 8, avg: 16584, res: 433.9',
  //   'dim 9, avg: 65736, res: 473.4',
  //   'dim 10, avg: 262344, res: 538.9'
  // ]

// [rand 0,1' sign -1 optAnnealingGetExpTemp
//   [
//   'dim 1, avg: 10.4, res: 65',
//     'dim 2, avg: 120.8, res: 123.4',
//     'dim 3, avg: 180.3, res: 173.7',
//     'dim 4, avg: 264, res: 203.9',
//     'dim 5, avg: 456, res: 260.7',
//     'dim 6, avg: 1224, res: 317.6',
//     'dim 7, avg: 4296, res: 365',
//     'dim 8, avg: 16584, res: 426.2',
//     'dim 9, avg: 65736, res: 486.2',
//     'dim 10, avg: 262344, res: 546.7'


////////////////////////////////////////////
//optAnnealingGetBoltzmannTemp  Is not proportional chances for edges of array +
//   [
//   'dim 1, avg: 7.5',
//     'dim 2, avg: 49.8',
//     'dim 3, avg: 67',
//     'dim 4, avg: 113',
//     'dim 5, avg: 150.7',
//     'dim 6, avg: 193.1',
//     'dim 7, avg: 213.7',
//     'dim 8, avg: 264.8',
//     'dim 9, avg: 245.2',
//     'dim 10, avg: 52676.5'
//   ]


  // [ optAnnealingGetBoltzmannTemp
  // 'dim 1, avg: 4.3',
  //   'dim 2, avg: 39',
  //   'dim 3, avg: 70.1',
  //   'dim 4, avg: 122.4',
  //   'dim 5, avg: 141.2',
  //   'dim 6, avg: 185.1',
  //   'dim 7, avg: 215.7',
  //   'dim 8, avg: 271.7',
  //   'dim 9, avg: 265.4',
  //   'dim 10, avg: 385.4'
  // ]

//[ sign -1 optAnnealingGetBoltzmannTemp  Is not proportional chances for edges of array +
//   'dim 1, avg: 100.6, res: 47.7',
//   'dim 2, avg: 185.4, res: 91.7',
//   'dim 3, avg: 204.7, res: 146.6',
//   'dim 4, avg: 258.5, res: 205',
//   'dim 5, avg: 456, res: 262.7',
//   'dim 6, avg: 1224, res: 306.1',
//   'dim 7, avg: 4296, res: 368.7',
//   'dim 8, avg: 16584, res: 418.7',
//   'dim 9, avg: 65736, res: 479',
//   'dim 10, avg: 262344, res: 546.6'
// ]

// [ optAnnealingGetBoltzmannTemp
//   'dim 1, avg: 100.7, res: 48.9',
//   'dim 2, avg: 165.8, res: 98.2',
//   'dim 3, avg: 207.4, res: 153.2',
//   'dim 4, avg: 252.6, res: 213.3',
//   'dim 5, avg: 456, res: 255.7',
//   'dim 6, avg: 1224, res: 316.5',
//   'dim 7, avg: 4296, res: 370',
//   'dim 8, avg: 16584, res: 420.6',
//   'dim 9, avg: 65736, res: 477.8',
//   'dim 10, avg: 262344, res: 534.7'
// ]


// [ sign -1 optAnnealingGetBoltzmannTemp  Is not proportional chances for edges of array +
//   [
//   'dim 1, avg: 59.8, res: 58.8',
//     'dim 2, avg: 142.7, res: 112.6',
//     'dim 3, avg: 184.6, res: 147.2',
//     'dim 4, avg: 264, res: 195.1',
//     'dim 5, avg: 456, res: 203',
//     'dim 6, avg: 1224, res: 275.8',
//     'dim 7, avg: 4296, res: 316.2',
//     'dim 8, avg: 16584, res: 338.3',
//     'dim 9, avg: 65736, res: 348.6',
//     'dim 10, avg: 262344, res: 379.1'
//   ]

// [ sign -1 optAnnealingGetBoltzmannTemp
// [
// 'dim 1, avg: 9.9, res: 65',
//   'dim 2, avg: 89.4, res: 122.1',
//   'dim 3, avg: 197.1, res: 158.8',
//   'dim 4, avg: 264, res: 195.8',
//   'dim 5, avg: 456, res: 233.8',
//   'dim 6, avg: 1224, res: 266.5',
//   'dim 7, avg: 4296, res: 308.1',
//   'dim 8, avg: 16584, res: 349.1',
//   'dim 9, avg: 65736, res: 352.8',
//   'dim 10, avg: 262344, res: 413.5'
// ]

////////////////////////////////////////////
  // [ optAnnealingGetTemp  Is not proportional chances for edges of array +
  // 'dim 1, avg: 26.3',
  //   'dim 2, avg: 133.7',
  //   'dim 3, avg: 190.7',
  //   'dim 4, avg: 248.6',
  //   'dim 5, avg: 413.2',
  //   'dim 6, avg: 1034.8',
  //   'dim 7, avg: 3533.8',
  //   'dim 8, avg: 13044.5',
  //   'dim 9, avg: 51334.3',
  //   'dim 10, avg: 203294.8'
  // ]

//[ optAnnealingGetTemp
//   'dim 1, avg: 64.3',
//   'dim 2, avg: 148.1',
//   'dim 3, avg: 188.6',
//   'dim 4, avg: 230.9',
//   'dim 5, avg: 392.2',
//   'dim 6, avg: 1068.3',
//   'dim 7, avg: 3436.7',
//   'dim 8, avg: 13014.3',
//   'dim 9, avg: 51555.6',
//   'dim 10, avg: 202979.7'
// ]

// [ sign -1 optAnnealingGetTemp  Is not proportional chances for edges of array +
// 'dim 1, avg: 4.7',
//   'dim 2, avg: 19.9',
//   'dim 3, avg: 79',
//   'dim 4, avg: 199.3',
//   'dim 5, avg: 427.3',
//   'dim 6, avg: 1224',
//   'dim 7, avg: 4296',
//   'dim 8, avg: 16584',
//   'dim 9, avg: 59555.9',
//   'dim 10, avg: 262344'
// ]
  // [ sign -1 optAnnealingGetTemp
  // 'dim 1, avg: 4.3',
  //   'dim 2, avg: 100.3',
  //   'dim 3, avg: 191.3',
  //   'dim 4, avg: 264',
  //   'dim 5, avg: 456',
  //   'dim 6, avg: 1224',
  //   'dim 7, avg: 4296',
  //   'dim 8, avg: 16584',
  //   'dim 9, avg: 65736',
  //   'dim 10, avg: 262344'
  // ]
