import { describe, it, expect } from 'vitest'
import { isAuthorized, extractBearerToken } from './auth'

describe('isAuthorized', () => {
  const token = 'abc123-secret-token'

  it('accepts a matching token', () => {
    expect(isAuthorized(token, token)).toBe(true)
  })

  it('rejects a wrong token of equal length', () => {
    expect(isAuthorized('xbc123-secret-token', token)).toBe(false)
  })

  it('rejects a shorter token (length mismatch)', () => {
    expect(isAuthorized('abc123', token)).toBe(false)
  })

  it('rejects a longer token (length mismatch)', () => {
    expect(isAuthorized(token + 'extra', token)).toBe(false)
  })

  it('rejects undefined provided token', () => {
    expect(isAuthorized(undefined, token)).toBe(false)
  })

  it('rejects null provided token', () => {
    expect(isAuthorized(null, token)).toBe(false)
  })

  it('rejects empty string provided token', () => {
    expect(isAuthorized('', token)).toBe(false)
  })

  it('rejects when configured token is undefined', () => {
    expect(isAuthorized(token, undefined)).toBe(false)
  })
})

describe('extractBearerToken', () => {
  it('extracts the token from a Bearer header', () => {
    expect(extractBearerToken('Bearer my-token')).toBe('my-token')
  })

  it('returns undefined for a missing header', () => {
    expect(extractBearerToken(undefined)).toBeUndefined()
  })

  it('returns undefined for a malformed header', () => {
    expect(extractBearerToken('my-token')).toBeUndefined()
  })

  it('returns undefined for a non-Bearer scheme', () => {
    expect(extractBearerToken('Basic my-token')).toBeUndefined()
  })

  it('uses the first value when header is an array', () => {
    expect(extractBearerToken(['Bearer first', 'Bearer second'])).toBe('first')
  })
})
