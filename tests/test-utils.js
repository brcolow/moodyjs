import { expect } from 'vitest'

// From glMatrix v4.
// https://github.com/toji/gl-matrix/tree/glmatrix-next
// Copyright 2022 Brandon Jones, Colin MacKenzie IV
const EPSILON = 0.00001
expect.extend({
  toBeVec(received, ...expected) {
    let values
    if (expected[0] instanceof Float32Array) {
      values = expected[0]
    } else {
      values = expected
    }
    if (received.length != values.length) {
      return ({
        pass: false,
        message: () => `Expected (${received}) and (${values}) to have the same length. (${received.length} != ${values.length})`
      })
    }
    for (let i = 0; i < values.length; ++i) {
      if (Math.abs(received[i] - values[i]) >= EPSILON) {
        return ({
          pass: false,
          message: () => `Expected (${received}) to be (${values}), but value[${i}] is not within tolerance. (${received[i]} != ${values[i]})`
        })
      }
    }

    return ({
      pass: true,
      message: () => `Expected (${received}) to be (${values}).`
    })
  },
})

expect.extend({
  toBeCloseToArray(received, expected, precision = 2, multiplier = 1) {
    if (!Array.isArray(received) || !Array.isArray(expected)) {
      return {
        pass: false,
        message: () =>
          `Expected both values to be arrays, but got ${typeof received} and ${typeof expected}`,
      }
    }

    if (received.length !== expected.length) {
      return {
        pass: false,
        message: () =>
          `Array lengths differ: expected ${expected.length}, received ${received.length}`,
      }
    }

    for (let i = 0; i < received.length; i++) {
      const actual = received[i] * multiplier
      const exp = expected[i]
      const pass = Math.abs(actual - exp) < Math.pow(10, -precision) + Number.EPSILON

      if (!pass) {
        return {
          pass: false,
          message: () =>
            `Element at index ${i} differs:\n` +
            `  Expected:  ${exp}\n` +
            `  Received:  ${received[i]} * ${multiplier} = ${actual}\n` +
            `  Precision: ${precision} decimal places`,
        }
      }
    }

    return {
      pass: true,
      message: () =>
        `Arrays are approximately equal to ${precision} decimal places (with multiplier ${multiplier})`,
    }
  },
})