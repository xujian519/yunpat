use std::path::Path;

#[derive(Debug, Clone)]
pub enum DocumentFormat {
    Pdf,
    Docx,
    Excel,
    Pptx,
    Image,
    Markdown,
    Text,
    Json,
}

impl DocumentFormat {
    pub fn from_extension(path: &str) -> Option<Self> {
        let ext = Path::new(path)
            .extension()
            .and_then(|e| e.to_str())
            .unwrap_or("")
            .to_lowercase();

        match ext.as_str() {
            "pdf" => Some(Self::Pdf),
            "docx" | "doc" => Some(Self::Docx),
            "xlsx" | "xls" | "csv" => Some(Self::Excel),
            "pptx" | "ppt" => Some(Self::Pptx),
            "png" | "jpg" | "jpeg" | "bmp" | "gif" | "tiff" => Some(Self::Image),
            "md" | "markdown" => Some(Self::Markdown),
            "txt" | "text" => Some(Self::Text),
            "json" => Some(Self::Json),
            _ => None,
        }
    }

    pub fn to_extension(&self) -> &str {
        match self {
            Self::Pdf => "pdf",
            Self::Docx => "docx",
            Self::Excel => "xlsx",
            Self::Pptx => "pptx",
            Self::Image => "png",
            Self::Markdown => "md",
            Self::Text => "txt",
            Self::Json => "json",
        }
    }
}

#[derive(Debug, Clone)]
pub struct ParseResult {
    pub text: String,
    pub metadata: serde_json::Value,
    pub format: DocumentFormat,
}

pub struct DocumentParser;

impl DocumentParser {
    pub fn new() -> Self {
        Self
    }

    pub async fn parse_file(&self, file_path: &str) -> anyhow::Result<ParseResult> {
        let format = DocumentFormat::from_extension(file_path)
            .ok_or_else(|| anyhow::anyhow!("不支持的文件格式: {}", file_path))?;

        let (text, metadata) = match format {
            DocumentFormat::Markdown | DocumentFormat::Text => {
                let text = tokio::fs::read_to_string(file_path).await?;
                let metadata = serde_json::json!({
                    "format": format.to_extension(),
                    "size": text.len(),
                });
                (text, metadata)
            }
            DocumentFormat::Json => {
                let text = tokio::fs::read_to_string(file_path).await?;
                let parsed: serde_json::Value = serde_json::from_str(&text)?;
                let metadata = serde_json::json!({
                    "format": "json",
                    "size": text.len(),
                });
                (serde_json::to_string_pretty(&parsed)?, metadata)
            }
            DocumentFormat::Pdf => {
                let bytes = tokio::fs::read(file_path).await?;
                let text = Self::parse_pdf(&bytes)?;
                let metadata = serde_json::json!({
                    "format": "pdf",
                    "size": bytes.len(),
                    "pages": text.matches("\n\n--- Page ").count() + 1,
                });
                (text, metadata)
            }
            DocumentFormat::Excel => {
                let bytes = tokio::fs::read(file_path).await?;
                let text = Self::parse_excel(&bytes)?;
                let metadata = serde_json::json!({
                    "format": "excel",
                    "size": bytes.len(),
                });
                (text, metadata)
            }
            _ => {
                let text = format!("[暂不支持解析此格式: {}]", file_path);
                let metadata = serde_json::json!({
                    "format": format.to_extension(),
                    "note": "此格式暂不支持"
                });
                (text, metadata)
            }
        };

        Ok(ParseResult {
            text,
            metadata,
            format,
        })
    }

    fn parse_pdf(bytes: &[u8]) -> anyhow::Result<String> {
        use lopdf::Document;
        use std::io::Cursor;

        let doc = Document::load_from(Cursor::new(bytes))?;
        let mut pages_text = Vec::new();

        for (page_num, page_id) in doc.get_pages().iter().enumerate() {
            let page_num_u32 = *page_id.0;
            if let Ok(text) = doc.extract_text(&[page_num_u32]) {
                pages_text.push(format!("--- Page {} ---\n{}", page_num + 1, text));
            }
        }

        Ok(pages_text.join("\n\n"))
    }

    fn parse_excel(bytes: &[u8]) -> anyhow::Result<String> {
        use calamine::{Reader, Xlsx};
        use std::io::Cursor;

        let cursor = Cursor::new(bytes);
        let mut workbook: Xlsx<_> = Reader::new(cursor)?;
        let mut sheets_text = Vec::new();

        let sheet_names = workbook.sheet_names().to_owned();
        for sheet_name in sheet_names {
            if let Ok(range) = workbook.worksheet_range(&sheet_name) {
                let mut rows = Vec::new();
                for row in range.rows() {
                    let cells: Vec<String> = row.iter().map(|c| c.to_string()).collect();
                    rows.push(cells.join("\t"));
                }
                sheets_text.push(format!("## Sheet: {}\n{}", sheet_name, rows.join("\n")));
            }
        }

        Ok(sheets_text.join("\n\n"))
    }

