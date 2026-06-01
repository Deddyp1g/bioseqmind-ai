# BioSeqMind-AI 运行模式与接手说明

本文档用于从当前 Linux 开发机无缝接手到 Windows 宿主机或 WSL2 环境。仓库只保存代码、脚本和示例配置，不包含本地密钥、SQLite 结果库、geNomad 数据库、虚拟环境、Node 依赖和 MMseqs2 二进制。

## 端口约定

- 前端：`5174`
- 后端：`8008`
- `5173`：保留给其他项目，本系统不占用

宿主机访问 Linux 虚拟机时，不要使用 `localhost:5174`。应先在 Linux 中查看 IP：

```bash
hostname -I
```

然后在宿主机浏览器访问：

```text
http://<linux-ip>:5174/
```

例如当前开发机可用：

```text
http://192.168.174.133:5174/
```

前端浏览器端统一请求同源 `/api`，由 Next.js 服务端代理到 FastAPI，避免宿主机、虚拟机、WSL2 与内置浏览器之间的 `localhost` 指向不一致。

## 必须手动配置的本地文件

首次克隆后复制示例文件：

```bash
cp backend/.env.example backend/.env
cp frontend/.env.local.example frontend/.env.local
```

必须填写：

```env
DEEPSEEK_API_KEY=你的 DeepSeek API Key
BIOSEQMIND_NCBI_EMAIL=你的邮箱
```

如果使用完整 geNomad 数据库模式，还要填写：

```env
BIOSEQMIND_GENOMAD_DB_PATH=/path/to/genomad_db
```

## 模式 1：当前快速模式（推荐先用）

这是当前已经验证通过的默认模式，适合课程展示、宿主机接手和普通 FASTA 测试：

```env
BIOSEQMIND_GENOMAD_MODE=fast_nn
BIOSEQMIND_GENOMAD_SINGLE_WINDOW=true
BIOSEQMIND_GENOMAD_THREADS=24
BIOSEQMIND_GENOMAD_SPLITS=0
BIOSEQMIND_GENOMAD_TIMEOUT_SECONDS=3600
```

特点：

- 使用 geNomad `nn-classification` + `summary`
- 保留真实 geNomad 神经网络识别
- 不依赖完整 geNomad 数据库路径
- 在当前 Linux CPU 环境下，SARS-CoV-2 参考序列 geNomad 阶段约十几秒
- NCBI BLAST 仍是远程真实查询，整体耗时主要取决于 NCBI 排队和网络

## 模式 2：完整 geNomad end-to-end 模式（保留旧版）

这是之前虚拟机里较慢但更完整的模式，适合后续需要更多 geNomad 注释、完整数据库证据或严谨实验时使用：

```env
BIOSEQMIND_GENOMAD_MODE=end_to_end
BIOSEQMIND_GENOMAD_DB_PATH=/path/to/genomad_db
BIOSEQMIND_GENOMAD_SPLITS=0
BIOSEQMIND_GENOMAD_TIMEOUT_SECONDS=3600
```

特点：

- 调用 geNomad `end-to-end`
- 需要下载完整 `genomad_db`
- CPU 环境可能明显更慢
- 适合保留完整模型和数据库工作流

geNomad 数据库不要提交到 GitHub。下载方式示例：

```bash
genomad download-database ./data
```

下载后把 `.env` 指到实际目录，例如：

```env
BIOSEQMIND_GENOMAD_DB_PATH=/root/bioseqmind-ai/data/genomad_db
```

## 真实数据约束

系统设计为真实依赖模式：

- `BIOSEQMIND_NCBI_MODE=live`
- geNomad 不可用时直接报错
- NCBI BLAST 不可用时直接报错
- DeepSeek API 不可用时直接报错
- 不生成演示 BLAST 命中
- 不生成伪造报告

因此，如果网络、数据库或 API key 出问题，前端看到失败是正常保护行为，不代表系统在造假。

## Linux 快速启动

```bash
./scripts/start-linux.sh
```

该脚本会：

- 创建 `backend/.venv`
- 安装后端依赖
- 安装前端依赖
- 启动 FastAPI `8008`
- 启动 Next.js `5174`
- 绑定 `0.0.0.0`，方便宿主机访问

## Windows 快速启动

```powershell
.\scripts\start-windows.ps1
```

Windows 原生运行时，前端访问：

```text
http://localhost:5174/
```

如果 geNomad 或 MMseqs2 在 Windows 原生环境安装困难，建议把后端和 geNomad 放在 WSL2 中运行，Windows 宿主机只通过浏览器访问 WSL2 暴露的 `5174`。

## GPU 说明

当前已验证链路中：

- NCBI BLAST URL API 是远程服务，不使用本地 GPU
- DeepSeek API 是远程服务，不使用本地 GPU
- geNomad 当前在 Linux 开发机上按 CPU 跑通

如果后续在 Windows/WSL2 中使用 GPU，需要先确认：

```bash
nvidia-smi
```

并确认 geNomad 或后续本地模型依赖的深度学习框架能识别 CUDA。不要仅因为机器有显卡就假设整个链路自动 GPU 加速。

## 开源仓库中不包含的内容

以下内容需要在接手机器重新生成或下载：

- `backend/.env`
- `frontend/.env.local`
- `backend/data/bioseqmind.sqlite3`
- `data/genomad_db`
- `backend/.venv`
- `frontend/node_modules`
- `frontend/.next`
- `tools/mmseqs`
- `logs`

这些都已在 `.gitignore` 中排除。
