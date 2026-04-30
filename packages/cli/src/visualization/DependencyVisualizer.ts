/**
 * 任务依赖图可视化器
 *
 * 整合文本渲染、TUI渲染和导出功能
 */

import type {
  HierarchicalPlan,
  VisualizationOptions,
  TUIRenderOptions,
  TextRenderOptions,
  ExportOptions,
  RenderResult,
} from './types.js';
import { ExportFormat } from './types.js';
import { TextRenderer } from './TextRenderer.js';
import { TUIRenderer } from './TUIRenderer.js';
import { writeFile } from 'fs/promises';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * 依赖图可视化器
 */
export class DependencyVisualizer {
  private textRenderer: TextRenderer;
  private tuiRenderer: TUIRenderer;

  constructor() {
    this.textRenderer = new TextRenderer();
    this.tuiRenderer = new TUIRenderer();
  }

  /**
   * 渲染为指定格式
   */
  render(plan: HierarchicalPlan, options: VisualizationOptions = { format: 'text' }): RenderResult {
    switch (options.format) {
      case 'tree':
      case 'graph':
        return this.textRenderer.render(plan, {
          ...options,
          format: options.format,
        } as TextRenderOptions);

      case 'tui' as any:
        return this.tuiRenderer.render(plan, {
          ...options,
          refreshRate: 1000,
          enableKeyboardNav: true,
          showHelp: true,
        } as TUIRenderOptions);

      default:
        return this.textRenderer.render(plan, {
          ...options,
          format: 'text',
        } as TextRenderOptions);
    }
  }

  /**
   * 导出为指定格式
   */
  async export(plan: HierarchicalPlan, options: ExportOptions): Promise<void> {
    switch (options.format) {
      case ExportFormat.DOT:
        await this.exportAsDOT(plan, options.outputPath);
        break;

      case ExportFormat.PNG:
        await this.exportAsPNG(plan, options);
        break;

      case ExportFormat.SVG:
        await this.exportAsSVG(plan, options);
        break;

      case ExportFormat.JSON:
        await this.exportAsJSON(plan, options.outputPath);
        break;

      case ExportFormat.MERMAID:
        await this.exportAsMermaid(plan, options.outputPath);
        break;

      default:
        throw new Error(`不支持的导出格式: ${options.format}`);
    }
  }

  /**
   * 导出为DOT格式
   */
  private async exportAsDOT(plan: HierarchicalPlan, outputPath: string): Promise<void> {
    const dotContent = this.textRenderer.exportToDOT(plan);
    await writeFile(outputPath, dotContent, 'utf-8');
  }

  /**
   * 导出为Mermaid格式
   */
  private async exportAsMermaid(plan: HierarchicalPlan, outputPath: string): Promise<void> {
    const mermaidContent = this.textRenderer.exportToMermaid(plan);
    await writeFile(outputPath, mermaidContent, 'utf-8');
  }

  /**
   * 导出为JSON格式
   */
  private async exportAsJSON(plan: HierarchicalPlan, outputPath: string): Promise<void> {
    const jsonContent = JSON.stringify(plan, null, 2);
    await writeFile(outputPath, jsonContent, 'utf-8');
  }

  /**
   * 导出为PNG图片
   */
  private async exportAsPNG(plan: HierarchicalPlan, options: ExportOptions): Promise<void> {
    // 1. 先生成DOT文件
    const dotPath = options.outputPath.replace('.png', '.dot');
    await this.exportAsDOT(plan, dotPath);

    // 2. 使用Graphviz的dot命令转换为PNG
    const width = options.width || 1200;
    const height = options.height || 800;
    const dpi = options.dpi || 300;

    try {
      const command = `dot -Tpng -Gsize=${width / dpi},${height / dpi}\\! -Gdpi=${dpi} -o "${options.outputPath}" "${dotPath}"`;
      await execAsync(command);

      // 3. 清理临时DOT文件
      await execAsync(`rm "${dotPath}"`);
    } catch (error) {
      throw new Error(`导出PNG失败: ${error}. 请确保已安装Graphviz (brew install graphviz)`);
    }
  }

  /**
   * 导出为SVG矢量图
   */
  private async exportAsSVG(plan: HierarchicalPlan, options: ExportOptions): Promise<void> {
    // 1. 先生成DOT文件
    const dotPath = options.outputPath.replace('.svg', '.dot');
    await this.exportAsDOT(plan, dotPath);

    // 2. 使用Graphviz的dot命令转换为SVG
    try {
      const command = `dot -Tsvg -o "${options.outputPath}" "${dotPath}"`;
      await execAsync(command);

      // 3. 清理临时DOT文件
      await execAsync(`rm "${dotPath}"`);
    } catch (error) {
      throw new Error(`导出SVG失败: ${error}. 请确保已安装Graphviz (brew install graphviz)`);
    }
  }

  /**
   * 获取文本渲染器
   */
  getTextRenderer(): TextRenderer {
    return this.textRenderer;
  }

  /**
   * 获取TUI渲染器
   */
  getTUIRenderer(): TUIRenderer {
    return this.tuiRenderer;
  }

  /**
   * 检查导出依赖
   */
  async checkExportDependencies(format: ExportFormat): Promise<{
    available: boolean;
    message: string;
  }> {
    if (format === ExportFormat.PNG || format === ExportFormat.SVG) {
      try {
        await execAsync('which dot');
        return { available: true, message: 'Graphviz已安装' };
      } catch {
        return {
          available: false,
          message: '需要安装Graphviz: brew install graphviz',
        };
      }
    }

    return { available: true, message: '导出依赖已满足' };
  }

  /**
   * 获取支持的导出格式
   */
  getSupportedFormats(): ExportFormat[] {
    return Object.values(ExportFormat);
  }

  /**
   * 获取格式描述
   */
  getFormatDescription(format: ExportFormat): string {
    const descriptions: Record<ExportFormat, string> = {
      [ExportFormat.DOT]: 'Graphviz DOT格式 (文本)',
      [ExportFormat.PNG]: 'PNG图片 (需要Graphviz)',
      [ExportFormat.SVG]: 'SVG矢量图 (需要Graphviz)',
      [ExportFormat.JSON]: 'JSON格式 (数据)',
      [ExportFormat.MERMAID]: 'Mermaid图表格式',
    };

    return descriptions[format] || format;
  }
}
