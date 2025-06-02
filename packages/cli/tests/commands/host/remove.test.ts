import {describe, expect, it} from 'vitest'
import HostRemove from '../../../src/commands/host/remove.js'

describe('host remove command', () => {
  it('has correct description and aliases', () => {
    expect(HostRemove.description).toBe('Remove a host from Aship')
    expect(HostRemove.aliases).toEqual(['host:rm', 'host:delete', 'host:del'])
  })

  it('has correct args', () => {
    expect(HostRemove.args.name).toBeDefined()
    expect(HostRemove.args.name.description).toBe('Name of the host to remove')
    expect(HostRemove.args.name.required).toBe(false)
  })

  it('has all required flags', () => {
    expect(HostRemove.flags.force).toBeDefined()
    expect(HostRemove.flags.interactive).toBeDefined()
    expect(HostRemove.flags['keep-usage']).toBeDefined()
  })

  it('has correct flag aliases', () => {
    expect(HostRemove.flags.force.char).toBe('f')
    expect(HostRemove.flags.interactive.char).toBe('i')
  })

  it('has correct default values', () => {
    expect(HostRemove.flags.force.default).toBe(false)
    expect(HostRemove.flags.interactive.default).toBe(false)
    expect(HostRemove.flags['keep-usage'].default).toBe(false)
  })

  it('has examples with aliases', () => {
    expect(HostRemove.examples).toBeDefined()
    expect(HostRemove.examples.length).toBeGreaterThan(0)
    const examplesText = HostRemove.examples.join(' ')
    expect(examplesText).toContain('host rm web-server')
    expect(examplesText).toContain('host del web-server -f')
  })
})
