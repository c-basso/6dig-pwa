const path = require('path');
const sharp = require('sharp');
const {takeHtmlPageScreenshot} = require('./takeHtmlPageScreenshot');

const ICONS_PATH =  path.resolve(__dirname, '..', 'img');

(async () => {
    const htmlPath = path.resolve(__dirname, `logo.html`);
    const screenshotPath = path.join(ICONS_PATH, `icon_1024.png`);
    
    const width = 1024;
    const height = 1024;

    await takeHtmlPageScreenshot({
        htmlPath,
        screenshotPath,
        width,
        height
    });

    const sizes = [
        700,
        144,
        500,
        600
    ];

    for (let size of sizes) {
        await sharp(screenshotPath)
            .png({
                palette: true,
                progressive: true
            })
            .resize(size, size)
            .toFile(path.join(ICONS_PATH, `icon_${size}.png`));
    }
})()
