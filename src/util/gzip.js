'use strict'

const zlib = require('zlib')

class Gzip {
  /**
   * Inverso do `unzip`: gzip do texto em UTF-8, em base64.
   *
   * @param {string} str
   * @returns {Promise<string>}
   */
  static zip(str) {
    return new Promise((resolve, reject) => {
      zlib.gzip(Buffer.from(str, 'utf8'), function (err, buffer) {
        if (err) return reject(err)
        resolve(buffer.toString('base64'))
      })
    })
  }

  /**
   *
   * @param {string} str
   * @returns {Promise<string>}
   */
  static unzip(str) {
    const buf = Buffer.from(str, 'base64')
    return new Promise((resolve, reject) => {
      zlib.unzip(buf, function (err, buffer) {
        if (err) return reject(err)
        const content = buffer.toString('utf8')
        resolve(content)
      })
    })
  }
}

module.exports = Object.freeze(Gzip)
