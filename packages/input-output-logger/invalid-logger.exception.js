export default class InvalidLoggerException extends Error {
  constructor () {
    super('[input-output-logger-middleware]: logger must be a function')
    this.name = 'InvalidLoggerException'
  }
}
