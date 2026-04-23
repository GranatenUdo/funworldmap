import { describe, it, expect } from 'vitest'
import { sanitise } from '../sanitise'

describe('sanitise', () => {
  it('leaves plain text untouched', () => {
    expect(sanitise('Hello world')).toBe('Hello world')
  })
  it('strips HTML tags', () => {
    expect(sanitise('<p>Hello <strong>world</strong></p>')).toBe('Hello world')
  })
  it('handles nested tags', () => {
    expect(sanitise('<div><p>a <em>b</em> c</p></div>')).toBe('a b c')
  })
  it('decodes named HTML entities', () => {
    expect(sanitise('Cats &amp; dogs')).toBe('Cats & dogs')
    expect(sanitise('&quot;hi&quot;')).toBe('"hi"')
    expect(sanitise('&lt;tag&gt;')).toBe('<tag>')
    expect(sanitise('&apos;quote&apos;')).toBe("'quote'")
    expect(sanitise('&nbsp;')).toBe(' ')
  })
  it('decodes numeric HTML entities', () => {
    expect(sanitise('hello&#8217;s world')).toBe('hello\u2019s world')
  })
  it('decodes hex HTML entities', () => {
    expect(sanitise('hello&#x2019;s world')).toBe('hello\u2019s world')
  })
  it('collapses whitespace', () => {
    expect(sanitise('<p>  hello   world  </p>')).toBe('hello world')
  })
  it('returns empty string on nullish input', () => {
    expect(sanitise('')).toBe('')
  })
})
