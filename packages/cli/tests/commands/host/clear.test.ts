import {describe, expect, it} from 'vitest'
import HostClear from '../../../src/commands/host/clear.js'

describe('host clear command', () => {
  it('has correct description and aliases', () => {
    expect(HostClear.description).toBe('Clear host-related data (usage history, recent connections)')
    expect(HostClear.aliases).toEqual(['host:clean', 'host:reset', 'host:purge'])
  })

  it('has all required flags', () => {
    expect(HostClear.flags.usage).toBeDefined()
    expect(HostClear.flags.recent).toBeDefined()
    expect(HostClear.flags.all).toBeDefined()
    expect(HostClear.flags.force).toBeDefined()
  })

  it('has correct flag aliases', () => {
    expect(HostClear.flags.usage.char).toBe('u')
    expect(HostClear.flags.recent.char).toBe('r')
    expect(HostClear.flags.all.char).toBe('a')
    expect(HostClear.flags.force.char).toBe('f')
  })

  it('has correct default values', () => {
    expect(HostClear.flags.usage.default).toBe(false)
    expect(HostClear.flags.recent.default).toBe(false)
    expect(HostClear.flags.all.default).toBe(false)
    expect(HostClear.flags.force.default).toBe(false)
  })

  it('has examples with aliases', () => {
    expect(HostClear.examples).toBeDefined()
    expect(HostClear.examples.length).toBeGreaterThan(0)
    const examplesText = HostClear.examples.join(' ')
    expect(examplesText).toContain('host clean --all -f')
    expect(examplesText).toContain('host reset --usage')
  })
})
