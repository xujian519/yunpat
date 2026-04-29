#!/bin/bash

echo "========================================"
echo "工具完整性快速验证"
echo "========================================"

# 颜色定义
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 验证计数器
TOTAL_TOOLS=0
VALID_TOOLS=0
TOTAL_ERRORS=0

echo ""
echo "📦 检查包导出..."
echo "----------------------------------------"

# 检查builtin-tools导出
echo -n "builtin-tools 导出: "
if grep -q "WebNavigateTool" packages/builtin-tools/src/index.ts && \
   grep -q "WebScrollTool" packages/builtin-tools/src/index.ts; then
    echo -e "${GREEN}✅ 通过${NC}"
else
    echo -e "${RED}❌ 失败${NC}"
    TOTAL_ERRORS=$((TOTAL_ERRORS + 1))
fi

# 检查document-tools导出
echo -n "document-tools 导出: "
if grep -q "PdfExtractTextTool" packages/document-tools/src/index.ts && \
   grep -q "DocumentConverterTool" packages/document-tools/src/index.ts; then
    echo -e "${GREEN}✅ 通过${NC}"
else
    echo -e "${RED}❌ 失败${NC}"
    TOTAL_ERRORS=$((TOTAL_ERRORS + 1))
fi

echo ""
echo "🔨 检查构建产物..."
echo "----------------------------------------"

# 检查builtin-tools构建
echo -n "builtin-tools 构建: "
if [ -d "packages/builtin-tools/dist" ]; then
    JS_COUNT=$(find packages/builtin-tools/dist -name "*.js" | wc -l)
    echo -e "${GREEN}✅ 存在${NC} (${JS_COUNT} 个JS文件)"
else
    echo -e "${RED}❌ 缺失${NC}"
    TOTAL_ERRORS=$((TOTAL_ERRORS + 1))
fi

# 检查document-tools构建
echo -n "document-tools 构建: "
if [ -d "packages/document-tools/dist" ]; then
    JS_COUNT=$(find packages/document-tools/dist -name "*.js" | wc -l)
    echo -e "${GREEN}✅ 存在${NC} (${JS_COUNT} 个JS文件)"
else
    echo -e "${RED}❌ 缺失${NC}"
    TOTAL_ERRORS=$((TOTAL_ERRORS + 1))
fi

echo ""
echo "📱 浏览器工具验证 (10个)..."
echo "----------------------------------------"

BROWSER_TOOLS=(
    "WebNavigateTool"
    "WebFindTabTool"
    "WebSnapshotTool"
    "WebClickTool"
    "WebFillTool"
    "WebEvaluateTool"
    "WebScreenshotTool"
    "WebWaitTool"
    "WebExtractTextTool"
    "WebScrollTool"
)

for tool in "${BROWSER_TOOLS[@]}"; do
    TOTAL_TOOLS=$((TOTAL_TOOLS + 1))
    echo -n "  ${tool}: "

    # 检查是否在源文件中定义
    if grep -q "export class ${tool}" packages/builtin-tools/src/browser/WebTools.ts; then
        # 检查是否在导出文件中
        if grep -q "${tool}" packages/builtin-tools/src/index.ts; then
            # 检查是否有metadata
            if grep -A 30 "export class ${tool}" packages/builtin-tools/src/browser/WebTools.ts | grep -q "readonly metadata"; then
                echo -e "${GREEN}✅${NC}"
                VALID_TOOLS=$((VALID_TOOLS + 1))
            else
                echo -e "${YELLOW}⚠️  缺少metadata${NC}"
                TOTAL_ERRORS=$((TOTAL_ERRORS + 1))
            fi
        else
            echo -e "${YELLOW}⚠️  未导出${NC}"
            TOTAL_ERRORS=$((TOTAL_ERRORS + 1))
        fi
    else
        echo -e "${RED}❌ 未定义${NC}"
        TOTAL_ERRORS=$((TOTAL_ERRORS + 1))
    fi
done

echo ""
echo "📄 文档解析工具验证 (19个)..."
echo "----------------------------------------"

DOCUMENT_TOOLS=(
    "PdfExtractTextTool"
    "PdfParseTool"
    "PdfToMarkdownTool"
    "PdfOcrTool"
    "DocxExtractTextTool"
    "DocxToHtmlTool"
    "DocxToMarkdownTool"
    "DocxParseTool"
    "ExcelReadTool"
    "ExcelToJsonTool"
    "ExcelToMarkdownTool"
    "ExcelParseTool"
    "ImageOcrTool"
    "BatchImageOcrTool"
    "ImageToMarkdownTool"
    "AudioTranscriptionTool"
    "AudioToSrtTool"
    "AudioToVttTool"
    "AudioToMarkdownTool"
    "UniversalDocumentParserTool"
)

# 注意：BatchDocumentParserTool和DocumentConverterTool也在UniversalDocumentTool.ts中
EXTRA_TOOLS=(
    "BatchDocumentParserTool"
    "DocumentConverterTool"
)

