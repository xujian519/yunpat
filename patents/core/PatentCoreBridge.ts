/**
 * PatentCore Bridge - 调用 Rust patent-core 算法的 TypeScript 桥接层
 *
 * 通过 patent-cli 子进程调用 Rust 实现的专利核心算法。
 * 算法包括：特征提取、交底书解析、权利要求生成、OA解析、质量评估、IPC分类等。
 *
 * 当 Rust CLI 不可用时，自动降级到 TypeScript 实现。
 */

import { execFile } from 'child_process';
import { promisify } from 'util';
import { writeFileSync, unlinkSync, mkdtempSync, rmSync } from 'fs';
import { join, dirname } from 'path';
import { tmpdir } from 'os';
import { fileURLToPath } from 'url';
import {
  extractFeaturesFallback,
  parseDisclosureFallback,
  generateClaimsFallback,
  classifyIpcFallback,
  isFallbackResult,
} from './PatentCoreFallback.js';

// ESM 模块中的 __dirname polyfill
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const execFileAsync = promisify(execFile);

let CLI_PATH = join(
  __dirname,
  '..',
  '..',
  'packages',
  'rust-tools',
  'target',
  'release',
  'patent-cli'
);

export function setCliPath(path: string): void {
  CLI_PATH = path;
}

async function runCli(args: string[]): Promise<any> {
  try {
    const { stdout } = await execFileAsync(CLI_PATH, args, { timeout: 30000 });
    return JSON.parse(stdout);
  } catch (error) {
    // CLI调用失败，返回fallback标记
    console.error({
      message: '[PatentCoreBridge] CLI调用失败',
      cliPath: CLI_PATH,
      args,
      error: error instanceof Error ? {
        message: error.message,
        stack: error.stack,
        name: error.name,
      } : String(error),
      timestamp: new Date().toISOString(),
    });
    return {
      fallback: true,
      error: error instanceof Error ? error.message : String(error),
      args,
    };
  }
}

/** 通过临时文件传递 JSON 数据给 CLI（避免命令行参数长度限制和跨平台 /dev/stdin 问题） */
async function runCliWithStdin(
  subcommand: string,
  extraArgs: string[],
  data: string
): Promise<any> {
  const tmpDir = mkdtempSync(join(tmpdir(), 'patent-cli-'));
  const tmpFile = join(tmpDir, 'input.json');
  try {
    writeFileSync(tmpFile, data, 'utf-8');
    const args = [subcommand, '--claims-file', tmpFile, ...extraArgs];
    const { stdout } = await execFileAsync(CLI_PATH, args, { timeout: 30000 });
    return JSON.parse(stdout);
  } catch (error) {
    // CLI调用失败，返回fallback标记
    console.error({
      message: '[PatentCoreBridge] CLI调用失败',
      cliPath: CLI_PATH,
      subcommand,
      extraArgs,
      tmpFile,
      error: error instanceof Error ? {
        message: error.message,
        stack: error.stack,
        name: error.name,
      } : String(error),
      timestamp: new Date().toISOString(),
    });
    return {
      fallback: true,
      error: error instanceof Error ? error.message : String(error),
      subcommand,
      extraArgs,
    };
  } finally {
    try {
      unlinkSync(tmpFile);
    } catch {
      /* ignore */
    }
    try {
      // 使用rmSync递归删除目录及其内容
      rmSync(tmpDir, { recursive: true, force: true });
    } catch (error) {
      // 清理失败，记录警告但不抛出错误
      console.warn({
        message: '[PatentCoreBridge] 清理临时目录失败',
        tmpDir,
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString(),
      });
    }
  }
}

// --- 类型定义 ---

export interface TechnicalFeature {
  id: string;
  description: string;
  feature_type: 'Essential' | 'Optional';
  category: 'Structural' | 'Functional' | 'Method' | 'Material' | 'Other';
  component: string | null;
  function: string | null;
}

export interface ProblemFeatureEffect {
  id: string;
  technical_problem: string;
  technical_features: TechnicalFeature[];
  technical_effects: string[];
}

