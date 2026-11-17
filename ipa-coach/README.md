# IPA Coach V3

面向 iPhone Safari 的英语发音训练 PWA，提供三级渐进课程：单音素、最小对立词、完整单词。应用支持标准发音播放、WAV 录音与本地回放、学习进度保存和逐级解锁。

## 评分真实性与隐私

发音评分只来自 **Azure Speech Pronunciation Assessment**。浏览器把 16 kHz PCM WAV 录音发送到本服务，服务端再调用 Azure 的 Pronunciation Assessment REST API。前端只接受带有 `source: azure-pronunciation-assessment` 的响应。

- 未配置 Azure 凭据时，界面显示“Azure 评分未配置”，评分按钮不可用，API 返回 `503 AZURE_NOT_CONFIGURED`，不会显示模拟分数。
- Azure 密钥只从服务端环境变量读取，不会进入静态文件、浏览器存储或 API 响应。
- 学习记录保存在浏览器 `localStorage`；录音仅在用户点击评分后发送。

## 本地运行

要求 Node.js 20+。

```bash
cd ipa-coach
npm install
copy .env.example .env
```

在终端设置环境变量后启动（项目不会自动读取 `.env`，生产环境请使用托管平台的 secret 配置）：

```powershell
$env:AZURE_SPEECH_KEY = "your-key"
$env:AZURE_SPEECH_REGION = "japaneast"
npm start
```

访问 `http://localhost:3000`。iPhone 必须通过 HTTPS（或本机开发环境）才能使用麦克风。Safari 中使用“分享 → 添加到主屏幕”安装 PWA。

## 测试

```bash
npm test
```

测试覆盖 Azure 配置判定、WAV 输入验证、Azure 结果映射，以及未配置凭据时绝不返回评分的关键约束。

## 部署

部署为支持 Node.js 20 的 Web 服务，启动命令为 `npm start`，并在服务端 Secret/Environment Variables 中配置：

| 变量 | 必需 | 说明 |
| --- | --- | --- |
| `AZURE_SPEECH_KEY` | 是（评分功能） | Azure Speech 资源密钥 |
| `AZURE_SPEECH_REGION` | 是（评分功能） | Azure 区域，如 `japaneast` |
| `PORT` | 否 | 默认 `3000` |

不要把真实 `.env`、密钥或 Azure 响应日志提交到 Git。
