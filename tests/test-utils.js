// From glMatrix v4.
// https://github.com/toji/gl-matrix/tree/glmatrix-next
// Copyright 2022 Brandon Jones, Colin MacKenzie IV
import { expect } from 'vitest'

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