export interface DisclosureDoc {
  title: string;
  sections: Record<string, string>;
  confidence: number;
}

export interface ClaimDraft {
  id: string;
  claim_type: 'Independent' | 'Dependent';
  preamble: string;
  transitional_phrase: string;
  elements: string[];
  dependent_on: string | null;
}

export interface OfficeAction {
  oa_type: string;
  citations: CitedReference[];
  affected_claims: number[];
  examiner_arguments: string;
}

export interface CitedReference {
  document_number: string;
  relevancy: string;
  claims_affected: number[];
}

export interface ResponseStrategy {
  strategy_type: 'AmendClaims' | 'Argue' | 'Hybrid' | 'Withdraw';
  reasoning: string;
  confidence: number;
}

export interface QualityAssessment {
  clarity_score: number;
  support_score: number;
  scope_score: number;
  overall_score: number;
  issues: QualityIssue[];
}

export interface QualityIssue {
  dimension: string;
  severity: string;
  description: string;
  suggestion: string;
}

export interface IpcClassification {
  section: string;
  class: string;
  subclass: string;
  group: string;
  description: string;
}

// --- API ---

/** 提取技术特征 */
export async function extractFeatures(text: string): Promise<{
  features: TechnicalFeature[];
  problem_feature_effects: ProblemFeatureEffect[];
  fallback?: true;
}> {
  const result = await runCli(['extract-features', '--text', text]);

  if (isFallbackResult(result)) {
    console.warn('[PatentCoreBridge] extractFeatures 降级到 TypeScript 实现');
    return extractFeaturesFallback(text);
  }

  return result;
}

/** 解析交底书结构 */
export async function parseDisclosure(text: string): Promise<DisclosureDoc & { fallback?: true }> {
  const result = await runCli(['parse-disclosure', '--text', text]);

  if (isFallbackResult(result)) {
    console.warn('[PatentCoreBridge] parseDisclosure 降级到 TypeScript 实现');
    return parseDisclosureFallback(text);
  }

  return result;
}

/** 生成权利要求 */
export async function generateClaims(
  title: string,
  solution: string,
  inventionType: 'product' | 'method' | 'use' = 'product'
): Promise<{
  claims: ClaimDraft[];
  rendered: string[];
  fallback?: true;
}> {
  const result = await runCli(['generate-claims', '--title', title, '--solution', solution, '-t', inventionType]);

  if (isFallbackResult(result)) {
    console.warn('[PatentCoreBridge] generateClaims 降级到 TypeScript 实现');
    return generateClaimsFallback(title, solution, inventionType);
  }

  return result;
}

/** 解析审查意见 */
export async function parseOa(text: string): Promise<OfficeAction> {
  return runCli(['parse-oa', '--text', text]);
}

/** 推荐答复策略 */
export async function recommendStrategy(oaJson: string): Promise<{
  strategies: ResponseStrategy[];
}> {
  return runCli(['recommend-strategy', '--oa-json', oaJson]);
}

/** 修改权利要求 */
export async function reviseClaims(
  claims: ClaimDraft[],
  strategy: 'AmendClaims' | 'Hybrid' | 'Argue' = 'Hybrid'
): Promise<{
  revised_claims: ClaimDraft[];
  revision_quality: number;
}> {
  return runCliWithStdin('revise-claims', ['-t', strategy], JSON.stringify(claims));
}

/** 评估权利要求质量 */
export async function assessQuality(claims: ClaimDraft[]): Promise<QualityAssessment> {
  return runCliWithStdin('assess-quality', [], JSON.stringify(claims));
}

/** IPC 分类 */
export async function classifyIpc(text: string): Promise<{
  classifications: IpcClassification[];
  fallback?: true;
}> {
  const result = await runCli(['classify-ipc', '--text', text]);

  if (isFallbackResult(result)) {
    console.warn('[PatentCoreBridge] classifyIpc 降级到 TypeScript 实现');
    return classifyIpcFallback(text);
  }

  return result;
}
