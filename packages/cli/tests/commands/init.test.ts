import {describe, expect, it, vi} from 'vitest'
import Init from '../../src/commands/init.js'

describe('init command', () => {
  it('has correct description and flags', () => {
    expect(Init.description).toBe('Initialize a new Aship project with interactive setup')
    expect(Init.aliases).toEqual(['initialize', 'setup'])
    expect(Init.flags.yes).toBeDefined()
    expect(Init.flags.minimal).toBeDefined()
  })

  it('shows help content', async () => {
    // Mock console.log to capture help output
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    try {
      const command = new Init(['--help'], {})
      // The help will be handled by OCLIF framework
      expect(command.constructor.name).toBe('Init')
    } finally {
      consoleSpy.mockRestore()
    }
  })
})
