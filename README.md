# ⚡ AI Pulse — AI 行业 Top 30 名人动态追踪 CLI

**零依赖**。纯 Node.js。直接运行。

> Inspired by Peter Steinberger's CLI-first philosophy.

## 快速开始

```bash
# 直接运行（需要 Node.js >= 18）
node ai-pulse.mjs help

# 或添加执行权限后直接运行
chmod +x ai-pulse.mjs
./ai-pulse.mjs help
```

## 命令一览

| 命令 | 说明 |
|------|------|
| `list` | 列出 Top 30 AI 名人 |
| `list --cat ceo` | 按类别筛选 (ceo/researcher/engineer/creator) |
| `info <name>` | 查看某人详情（支持英文/中文名） |
| `latest` | 获取所有名人最新动态 |
| `latest --person sam` | 只看某人的动态 |
| `latest --limit 10` | 限制显示条数 |
| `latest --no-news` | 不包含行业新闻源 |
| `digest` | 生成每日简报 |
| `search <query>` | 搜索名人 |
| `cache` | 查看缓存状态 |
| `cache --clear` | 清除缓存 |

## 使用示例

```bash
# 列出所有 CEO
node ai-pulse.mjs list --cat ceo

# 查看 Peter Steinberger 详情 + 最新博客
node ai-pulse.mjs info peter

# 获取所有人的最新动态
node ai-pulse.mjs latest

# 只看 Andrej Karpathy 的最新视频
node ai-pulse.mjs latest --person karpathy

# 搜索中国 AI 名人
node ai-pulse.mjs search 中国

# 生成每日 AI 简报
node ai-pulse.mjs digest
```

## 预览页（重构后）

`preview.html` 现在会从 `data/people.json` 读取人物数据，需通过本地 HTTP 服务访问：

```bash
cd /Users/youzhaoyang/Code/ai-pulse
python3 -m http.server 8080
```

浏览器打开：

`http://localhost:8080/preview.html`

## 数据结构（重构后）

- `data/people.json`：CLI 和预览页共享的 Top30 人物数据源（单一事实源）
- `ai-pulse.mjs`：从 `data/people.json` 读取 `feeds`
- `preview.html`：从 `data/people.json` 加载数据，并将 `feeds` 映射为页面使用的 `rss`

## 数据来源

- 个人博客 RSS 订阅 (Sam Altman, Peter Steinberger, Andrew Ng 等)
- YouTube RSS (Andrej Karpathy)
- 机构博客 (OpenAI, Anthropic, Google AI, Meta AI, Hugging Face, NVIDIA 等)
- 本地缓存（30 分钟 TTL），避免重复请求

## 技术特点

- **零依赖**: 不需要 `npm install`，纯 Node.js 内置 API
- **共享数据源**: CLI + 预览页共用 `data/people.json`
- **RSS 解析**: 自研轻量 XML 解析，支持 RSS 2.0 和 Atom
- **本地缓存**: 文件级缓存，30 分钟 TTL
- **终端美化**: ANSI 色彩 + Unicode 表格
- **快速启动**: 单文件，毫秒级启动
