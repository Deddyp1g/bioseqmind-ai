# BioSeqMind-AI Windows + GPU 移植文档

## 目标环境

- Windows 11
- NVIDIA GPU + 最新 Game Ready/Studio Driver
- Python 3.11 64-bit
- Node.js 20.19+ 或 Node.js 22 LTS
- Git for Windows
- 可选但推荐：WSL2 Ubuntu 22.04/24.04，用于 geNomad 与生物信息依赖

## 推荐部署形态

前端和 FastAPI 可以原生运行在 Windows；geNomad 推荐运行在 WSL2 或 Conda/Mamba 环境中。NCBI BLAST URL API 与 DeepSeek API 是远程服务，本身不消耗本机 GPU。GPU 主要用于后续扩展本地深度学习模型、批量推理或本地大模型时加速；geNomad 官方常见安装路径是 Pixi/Mamba/Docker，是否使用 GPU 取决于其依赖与运行方式，不能把远程 NCBI/DeepSeek 调用算成本地 GPU 加速。

## 1. 安装基础工具

```powershell
winget install Git.Git
winget install Python.Python.3.11
winget install OpenJS.NodeJS.LTS
```

确认版本：

```powershell
python --version
node --version
npm --version
```

Node 如果低于 `20.19`，建议安装 Node.js 22 LTS，否则 Next.js/ESLint 依赖可能出现 engine warning。

## 2. 克隆与安装项目

```powershell
git clone https://github.com/Deddyp1g/bioseqmind-ai.git BioSeqMind-AI
cd BioSeqMind-AI
.\scripts\start-windows.ps1
```

访问：

- 前端：http://localhost:5174
- 后端：http://127.0.0.1:8008/api/health

## 3. 配置环境变量

编辑 `backend\.env`：

```env
BIOSEQMIND_DB_PATH=data/bioseqmind.sqlite3
BIOSEQMIND_CORS_ORIGINS=http://localhost:5174,http://127.0.0.1:5174
BIOSEQMIND_NCBI_MODE=live
DEEPSEEK_API_KEY=sk-...
BIOSEQMIND_DEEPSEEK_MODEL=deepseek-v4-flash
BIOSEQMIND_GENOMAD_COMMAND=genomad
BIOSEQMIND_GENOMAD_DB_PATH=C:\bioseqmind\data\genomad_db
```

编辑 `frontend\.env.local`：

```env
NEXT_PUBLIC_API_BASE_URL=auto
BIOSEQMIND_BACKEND_INTERNAL_URL=http://127.0.0.1:8008/api
```

前端默认通过同源 `/api` 代理访问 FastAPI。这样 Windows、WSL2、远程开发容器和部分内置浏览器都只需要访问 `5174`，不会因为 `localhost`、`127.0.0.1` 或 IPv6 解析差异导致页面能打开但 API 失败。

## 4. 选择 geNomad 模式

项目保留两套 geNomad 路径。

### 当前快速模式

```env
BIOSEQMIND_GENOMAD_MODE=fast_nn
BIOSEQMIND_GENOMAD_SINGLE_WINDOW=true
BIOSEQMIND_GENOMAD_THREADS=24
```

该模式调用 `genomad nn-classification` 和 `genomad summary`，是当前开发机已验证的默认模式。

### 旧版完整模式

```env
BIOSEQMIND_GENOMAD_MODE=end_to_end
BIOSEQMIND_GENOMAD_DB_PATH=C:\bioseqmind\data\genomad_db
```

该模式保留之前虚拟机较慢但更完整的 `genomad end-to-end` 流程，需要完整 geNomad 数据库。数据库体积较大，不会放入 GitHub，需在接手机器下载或复制。

更详细说明见 [deployment-modes.md](deployment-modes.md)。

## 5. geNomad 安装建议

当前 Linux 开发机已经安装：

- geNomad 命令：`/root/bioseqmind-ai/backend/.venv/bin/genomad`
- geNomad 数据库：`/root/bioseqmind-ai/data/genomad_db`，版本 `1.9`
- MMseqs2：`/root/bioseqmind-ai/tools/mmseqs/bin/mmseqs`
- 后端调用包装脚本：`/root/bioseqmind-ai/scripts/genomad-with-tools.sh`

Linux 当前 `.env` 已指向包装脚本：

```env
BIOSEQMIND_GENOMAD_COMMAND=/root/bioseqmind-ai/scripts/genomad-with-tools.sh
BIOSEQMIND_GENOMAD_DB_PATH=/root/bioseqmind-ai/data/genomad_db
```

迁移到 Windows 时，可以直接复制 `data/genomad_db` 目录；但更推荐在 WSL2 内运行后端和 geNomad，这样 MMseqs2、文件权限和路径格式最少踩坑。

### 方案 A：WSL2 + Mamba

```powershell
wsl --install -d Ubuntu-24.04
```

进入 WSL 后：

```bash
curl -L -O https://github.com/conda-forge/miniforge/releases/latest/download/Miniforge3-Linux-x86_64.sh
bash Miniforge3-Linux-x86_64.sh
mamba create -n genomad -c conda-forge -c bioconda genomad
mamba activate genomad
genomad download-database /mnt/c/bioseqmind/data
```

Windows 后端若要调用 WSL 内的 geNomad，可以把 `BIOSEQMIND_GENOMAD_COMMAND` 改成一个 `.cmd` 包装脚本；更简单的做法是后端也放在 WSL 内运行。

### 方案 B：Windows Conda/Mamba

如果 bioconda 包在你的 Windows 环境可用：

```powershell
mamba create -n genomad -c conda-forge -c bioconda genomad
mamba activate genomad
genomad download-database C:\bioseqmind\data
```

若依赖解析失败，改用 WSL2。

## 6. GPU 检查

Windows 原生：

```powershell
nvidia-smi
```

WSL2：

```bash
nvidia-smi
```

若未来加入本地模型推理，可在 Windows 或 WSL2 中安装对应 CUDA 版 PyTorch：

```bash
pip install torch --index-url https://download.pytorch.org/whl/cu121
python - <<'PY'
import torch
print(torch.cuda.is_available())
print(torch.cuda.get_device_name(0) if torch.cuda.is_available() else "no cuda")
PY
```

当前已验证流程中，NCBI BLAST 和 DeepSeek 都是远程 API，不消耗本地 GPU。geNomad 能否实际使用 GPU 取决于安装方式和底层深度学习框架，迁移时请用实际命令验证，不要只看机器是否有显卡。

## 7. 生产运行建议

- 前端端口固定 `5174`，避免与你现有 `5173` 服务冲突。
- 后端端口固定 `8008`。
- 前端启动脚本默认监听 IPv6/IPv4 通配地址；如果某台 Windows 机器不支持该模式，可临时运行 `npm run dev:ipv4`。
- `BIOSEQMIND_NCBI_MODE=live` 会等待真实 BLAST；不要使用 `auto` 或 `mock` 生成替代结果。
- 正式论文截图前，确认 geNomad 数据库、NCBI 网络和 DeepSeek key 全部可用，并在报告中保留来源字段。
- SQLite 可迁移到 PostgreSQL；当前仓储层集中在 `backend/app/repository.py`，替换成本较低。
