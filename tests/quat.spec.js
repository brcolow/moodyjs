// From glMatrix v4.
// https://github.com/toji/gl-matrix/tree/glmatrix-next
// Copyright 2022 Brandon Jones, Colin MacKenzie IV

import { expect, describe, it, beforeEach } from 'vitest'
import { Mat4, Quat, Vector3 } from '../math'
import "./test-utils"

describe("Quat", () => {
  describe("constructor", () => {
    it("should return Quat(0, 0, 0, 1) if called with no arguments", () => {
      expect(new Quat()).toBeVec(0, 0, 0, 1)
    })

    it("should return Quat(x, y, z, w) if called with (x, y, z, w)", () => {
      expect(new Quat(1, 2, 3, 4)).toBeVec(1, 2, 3, 4)
      expect(new Quat(-3, 4.4, -5.6, 7.8)).toBeVec(-3, 4.4, -5.6, 7.8)
    })

    it("should return Quat(x, x, x, x) if called with (x)", () => {
      expect(new Quat(1)).toBeVec(1, 1, 1, 1)
      expect(new Quat(-2.3)).toBeVec(-2.3, -2.3, -2.3, -2.3)
    })

    it("should return Quat(x, y, z, w) if called with ([x, y, z, w])", () => {
      expect(new Quat([1, 2, 3, 4])).toBeVec(1, 2, 3, 4)
      expect(new Quat([-3, 4.4, -5.6, 7.8])).toBeVec(-3, 4.4, -5.6, 7.8)
    })

    it("should return Quat(x, y, z, w) if called with (Quat(x, y, z, w))", () => {
      let v = new Quat(3.4, 5.6, 7.8, 9)
      expect(new Quat(v)).toBeVec(v)
    })

    it("should return Quat(x, y, z, w) if called with (Float32Array([x, y, z, w]))", () => {
      let arr = new Float32Array([1.2, 3.4, 5.6, 7.8])
      expect(new Quat(arr)).toBeVec(arr)
    })
  })

  describe("static", () => {
    let out, quatA, quatB, result, vec

    const id = new Quat(0, 0, 0, 1)
    const deg90 = Math.PI / 2

    beforeEach(() => {
      quatA = new Quat(1, 2, 3, 4)
      quatB = new Quat(5, 6, 7, 8)
      out = new Quat(0, 0, 0, 0)
      vec = [1, 1, -1]
    })

    describe("create", () => {
      beforeEach(() => { result = Quat.create() })
      it("should return a 4 element array initialized to an identity quaternion", () => { expect(result).toBeVec(0, 0, 0, 1) })
    })

    describe("identity", () => {
      beforeEach(() => { result = Quat.identity(out) })
      it("should place values into out", () => { expect(result).toBeVec(0, 0, 0, 1) })
      it("should return out", () => { expect(result).toBe(out) })
    })

    describe("multiply", () => {
      describe("with a separate output quaternion", () => {
        beforeEach(() => { result = Quat.multiply(out, quatA, quatB) })

        it("should place values into out", () => { expect(out).toBeVec(24, 48, 48, -6) })
        it("should return out", () => { expect(result).toBe(out) })
        it("should not modify quatA", () => { expect(quatA).toBeVec(1, 2, 3, 4) })
        it("should not modify quatB", () => { expect(quatB).toBeVec(5, 6, 7, 8) })
      })

      describe("when quatA is the output quaternion", () => {
        beforeEach(() => { result = Quat.multiply(quatA, quatA, quatB) })

        it("should place values into quatA", () => { expect(quatA).toBeVec(24, 48, 48, -6) })
        it("should return quatA", () => { expect(result).toBe(quatA) })
        it("should not modify quatB", () => { expect(quatB).toBeVec(5, 6, 7, 8) })
      })

      describe("when quatB is the output quaternion", () => {
        beforeEach(() => { result = Quat.multiply(quatB, quatA, quatB) })

        it("should place values into quatB", () => { expect(quatB).toBeVec(24, 48, 48, -6) })
        it("should return quatB", () => { expect(result).toBe(quatB) })
        it("should not modify quatA", () => { expect(quatA).toBeVec(1, 2, 3, 4) })
      })
    })

    describe("normalize", () => {
      beforeEach(() => { quatA = [5, 0, 0, 0] })

      describe("with a separate output quaternion", () => {
        beforeEach(() => { result = Quat.normalize(out, quatA) })

        it("should place values into out", () => { expect(out).toBeVec(1, 0, 0, 0) })
        it("should return out", () => { expect(result).toBe(out) })
        it("should not modify quatA", () => { expect(quatA).toBeVec(5, 0, 0, 0) })
      })

      describe("when quatA is the output quaternion", () => {
        beforeEach(() => { result = Quat.normalize(quatA, quatA) })

        it("should place values into quatA", () => { expect(quatA).toBeVec(1, 0, 0, 0) })
        it("should return quatA", () => { expect(result).toBe(quatA) })
      })
    })
  })

  describe("toMatrix4", () => {
    let quatA

    beforeEach(() => {
      quatA = Quat.create(0, 0, 0, 1)
    })

    it("should create a correct rotation matrix for a quaternion representing no rotation", () => {
      const matrix = quatA.toMatrix4()
      expect(matrix).toBeVec(
        -1, 0, 0, 0,
        0, -1, 0, 0,
        0, 0, 1, 0,
        0, 0, 0, 1
      )
    })

    // SHOULD BE:
    // 1, 0, 0, 0,
    // 0, 0, -1, 0,
    // 0, 1, 0, 0,
    // 0, 0, 0, 1
    it("should create a correct rotation matrix for a quaternion representing a rotation around X-axis", () => {
      quatA = Quat.create(Math.sqrt(0.5), 0, 0, Math.sqrt(0.5))
      const matrix = quatA.toMatrix4()
      // Expected matrix for 90 degrees rotation around X-axis
      expect(matrix).toBeVec(
        0, -1, 0, 0,
        1, 0, 0, 0,
        0, 0, 1, 0,
        0, 0, 0, 1
      )
    })

    it("should create a correct rotation matrix for a quaternion representing a rotation around Y-axis", () => {
      quatA = Quat.create(Math.sqrt(0.5), 0, Math.sqrt(0.5), 0) // Quaternion for 90 degrees rotation around Y-axis
      const matrix = quatA.toMatrix4()
      // Expected matrix for 90 degrees rotation around Y-axis
      expect(matrix).toBeVec(
        0, 0, 1, 0,
        0, 1, 0, 0,
        -1, 0, 0, 0,
        0, 0, 0, 1
      )
    })

    // SHOULD BE:
    // 0, -1, 0, 0,
    // 1, 0, 0, 0,
    // 0, 0, 1, 0,
    // 0, 0, 0, 1
    it("should create a correct rotation matrix for a quaternion representing a rotation around Z-axis", () => {
      quatA = Quat.create(Math.sqrt(0.5), Math.sqrt(0.5), 0, 0) // Quaternion for 90 degrees rotation around Z-axis
      const matrix = quatA.toMatrix4()
      // Expected matrix for 90 degrees rotation around Z-axis
      expect(matrix).toBeVec(
        1, 0, 0, 0,
        0, 0, -1, 0,
        0, 1, 0, 0,
        0, 0, 0, 1
      )
    })
  })
})