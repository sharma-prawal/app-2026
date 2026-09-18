// Generates metadata-free Home Screen icons from the small project-owned SVG mark.
import sharp from 'sharp';

for (const size of [180, 512]) {
  await sharp('public/icon.svg').resize(size, size).png().toFile(`public/icon-${size}.png`);
}
