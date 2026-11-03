# Life of Font

把字体转化成 cells，让字形在 cellular automata 规则中演化，并导出 SVG 矢量图形和 OpenType 字体。网站完全在浏览器中运行，使用 FiraCode-Medium、纯黑白界面和自适应布局，无需服务器或账户。

[在线体验](https://mankunguo.github.io/life-of-font/) · [项目介绍](https://mankunguo.com/life-of-font-2)

Info 直接跳转至 [项目介绍网页](https://mankunguo.com/life-of-font-2)。浏览器标签页图标为纯黑正方形；桌面布局的左右操作区和预览框上下对齐。

## 在 VS Code 中运行

用 VS Code 打开本项目文件夹。在 Terminal 中运行：

```bash
npm run dev
```

打开终端中显示的本地地址，默认是 `http://127.0.0.1:5174`。需要 Node.js 20 或以上。**不需要 npm install**：没有运行时安装步骤，字体生成库已保存在 `vendor/`。

端口已被占用时：

```bash
npm run dev -- --port 5175
```

也可以使用 VS Code 的 **Terminal → Run Task → Preview Life of Font**。

## 使用方法

1. **Font**：展开菜单选择字体，菜单底部的黑色 **Import your font +** 可导入 OTF / TTF / WOFF / WOFF2，一次可选多个文件。文件仅在浏览器内处理。菜单支持方向键、Enter 和 Escape。
2. **Text**：输入最多 32 个字符。支持大小写、空格、标点以及原字体支持的 Unicode 字符。
3. **Cells size**：设置 2–40 px 的采样尺寸；越小越精细。点击 **Generate** 建立初始细胞网格。输入改动在再次 Generate 后生效。
4. **Rule**：直接点选 0–8。黑色表示选中。Cell born 控制死细胞在何种邻居数量下出生，Cell alive 控制活细胞存活。修改规则会作用于后续 generation。
5. **Play / Pause**：播放演化。**Step gap** 表示每几个动画 tick 更新一代；**Speed** 表示每秒 tick 数。例如 24 fps、gap 3，约每秒演化 8 代。单步按钮只前进一代，重置回到初始 cells。
6. **预览顶部控件**：− / 百分比 / + 调整缩放；点击百分比恢复 100%。实际细胞网格按右侧 frame 的比例扩展，100% 时覆盖整个边框内部；方格始终保持正方形，没有左右或上下的固定留白。cells / solid 选择分离方格或连续形状，网格按钮显示纯黑参考线。也可滚轮缩放、拖动画布平移；100% 及以上缩放时平移不会露出网格以外的区域。
7. **Export**：画布右下角展开菜单，直接点 **Vector (.svg)** 或 **Font (.otf)** 下载，没有额外设置弹窗。字体自动包含全部 95 个基本拉丁字符（含数字与标点），以及当前输入中的其他字符。生成期间按钮显示进度，Escape 可取消。

快捷键：空格播放/暂停，`→` 单步，`R` 重置，`G` 显示网格，`0` 适配画布，Enter 生成。在输入框输入时不会触发这些快捷键。

## 矢量输出

- **SVG**：保存当前画面中精确的 cell 形状，使用纯黑的独立 `<path>`，背景透明，自动裁切到字形。没有嵌入 PNG、没有 `<text>`，不需要接收者安装原字体。可在 Illustrator、Figma、Inkscape 等工具中打开和编辑。缩放和参考网格只影响预览。
- **OTF**：直接导出真实的 OpenType 字体，包含矢量轮廓。默认包含基本拉丁字符（95 个，包括大小写、数字、空格、标点）及当前输入的字符。每个字符使用**本次生成时的字体与 cell size，以及实际经历的完整规则历史**独立演化。空间和基线按输入字体的度量保留。
- 连续文字中，邻近字母的细胞可能相互作用；OTF 的字符独立演化，所以与整句演化的 SVG 可能不同。需要保留画面时选择 SVG。
- Canvas 只在后台将输入字体采样为 0/1 数据；**预览、SVG 和 OTF 的输出几何均为矢量**。

网格使用 8 邻域、固定的死亡边界。文字采样后先预留 18 个 cell，再按右侧 frame 的比例补足行列，让整个预览框都可发生演化。窗口尺寸改变时，会在后台按新网格重放本次规则历史，保留当前 Step 和播放状态；不会将方格拉成长方形。为控制浏览器内存，网格最多 250,000 个 cell，每次实验最多 2,000 代。文字或 frame 比例需要过大网格时，增加 Cells size 或缩短文字即可。OTF 的计算在 Web Worker 中进行；Escape 可取消字体导出。

## 本地 demo 字体与公开字体

提供的 Social、Neplus、Movio、Shelley 字体已复制到 `assets/local-fonts/`，用于本机还原 demo。这个文件夹被 `.gitignore` 排除，构建时也不会复制到公开网站。只有在本机开发地址下才加载这些示例字体。

全站界面使用 `assets/fonts/FiraCode-Medium.ttf`；输入字体选择只影响生成的字形。本地菜单显示四款 demo 字体；公开网站提供打包的 **Archivo Black** 和 **Fira Code**，以及导入字体功能，不依赖外部 CDN。对应的 OFL 许可证保存在 `assets/fonts/`。OpenType.js 1.3.4 使用 MIT 许可证，原文保存在 `vendor/opentype-LICENSE.txt`。导入字体及其衍生字形的使用权限由原字体许可证决定。

## 发布到 GitHub Pages

本项目已经配置 `.github/workflows/pages.yml`。将 **life-of-font_261102 项目文件夹本身**作为仓库根目录上传到 GitHub，不要将其他版本、外层视频、参考代码和原始字体文件夹一起上传。

1. 创建 GitHub 仓库，将本项目代码推送到 `main` 分支。
2. 仓库 **Settings → Pages → Build and deployment → Source** 选择 **GitHub Actions**。
3. 在 **Actions** 中查看 **Deploy to GitHub Pages**。每次推送会检查、构建并发布 `dist/`。
4. 成功后，Pages 设置和 workflow 都会显示公开地址，一般为 `https://你的用户名.github.io/仓库名/`。

参考 [GitHub 官方 Pages 发布文档](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)。全部资源均使用相对路径，支持仓库子路径，无需配置域名或后端。

手动构建和检查：

```bash
npm run check
npm run build
node scripts/serve.mjs --dist --port 5175
```

`dist/` 可上传至任何静态网站服务。生产构建会关闭本地参考字体加载，并排除这些字体文件。页面不含服务器 API、账户或外部请求。

## 代码结构

| 文件 | 用途 |
| --- | --- |
| `index.html` / `style.css` | 页面、对话框、自适应样式 |
| `src/app.js` | 交互、播放、导入、缩放与导出 |
| `src/engine.js` | 细胞演化、边界与几何遍历 |
| `src/sampling.js` | 字体采样、基线和原始字符度量 |
| `src/world.js` / `src/world-worker.js` | 按 frame 建立网格、等比显示，以及窗口变化后的规则重放 |
| `src/vector.js` | SVG 路径与独立文件导出 |
| `src/font-worker.js` | 后台生成 OpenType 矢量字体 |
| `scripts/` | 零依赖预览服务器和静态构建 |
| `tests/` | 演化、边界、SVG 和 OTF 验证 |

界面与项目概念参考原始 demo，演化逻辑参考文件夹中的复刻实现，并重新实现为独立的矢量网站。
