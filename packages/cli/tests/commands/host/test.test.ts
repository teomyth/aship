import {describe, expect, it} from 'vitest'
import HostTest from '../../../src/commands/host/test.js'

describe('host test command', () => {
  it('has correct description and aliases', () => {
    expect(HostTest.description).toBe('Test connection to a host')
    expect(HostTest.aliases).toEqual(['host:ping', 'host:check', 'host:connect'])
  })

  it('has correct args', () => {
    expect(HostTest.args.name).toBeDefined()
    expect(HostTest.args.name.description).toBe('Name of the host to test')
    expect(HostTest.args.name.required).toBe(false)
  })

  it('has all required flags', () => {
    expect(HostTest.flags.timeout).toBeDefined()
    expect(HostTest.flags.verbose).toBeDefined()
    expect(HostTest.flags.all).toBeDefined()
    expect(HostTest.flags.interactive).toBeDefined()
    expect(HostTest.flags['update-usage']).toBeDefined()
  })

  it('has correct flag aliases', () => {
    expect(HostTest.flags.timeout.char).toBe('t')
    expect(HostTest.flags.verbose.char).toBe('v')
    expect(HostTest.flags.all.char).toBe('a')
    expect(HostTest.flags.interactive.char).toBe('i')
  })

  it('has correct default values', () => {
    expect(HostTest.flags.timeout.default).toBe(10)
    expect(HostTest.flags.verbose.default).toBe(false)
    expect(HostTest.flags.all.default).toBe(false)
    expect(HostTest.flags.interactive.default).toBe(false)
    expect(HostTest.flags['update-usage'].default).toBe(true)
  })
})
