import { vi } from 'vitest';
import { fileExists as mockFileExists } from './fs-mock';

// Mock @aship/utils module
vi.mock('@aship/utils', () => {
  return {
    fileExists: vi.fn().mockImplementation((path: string) => {
      return mockFileExists(path);
    }),
  };
});

// Export mocked functions for use in tests
export const mockedFileExists = vi.fn().mockImplementation((path: string) => {
  return mockFileExists(path);
});
