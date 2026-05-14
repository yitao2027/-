// SVG → 1024x1024 高清 PNG（保留透明背景，自动居中）
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const SRC = process.argv[2];
const DST = process.argv[3];
const SIZE = parseInt(process.argv[4] || '1024', 10);

if (!SRC || !DST) {
  console.error('用法: node svg_to_png.cjs <src.svg> <dst.png> [size=1024]');
  process.exit(1);
}

const buf = fs.readFileSync(SRC);

sharp(buf, { density: 600 }) // 高密度渲染，确保细节
  .resize(SIZE, SIZE, {
    fit: 'contain',
    background: { r: 0, g: 0, b: 0, alpha: 0 }, // 透明背景
  })
  .png({ compressionLevel: 9, adaptiveFiltering: true })
  .toFile(DST)
  .then(info => {
    console.log(`✅ 已生成: ${DST} (${info.width}x${info.height}, ${(info.size/1024).toFixed(1)}KB)`);
  })
  .catch(err => {
    console.error('❌ 失败:', err.message);
    process.exit(1);
  });
