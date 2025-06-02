/**
 * Inventory management exports
 */

export { InventoryGenerator } from './inventory-generator.js';
export type {
  InventoryOptions,
  InjectOptions,
  InventoryContent,
  InventoryHostEntry,
  InventoryGroup,
  InjectionPreview,
  InventoryFormat,
} from './types.js';

// Re-export existing inventory functions for backward compatibility
export { generateInventoryFile, generateInventoryContent } from '../ansible/inventory.js';
