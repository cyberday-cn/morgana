# Vision / Image Routing in Hermes + Morgana

## Two Paths, Different Behavior

Hermes has two paths for handling images, and they behave differently:

| Path | Trigger | image_routing? | How images arrive |
|------|---------|:---:|------|
| Gateway Native (微信, Telegram) | File attachment detected by gateway | ✅ Yes | File path → `decide_image_input_mode` |
| API Server (Morgana, Open WebUI) | Content array in chat completions body | ❌ No | Already base64 `image_url` in content array |

### Gateway Native Path

```
图片附件 → gateway 检测 → _decide_image_input_mode(provider, model, cfg)
  → "native": 直接 attach 到 user turn（模型需支持 vision）
  → "text": 调用 vision_analyze（auxiliary.vision 模型）描述图片 → 注入文字描述
```

`decide_image_input_mode` 逻辑（`agent/image_routing.py`）:
1. 主模型支持 vision → `"native"`
2. 主模型不支持 vision + 配置了 `auxiliary.vision` → `"text"`（用 vision_analyze 描述）
3. 否则 → `"text"`（默认 vision_analyze）

### API Server Path

```
Content array (含 image_url) → _normalize_multimodal_content 保留 → run_conversation
  → 直接发给主模型（无 image_routing 拦截）
  → 主模型不支持 → 报错 → Hermes 剥离图片重试 → 图片信息丢失
```

## Model Compatibility

### GLM-5V-Turbo (z.ai)
- Provider: `z.ai`
- Base URL: `https://open.bigmodel.cn/api/paas/v4`
- OpenAI vision format: ✅ 完全兼容
- Use case: `auxiliary.vision` fallback for微信图片, or direct model for Morgana

### Kimi K3 (kimi-coding)
- Provider: `kimi-coding`
- API Key prefix: `sk-kim-...`
- Base URL: `https://api.kimi.com/coding/v1`
- Protocol: Anthropic Messages wire (**not** OpenAI)
- OpenAI vision format: ❌ 返回 `unknown variant image_url, expected text`
- Hermes标记: `_PROVIDERS_WITHOUT_VISION` 包含 `kimi-coding`
- Note: Kimi Platform (`api.moonshot.ai`) 支持 vision，但需要 MOONSHOT_API_KEY（非 coding plan key）

### DeepSeek (deepseek)
- Provider: `deepseek`
- Vision: ❌ 纯文本模型
- 错误: `unknown variant image_url, expected text`

## model_routes Configuration

API Server 支持 `model_routes` 配置（在 `api_server.extra` 下），按请求中的 `model` 字段路由：

```yaml
api_server:
  extra:
    model_routes:
      GLM-5V-Turbo:          # client 发送的 model 名
        model: GLM-5V-Turbo
        provider: z.ai
        base_url: https://open.bigmodel.cn/api/paas/v4
```

这使得 Morgana 可以通过发送不同的 model 名来选择不同的后端。
