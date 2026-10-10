# chat-log：会话 ask/rep 归档规则

本文件供 `@chat-log.md` 使用。完整规则见同目录 [`chat-log.mdc`](chat-log.mdc)。

**唯一版式范本：** [`chatlog/2026-08-13-chat1/2026-08-13-chat1.md`](../chatlog/2026-08-13-chat1/2026-08-13-chat1.md)

## 核心要求（逐字 + 版式一致）

1. 文件夹：`chatlog/YYYY-MM-DD-chatN-<主题概述>/`，含 md + `fig1`～`figN` 图片。
2. ask 与 rep **一一对应、交替**书写：`## chat ask` → `## chat rep` → `## chat ask` → `## chat rep`…  
   **禁止**先堆全部 ask、再堆全部 rep；**禁止**在单个 ask/rep 里用 `### 第 k 轮` 塞多轮。
3. 元数据固定三行：`用途` / `范围` / `本文件夹同时存放提问截图：fig1～figN`。
4. **ask/rep 正文与当轮 chat 原文一致**，禁止摘要；仅去掉 image_files、timestamp 标签，路径改相对链接。
5. **配图**：每条 `- **图N** 说明` 后**下一行** `![图N …](figN-….png)`（与 chat1 相同，禁止先堆图）。
6. **rep** 保留全部 mermaid、表格、代码引用；禁止删节。

详细规则见 [`chat-log.mdc`](chat-log.mdc)。
