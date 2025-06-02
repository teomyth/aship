/**
 * Tests for normalizeTagsConfig function
 */

import { describe, it, expect } from 'vitest';
import { normalizeTagsConfig, type TagsConfig } from '../../../src/schemas/project-config.js';

describe('normalizeTagsConfig', () => {
  it('should handle empty/null config', () => {
    expect(normalizeTagsConfig({})).toEqual({
      tags: {},
      default: [],
      groups: {},
    });

    expect(normalizeTagsConfig(null as any)).toEqual({
      tags: {},
      default: [],
      groups: {},
    });

    expect(normalizeTagsConfig(undefined as any)).toEqual({
      tags: {},
      default: [],
      groups: {},
    });
  });

  it('should handle tag descriptions format', () => {
    const config: TagsConfig = {
      setup: 'Initial setup tasks',
      deploy: 'Deployment tasks',
      cleanup: 'Cleanup operations',
    };

    const result = normalizeTagsConfig(config);

    expect(result).toEqual({
      tags: {
        setup: 'Initial setup tasks',
        deploy: 'Deployment tasks',
        cleanup: 'Cleanup operations',
      },
      default: [],
      groups: {},
    });
  });

  it('should handle tags list format', () => {
    const config: TagsConfig = {
      tags: ['setup', 'deploy', 'cleanup'],
    };

    const result = normalizeTagsConfig(config);

    expect(result).toEqual({
      tags: {
        setup: 'setup',
        deploy: 'deploy',
        cleanup: 'cleanup',
      },
      default: [],
      groups: {},
    });
  });

  it('should handle default tags', () => {
    const config: TagsConfig = {
      setup: 'Setup tasks',
      deploy: 'Deploy tasks',
      default: ['setup'],
    };

    const result = normalizeTagsConfig(config);

    expect(result).toEqual({
      tags: {
        setup: 'Setup tasks',
        deploy: 'Deploy tasks',
      },
      default: ['setup'],
      groups: {},
    });
  });

  it('should handle tag groups', () => {
    const config: TagsConfig = {
      setup: 'Setup tasks',
      deploy: 'Deploy tasks',
      cleanup: 'Cleanup tasks',
      quick: ['setup'],
      full: ['setup', 'deploy', 'cleanup'],
    };

    const result = normalizeTagsConfig(config);

    expect(result).toEqual({
      tags: {
        setup: 'Setup tasks',
        deploy: 'Deploy tasks',
        cleanup: 'Cleanup tasks',
      },
      default: [],
      groups: {
        quick: ['setup'],
        full: ['setup', 'deploy', 'cleanup'],
      },
    });
  });

  it('should handle mixed format with descriptions, tags list, defaults, and groups', () => {
    const config: TagsConfig = {
      // Individual tags with descriptions
      setup: 'Initial setup with configuration',
      monitoring: 'Monitoring setup',

      // Tags list without descriptions
      tags: ['deploy', 'restart', 'cleanup'],

      // Default selection
      default: ['setup', 'deploy'],

      // Tag groups
      quick: ['setup'],
      full: ['setup', 'deploy', 'monitoring'],
      maintenance: ['cleanup', 'restart'],
    };

    const result = normalizeTagsConfig(config);

    expect(result).toEqual({
      tags: {
        setup: 'Initial setup with configuration',
        monitoring: 'Monitoring setup',
        deploy: 'deploy',
        restart: 'restart',
        cleanup: 'cleanup',
      },
      default: ['setup', 'deploy'],
      groups: {
        quick: ['setup'],
        full: ['setup', 'deploy', 'monitoring'],
        maintenance: ['cleanup', 'restart'],
      },
    });
  });

  it('should handle only tags list format', () => {
    const config: TagsConfig = {
      tags: ['web', 'database', 'cache'],
      default: ['web'],
      production: ['web', 'database', 'cache'],
      development: ['web'],
    };

    const result = normalizeTagsConfig(config);

    expect(result).toEqual({
      tags: {
        web: 'web',
        database: 'database',
        cache: 'cache',
      },
      default: ['web'],
      groups: {
        production: ['web', 'database', 'cache'],
        development: ['web'],
      },
    });
  });

  it('should handle only descriptions format', () => {
    const config: TagsConfig = {
      common: 'Common setup tasks',
      app: 'Application deployment',
      database: 'Database operations',
    };

    const result = normalizeTagsConfig(config);

    expect(result).toEqual({
      tags: {
        common: 'Common setup tasks',
        app: 'Application deployment',
        database: 'Database operations',
      },
      default: [],
      groups: {},
    });
  });

  it('should handle complex real-world example', () => {
    const config: TagsConfig = {
      // Core tags with descriptions
      common: 'Basic system setup and dependencies',
      security: 'Security configuration and hardening',
      monitoring: 'Monitoring and alerting setup',

      // Additional tags without descriptions
      tags: ['backup', 'restore', 'maintenance'],

      // Default selection
      default: ['common', 'security'],

      // Deployment scenarios
      minimal: ['common'],
      standard: ['common', 'security', 'monitoring'],
      full: ['common', 'security', 'monitoring', 'backup'],
      maintenance_mode: ['maintenance', 'backup'],
    };

    const result = normalizeTagsConfig(config);

    expect(result).toEqual({
      tags: {
        common: 'Basic system setup and dependencies',
        security: 'Security configuration and hardening',
        monitoring: 'Monitoring and alerting setup',
        backup: 'backup',
        restore: 'restore',
        maintenance: 'maintenance',
      },
      default: ['common', 'security'],
      groups: {
        minimal: ['common'],
        standard: ['common', 'security', 'monitoring'],
        full: ['common', 'security', 'monitoring', 'backup'],
        maintenance_mode: ['maintenance', 'backup'],
      },
    });
  });

  it('should ignore invalid values', () => {
    const config: TagsConfig = {
      setup: 'Valid description',
      invalid_number: 123 as any,
      invalid_object: { nested: 'object' } as any,
      valid_list: ['tag1', 'tag2'],
      default: ['setup'],
    };

    const result = normalizeTagsConfig(config);

    expect(result).toEqual({
      tags: {
        setup: 'Valid description',
      },
      default: ['setup'],
      groups: {
        valid_list: ['tag1', 'tag2'],
      },
    });
  });
});
