import {describe, expect, it} from 'vitest'
import HostImport from '../../../src/commands/host/import.js'

describe('host import command', () => {
  it('has correct description and aliases', () => {
    expect(HostImport.description).toBe('Import hosts from SSH config or other sources')
    expect(HostImport.aliases).toEqual(['host:load', 'host:sync'])
  })

  it('has correct args', () => {
    expect(HostImport.args.source).toBeDefined()
    expect(HostImport.args.source.description).toBe('Source to import from (ssh-config|file)')
    expect(HostImport.args.source.required).toBe(false)
  })

  it('has all required flags', () => {
    expect(HostImport.flags['ssh-config']).toBeDefined()
    expect(HostImport.flags.file).toBeDefined()
    expect(HostImport.flags.filter).toBeDefined()
    expect(HostImport.flags.force).toBeDefined()
    expect(HostImport.flags['dry-run']).toBeDefined()
    expect(HostImport.flags.interactive).toBeDefined()
  })

  it('has correct flag aliases', () => {
    expect(HostImport.flags.file.char).toBe('f')
    expect(HostImport.flags['dry-run'].char).toBe('d')
    expect(HostImport.flags.interactive.char).toBe('i')
  })

  it('has correct default values', () => {
    expect(HostImport.flags['ssh-config'].default).toBe(false)
    expect(HostImport.flags.force.default).toBe(false)
    expect(HostImport.flags['dry-run'].default).toBe(false)
    expect(HostImport.flags.interactive.default).toBe(false)
  })

  it('has examples with aliases', () => {
    expect(HostImport.examples).toBeDefined()
    expect(HostImport.examples.length).toBeGreaterThan(0)
    const examplesText = HostImport.examples.join(' ')
    expect(examplesText).toContain('host load --ssh-config')
    expect(examplesText).toContain('host sync -f hosts.json')
  })
})
