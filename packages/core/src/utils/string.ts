/**
 * String utility functions
 */

/**
 * Clean input string by removing any trailing newline characters and trimming whitespace
 * @param input Input string
 * @returns Cleaned input string
 */
export function cleanInputString(input: string): string {
  if (!input) return input;
  return input.replace(/\\n$/, '').trim();
}
