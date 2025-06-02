/**
 * Variable definition schemas
 */

import { z } from 'zod';

/**
 * Schema for variable definition in aship.yml
 */
export const VariableDefinitionSchema = z
  .object({
    /**
     * Variable type
     */
    type: z.enum(['string', 'int', 'bool', 'choice', 'list', 'password', 'multiselect']),

    /**
     * Variable description for user prompts
     */
    description: z.string().optional(),

    /**
     * Default value for the variable
     */
    default: z.any().optional(),

    /**
     * Whether the variable is required
     */
    required: z.boolean().optional().default(false),

    /**
     * Available choices for 'choice' type variables
     */
    choices: z.array(z.string()).optional(),

    /**
     * Minimum value for 'int' type variables
     */
    min: z.number().optional(),

    /**
     * Maximum value for 'int' type variables
     */
    max: z.number().optional(),

    /**
     * Pattern validation for 'string' type variables
     */
    pattern: z.string().optional(),

    /**
     * Variable group for UI organization
     */
    group: z.string().optional(),
  })
  .refine(
    data => {
      // Validate that choice and multiselect types have choices defined
      if (
        (data.type === 'choice' || data.type === 'multiselect') &&
        (!data.choices || data.choices.length === 0)
      ) {
        return false;
      }
      return true;
    },
    {
      message: 'Choice and multiselect type variables must have at least one choice defined',
    }
  )
  .refine(
    data => {
      // Validate that min/max are only used with int type
      if ((data.min !== undefined || data.max !== undefined) && data.type !== 'int') {
        return false;
      }
      return true;
    },
    {
      message: "Min/max values can only be used with 'int' type variables",
    }
  )
  .refine(
    data => {
      // Validate that pattern is only used with string type
      if (data.pattern !== undefined && data.type !== 'string') {
        return false;
      }
      return true;
    },
    {
      message: "Pattern validation can only be used with 'string' type variables",
    }
  );

/**
 * TypeScript type for variable definition
 */
export type VariableDefinition = z.infer<typeof VariableDefinitionSchema>;

/**
 * Schema for validating variable values against their definitions
 */
export const createVariableValueSchema = (definition: VariableDefinition) => {
  switch (definition.type) {
    case 'string': {
      let stringSchema = z.string();
      if (definition.pattern) {
        stringSchema = stringSchema.regex(new RegExp(definition.pattern));
      }
      return definition.required ? stringSchema : stringSchema.optional();
    }

    case 'int': {
      let intSchema = z.number().int();
      if (definition.min !== undefined) {
        intSchema = intSchema.min(definition.min);
      }
      if (definition.max !== undefined) {
        intSchema = intSchema.max(definition.max);
      }
      return definition.required ? intSchema : intSchema.optional();
    }

    case 'bool':
      return definition.required ? z.boolean() : z.boolean().optional();

    case 'choice': {
      if (!definition.choices || definition.choices.length === 0) {
        throw new Error('Choice type variables must have choices defined');
      }
      const choiceSchema = z.enum(definition.choices as [string, ...string[]]);
      return definition.required ? choiceSchema : choiceSchema.optional();
    }

    case 'multiselect': {
      if (!definition.choices || definition.choices.length === 0) {
        throw new Error('Multiselect type variables must have choices defined');
      }
      const multiselectSchema = z.array(z.enum(definition.choices as [string, ...string[]]));
      return definition.required ? multiselectSchema : multiselectSchema.optional();
    }

    case 'list': {
      const listSchema = z.array(z.any());
      return definition.required ? listSchema : listSchema.optional();
    }

    case 'password': {
      const passwordSchema = z.string().min(1);
      return definition.required ? passwordSchema : passwordSchema.optional();
    }

    default:
      throw new Error(`Unsupported variable type: ${(definition as any).type}`);
  }
};

/**
 * Validate a variable value against its definition
 */
export const validateVariableValue = (
  definition: VariableDefinition,
  value: any
): { success: boolean; error?: string } => {
  try {
    const schema = createVariableValueSchema(definition);
    schema.parse(value);
    return { success: true };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: error.errors.map(e => e.message).join(', '),
      };
    }
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown validation error',
    };
  }
};