    pub async fn parse_to_markdown(&self, file_path: &str) -> anyhow::Result<String> {
        let result = self.parse_file(file_path).await?;

        match result.format {
            DocumentFormat::Markdown => Ok(result.text),
            DocumentFormat::Text => Ok(format!("```\n{}\n```", result.text)),
            DocumentFormat::Json => {
                let parsed: serde_json::Value = serde_json::from_str(&result.text)?;
                Ok(format!(
                    "```json\n{}\n```",
                    serde_json::to_string_pretty(&parsed)?
                ))
            }
            _ => Ok(format!(
                "## 文档: {}\n\n格式: {}\n\n{}",
                file_path,
                result.format.to_extension(),
                result.text
            )),
        }
    }
}

impl Default for DocumentParser {
    fn default() -> Self {
        Self::new()
    }
}

pub struct DocumentGenerator;

impl DocumentGenerator {
    pub fn new() -> Self {
        Self
    }

    pub async fn markdown_to_docx(&self, markdown: &str, output_path: &str) -> anyhow::Result<()> {
        let docx = self.parse_markdown_to_docx(markdown)?;

        let file = std::fs::File::create(output_path)?;
        docx.build().pack(file)?;

        Ok(())
    }

    fn parse_markdown_to_docx(&self, markdown: &str) -> anyhow::Result<docx_rs::Docx> {
        use docx_rs::*;

        let mut docx = Docx::new();
        let lines: Vec<&str> = markdown.lines().collect();
        let mut i = 0;

        while i < lines.len() {
            let line = lines[i];

            if line.is_empty() {
                i += 1;
                continue;
            }

            if line.starts_with("# ") {
                let text = line.trim_start_matches("# ").trim();
                docx = docx.add_paragraph(
                    Paragraph::new()
                        .add_run(Run::new().add_text(text).bold().size(32))
                        .style("Heading1"),
                );
            } else if line.starts_with("## ") {
                let text = line.trim_start_matches("## ").trim();
                docx = docx.add_paragraph(
                    Paragraph::new()
                        .add_run(Run::new().add_text(text).bold().size(28))
                        .style("Heading2"),
                );
            } else if line.starts_with("### ") {
                let text = line.trim_start_matches("### ").trim();
                docx = docx.add_paragraph(
                    Paragraph::new()
                        .add_run(Run::new().add_text(text).bold().size(24))
                        .style("Heading3"),
                );
            } else if line.starts_with("```") {
                let _lang = line.trim_start_matches("`").trim();
                i += 1;
                let mut code_lines = Vec::new();
                while i < lines.len() && !lines[i].starts_with("```") {
                    code_lines.push(lines[i]);
                    i += 1;
                }
                let code = code_lines.join("\n");
                docx = docx.add_paragraph(
                    Paragraph::new()
                        .add_run(Run::new().add_text(code).size(20))
                        .style("Code"),
                );
            } else if line.starts_with("- ") || line.starts_with("* ") {
                let text = line
                    .trim_start_matches("- ")
                    .trim_start_matches("* ")
                    .trim();
                docx = docx.add_paragraph(
                    Paragraph::new()
                        .add_run(Run::new().add_text(format!("• {}", text)))
                        .indent(Some(720), None, None, None),
                );
            } else if line.chars().next().is_some_and(|c| c.is_ascii_digit()) && line.contains(". ")
            {
                let text = line.split_once(". ").map(|x| x.1).unwrap_or(line).trim();
                docx = docx.add_paragraph(
                    Paragraph::new()
                        .add_run(Run::new().add_text(format!(
                            "{}. {}",
                            line.chars().next().unwrap(),
                            text
                        )))
                        .indent(Some(720), None, None, None),
                );
            } else if line.starts_with("> ") {
                let text = line.trim_start_matches("> ").trim();
                docx = docx.add_paragraph(
                    Paragraph::new()
                        .add_run(Run::new().add_text(text).italic())
                        .style("Quote"),
                );
            } else {
                docx = self.add_formatted_paragraph(docx, line);
            }

            i += 1;
        }

        Ok(docx)
    }

