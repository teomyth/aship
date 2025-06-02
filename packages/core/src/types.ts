/**
 * Local type definitions
 */

/**
 * Playbook variable definition
 */
export interface PlaybookVariable {
  /**
   * Variable type
   */
  type: 'string' | 'number' | 'boolean' | 'list';

  /**
   * Variable description
   */
  description?: string;

  /**
   * Default value
   */
  default?: any;

  /**
   * Whether the variable is required
   */
  required?: boolean;

  /**
   * Validation rules
   */
  validation?: {
    pattern?: string;
    min?: number;
    max?: number;
    options?: any[];
  };

  /**
   * Variable group for UI organization
   */
  group?: string;
}

/**
 * Playbook configuration
 */
export interface PlaybookConfig {
  /**
   * Playbook path
   */
  path: string;

  /**
   * Playbook description
   */
  description?: string;

  /**
   * Target servers or server groups
   */
  servers?: string[];

  /**
   * Playbook variables
   */
  variables?: Record<string, PlaybookVariable>;
}
