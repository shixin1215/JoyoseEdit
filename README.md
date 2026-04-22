# JoyoseEdit

一个 **KernelSU WebUI 模块**，用于可视化编辑小米 / 红米 V3 版本 Joyose 的云控配置，
替代 Scene / MT 管理器 / SQLite Database Browser 手动折腾 `SmartP.db` + `teg_config.db`
的苦力活。**仅支持 V3，不支持 V1 / V2。**

核心能力：

- **三条策略路径都能编辑**：Novatek 独显（红米至尊系）、高通 GPU（AFME / FRC / FSR，
  小米 15 / 15 Pro 等）、MIVK / MIGL 渲染 module（通用细化）。
- **"无中生有" 添加条目**：典型场景是小米 17 本身没下发插帧 / 超分，你可以在
  WebUI 里直接创建 `frc_game_params` + `fisr_config` 路由，让设备尝试启用。
- **云控锁定**：把 `cloud_config.version` / `header.version` / `rules.rule_version`
  的年份统一改成 **2099**，未来几年不会被云端覆盖。
- **全量备份 / 任意回滚**：每次提交自动生成一次 DB 二进制备份 +
  一条累积式历史记录（含 before / after JSON + diff），任何历史点都能回滚；
  回滚本身也写入一条新历史，永不破坏审计链。
- **安全护栏**：特权操作只通过 `bin/joyose-edit.sh` 的子命令白名单；写入前比对
  DB 磁盘指纹防冲突；所有解析器的 `serialize(parse(s)) === s` 都在 CI 中验证。

## 适用机型（基于样本实测）

| 机型 | 主插帧路径 | 状态 |
| --- | --- | --- |
| Xiaomi 17 Pro Max | — | 默认未下发；可通过本模块自主添加 |
| Xiaomi 15 | 高通 GPU (AFME + FRC + FSR) | 已下发原神 / 星铁 4 条 |
| Xiaomi 15 Pro | 高通 GPU (AFME + FRC + FSR) | 与 15 一致，MIGL 多了王者 / 吃鸡 |
| Xiaomi K90 Pro Max（Redmi 继任） | Novatek 独显 (d1 / d2) | 下发 71 条，`rules` 表空 |

其它小米 / 红米 V3 设备也可以试，格式一致。

## 安装

1. 到 [release](./release/) 下载 `joyose-edit-v0.1.0.zip`（或自己 `npm run build && npm run package` 生成）。
2. 在 KernelSU 管理器里 "安装模块" 选中这个 zip，重启。
3. 回到 KernelSU 管理器，打开 JoyoseEdit 模块的 "WebUI"。

## WebUI 导航

| 页面         | 作用                                                                  |
| ------------ | --------------------------------------------------------------------- |
| 概览         | DB 状态 / 路径探测 / 快速备份                                         |
| 云控锁定     | 把 `version` 年份改成 2099                                            |
| 游戏列表     | 编辑 `common_config.params.game_list` / `support_app`                 |
| 高通 GPU     | `frc_game_params` 结构化表单 + `fisr_config` 路由预设                 |
| Novatek 独显 | 三段字符串（独显 A / GPU 方案 / 独显 B）结构化编辑                    |
| MIVK / MIGL  | 渲染 module 细化（`vrs` / `hsre` / `drr` / `gmem` / `mifi` / `misr`） |
| JSON 编辑    | 兜底：直接改 `params` / `rule_content`（CodeMirror 6）                |
| 编辑历史     | 全量历史 + diff + 回滚                                                |

## 本地开发

```bash
# 依赖
npm install

# 跑所有解析器 + 端到端测试（对仓库内 4 份样本 DB 全路径 round-trip）
npm test

# 类型检查 + 生产构建（输出到 dist/）
npm run build

# 把 dist/ 打包成 KernelSU 安装 zip
# 产物命名：release/joyose-edit-<base-version>-<commit-count>[-dirty]-<short-sha>.zip
# 例如     release/joyose-edit-v0.1.0-17-4a7c2f9.zip
# 同时会把 commit-count 写进 zip 内 module.prop 的 versionCode，
# KernelSU 管理器据此判断"有更新"。
npm run package

# 开发热更新（本地浏览器；没有 KernelSU 桥，所有 root 操作会直接报错）
npm run dev
```

## 相关文件

```text
module/                     KernelSU 模块文件（customize / post-fs-data / bin）
src/parsers/                所有字符串格式的 parse / serialize / validate
src/db/                     sql.js 封装 + 路径探测
src/history/                累积式历史 + diff + rule_content 信封
src/root/bridge.ts          ksu.exec 封装 + 子命令白名单
src/ui/                     Vue 3 SFC
tests/run.mts               端到端验证（npm test）
tests/<device>/             四台机型的样本 SmartP.db / teg_config.db
scripts/package-module.mjs  自包含 zip 打包器
CLAUDE.md                   给 Claude / 未来维护者的详细说明
```

## 许可

MIT（见 LICENSE 如未提供请补充）。

## 特别说明

- DB 里的数据格式是通过对照四台实机样本逆向得到的，不排除未覆盖机型有额外字段。
  遇到未知形状的字段，UI 会通过 "JSON 编辑" 兜底暴露，不会阻塞你。
- 本模块**不会**向云端发起任何请求，所有处理都在本地。
- 写入前会自动备份到 `/data/adb/joyose-edit/backup/`；回滚用 "概览 → 回滚到最近备份"
  或 `sh bin/joyose-edit.sh revert-latest`。
- 当设备被云控下发新版时，除非开启了 "云控锁定"，否则你的修改可能会被覆盖。
