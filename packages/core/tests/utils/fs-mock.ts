import * as path from 'node:path';
import { Volume, createFsFromVolume } from 'memfs';

// 创建内存文件系统
const volume = Volume.fromJSON({});
const fs = createFsFromVolume(volume);

// 导出 fs 模块
export { fs };

/**
 * 创建测试文件
 * @param filePath 文件路径
 * @param content 文件内容
 */
export function createTestFile(filePath: string, content: string): void {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(filePath, content, 'utf-8');
}

/**
 * 清空内存文件系统
 */
export function clearFs(): void {
  volume.reset();
}

/**
 * 检查文件是否存在
 * @param filePath 文件路径
 * @returns 文件是否存在
 */
export function fileExists(filePath: string): boolean {
  return fs.existsSync(filePath);
}
