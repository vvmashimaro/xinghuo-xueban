// 渲染 15 秒宣传片：python3 music.py && node render.js
// 依赖：playwright（chromium）、ffmpeg、numpy、Noto Sans CJK SC 字体。
// node render.js stills 1.8,4.6 只截取指定时间点的关键帧到 stills/。
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const FPS = 30, DURATION = 15;
const mode = process.argv[2] || 'video';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  await page.goto('file://' + path.join(__dirname, 'promo.html'));
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(300);

  if (mode === 'stills') {
    fs.mkdirSync(path.join(__dirname, 'stills'), { recursive: true });
    const times = (process.argv[3] || '1.8,4.6,6.9,8.2,9.3,11.8,14.5').split(',').map(Number);
    for (const t of times) {
      await page.evaluate(t => window.render(t), t);
      await page.screenshot({ path: path.join(__dirname, 'stills', `t${t.toFixed(1)}.png`) });
    }
  } else {
    const ff = spawn('ffmpeg', ['-y', '-f', 'image2pipe', '-framerate', String(FPS), '-i', '-',
      '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-pix_fmt', 'yuv420p', path.join(__dirname, 'video_silent.mp4')],
      { stdio: ['pipe', 'inherit', 'inherit'] });
    const total = FPS * DURATION;
    for (let i = 0; i < total; i++) {
      await page.evaluate(t => window.render(t), i / FPS);
      const buf = await page.screenshot({ type: 'png' });
      if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
    }
    ff.stdin.end();
    await new Promise(r => ff.on('close', r));
    const mux = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-i', path.join(__dirname, 'video_silent.mp4'), '-i', path.join(__dirname, 'music.wav'),
      '-c:v', 'copy', '-af', 'loudnorm=I=-16:TP=-1.5:LRA=11', '-c:a', 'aac', '-b:a', '192k', '-ar', '44100', '-shortest',
      '-movflags', '+faststart', path.join(__dirname, 'xinghuo-xueban-promo-15s.mp4')], { stdio: 'inherit' });
    await new Promise(r => mux.on('close', r));
  }
  await browser.close();
})();
