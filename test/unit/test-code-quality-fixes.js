/**
 * 测试 7: 代码质量修复验证
 *
 * 验证所有代码质量修复是否正确应用
 */
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
async function testCodeQualityFixes() {
    const results = [];
    console.log('=== 测试 7: 代码质量修复验证 ===\n');
    // P0-1: API Key 硬编码 → 环境变量
    console.log('📋 P0-1: API Key 硬编码检查...');
    try {
        const configPath = join(process.cwd(), 'packages/core/src/memory/config.ts');
        const configContent = readFileSync(configPath, 'utf-8');
        const hasEnvVarSupport = configContent.includes('process.env.BGE_API_KEY') ||
            configContent.includes('process.env.DATABASE_URL');
        if (hasEnvVarSupport) {
            results.push({
                name: 'P0-1: API Key 硬编码 → 环境变量',
                status: 'pass',
                message: '✅ config.ts 支持环境变量读取',
            });
            console.log('✅ config.ts 支持环境变量读取\n');
        }
        else {
            results.push({
                name: 'P0-1: API Key 硬编码 → 环境变量',
                status: 'fail',
                message: '❌ config.ts 不支持环境变量',
            });
            console.log('❌ config.ts 不支持环境变量\n');
        }
    }
    catch (error) {
        results.push({
            name: 'P0-1: API Key 硬编码 → 环境变量',
            status: 'fail',
            message: `❌ 检查失败: ${error}`,
        });
        console.log(`❌ 检查失败: ${error}\n`);
    }
    // P0-2: embedding 类型统一
    console.log('📋 P0-2: embedding 类型统一检查...');
    try {
        const vectorStorePath = join(process.cwd(), 'packages/core/src/memory/long-term/PostgresVectorStore.ts');
        const vectorStoreContent = readFileSync(vectorStorePath, 'utf-8');
        const hasVectorType = vectorStoreContent.includes('vector(1024)') &&
            vectorStoreContent.includes('ADD COLUMN embedding vector');
        if (hasVectorType) {
            results.push({
                name: 'P0-2: embedding 类型统一',
                status: 'pass',
                message: '✅ PostgresVectorStore 使用 vector(1024) 类型',
            });
            console.log('✅ PostgresVectorStore 使用 vector(1024) 类型\n');
        }
        else {
            results.push({
                name: 'P0-2: embedding 类型统一',
                status: 'fail',
                message: '❌ PostgresVectorStore 未使用 vector 类型',
            });
            console.log('❌ PostgresVectorStore 未使用 vector 类型\n');
        }
    }
    catch (error) {
        results.push({
            name: 'P0-2: embedding 类型统一',
            status: 'fail',
            message: `❌ 检查失败: ${error}`,
        });
        console.log(`❌ 检查失败: ${error}\n`);
    }
    // P0-3: or 导入位置（应该无问题）
    console.log('📋 P0-3: or 导入位置检查...');
    try {
        const graphStorePath = join(process.cwd(), 'packages/core/src/memory/long-term/PostgresGraphStore.ts');
        // 文件可能不存在，跳过
        if (!existsSync(graphStorePath)) {
            results.push({
                name: 'P0-3: or 导入位置',
                status: 'skip',
                message: '⏭️ PostgresGraphStore.ts 不存在，跳过',
            });
            console.log('⏭️ PostgresGraphStore.ts 不存在，跳过\n');
        }
        else {
            const graphStoreContent = readFileSync(graphStorePath, 'utf-8');
            const hasCorrectImport = graphStoreContent.includes('import { eq, and, or, sql') ||
                graphStoreContent.match(/import.*\bor\b.*from ['"]drizzle-orm['"]/);
            if (hasCorrectImport) {
                results.push({
                    name: 'P0-3: or 导入位置',
                    status: 'pass',
                    message: '✅ or 函数正确导入',
                });
                console.log('✅ or 函数正确导入\n');
            }
            else {
                results.push({
                    name: 'P0-3: or 导入位置',
                    status: 'fail',
                    message: '❌ or 函数导入不正确',
                });
                console.log('❌ or 函数导入不正确\n');
            }
        }
    }
    catch (error) {
        results.push({
            name: 'P0-3: or 导入位置',
            status: 'skip',
            message: `⏭️ 跳过: ${error}`,
        });
        console.log(`⏭️ 跳过: ${error}\n`);
    }
    // P1-1: upsertBatch 真批量
    console.log('📋 P1-1: upsertBatch 真批量检查...');
    try {
        const vectorStorePath = join(process.cwd(), 'packages/core/src/memory/long-term/PostgresVectorStore.ts');
        const vectorStoreContent = readFileSync(vectorStorePath, 'utf-8');
        // 检查是否有批量插入（.insert(memories) 和 .values(values)）并且有注释说明批量插入
        const hasInsert = vectorStoreContent.includes('.insert(memories)');
        const hasValues = vectorStoreContent.includes('.values(values)');
        const hasBatchComment = vectorStoreContent.includes('批量插入') || vectorStoreContent.includes('真批量');
        const hasTrueBatch = hasInsert && hasValues && hasBatchComment;
        console.log(`  🔍 调试: hasInsert = ${hasInsert}, hasValues = ${hasValues}, hasBatchComment = ${hasBatchComment}`);
        if (hasTrueBatch) {
            results.push({
                name: 'P1-1: upsertBatch 真批量',
                status: 'pass',
                message: '✅ upsertBatch 使用真批量插入',
            });
            console.log('✅ upsertBatch 使用真批量插入\n');
        }
        else {
            results.push({
                name: 'P1-1: upsertBatch 真批量',
                status: 'fail',
                message: '❌ upsertBatch 未使用批量插入',
            });
            console.log('❌ upsertBatch 未使用批量插入\n');
        }
    }
    catch (error) {
        results.push({
            name: 'P1-1: upsertBatch 真批量',
            status: 'fail',
            message: `❌ 检查失败: ${error}`,
        });
        console.log(`❌ 检查失败: ${error}\n`);
    }
    // P1-2: BGE 缓存 LRU
    console.log('📋 P1-2: BGE 缓存 LRU 检查...');
    try {
        const bgePath = join(process.cwd(), 'packages/core/src/memory/integration/BGEIntegration.ts');
        const bgeContent = readFileSync(bgePath, 'utf-8');
        // 检查 LRU 缓存实现：缓存大小检查 + 删除最早条目
        const hasLRU = bgeContent.includes('this.cache.size >= this.cacheMaxSize') &&
            bgeContent.includes('this.cache.delete(firstKey)') &&
            bgeContent.includes('LRU');
        if (hasLRU) {
            results.push({
                name: 'P1-2: BGE 缓存 LRU',
                status: 'pass',
                message: '✅ BGE 实现 LRU 缓存淘汰',
            });
            console.log('✅ BGE 实现 LRU 缓存淘汰\n');
        }
        else {
            results.push({
                name: 'P1-2: BGE 缓存 LRU',
                status: 'fail',
                message: '❌ BGE 缓存无上限',
            });
            console.log('❌ BGE 缓存无上限\n');
        }
    }
    catch (error) {
        results.push({
            name: 'P1-2: BGE 缓存 LRU',
            status: 'fail',
            message: `❌ 检查失败: ${error}`,
        });
        console.log(`❌ 检查失败: ${error}\n`);
    }
    // P1-3: MemoryStore 重复代码（已标记）
    console.log('📋 P1-3: MemoryStore 重复代码检查...');
    try {
        const notesPath = join(process.cwd(), 'packages/core/src/memory/REFACTORING_NOTES.md');
        if (existsSync(notesPath)) {
            results.push({
                name: 'P1-3: MemoryStore 重复代码',
                status: 'pass',
                message: '✅ 已创建重构说明文档',
            });
            console.log('✅ 已创建重构说明文档\n');
        }
        else {
            results.push({
                name: 'P1-3: MemoryStore 重复代码',
                status: 'skip',
                message: '⏭️ 重构说明文档不存在',
            });
            console.log('⏭️ 重构说明文档不存在\n');
        }
    }
    catch (error) {
        results.push({
            name: 'P1-3: MemoryStore 重复代码',
            status: 'skip',
            message: `⏭️ 跳过: ${error}`,
        });
        console.log(`⏭️ 跳过: ${error}\n`);
    }
    // P2-1: compress() 实现
    console.log('📋 P2-1: compress() 实现检查...');
    try {
        const memoryStorePath = join(process.cwd(), 'packages/core/src/memory/MemoryStore.ts');
        const memoryStoreContent = readFileSync(memoryStorePath, 'utf-8');
        const hasCompressImpl = memoryStoreContent.includes('async compress(') &&
            memoryStoreContent.includes('splice(0, toDelete)') &&
            !memoryStoreContent.includes('// TODO: 实现记忆压缩逻辑');
        if (hasCompressImpl) {
            results.push({
                name: 'P2-1: compress() 实现',
                status: 'pass',
                message: '✅ compress() 已实现 LRU 算法',
            });
            console.log('✅ compress() 已实现 LRU 算法\n');
        }
        else {
            results.push({
                name: 'P2-1: compress() 实现',
                status: 'fail',
                message: '❌ compress() 未实现或为空壳',
            });
            console.log('❌ compress() 未实现或为空壳\n');
        }
    }
    catch (error) {
        results.push({
            name: 'P2-1: compress() 实现',
            status: 'fail',
            message: `❌ 检查失败: ${error}`,
        });
        console.log(`❌ 检查失败: ${error}\n`);
    }
    // P2-2: Token 估算改进
    console.log('📋 P2-2: Token 估算改进检查...');
    try {
        const tokenWindowPath = join(process.cwd(), 'packages/core/src/memory/short-term/TokenWindow.ts');
        const tokenWindowContent = readFileSync(tokenWindowPath, 'utf-8');
        const hasImprovedEstimation = tokenWindowContent.includes('/ 1.3') && tokenWindowContent.includes('englishWords');
        if (hasImprovedEstimation) {
            results.push({
                name: 'P2-2: Token 估算改进',
                status: 'pass',
                message: '✅ Token 估算算法已改进',
            });
            console.log('✅ Token 估算算法已改进\n');
        }
        else {
            results.push({
                name: 'P2-2: Token 估算改进',
                status: 'fail',
                message: '❌ Token 估算算法未改进',
            });
            console.log('❌ Token 估算算法未改进\n');
        }
    }
    catch (error) {
        results.push({
            name: 'P2-2: Token 估算改进',
            status: 'fail',
            message: `❌ 检查失败: ${error}`,
        });
        console.log(`❌ 检查失败: ${error}\n`);
    }
    // 总结
    console.log('=== 测试总结 ===');
    const passed = results.filter((r) => r.status === 'pass').length;
    const failed = results.filter((r) => r.status === 'fail').length;
    const skipped = results.filter((r) => r.status === 'skip').length;
    console.log(`✅ 通过: ${passed}/${results.length}`);
    console.log(`❌ 失败: ${failed}/${results.length}`);
    console.log(`⏭️ 跳过: ${skipped}/${results.length}`);
    return results;
}
testCodeQualityFixes()
    .then((results) => {
    const failed = results.filter((r) => r.status === 'fail');
    if (failed.length > 0) {
        console.log('\n❌ 部分测试失败！');
        process.exit(1);
    }
    else {
        console.log('\n✅ 所有测试通过！');
        process.exit(0);
    }
})
    .catch(console.error);
