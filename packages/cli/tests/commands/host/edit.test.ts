import {describe, expect, it} from 'vitest'
import HostEdit from '../../../src/commands/host/edit.js'

describe('host edit command', () => {
  it('has correct description and aliases', () => {
    expect(HostEdit.description).toBe('Edit an existing host configuration')
    expect(HostEdit.aliases).toEqual(['host:update', 'host:modify', 'host:change'])
  })

  it('has correct args', () => {
    expect(HostEdit.args.name).toBeDefined()
    expect(HostEdit.args.name.description).toBe('Name of the host to edit')
    expect(HostEdit.args.name.required).toBe(false)
  })

  it('has all required flags', () => {
    expect(HostEdit.flags.interactive).toBeDefined()
    expect(HostEdit.flags.hostname).toBeDefined()
    expect(HostEdit.flags.port).toBeDefined()
    expect(HostEdit.flags.user).toBeDefined()
    expect(HostEdit.flags['identity-file']).toBeDefined()
    expect(HostEdit.flags.description).toBeDefined()
    expect(HostEdit.flags['non-interactive']).toBeDefined()
    expect(HostEdit.flags.test).toBeDefined()
    expect(HostEdit.flags['clear-identity']).toBeDefined()
    expect(HostEdit.flags['clear-description']).toBeDefined()
  })

  it('has correct flag aliases', () => {
    expect(HostEdit.flags.interactive.char).toBe('i')
  })

  it('has correct default values', () => {
    expect(HostEdit.flags.interactive.default).toBe(false)
    expect(HostEdit.flags['non-interactive'].default).toBe(false)
    expect(HostEdit.flags.test.default).toBe(false)
    expect(HostEdit.flags['clear-identity'].default).toBe(false)
    expect(HostEdit.flags['clear-description'].default).toBe(false)
  })

  it('has examples with aliases', () => {
    expect(HostEdit.examples).toBeDefined()
    expect(HostEdit.examples.length).toBeGreaterThan(0)
    const examplesText = HostEdit.examples.join(' ')
    expect(examplesText).toContain('host update web-server --hostname new.example.com')
    expect(examplesText).toContain('host modify web-server -i')
  })
})
