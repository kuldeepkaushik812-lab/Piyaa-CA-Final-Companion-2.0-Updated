import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const svgPath = 'public/icons/pwa-icon.svg';
const outputDir = 'public/icons';

const targets = [
  { name: 'pwa-192x192.png', size: 192 },
  { name: 'pwa-512x512.png', size: 512 },
  { name: 'apple-touch-icon.png', size: 180 },
  { name: 'icon-192x192.png', size: 192 },
  { name: 'icon-512x512.png', size: 512 }
];

async function generate() {
  console.log('Starting icon generation from SVG...');
  if (!fs.existsSync(svgPath)) {
    console.error(`SVG source not found at: ${svgPath}`);
    process.exit(1);
  }

  for (const target of targets) {
    const dest = path.join(outputDir, target.name);
    console.log(`Generating ${dest} (${target.size}x${target.size})...`);
    await sharp(svgPath)
      .resize(target.size, target.size)
      .png()
      .toFile(dest);
    console.log(`Successfully generated ${dest}`);
  }
  console.log('All icons generated successfully!');
}

generate().catch(err => {
  console.error('Error generating icons:', err);
  process.exit(1);
});
