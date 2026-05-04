# YunPat图像识别服务

## 服务列表

### 1. 化学结构识别服务

**端口**: 8766

**功能**: 识别图片中的化学结构（分子式、反应方程式等）

**安装依赖**:

```bash
cd services/chemical-structure-service
pip install -r requirements.txt
```

**启动服务**:

```bash
python main.py
```

**API接口**:

- POST /recognize - 识别化学结构
  ```json
  {
    "image_data": "base64_encoded_image_data",
    "image_format": "png",
    "output_format": "smiles"
  }
  ```

**技术栈**:

- FastAPI
- Imago (EPAM开源工具)

---

### 2. 数学公式识别服务

**端口**: 8767

**功能**: 识别图片中的数学公式（输出LaTeX）

**安装依赖**:

```bash
cd services/math-formula-service
pip install -r requirements.txt
```

**启动服务**:

```bash
python main.py
```

**API接口**:

- POST /recognize - 识别数学公式
  ```json
  {
    "image_data": "base64_encoded_image_data",
    "image_format": "png"
  }
  ```

**技术栈**:

- FastAPI
- Pix2Text (开源Mathpix替代品)

---

## 注意事项

### 1. Python环境要求

- Python 3.8+
- 建议使用虚拟环境

### 2. 机器学习模型

首次使用会自动下载机器学习模型，可能需要较长时间。

### 3. 硬件要求

- CPU: 支持SSE4.2
- RAM: 至少4GB
- 推荐: GPU（可选，加速识别）

---

## 开源工具

### Imago

- GitHub: https://github.com/epam/imago
- 文档: https://imago.readthedocs.io/

### Pix2Text

- GitHub: https://github.com/breezedeus/Pix2Text
- 论文: https://arxiv.org/abs/2309.08305

---

## 许可证

MIT License
