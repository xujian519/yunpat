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
import { extractFeaturesFallback, parseDisclosureFallback, generateClaimsFallback, classifyIpcFallback, isFallbackResult, } from './PatentCoreFallback.js';
// ESM 模块中的 __dirname polyfill
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const execFileAsync = promisify(execFile);
let CLI_PATH = join(__dirname, '..', '..', 'packages', 'rust-tools', 'target', 'release', 'patent-cli');
export function setCliPath(path) {
    CLI_PATH = path;
}
async function runCli(args) {
    try {
        const { stdout } = await execFileAsync(CLI_PATH, args, { timeout: 30000 });
        return JSON.parse(stdout);
    }
    catch (error) {
        // CLI调用失败，返回fallback标记
        console.error({
            message: '[PatentCoreBridge] CLI调用失败',
            cliPath: CLI_PATH,
            args,
            error: error instanceof Error
                ? {
                    message: error.message,
                    stack: error.stack,
                    name: error.name,
                }
                : String(error),
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
async function runCliWithStdin(subcommand, extraArgs, data) {
    const tmpDir = mkdtempSync(join(tmpdir(), 'patent-cli-'));
    const tmpFile = join(tmpDir, 'input.json');
    try {
        writeFileSync(tmpFile, data, 'utf-8');
        const args = [subcommand, '--claims-file', tmpFile, ...extraArgs];
        const { stdout } = await execFileAsync(CLI_PATH, args, { timeout: 30000 });
        return JSON.parse(stdout);
    }
    catch (error) {
        // CLI调用失败，返回fallback标记
        console.error({
            message: '[PatentCoreBridge] CLI调用失败',
            cliPath: CLI_PATH,
            subcommand,
            extraArgs,
            tmpFile,
            error: error instanceof Error
                ? {
                    message: error.message,
                    stack: error.stack,
                    name: error.name,
                }
                : String(error),
            timestamp: new Date().toISOString(),
        });
        return {
            fallback: true,
            error: error instanceof Error ? error.message : String(error),
            subcommand,
            extraArgs,
        };
    }
    finally {
        try {
            unlinkSync(tmpFile);
        }
        catch {
            /* ignore */
        }
        try {
            // 使用rmSync递归删除目录及其内容
            rmSync(tmpDir, { recursive: true, force: true });
        }
        catch (error) {
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
// --- API ---
/** 提取技术特征 */
export async function extractFeatures(text) {
    const result = await runCli(['extract-features', '--text', text]);
    if (isFallbackResult(result)) {
        console.warn('[PatentCoreBridge] extractFeatures 降级到 TypeScript 实现');
        return extractFeaturesFallback(text);
    }
    return result;
}
/** 解析交底书结构 */
export async function parseDisclosure(text) {
    const result = await runCli(['parse-disclosure', '--text', text]);
    if (isFallbackResult(result)) {
        console.warn('[PatentCoreBridge] parseDisclosure 降级到 TypeScript 实现');
        return parseDisclosureFallback(text);
    }
    return result;
}
/** 生成权利要求 */
export async function generateClaims(title, solution, inventionType = 'product') {
    const result = await runCli([
        'generate-claims',
        '--title',
        title,
        '--solution',
        solution,
        '-t',
        inventionType,
    ]);
    if (isFallbackResult(result)) {
        console.warn('[PatentCoreBridge] generateClaims 降级到 TypeScript 实现');
        return generateClaimsFallback(title, solution, inventionType);
    }
    return result;
}
/** 解析审查意见 */
export async function parseOa(text) {
    return runCli(['parse-oa', '--text', text]);
}
/** 推荐答复策略 */
export async function recommendStrategy(oaJson) {
    return runCli(['recommend-strategy', '--oa-json', oaJson]);
}
/** 修改权利要求 */
export async function reviseClaims(claims, strategy = 'Hybrid') {
    return runCliWithStdin('revise-claims', ['-t', strategy], JSON.stringify(claims));
}
/** 评估权利要求质量 */
export async function assessQuality(claims) {
    return runCliWithStdin('assess-quality', [], JSON.stringify(claims));
}
/** IPC 分类 */
export async function classifyIpc(text) {
    const result = await runCli(['classify-ipc', '--text', text]);
    if (isFallbackResult(result)) {
        console.warn('[PatentCoreBridge] classifyIpc 降级到 TypeScript 实现');
        return classifyIpcFallback(text);
    }
    return result;
}
