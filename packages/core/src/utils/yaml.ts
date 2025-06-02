/**
 * YAML utilities
 */

import { dump, load } from 'js-yaml';
import * as fsUtils from './fs.js';

/**
 * Load YAML file
 * @param filePath Path to the YAML file
 * @returns Parsed YAML content
 */
function loadYamlFile<T = any>(filePath: string): T {
  if (!fsUtils.fileExists(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  const content = fsUtils.readTextFile(filePath);

  try {
    return load(content) as T;
  } catch (error) {
    throw new Error(`Failed to parse YAML file ${filePath}: ${(error as Error).message}`);
  }
}

/**
 * Save data to YAML file
 * @param filePath Path to the YAML file
 * @param data Data to save
 */
function saveYamlFile<T>(filePath: string, data: T): void {
  try {
    const yamlContent = dump(data, {
      indent: 2,
      lineWidth: 120,
      noRefs: true,
    });

    fsUtils.writeTextFile(filePath, yamlContent);
  } catch (error) {
    throw new Error(`Failed to save YAML file ${filePath}: ${(error as Error).message}`);
  }
}

export { loadYamlFile, saveYamlFile };
