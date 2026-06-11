# SunsetBot ServerChan WeChat Push

每天同时请求 SunsetBot 的重庆日出、日落火烧云信息，并通过 Server 酱推送到微信。

## 本地预览样式

调试样式时先运行：

```powershell
npm run preview
```

它会同时请求日出和日落接口，但不会调用 Server 酱，也不会消耗推送额度。运行后打开：

```text
C:\Users\admin\Documents\SunSet\preview.html
```

预览模式默认会把日出 `tb_quality` 模拟为 `0.597（污）`，把日落 `tb_quality` 模拟为 `0.832（良）`，方便查看“日出和日落都大于等于 0.4”时的同表展示效果。

也可以临时指定预览级别：

```powershell
$env:PREVIEW_RISE_QUALITY="0.597（污）"
$env:PREVIEW_SET_QUALITY="1.2（大烧）"
npm run preview
```

或者让日出、日落使用同一个模拟值：

```powershell
$env:PREVIEW_QUALITY="0.8（大烧）"
npm run preview
```

这些模拟值只影响 `npm run preview`，不会影响 `npm run push`。

## 模拟推送测试

需要真实推送模拟消息时，使用项目脚本，不要用 PowerShell 管道临时拼中文，避免中文括号和“污/良”等字符变成 `???`。

默认只预览、不发送：

```powershell
npm run push:simulated -- both
npm run push:simulated -- set-only
npm run push:simulated -- rise-only
```

确认要真实推送时，显式设置 `SEND_SIMULATED=1`：

```powershell
$env:SEND_SIMULATED="1"
npm run push:simulated -- both
```

## 真实推送

确认样式满意后再运行：

```powershell
npm run push
```

真实推送会读取本地 `.env` 里的：

```text
SERVERCHAN_SENDKEY=你的Server酱SendKey
RISE_URL=日出接口
SET_URL=日落接口
OPEN_URL=https://sunsetbot.top/map/
```

## 推送规则

脚本会同时查询日出和日落结果，只展示 `tb_quality >= 0.4` 的结果。

- 日出达标、日落不达标：只展示日出一行。
- 日落达标、日出不达标：只展示日落一行。
- 日出和日落都达标：同一张表里展示两行。
- 日出和日落都不达标：跳过 Server 酱，不消耗推送次数。

表格字段：

```text
火烧云信息 | 日出/日落
城市名称: display_city_name
类型: display_event_name_cn
时间: tb_event_time
数值: tb_quality 原始值
级别: tb_quality 对应的火烧云描述
```

不会推送完整 JSON。

注意：Server 酱会把 HTML 表格当普通文本显示，所以真实推送内容使用 Markdown 表格，不再发送 `<table>` HTML。

## GitHub Actions 定时推送

仓库已经包含 `.github/workflows/sunset-serverchan.yml`，默认每天北京时间 `09:00` 和 `18:00` 各执行一次。

在 GitHub 仓库里配置：

```text
Settings -> Secrets and variables -> Actions -> Secrets
SERVERCHAN_SENDKEY=你的Server酱SendKey
```

不要把本地 `.env` 提交到公开仓库。
