# YunPat 辅助服务

独立部署的专业识别和下载服务，为 YunPat 智能体提供图像识别和专利文件获取能力。

---

## 服务列表

### 1. 化学结构识别服务

端口: 8766

功能：识别图片中的化学结构（分子式、反应方程式等），输出 SMILES 格式。

安装与启动：

```bash
cd services/chemical-structure-service
pip install -r requirements.txt
python main.py
```

API 接口：

- `POST /recognize` -- 识别化学结构

```json
{
  "image_data": "base64_encoded_image_data",
  "image_format": "png",
  "output_format": "smiles"
}
```

技术栈：FastAPI + Imago (EPAM 开源工具)

---

### 2. 数学公式识别服务

端口: 8767

功能：识别图片中的数学公式，输出 LaTeX 格式。

安装与启动：

```bash
cd services/math-formula-service
pip install -r requirements.txt
python main.py
```

API 接口：

- `POST /recognize` -- 识别数学公式

```json
{
  "image_data": "base64_encoded_image_data",
  "image_format": "png"
}
```

技术栈：FastAPI + Pix2Text (开源 Mathpix 替代品)

---

### 3. 专利下载服务

端口: 8765

功能：基于 Google Patents 的专利 PDF 下载服务，支持单个和批量下载。

安装与启动：

```bash
cd services/patent-download-service
pip install -r requirements.txt
python main.py
```

API 接口：

- `POST /download` -- 下载单个专利

```json
{
  "patent": "US4405829A1",
  "output_path": "./downloads",
  "waiting_time": 6
}
```

- `POST /download/batch` -- 批量下载专利

```json
{
  "patents": ["US4405829A1", "EP0551921B1"],
  "output_path": "./downloads"
}
```

- `GET /health` -- 健康检查

技术栈：FastAPI + Selenium + GooglePatentsPdfDownloader

注意事项：

- 需要安装 Chrome 或 Brave 浏览器
- 首次运行会自动下载 ChromeDriver
- 默认使用 headless 模式

---

## 通用注意事项

### Python 环境

- Python 3.8+
- 建议使用虚拟环境

### 硬件要求

- CPU: 支持 SSE4.2
- RAM: 至少 4GB
- GPU: 可选，用于加速识别

### 模型下载

首次使用化学结构和数学公式识别服务时，会自动下载机器学习模型，可能需要较长时间。

---

## 许可证

MIT

---

最后更新: 2026-05-06
