/**
 * Rust 专利工具集成层
 *
 * 通过 FFI 或 CLI 调用 Rust 实现的专利工具
 */

import { spawn } from 'child_process';
import { promisify } from 'util';
import { writeFile, readFile } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

/**
 * Rust 专利工具包装器
 */
export class PatentToolsRust {
  private rustBinaryPath: string;

  constructor(rustBinaryPath?: string) {
    this.rustBinaryPath = rustBinaryPath || join(process.cwd(), 'rust/target/debug/patent-tools');
  }

  /**
   * 搜索专利
   */
  async searchPatents(query: {
    keywords: string[];
    applicant?: string;
    limit?: number;
  }): Promise<any> {
    const inputPath = join(tmpdir(), `patent-search-${Date.now()}.json`);
    await writeFile(inputPath, JSON.stringify(query));

    try {
      const result = await this.execRustCommand('search', ['--input', inputPath]);
      return JSON.parse(result);
    } finally {
      // 清理临时文件
      // await unlink(inputPath).catch(() => {});
    }
  }

  /**
   * 生成权利要求
   */
  async generateClaims(params: {
    technicalFeatures: any[];
    inventionType: string;
  }): Promise<any> {
    const inputPath = join(tmpdir(), `claim-gen-${Date.now()}.json`);
    await writeFile(inputPath, JSON.stringify(params));

    try {
      const result = await this.execRustCommand('generate-claims', ['--input', inputPath]);
      return JSON.parse(result);
    } finally {
      // await unlink(inputPath).catch(() => {});
    }
  }

  /**
   * 评估权利要求质量
   */
  async assessQuality(claims: any[]): Promise<any> {
    const inputPath = join(tmpdir(), `quality-assess-${Date.now()}.json`);
    await writeFile(inputPath, JSON.stringify({ claims }));

    try {
      const result = await this.execRustCommand('assess-quality', ['--input', inputPath]);
      return JSON.parse(result);
    } finally {
      // await unlink(inputPath).catch(() => {});
    }
  }

  /**
   * 解析审查意见
   */
  async parseOfficeAction(text: string): Promise<any> {
    const inputPath = join(tmpdir(), `oa-parse-${Date.now()}.json`);
    await writeFile(inputPath, JSON.stringify({ text }));

    try {
      const result = await this.execRustCommand('parse-office-action', ['--input', inputPath]);
      return JSON.parse(result);
    } finally {
      // await unlink(inputPath).catch(() => {});
    }
  }

  /**
   * 执行 Rust 命令
   */
  private async execRustCommand(command: string, args: string[]): Promise<string> {
    return new Promise((resolve, reject) => {
      const process = spawn(this.rustBinaryPath, [command, ...args]);

      let stdout = '';
      let stderr = '';

      process.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      process.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      process.on('close', (code) => {
        if (code === 0) {
          resolve(stdout);
        } else {
          reject(new Error(`Rust command failed: ${stderr}`));
        }
      });

      process.on('error', (error) => {
        reject(new Error(`Failed to spawn Rust process: ${error.message}`));
      });
    });
  }
}

/**
 * 导出单例实例
 */
export const patentToolsRust = new PatentToolsRust();

/**
 * 便捷函数
 */
export async function searchPatents(query: {
  keywords: string[];
  applicant?: string;
  limit?: number;
}): Promise<any> {
  return patentToolsRust.searchPatents(query);
}

export async function generateClaims(params: {
  technicalFeatures: any[];
  inventionType: string;
}): Promise<any> {
  return patentToolsRust.generateClaims(params);
}

export async function assessQuality(claims: any[]): Promise<any> {
  return patentToolsRust.assessQuality(claims);
}

export async function parseOfficeAction(text: string): Promise<any> {
  return patentToolsRust.parseOfficeAction(text);
}
