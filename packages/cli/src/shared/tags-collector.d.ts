/**
 * Tags collector for CLI commands
 *
 * This module provides functionality for collecting and managing Ansible tags
 * from aship.yml configuration files.
 */
import type { ProjectConfig, TagsConfig } from '@aship/core';
/**
 * Collect tags from project configuration
 * @param config Project configuration
 * @param existingTags Existing tag values
 * @returns Selected tags
 */
export declare function collectTagsFromConfig(
  config: ProjectConfig,
  existingTags?: string[]
): Promise<string[]>;
/**
 * Collect tags from tags configuration
 * @param tagsConfig Tags configuration
 * @param existingTags Existing tag values
 * @returns Selected tags
 */
export declare function collectTagsFromDefinition(
  tagsConfig: TagsConfig,
  existingTags?: string[]
): Promise<string[]>;
/**
 * Collect tags with simple choices
 * @param availableTags Available tag names
 * @param defaultTags Default selected tags
 * @returns Selected tags
 */
export declare function collectTagsFromChoices(
  availableTags: string[],
  defaultTags?: string[]
): Promise<string[]>;
/**
 * Select tag group (legacy function, kept for backward compatibility)
 * @param tagsConfig Tags configuration
 * @returns Selected tag group name
 */
export declare function selectTagGroup(tagsConfig: TagsConfig): Promise<string | null>;
/**
 * Get tags from group (legacy function, kept for backward compatibility)
 * @param tagsConfig Tags configuration
 * @param groupName Group name
 * @returns Tags in the group
 */
export declare function getTagsFromGroup(tagsConfig: TagsConfig, groupName: string): string[];
/**
 * Check if tags should be collected
 * @param config Project configuration
 * @param options Command options
 * @returns Whether to collect tags
 */
export declare function shouldCollectTags(
  config: ProjectConfig,
  options: {
    tags?: string;
    yes?: boolean;
  }
): Promise<boolean>;
//# sourceMappingURL=tags-collector.d.ts.map
