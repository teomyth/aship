import {describe, expect, it} from 'vitest'
import HostAdd from '../../../src/commands/host/add.js'

describe('host add command', () => {
  it('has correct description and aliases', () => {
    expect(HostAdd.description).toBe('Add a new host to Aship')
    expect(HostAdd.aliases).toEqual(['host:create', 'host:new'])
  })

  it('has all required flags', () => {
    expect(HostAdd.flags.name).toBeDefined()
    expect(HostAdd.flags.hostname).toBeDefined()
    expect(HostAdd.flags.port).toBeDefined()
    expect(HostAdd.flags.user).toBeDefined()
    expect(HostAdd.flags['identity-file']).toBeDefined()
    expect(HostAdd.flags.description).toBeDefined()
    expect(HostAdd.flags['non-interactive']).toBeDefined()
    expect(HostAdd.flags.test).toBeDefined()
    expect(HostAdd.flags.force).toBeDefined()
  })

  it('has correct flag aliases', () => {
    expect(HostAdd.flags.name.char).toBe('n')
    expect(HostAdd.flags.hostname.char).toBe('h')
    expect(HostAdd.flags.port.char).toBe('p')
    expect(HostAdd.flags.user.char).toBe('u')
    expect(HostAdd.flags['identity-file'].char).toBe('i')
    expect(HostAdd.flags.description.char).toBe('d')
    expect(HostAdd.flags.test.char).toBe('t')
    expect(HostAdd.flags.force.char).toBe('f')
  })

  it('has correct default values', () => {
    expect(HostAdd.flags.port.default).toBe('22')
    expect(HostAdd.flags['non-interactive'].default).toBe(false)
    expect(HostAdd.flags.test.default).toBe(false)
    expect(HostAdd.flags.force.default).toBe(false)
  })

  it('has examples with aliases', () => {
    expect(HostAdd.examples).toBeDefined()
    expect(HostAdd.examples.length).toBeGreaterThan(0)
    const examplesText = HostAdd.examples.join(' ')
    expect(examplesText).toContain('host create --hostname example.com')
    expect(examplesText).toContain('host new -n web-server -h 192.168.1.100 -u ubuntu')
  })
})
