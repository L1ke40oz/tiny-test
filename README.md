# AI 房东：404号公寓

一个移动端优先的网页互动小游戏。你扮演刚上线的公寓管理 AI「HOME-AI 404」，通过聊天、设备控制、日志调查和清洁机器人 R-04 的现场探索，调查 405 门外的敲门声。

DEMO 包含完整的第一章《敲门声》和终章结局演示。

## 运行

纯静态网站（HTML + CSS + 原生 JavaScript），无需构建、无后端。

```bash
python -m http.server 5404
```

然后打开 http://localhost:5404 。也可以直接部署到 GitHub Pages / Netlify / Vercel 等任何静态托管。

调试参数：`?skip` 跳过开场，`?debug` 在「系统」页显示隐藏变量。

## 结构

```
index.html
css/style.css
js/
  data/characters.js   住户设定
  data/chapter1.js     第一章剧情：设备、日志、线索、聊天话题
  data/scene1.js       第一章现场探索：场景、热点、物品
  data/endings.js      终章与结局
  state.js             游戏状态（可变数据）
  engine.js            规则与流程
  scene.js             现场插画与热点
  ui.js                界面渲染与交互
  main.js              入口
```
