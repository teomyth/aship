/**
 * Tags collector for CLI commands
 *
 * This module provides functionality for collecting and managing Ansible tags
 * from aship.yml configuration files.
 */

import { type ProjectConfig, type TagsConfig, logger, normalizeTagsConfig } from '@aship/core';
import inquirer from 'inquirer';

/**
 * Collect tags from project configuration
 * @param config Project configuration
 * @param existingTags Existing tag values
 * @returns Selected tags
 */
export async function collectTagsFromConfig(
  config: ProjectConfig,
  existingTags: string[] = []
): Promise<string[]> {
  const tagsConfig = config.tags;
  if (!tagsConfig) {
    return [];
  }

  return collectTagsFromDefinition(tagsConfig, existingTags);
}

/**
 * Collect tags from tags configuration
 * @param tagsConfig Tags configuration
 * @param existingTags Existing tag values
 * @returns Selected tags
 */
export async function collectTagsFromDefinition(
  tagsConfig: TagsConfig,
  existingTags: string[] = []
): Promise<string[]> {
  // Normalize the tags configuration
  const normalized = normalizeTagsConfig(tagsConfig);

  // If no tags defined, return empty array
  if (Object.keys(normalized.tags).length === 0) {
    return [];
  }

  logger.subsection('Tag Selection');
  logger.info('Please select the Ansible tags to execute:');

  // Create quick options (groups + default)
  const quickOptions: Array<{ name: string; value: string | null }> = [];

  // Add "run all tasks" option (no tags) - this is the natural default
  quickOptions.push({
    name: 'Run all tasks (no tag filtering)',
    value: 'all',
  });

  // Add default option if available
  if (normalized.default.length > 0) {
    quickOptions.push({
      name: `default (${normalized.default.join(', ')})`,
      value: 'default',
    });
  }

  // Add group options
  for (const [groupName, groupTags] of Object.entries(normalized.groups)) {
    quickOptions.push({
      name: `${groupName} (${(groupTags as string[]).join(', ')})`,
      value: groupName,
    });
  }

  // Add custom selection option
  quickOptions.push({
    name: 'Custom selection...',
    value: null,
  });

  // First prompt: Quick options or custom
  const quickResponse = await inquirer.prompt({
    type: 'list',
    name: 'selection',
    message: 'Choose tag selection method:',
    choices: quickOptions,
  });

  // If user selected a predefined option, return those tags
  if (quickResponse.selection === 'all') {
    return []; // Empty array means no tag filtering (run all tasks)
  }
  if (quickResponse.selection === 'default') {
    return normalized.default;
  }
  if (quickResponse.selection && normalized.groups[quickResponse.selection]) {
    return normalized.groups[quickResponse.selection];
  }

  // Custom selection: show individual tags
  const individualChoices = Object.entries(normalized.tags).map(([tagName, description]) => ({
    name: `${tagName} - ${description}`,
    value: tagName,
    checked: existingTags.includes(tagName) || normalized.default.includes(tagName),
  }));

  const customResponse = await inquirer.prompt({
    type: 'checkbox',
    name: 'selectedTags',
    message: 'Select individual tags (leave empty to run all tasks):',
    choices: individualChoices,
    validate: (input: unknown) => {
      const tags = input as string[];
      if (!Array.isArray(tags)) {
        return 'Invalid selection';
      }
      // Allow empty selection - this means run all tasks without tag filtering
      return true;
    },
  });

  return customResponse.selectedTags;
}

/**
 * Collect tags with simple choices
 * @param availableTags Available tag names
 * @param defaultTags Default selected tags
 * @returns Selected tags
 */
export async function collectTagsFromChoices(
  availableTags: string[],
  defaultTags: string[] = []
): Promise<string[]> {
  if (availableTags.length === 0) {
    return [];
  }

  logger.subsection('Tag Selection');
  logger.info('Please select the Ansible tags to execute:');

  const choices = availableTags.map(tag => ({
    name: tag,
    value: tag,
    checked: defaultTags.includes(tag),
  }));

  const response = await inquirer.prompt({
    type: 'checkbox',
    name: 'selectedTags',
    message: 'Select tags to execute (leave empty to run all tasks):',
    choices,
    validate: (input: unknown) => {
      const tags = input as string[];
      if (!Array.isArray(tags)) {
        return 'Invalid selection';
      }
      // Allow empty selection - this means run all tasks without tag filtering
      return true;
    },
  });

  return response.selectedTags;
}

/**
 * Select tag group (legacy function, kept for backward compatibility)
 * @param tagsConfig Tags configuration
 * @returns Selected tag group name
 */
export async function selectTagGroup(tagsConfig: TagsConfig): Promise<string | null> {
  const normalized = normalizeTagsConfig(tagsConfig);

  if (Object.keys(normalized.groups).length === 0) {
    return null;
  }

  logger.subsection('Tag Group Selection');
  logger.info('Select a predefined tag group:');

  const choices = [
    { name: 'Custom selection', value: null },
    ...Object.entries(normalized.groups).map(([groupName, tags]) => ({
      name: `${groupName} (${(tags as string[]).join(', ')})`,
      value: groupName,
    })),
  ];

  const response = await inquirer.prompt({
    type: 'list',
    name: 'selectedGroup',
    message: 'Choose tag selection method:',
    choices,
  });

  return response.selectedGroup;
}

/**
 * Get tags from group (legacy function, kept for backward compatibility)
 * @param tagsConfig Tags configuration
 * @param groupName Group name
 * @returns Tags in the group
 */
export function getTagsFromGroup(tagsConfig: TagsConfig, groupName: string): string[] {
  const normalized = normalizeTagsConfig(tagsConfig);

  if (groupName === 'default') {
    return normalized.default;
  }

  if (!normalized.groups[groupName]) {
    return [];
  }

  return normalized.groups[groupName];
}

/**
 * Check if tags should be collected
 * @param config Project configuration
 * @param options Command options
 * @returns Whether to collect tags
 */
export async function shouldCollectTags(
  config: ProjectConfig,
  options: { tags?: string; yes?: boolean }
): Promise<boolean> {
  // If tags already specified via command line, don't collect
  if (options.tags) {
    return false;
  }

  // If non-interactive mode, don't collect
  if (options.yes) {
    return false;
  }

  // If no tags configuration, don't collect
  if (!config.tags) {
    return false;
  }

  // Check if there are any tags defined (either format)
  const normalized = normalizeTagsConfig(config.tags);
  if (Object.keys(normalized.tags).length === 0) {
    return false;
  }

  return true;
}