for tool in "${DOCUMENT_TOOLS[@]}" "${EXTRA_TOOLS[@]}"; do
    TOTAL_TOOLS=$((TOTAL_TOOLS + 1))
    echo -n "  ${tool}: "

    # 查找工具定义的文件
    TOOL_FILE=""
    if grep -q "export class ${tool}" packages/document-tools/src/tools/PdfTools.ts 2>/dev/null; then
        TOOL_FILE="packages/document-tools/src/tools/PdfTools.ts"
    elif grep -q "export class ${tool}" packages/document-tools/src/tools/DocxTools.ts 2>/dev/null; then
        TOOL_FILE="packages/document-tools/src/tools/DocxTools.ts"
    elif grep -q "export class ${tool}" packages/document-tools/src/tools/ExcelTools.ts 2>/dev/null; then
        TOOL_FILE="packages/document-tools/src/tools/ExcelTools.ts"
    elif grep -q "export class ${tool}" packages/document-tools/src/tools/OcrTools.ts 2>/dev/null; then
        TOOL_FILE="packages/document-tools/src/tools/OcrTools.ts"
    elif grep -q "export class ${tool}" packages/document-tools/src/tools/AudioTools.ts 2>/dev/null; then
        TOOL_FILE="packages/document-tools/src/tools/AudioTools.ts"
    elif grep -q "export class ${tool}" packages/document-tools/src/tools/UniversalDocumentTool.ts 2>/dev/null; then
        TOOL_FILE="packages/document-tools/src/tools/UniversalDocumentTool.ts"
    fi

    if [ -n "$TOOL_FILE" ]; then
        # 检查是否在导出文件中
        if grep -q "${tool}" packages/document-tools/src/index.ts; then
            # 检查是否有metadata
            if grep -A 30 "export class ${tool}" "$TOOL_FILE" | grep -q "readonly metadata"; then
                echo -e "${GREEN}✅${NC}"
                VALID_TOOLS=$((VALID_TOOLS + 1))
            else
                echo -e "${YELLOW}⚠️  缺少metadata${NC}"
                TOTAL_ERRORS=$((TOTAL_ERRORS + 1))
            fi
        else
            echo -e "${YELLOW}⚠️  未导出${NC}"
            TOTAL_ERRORS=$((TOTAL_ERRORS + 1))
        fi
    else
        echo -e "${RED}❌ 未定义${NC}"
        TOTAL_ERRORS=$((TOTAL_ERRORS + 1))
    fi
done

echo ""
echo "🏷️  类型定义验证..."
echo "----------------------------------------"

# 检查document-types
echo -n "DocumentType 枚举: "
if grep -q "enum DocumentType" packages/document-tools/src/types/document.ts; then
    echo -e "${GREEN}✅${NC}"
else
    echo -e "${RED}❌${NC}"
    TOTAL_ERRORS=$((TOTAL_ERRORS + 1))
fi

echo -n "ElementType 枚举: "
if grep -q "enum ElementType" packages/document-tools/src/types/document.ts; then
    echo -e "${GREEN}✅${NC}"
else
    echo -e "${RED}❌${NC}"
    TOTAL_ERRORS=$((TOTAL_ERRORS + 1))
fi

echo -n "OutputFormat 枚举: "
if grep -q "enum OutputFormat" packages/document-tools/src/types/document.ts; then
    echo -e "${GREEN}✅${NC}"
else
    echo -e "${RED}❌${NC}"
    TOTAL_ERRORS=$((TOTAL_ERRORS + 1))
fi

echo ""
echo "🎯 ToolCategory 验证..."
echo "----------------------------------------"

echo -n "DOCUMENT 类别存在: "
if grep -q "DOCUMENT = 'document'" packages/core/src/tools/types.ts; then
    echo -e "${GREEN}✅${NC}"
else
    echo -e "${RED}❌${NC}"
    TOTAL_ERRORS=$((TOTAL_ERRORS + 1))
fi

echo ""
echo "========================================"
echo "验证总结"
echo "========================================"
echo "总工具数: ${TOTAL_TOOLS}"
PERCENT=$(awk "BEGIN {printf \"%.1f\", (${VALID_TOOLS}*100.0/${TOTAL_TOOLS})}")
echo -e "有效工具: ${GREEN}${VALID_TOOLS}${NC} (${PERCENT}%)"
echo -e "错误总数: ${RED}${TOTAL_ERRORS}${NC}"
echo "========================================"
echo ""

# 最终结论
if [ $TOTAL_ERRORS -eq 0 ] && [ $VALID_TOOLS -eq $TOTAL_TOOLS ]; then
    echo -e "${GREEN}✅ 所有验证通过！工具完全可用。${NC}"
    echo ""
    exit 0
else
    echo -e "${RED}❌ 验证发现问题，请检查上述错误。${NC}"
    echo ""
    exit 1
fi
