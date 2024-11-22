const fs = require('fs');
const path = require('path');

// 简单的 1x1 像素的透明 PNG 文件的 base64 编码
const transparentPixel = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

const sizes = [16, 48, 128];

// 确保 icons 目录存在
const iconsDir = path.join(__dirname, 'icons');
if (!fs.existsSync(iconsDir)) {
    fs.mkdirSync(iconsDir);
}

// 为每个尺寸创建图标
sizes.forEach(size => {
    const iconPath = path.join(iconsDir, `icon${size}.png`);
    const buffer = Buffer.from(transparentPixel, 'base64');
    fs.writeFileSync(iconPath, buffer);
});

console.log('Icons created successfully!'); 