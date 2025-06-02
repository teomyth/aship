/**
 * File resolver
 *
 * This module provides utilities for resolving file paths.
 * It can be used for any file type by providing appropriate configuration.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileExists } from './fs.js';

/**
 * File type configuration for resolver
 */
export interface FileTypeConfig {
  /**
   * List of file extensions to try (with dot, e.g. ['.yml', '.yaml'])
   */
  extensions: string[];

  /**
   * Default file name to look for if no path is provided
   */
  defaultFileName?: string;

  /**
   * Default directory name to look in
   */
  defaultDirName?: string;

  /**
   * Description of the file type (for error messages and prompts)
   */
  description: string;
}

/**
 * Options for resolving file paths
 */
export interface ResolveFileOptions {
  /**
   * Whether to run in non-interactive mode
   */
  nonInteractive?: boolean;

  /**
   * Function to log messages
   */
  logger?: {
    error: (message: string) => void;
    warn: (message: string) => void;
    info: (message: string) => void;
  };

  /**
   * Function to prompt user for input
   */
  promptFunction?: (questions: any[]) => Promise<any>;
}

/**
 * Resolve file path from user input
 * @param filePath User-provided file path or name
 * @param currentDir Current working directory
 * @param fileTypeConfig Configuration for the file type
 * @param options Options for resolving the file path
 * @returns Resolved file path
 */
export async function resolveFilePath(
  filePath: string | undefined,
  currentDir: string,
  fileTypeConfig: FileTypeConfig,
  options: ResolveFileOptions = {}
): Promise<string | undefined> {
  const {
    nonInteractive = false,
    logger = {
      error: console.error,
      warn: console.warn,
      info: console.log,
    },
    promptFunction,
  } = options;

  // If no prompt function is provided and we're in interactive mode, we can't proceed
  if (!promptFunction && !nonInteractive) {
    throw new Error('promptFunction is required for interactive mode');
  }

  // If file path is provided, check if it exists
  if (filePath) {
    // Check if it's a relative path
    const resolvedPath = path.isAbsolute(filePath) ? filePath : path.resolve(currentDir, filePath);

    // Check if the file exists
    if (fileExists(resolvedPath)) {
      return resolvedPath;
    }

    // Check if it's a file name without extension
    for (const ext of fileTypeConfig.extensions) {
      const withExt = `${resolvedPath}${ext}`;
      if (fileExists(withExt)) {
        return withExt;
      }
    }

    // Check if it's in the default directory
    if (fileTypeConfig.defaultDirName) {
      const inDefaultDir = path.resolve(currentDir, fileTypeConfig.defaultDirName, filePath);
      if (fileExists(inDefaultDir)) {
        return inDefaultDir;
      }

      // Try with extensions
      for (const ext of fileTypeConfig.extensions) {
        const inDefaultDirWithExt = `${inDefaultDir}${ext}`;
        if (fileExists(inDefaultDirWithExt)) {
          return inDefaultDirWithExt;
        }
      }
    }

    // If we're in non-interactive mode, exit with error
    if (nonInteractive) {
      logger.error(`Error: ${fileTypeConfig.description} not found: ${filePath}`);
      return undefined;
    }

    // If we're in interactive mode, warn the user and prompt for a new path
    logger.warn(`${fileTypeConfig.description} not found: ${filePath}`);
    logger.warn(`Please provide a valid ${fileTypeConfig.description.toLowerCase()} path.`);

    // Prompt for a new path
    if (promptFunction) {
      const response = await promptFunction([
        {
          type: 'input',
          name: 'filePath',
          message: `Enter ${fileTypeConfig.description.toLowerCase()} path:`,
          validate: (input: string) => {
            if (!input) {
              return `${fileTypeConfig.description} path is required`;
            }
            return true;
          },
        },
      ]);

      // Recursively resolve the new path
      return resolveFilePath(response.filePath, currentDir, fileTypeConfig, options);
    }
  }

  // If no file path is provided, check if there's a default file
  if (fileTypeConfig.defaultFileName) {
    for (const ext of fileTypeConfig.extensions) {
      const defaultFile = path.resolve(currentDir, `${fileTypeConfig.defaultFileName}${ext}`);
      if (fileExists(defaultFile)) {
        return defaultFile;
      }
    }
  }

  // If we're in non-interactive mode, exit with error
  if (nonInteractive) {
    logger.error(
      `Error: No ${fileTypeConfig.description.toLowerCase()} specified and no default ${fileTypeConfig.description.toLowerCase()} found.`
    );
    return undefined;
  }

  // If we're in interactive mode, prompt for a file path
  logger.warn(
    `No ${fileTypeConfig.description.toLowerCase()} specified and no default ${fileTypeConfig.description.toLowerCase()} found.`
  );

  // Check if there are any files in the default directory
  let files: string[] = [];
  if (
    fileTypeConfig.defaultDirName &&
    fileExists(path.resolve(currentDir, fileTypeConfig.defaultDirName))
  ) {
    try {
      // Get all files with matching extensions in the default directory
      const dirPath = path.resolve(currentDir, fileTypeConfig.defaultDirName);
      const dirFiles = fs.readdirSync(dirPath);
      files = dirFiles.filter((file: string) =>
        fileTypeConfig.extensions.some(ext => file.endsWith(ext))
      );
    } catch (error) {
      logger.warn(
        `Failed to read ${fileTypeConfig.defaultDirName} directory: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  if (files.length > 0 && promptFunction && fileTypeConfig.defaultDirName) {
    // Prompt user to select a file
    const defaultDirPath = path.resolve(currentDir, fileTypeConfig.defaultDirName);
    const response = await promptFunction([
      {
        type: 'list',
        name: 'filePath',
        message: `Select a ${fileTypeConfig.description.toLowerCase()}:`,
        choices: [
          ...files.map((file: string) => ({
            name: file,
            value: path.resolve(defaultDirPath, file),
          })),
          { name: 'Enter custom path', value: 'custom' },
        ],
      },
    ]);

    if (response.filePath === 'custom') {
      // Prompt for a custom path
      const customResponse = await promptFunction([
        {
          type: 'input',
          name: 'filePath',
          message: `Enter ${fileTypeConfig.description.toLowerCase()} path:`,
          validate: (input: string) => {
            if (!input) {
              return `${fileTypeConfig.description} path is required`;
            }
            return true;
          },
        },
      ]);

      // Recursively resolve the custom path
      return resolveFilePath(customResponse.filePath, currentDir, fileTypeConfig, options);
    }

    return response.filePath;
  }
  if (promptFunction) {
    // Prompt for a file path
    const response = await promptFunction([
      {
        type: 'input',
        name: 'filePath',
        message: `Enter ${fileTypeConfig.description.toLowerCase()} path:`,
        validate: (input: string) => {
          if (!input) {
            return `${fileTypeConfig.description} path is required`;
          }
          return true;
        },
      },
    ]);

    // Recursively resolve the path
    return resolveFilePath(response.filePath, currentDir, fileTypeConfig, options);
  }

  return undefined;
}
