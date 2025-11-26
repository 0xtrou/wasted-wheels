const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const SOURCE_IMAGE = 'icon.jpg';
const OUTPUT_DIR = __dirname;

// Icon sizes needed for web
const sizes = [
    { name: 'icon-16.png', size: 16 },
    { name: 'icon-32.png', size: 32 },
    { name: 'icon-180.png', size: 180 },  // Apple touch icon
    { name: 'icon-192.png', size: 192 },  // Android/PWA
    { name: 'icon-512.png', size: 512 },  // PWA splash
];

async function generateIcons() {
    const sourcePath = path.join(OUTPUT_DIR, SOURCE_IMAGE);

    if (!fs.existsSync(sourcePath)) {
        console.error(`Source image not found: ${sourcePath}`);
        process.exit(1);
    }

    console.log(`Generating icons from ${SOURCE_IMAGE}...\n`);

    for (const { name, size } of sizes) {
        const outputPath = path.join(OUTPUT_DIR, name);

        await sharp(sourcePath)
            .resize(size, size, {
                fit: 'cover',
                position: 'center'
            })
            .png()
            .toFile(outputPath);

        console.log(`✓ Generated ${name} (${size}x${size})`);
    }

    // Generate favicon.ico (32x32 PNG renamed, browsers accept PNG as ico)
    const faviconPath = path.join(OUTPUT_DIR, 'favicon.ico');
    await sharp(sourcePath)
        .resize(32, 32, {
            fit: 'cover',
            position: 'center'
        })
        .png()
        .toFile(faviconPath);

    console.log(`✓ Generated favicon.ico (32x32)`);

    console.log('\n✅ All icons generated successfully!');
}

generateIcons().catch(err => {
    console.error('Error generating icons:', err);
    process.exit(1);
});