    fn add_formatted_paragraph(&self, docx: docx_rs::Docx, text: &str) -> docx_rs::Docx {
        use docx_rs::*;

        let mut paragraph = Paragraph::new();
        let mut chars = text.chars().peekable();
        let mut in_bold = false;
        let mut in_italic = false;
        let mut run_text = String::new();

        while let Some(ch) = chars.next() {
            match ch {
                '*' if chars.peek() == Some(&'*') => {
                    if !run_text.is_empty() {
                        let mut run = Run::new().add_text(&run_text);
                        if in_bold {
                            run = run.bold();
                        }
                        if in_italic {
                            run = run.italic();
                        }
                        paragraph = paragraph.add_run(run);
                        run_text.clear();
                    }

                    chars.next();
                    in_bold = !in_bold;
                }
                '*' => {
                    if !run_text.is_empty() {
                        let mut run = Run::new().add_text(&run_text);
                        if in_bold {
                            run = run.bold();
                        }
                        if in_italic {
                            run = run.italic();
                        }
                        paragraph = paragraph.add_run(run);
                        run_text.clear();
                    }
                    in_italic = !in_italic;
                }
                _ => {
                    run_text.push(ch);
                }
            }
        }

        if !run_text.is_empty() {
            let mut run = Run::new().add_text(&run_text);
            if in_bold {
                run = run.bold();
            }
            if in_italic {
                run = run.italic();
            }
            paragraph = paragraph.add_run(run);
        }

        if paragraph.children.is_empty() {
            paragraph = paragraph.add_run(Run::new().add_text(""));
        }

        docx.add_paragraph(paragraph)
    }

    pub async fn generate_report(
        &self,
        title: &str,
        content: &str,
        output_path: &str,
    ) -> anyhow::Result<()> {
        let report = format!("# {}\n\n{}\n", title, content);

        tokio::fs::write(output_path, report).await?;
        Ok(())
    }
}

impl Default for DocumentGenerator {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_document_format_from_extension() {
        assert!(matches!(
            DocumentFormat::from_extension("test.pdf"),
            Some(DocumentFormat::Pdf)
        ));
        assert!(matches!(
            DocumentFormat::from_extension("test.docx"),
            Some(DocumentFormat::Docx)
        ));
        assert!(matches!(
            DocumentFormat::from_extension("test.xlsx"),
            Some(DocumentFormat::Excel)
        ));
        assert!(matches!(
            DocumentFormat::from_extension("test.md"),
            Some(DocumentFormat::Markdown)
        ));
    }

    #[tokio::test]
    async fn test_parse_markdown_file() {
        let parser = DocumentParser::new();
        let temp_file = std::env::temp_dir().join("test_doc.md");
        tokio::fs::write(&temp_file, "# 测试文档\n\n这是一段内容。")
            .await
            .expect("写入测试文件失败");

        let result = parser.parse_file(temp_file.to_str().unwrap()).await;
        assert!(result.is_ok());

        let parsed = result.unwrap();
        assert_eq!(parsed.text, "# 测试文档\n\n这是一段内容。");

        tokio::fs::remove_file(temp_file).await.ok();
    }

    #[tokio::test]
    async fn test_parse_to_markdown() {
        let parser = DocumentParser::new();
        let temp_file = std::env::temp_dir().join("test_doc.txt");
        tokio::fs::write(&temp_file, "纯文本内容")
            .await
            .expect("写入测试文件失败");

        let result = parser.parse_to_markdown(temp_file.to_str().unwrap()).await;
        assert!(result.is_ok());
        assert!(result.unwrap().contains("纯文本内容"));

        tokio::fs::remove_file(temp_file).await.ok();
    }

    #[tokio::test]
    async fn test_generate_report() {
        let generator = DocumentGenerator::new();
        let output_path = std::env::temp_dir().join("test_report.md");

        let result = generator
            .generate_report("测试报告", "报告内容", output_path.to_str().unwrap())
            .await;
        assert!(result.is_ok());

        let content = tokio::fs::read_to_string(&output_path)
            .await
            .expect("读取报告失败");
        assert!(content.contains("测试报告"));
        assert!(content.contains("报告内容"));

        tokio::fs::remove_file(output_path).await.ok();
    }

    #[tokio::test]
    async fn test_markdown_to_docx() {
        let generator = DocumentGenerator::new();
        let output_path = std::env::temp_dir().join("test_output.docx");
        let markdown = r#"# 测试标题

这是普通段落，包含**粗体**和*斜体*文本。

## 二级标题

- 列表项 1
- 列表项 2

1. 数字列表 1
2. 数字列表 2

> 这是一段引用

```rust
let x = 1;
```
"#;

        let result = generator
            .markdown_to_docx(markdown, output_path.to_str().unwrap())
            .await;
        assert!(result.is_ok(), "DOCX 生成失败: {:?}", result.err());

        assert!(output_path.exists(), "DOCX 文件未创建");

        let metadata = tokio::fs::metadata(&output_path)
            .await
            .expect("读取文件元数据失败");
        assert!(metadata.len() > 0, "DOCX 文件为空");

        tokio::fs::remove_file(output_path).await.ok();
    }

    #[test]
    fn test_parse_markdown_headings() {
        let generator = DocumentGenerator::new();
        let markdown = "# 一级标题\n## 二级标题\n### 三级标题";
        let docx = generator.parse_markdown_to_docx(markdown).unwrap();
        let _ = docx.build();
    }

    #[test]
    fn test_parse_markdown_formatting() {
        let generator = DocumentGenerator::new();
        let markdown = "这是**粗体**和*斜体*文本";
        let docx = generator.parse_markdown_to_docx(markdown).unwrap();
        let _ = docx.build();
    }
}
