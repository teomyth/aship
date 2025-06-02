import {describe, expect, it} from 'vitest'
import HostList from '../../../src/commands/host/list.js'

describe('host list command', () => {
  it('has correct description and aliases', () => {
    expect(HostList.description).toBe('List all configured hosts')
    expect(HostList.aliases).toEqual(['host:ls', 'hosts'])
  })

  it('has all required flags', () => {
    expect(HostList.flags.usage).toBeDefined()
    expect(HostList.flags.source).toBeDefined()
    expect(HostList.flags.format).toBeDefined()
    expect(HostList.flags.verbose).toBeDefined()
    expect(HostList.flags.quiet).toBeDefined()
    expect(HostList.flags['relative-time']).toBeDefined()
  })

  it('has correct flag aliases', () => {
    expect(HostList.flags.usage.char).toBe('u')
    expect(HostList.flags.source.char).toBe('s')
    expect(HostList.flags.format.char).toBe('f')
    expect(HostList.flags.verbose.char).toBe('v')
    expect(HostList.flags.quiet.char).toBe('q')
    expect(HostList.flags['relative-time'].char).toBe('r')
  })

  it('has correct default values and options', () => {
    expect(HostList.flags.format.default).toBe('table')
    expect(HostList.flags.format.options).toEqual(['table', 'json'])
    expect(HostList.flags.source.options).toEqual(['manual', 'ssh_config', 'imported'])
  })

  it('has examples with aliases', () => {
    expect(HostList.examples).toBeDefined()
    expect(HostList.examples.length).toBeGreaterThan(0)
    const examplesText = HostList.examples.join(' ')
    expect(examplesText).toContain('host ls')
    expect(examplesText).toContain('hosts -u')
  })
})
