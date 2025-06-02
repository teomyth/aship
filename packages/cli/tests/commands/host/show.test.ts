import {describe, expect, it} from 'vitest'
import HostShow from '../../../src/commands/host/show.js'

describe('host show command', () => {
  it('has correct description and aliases', () => {
    expect(HostShow.description).toBe('Show detailed information about a host')
    expect(HostShow.aliases).toEqual(['host:info', 'host:get', 'host:describe'])
  })

  it('has correct args', () => {
    expect(HostShow.args.name).toBeDefined()
    expect(HostShow.args.name.description).toBe('Name of the host to show')
    expect(HostShow.args.name.required).toBe(false)
  })

  it('has all required flags', () => {
    expect(HostShow.flags.format).toBeDefined()
    expect(HostShow.flags.usage).toBeDefined()
    expect(HostShow.flags.interactive).toBeDefined()
    expect(HostShow.flags['relative-time']).toBeDefined()
  })

  it('has correct flag aliases', () => {
    expect(HostShow.flags.format.char).toBe('f')
    expect(HostShow.flags.usage.char).toBe('u')
    expect(HostShow.flags.interactive.char).toBe('i')
    expect(HostShow.flags['relative-time'].char).toBe('r')
  })

  it('has correct default values and options', () => {
    expect(HostShow.flags.format.default).toBe('table')
    expect(HostShow.flags.format.options).toEqual(['table', 'json'])
    expect(HostShow.flags.usage.default).toBe(false)
    expect(HostShow.flags.interactive.default).toBe(false)
    expect(HostShow.flags['relative-time'].default).toBe(false)
  })
})
