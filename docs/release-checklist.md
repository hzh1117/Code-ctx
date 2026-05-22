# Code-ctx 发布检查清单 / Release Checklist

本清单用于每次正式发布（含 npm publish、Gitee/GitHub tag、release 公告）前的人工核对。
默认 `docs/` 不上传 Git，本文件是显式例外（`.gitignore` 中以 `!docs/release-checklist.md` 解除忽略）。

> **谁应该读这份？**
> - 仓库维护者（执行发布的人）
> - 想理解发布门槛的贡献者
> - 复核非商业许可边界的法务/合规审阅者

按顺序勾选；任何一项无法确认，**不要继续发布**。

---

## 1. 许可证和非商业边界

- [ ] `LICENSE` 未被修改为允许商业用途（不是 MIT、Apache、BSD 等 OSI 开源许可）。
- [ ] `package.json` `license` 字段保持 `SEE LICENSE IN LICENSE`。
- [ ] `README.md` 与 `README_EN.md` 顶部仍写明"源码公开 / 非商业使用"、不属于 OSI 开源许可。
- [ ] 没有未授权的商用集成宣传或第三方背书。

## 2. 文件清单与隐私

运行：

```bash
npm pack --dry-run
```

- [ ] 包内文件列表 = `package.json` `files` 字段声明（`bin/`、`src/`、`templates/`、`web/dist/`、几个根部 Markdown、`.env.example`）。
- [ ] 不包含 `.env`、`docs/`（除本检查清单外不应有 docs 入包）、`ai-docs/`、`tests/`、`coverage/`、`web/node_modules/`、`web/src/`、`web/index.html` 之外的 web 源码。
- [ ] 不包含本地调试文件（`test-api*.js`、`code-ctx-action-plan.md`、`codecontext-design-v2.md`、`.ai-prompt.md`、`.firecrawl/`、`plans/`）。
- [ ] 不包含任何 API Key、token、私有 baseUrl、内部 SSH 配置。

## 3. 敏感信息扫描

- [ ] `git diff <last-tag>..HEAD` 中不出现明文密码、API Key、JWT、SSH Key、内网 IP、`ai-docs/` 私有内容。
- [ ] `.env.example` 仅含占位符（如 `your_api_key_here`），不含真实 key。
- [ ] CHANGELOG 中没有泄露具体客户、内部 URL、未公开的安全细节。

## 4. 测试与构建

- [ ] `npm ci` 干净安装无错。
- [ ] `npm run lint` exit 0（warning 可接受，error 必须修）。
- [ ] `npm test -- --runInBand` 全部通过。
- [ ] `npm run coverage` 通过；关键模块覆盖率没有显著下滑。
- [ ] `npm run build:web` 通过，`web/dist/` 产物已重新生成并已纳入此次发布。
- [ ] `npm run check` 通过。
- [ ] 本地手动跑过一遍冒烟流程：`code-ctx init --skip-ai`、`code-ctx use --stdout`、`code-ctx update`、`code-ctx doctor`。

## 5. CI 与依赖安全

- [ ] 当前 `master` 分支最新提交的 GitHub Actions CI（Node 18/20/22）全绿。
- [ ] `audit` job 没有遗留 high/critical 漏洞，或已在 CHANGELOG 注明已知风险。
- [ ] Dependabot 待合并 PR 已处理：合并、关闭或归入下一版本。

## 6. 安全披露与社区文件

- [ ] `SECURITY.md` 中的披露渠道仍然有效。
- [ ] GitHub 仓库 Settings → Security → "Private vulnerability reporting" 已开启。
- [ ] `SUPPORT.md`、`CONTRIBUTING.md`、`CODE_OF_CONDUCT.md` 未过期或被误删。

## 7. 文档同步

- [ ] `README.md` 与 `README_EN.md` 描述与本版本能力一致（不夸大、不遗漏破坏性变更）。
- [ ] `CHANGELOG.md` 在 `## 中文` 和 `## English` 两栏都有本版本条目；包含 Added / Changed / Fixed / Known Issues / Security 中相关分类。
- [ ] 若涉及配置协议变更，已在 README / CHANGELOG 中注明迁移方式。

## 8. 版本号与 tag

- [ ] 按 semver 选择版本号：
  - 修复 / 内部重构 → patch
  - 新增能力、向后兼容 → minor
  - 协议或 CLI 行为破坏性变更 → major（在 1.x 阶段尤其要慎重）
- [ ] `package.json` `version` 已升号。
- [ ] CHANGELOG `[Unreleased]` 标题改为新版本号 + 日期，并新建空的 `[Unreleased]`。
- [ ] 创建 git tag：`git tag vX.Y.Z`。

## 9. 发布操作（npm + 仓库）

> 当前主仓库是 Gitee（`git remote get-url gitee`）；GitHub 仅作公开镜像。npm publish 由维护者本机执行。

1. [ ] 推送代码：`git push gitee master --tags`；如需同步公开：`git push github master --tags`。
2. [ ] `npm publish`：发布 npm 包。如需 dry-run，先 `npm publish --dry-run`。
3. [ ] 在 Gitee（和可选 GitHub）创建 Release：标题 `vX.Y.Z`，正文复制本版 CHANGELOG。
4. [ ] 发布后 `npm view code-ctx` 确认版本号与文件列表正确。
5. [ ] 在本地另一个目录 `npm install -g code-ctx@X.Y.Z` 验证 CLI 入口可执行。

## 10. 回滚策略

- [ ] 如发布后发现严重问题（功能崩溃、安全暴露、错误的依赖锁定）：
  1. `npm deprecate code-ctx@X.Y.Z "<原因>，请升级到 X.Y.Z+1 或回退到 X.Y.(Z-1)"`。
  2. **不要**使用 `npm unpublish`（72 小时后无法撤销，且会污染依赖网络）。
  3. 立刻准备 `X.Y.(Z+1)` 修复版，CHANGELOG 标注本次回滚原因。
  4. Gitee/GitHub release 页编辑加上"已废弃，见 X.Y.(Z+1)"提示，但不要直接删除 tag。
- [ ] 如发布后发现 LICENSE / 非商业边界被破坏（例如误并入 MIT 头文件）：立即按上面流程废弃当前版本，并发出更正说明。

---

## 附：常用命令速查

```bash
npm run check                 # 测试 + 构建
npm pack --dry-run            # 检查包文件列表
git diff <last-tag>..HEAD     # 看本次发布的所有变更
npm view code-ctx versions    # 看 npm 已发布版本
git log --oneline <last-tag>..HEAD   # 看本次发布的提交
```
