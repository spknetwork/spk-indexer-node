export class NotImplementedException extends Error {
  constructor(msg = '') {
    super(`Not implemented exception! ${msg}`)
  }
}
