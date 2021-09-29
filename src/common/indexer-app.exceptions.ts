export class DataCorruptedException extends Error {
  constructor(msg = '') {
    super(`Corrupted data detected! ${msg}`)
  }
}

export class NotFoundException extends Error {
  constructor(msg = '') {
    super(`Data not found! ${msg}`)
  }
}

export class NotImplementedException extends Error {
  constructor(msg = '') {
    super(`Not implemented exception! ${msg}`)
  }
}
