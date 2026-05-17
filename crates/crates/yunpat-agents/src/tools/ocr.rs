use std::path::Path;

#[derive(Debug, Clone)]
pub struct OcrResult {
    pub text: String,
    pub confidence: Option<f32>,
    pub language: String,
}

#[derive(Debug)]
pub struct OcrTool;

impl OcrTool {
    pub fn new() -> Self {
        Self
    }

    pub async fn recognize_image(
        &self,
        image_path: &str,
        language: Option<&str>,
    ) -> anyhow::Result<OcrResult> {
        let path = Path::new(image_path);
        if !path.exists() {
            return Err(anyhow::anyhow!("图片文件不存在: {}", image_path));
        }

        let lang = language.unwrap_or("chi_sim+eng");

        #[cfg(feature = "ocr")]
        {
            self.recognize_with_tesseract(image_path, lang).await
        }

        #[cfg(not(feature = "ocr"))]
        {
            let file_size = tokio::fs::metadata(image_path).await?.len();
            Ok(OcrResult {
                text: format!(
                    "[OCR 功能未启用]\n\n\
                     图片: {}\n\
                     大小: {} bytes\n\
                     语言: {}\n\n\
                     要启用 OCR 功能，请使用 --features ocr 编译，\n\
                     并确保系统已安装 Tesseract OCR 引擎。\n\n\
                     macOS: brew install tesseract tesseract-lang\n\
                     Ubuntu: sudo apt-get install tesseract-ocr tesseract-ocr-chi-sim\n\
                     Windows: 从 https://github.com/UB-Mannheim/tesseract/wiki 下载安装程序",
                    image_path, file_size, lang
                ),
                confidence: None,
                language: lang.to_string(),
            })
        }
    }

    #[cfg(feature = "ocr")]
    async fn recognize_with_tesseract(
        &self,
        image_path: &str,
        language: &str,
    ) -> anyhow::Result<OcrResult> {
        use std::io::Cursor;
        use tesseract::Tesseract;

        let image_bytes = tokio::fs::read(image_path).await?;
        let img = image::ImageReader::new(Cursor::new(&image_bytes))
            .with_guessed_format()?
            .decode()?;

        let (width, height) = (img.width(), img.height());
        let rgb_img = img.to_rgb8();
        let raw_pixels = rgb_img.as_raw();

        let mut tess = Tesseract::new(None, Some(language))
            .map_err(|e| anyhow::anyhow!("Tesseract 初始化失败: {:?}", e))?;

        tess = tess
            .set_frame(
                raw_pixels,
                width as i32,
                height as i32,
                3,
                (width * 3) as i32,
            )
            .map_err(|e| anyhow::anyhow!("设置图片失败: {:?}", e))?;

        let text = tess.get_text().map_err(|e| anyhow::anyhow!("OCR 识别失败: {:?}", e))?;

        let confidence = Some(tess.mean_text_conf() as f32);

        Ok(OcrResult {
            text: text.trim().to_string(),
            confidence,
            language: language.to_string(),
        })
    }

    pub async fn recognize_multiple(
        &self,
        image_paths: &[String],
        language: Option<&str>,
    ) -> anyhow::Result<Vec<OcrResult>> {
        let mut results = Vec::new();
        for path in image_paths {
            match self.recognize_image(path, language).await {
                Ok(result) => results.push(result),
                Err(e) => results.push(OcrResult {
                    text: format!("[错误] {}: {}", path, e),
                    confidence: None,
                    language: language.unwrap_or("chi_sim+eng").to_string(),
                }),
            }
        }
        Ok(results)
    }
}

impl Default for OcrTool {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_ocr_tool_new() {
        let tool = OcrTool::new();
        let _ = format!("{:?}", tool);
    }

    #[tokio::test]
    async fn test_ocr_nonexistent_file() {
        let tool = OcrTool::new();
        let result = tool.recognize_image("/nonexistent/image.png", None).await;
        assert!(result.is_err());
        assert!(result.unwrap_err().to_string().contains("不存在"));
    }

    #[tokio::test]
    async fn test_ocr_without_feature_flag() {
        let tool = OcrTool::new();

        let temp_image = std::env::temp_dir().join("test_ocr_image.png");

        #[cfg(feature = "ocr")]
        {
            use image::ImageBuffer;
            let img: ImageBuffer<image::Rgb<u8>, Vec<u8>> =
                ImageBuffer::from_pixel(100, 30, image::Rgb([255, 255, 255]));
            img.save(&temp_image).expect("保存测试图片失败");
        }

        #[cfg(not(feature = "ocr"))]
        {
            tokio::fs::write(&temp_image, b"fake image data")
                .await
                .expect("写入测试文件失败");
        }

        let result = tool
            .recognize_image(temp_image.to_str().unwrap_or("test.png"), Some("eng"))
            .await;
        assert!(result.is_ok());

        #[cfg(not(feature = "ocr"))]
        {
            let ocr_result = result.expect("OCR 结果已验证 is_ok");
            assert!(ocr_result.text.contains("OCR 功能未启用"));
        }

        tokio::fs::remove_file(temp_image).await.ok();
    }
}
