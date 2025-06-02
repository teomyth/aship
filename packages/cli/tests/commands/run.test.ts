import {describe, expect, it} from 'vitest'
import Run from '../../src/commands/run.js'

describe('run command', () => {
  it('has correct description and flags', () => {
    expect(Run.description).toBe('Run a playbook by name or file path')
    expect(Run.flags.hosts).toBeDefined()
    expect(Run.flags.inventory).toBeDefined()
    expect(Run.flags['skip-vars']).toBeDefined()
    expect(Run.flags.yes).toBeDefined()
  })

  it('has correct args', () => {
    expect(Run.args.playbook).toBeDefined()
    expect(Run.args.playbook.description).toBe('Playbook name from aship.yml or file path')
    expect(Run.args.playbook.required).toBe(false)
  })

  it('has correct examples', () => {
    expect(Run.examples).toBeDefined()
    expect(Run.examples.length).toBeGreaterThan(0)
  })
})
