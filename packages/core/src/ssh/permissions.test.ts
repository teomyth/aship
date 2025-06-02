import { describe, it, expect, vi } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

// Mock fs module for testing
vi.mock('node:fs', () => ({
  existsSync: vi.fn(),
  statSync: vi.fn(),
  constants: {
    F_OK: 0,
    R_OK: 4,
  },
}));

describe('SSH Permissions', () => {
  it('should check if SSH key file exists', () => {
    const mockExistsSync = vi.mocked(fs.existsSync);
    mockExistsSync.mockReturnValue(true);

    const keyPath = path.join(os.homedir(), '.ssh', 'id_rsa');
    const exists = fs.existsSync(keyPath);

    expect(exists).toBe(true);
    expect(mockExistsSync).toHaveBeenCalledWith(keyPath);
  });
});
