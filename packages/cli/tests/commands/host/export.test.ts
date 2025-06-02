import {describe, expect, it} from 'vitest'
import HostExport from '../../../src/commands/host/export.js'

describe('host export command', () => {
  it('has correct description and aliases', () => {
    expect(HostExport.description).toBe('Export hosts to various formats')
    expect(HostExport.aliases).toEqual(['host:save', 'host:dump', 'host:backup'])
  })

  it('has all required flags', () => {
    expect(HostExport.flags.format).toBeDefined()
    expect(HostExport.flags.output).toBeDefined()
    expect(HostExport.flags.filter).toBeDefined()
    expect(HostExport.flags.source).toBeDefined()
    expect(HostExport.flags['include-usage']).toBeDefined()
    expect(HostExport.flags.pretty).toBeDefined()
    expect(HostExport.flags.group).toBeDefined()
  })

  it('has correct flag aliases', () => {
    expect(HostExport.flags.format.char).toBe('f')
    expect(HostExport.flags.output.char).toBe('o')
    expect(HostExport.flags.source.char).toBe('s')
    expect(HostExport.flags.pretty.char).toBe('p')
    expect(HostExport.flags.group.char).toBe('g')
  })

  it('has correct default values and options', () => {
    expect(HostExport.flags.format.default).toBe('json')
    expect(HostExport.flags.format.options).toEqual(['json', 'yaml', 'ssh-config', 'ansible'])
    expect(HostExport.flags.source.options).toEqual(['manual', 'ssh_config', 'imported'])
    expect(HostExport.flags['include-usage'].default).toBe(false)
    expect(HostExport.flags.pretty.default).toBe(true)
    expect(HostExport.flags.group.default).toBe('aship_hosts')
  })

  it('has examples with aliases', () => {
    expect(HostExport.examples).toBeDefined()
    expect(HostExport.examples.length).toBeGreaterThan(0)
    const examplesText = HostExport.examples.join(' ')
    expect(examplesText).toContain('host save -f json -o hosts.json')
    expect(examplesText).toContain('host backup --format ansible')
  })
})
