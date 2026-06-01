# 开源发布说明

## 仓库内容

本仓库包含 BioSeqMind-AI 的前端、后端、运行脚本、测试和部署文档：

- `frontend/`：Next.js + TypeScript + Tailwind CSS + shadcn/ui + ECharts
- `backend/`：FastAPI、SQLite 仓储、geNomad/NCBI/DeepSeek 编排
- `scripts/`：Linux 与 Windows 启动脚本
- `docs/`：Windows/GPU 迁移、运行模式和接手说明

## 未提交内容

为了安全和体积控制，下列内容不会提交到 GitHub：

- API key、token 和 `.env` 私密配置
- SQLite 分析结果库
- geNomad 数据库
- Python 虚拟环境
- Node.js 依赖和 Next.js 构建产物
- MMseqs2 二进制
- 日志文件

## 接手顺序

1. 克隆仓库。
2. 复制 `.env.example` 和 `.env.local.example`。
3. 填写 DeepSeek API key、NCBI 邮箱和 geNomad 配置。
4. 按 `docs/deployment-modes.md` 选择 `fast_nn` 或 `end_to_end`。
5. 运行启动脚本。
6. 用真实 FASTA 测试上传、BLAST、报告和问答。

## 推荐公开仓库名

```text
Deddyp1g/bioseqmind-ai
```
