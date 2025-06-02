/**
 * Project configuration schema for aship.yml
 */

import { z } from 'zod';
import { VariableDefinitionSchema } from './variables.js';

/**
 * Schema for tags configuration
 * Supports flat format with multiple value types:
 *
 * tags:
 *   # Tag with description
 *   setup: "Setup description"
 *   config: "Config description"
 *
 *   # Tag list without descriptions
 *   tags: ["deploy", "restart", "cleanup"]
 *
 *   # Default selected tags
 *   default: ["setup", "config"]
 *
 *   # Tag groups
 *   quick: ["setup"]
 *   full: ["setup", "config", "deploy"]
 */
export const TagsConfigSchema = z.record(
  z.union([
    z.string(), // Tag with description: "tag_name: description"
    z.array(z.string()), // Tag list or group: "key: [tag1, tag2]"
  ])
);

/**
 * Schema for project configuration (aship.yml)
 * This represents the design-time configuration that should be version controlled
 */
export const ProjectConfigSchema = z
  .object({
    /**
     * Project name
     */
    name: z.string().min(1, 'Project name cannot be empty'),

    /**
     * Project description
     */
    description: z.string().optional(),

    /**
     * Playbook definitions
     * Maps playbook names to their file paths
     * Example: { "setup": "site.yml", "deploy": "playbooks/deploy.yml" }
     */
    playbooks: z.record(z.string()).optional(),

    /**
     * Variable definitions
     * Maps variable names to their type definitions and validation rules
     */
    vars: z.record(VariableDefinitionSchema).optional(),

    /**
     * Tags configuration for Ansible playbooks
     */
    tags: TagsConfigSchema.optional(),

    /**
     * Ansible configuration (optional)
     */
    ansible: z
      .object({
        /**
         * Path to ansible.cfg file
         */
        configPath: z.string().optional(),
      })
      .optional(),
  })
  .strict(); // Reject unknown properties

/**
 * TypeScript types
 */
export type TagsConfig = z.infer<typeof TagsConfigSchema>;
export type ProjectConfig = z.infer<typeof ProjectConfigSchema>;

/**
 * Normalized tags configuration for internal use
 */
export interface NormalizedTagsConfig {
  /** Individual tag definitions with descriptions */
  tags: Record<string, string>;
  /** Default selected tags */
  default: string[];
  /** Tag groups/combinations */
  groups: Record<string, string[]>;
}

/**
 * Normalize tags configuration to internal format
 * Handles flat format with support for tag descriptions, tag lists, defaults, and groups
 */
export function normalizeTagsConfig(tagsConfig: TagsConfig): NormalizedTagsConfig {
  if (!tagsConfig || typeof tagsConfig !== 'object') {
    return {
      tags: {},
      default: [],
      groups: {},
    };
  }

  const tags: Record<string, string> = {};
  const groups: Record<string, string[]> = {};
  let defaultTags: string[] = [];

  for (const [key, value] of Object.entries(tagsConfig)) {
    if (typeof value === 'string') {
      // Individual tag with description: "tag_name: description"
      tags[key] = value;
    } else if (Array.isArray(value)) {
      if (key === 'default') {
        // Default selected tags: "default: [tag1, tag2]"
        defaultTags = value;
      } else if (key === 'tags') {
        // Tag list without descriptions: "tags: [tag1, tag2, tag3]"
        for (const tagName of value) {
          if (typeof tagName === 'string') {
            tags[tagName] = tagName; // Use tag name as description
          }
        }
      } else {
        // Tag group: "group_name: [tag1, tag2]"
        groups[key] = value;
      }
    }
  }

  return {
    tags,
    default: defaultTags,
    groups,
  };
}

/**
 * Validate project configuration
 */
export const validateProjectConfig = (
  config: unknown
): {
  success: boolean;
  data?: ProjectConfig;
  errors?: string[];
} => {
  try {
    const validatedConfig = ProjectConfigSchema.parse(config);
    return {
      success: true,
      data: validatedConfig,
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        errors: error.errors.map(e => `${e.path.join('.')}: ${e.message}`),
      };
    }
    return {
      success: false,
      errors: [error instanceof Error ? error.message : 'Unknown validation error'],
    };
  }
};

/**
 * Default project configuration template
 * Note: No example variables are included by default - users should define their own
 */
export const createDefaultProjectConfig = (projectName: string): ProjectConfig => ({
  name: projectName,
  description: `Aship project: ${projectName}`,
  playbooks: {
    setup: 'site.yml',
  },
  // No vars section by default - users should add their own variables as needed
});

/**
 * Minimal project configuration template
 */
export const createMinimalProjectConfig = (projectName: string): ProjectConfig => ({
  name: projectName,
});
