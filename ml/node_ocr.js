const fs = require('fs');
const path = require('path');

async function run() {
  const imagePath = process.argv[2];
  if (!imagePath || !fs.existsSync(imagePath)) {
    console.log('');
    process.exit(0);
  }

  try {
    // Check if tesseract binary exists or use bundled tesseract.js
    const { execSync } = require('child_process');
    try {
      const out = execSync(`tesseract "${imagePath}" stdout --oem 1 -l eng 2>/dev/null`, { encoding: 'utf8' });
      console.log(out.trim());
      process.exit(0);
    } catch (e) {
      // fallback
    }
  } catch (err) {
    console.log('');
  }
}
run();
