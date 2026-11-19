const fs = require('fs');
const Tesseract = require('tesseract.js');

async function run() {
  const imgPath = process.argv[2];
  if (!imgPath || !fs.existsSync(imgPath)) {
    process.exit(1);
  }

  try {
    const { data: { text } } = await Tesseract.recognize(imgPath, 'eng');
    console.log(text.trim());
    process.exit(0);
  } catch (err) {
    process.exit(1);
  }
}

run();
