const fs = require('fs');

// Create simple SVG icons and save as files
const sizes = [16, 48, 128];

sizes.forEach(size => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" fill="none"/>
  <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#333333" font-family="Arial" font-weight="bold" font-size="${size * 0.5}">LC</text>
</svg>`;
  
  fs.writeFileSync(`public/icon${size}.svg`, svg);
  console.log(`Created icon${size}.svg`);
});

console.log('All icons created!');
