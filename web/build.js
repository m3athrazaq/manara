// Builds the Manara mosque screen and the imam's phone page:
//   dist/manara.html     – artifact page (no document skeleton; prayer library from jsDelivr)
//   dist/manara-tv.html  – standalone offline file for the TV (everything inlined),
//                          also written to ../docs/index.html (GitHub Pages and the Android app use it)
//   dist/remote.html     – phone control page, also written to ../docs/remote.html
//   dist/app.html        – page behind the screen's QR code (download the APK or open the screen), also ../docs/app/index.html
// (Replacements use functions so '$' sequences inside the inlined libraries stay literal.)
// REMOTE_URL (env) is where docs/remote.html is served; the screen's pairing QR code points there.
const fs = require('fs');
const path = require('path');
const root = __dirname;
const nm = (...p) => path.join(root, 'node_modules', ...p);
const ADHAN_VERSION = '4.4.6';
const REMOTE_URL = process.env.REMOTE_URL || 'https://m3athrazaq.github.io/manara/remote.html';
// The QR code on the main screen; kept short so the code stays coarse enough to scan from a few steps away.
const APP_URL = process.env.APP_URL || 'https://m3athrazaq.github.io/manara/app/';
const WEB_URL = process.env.WEB_URL || 'https://m3athrazaq.github.io/manara/';
const APK_URL = process.env.APK_URL || 'https://github.com/m3athrazaq/manara/releases/latest/download/manara.apk';

function faces(cssFile, family, subsets) {
  const css = fs.readFileSync(cssFile, 'utf8');
  const blocks = css.match(/@font-face\s*{[^}]*}/g) || [];
  return blocks
    .filter((b) => {
      const m = b.match(/files\/([^)'"\s]+?)\.woff2/);
      return m && subsets.some((s) => new RegExp('-' + s + '-(\\d+|wght)-normal$').test(m[1]));
    })
    .map((b) => {
      const file = b.match(/url\(\.\/files\/([^)]+?\.woff2)\)/)[1];
      const data = fs.readFileSync(path.join(path.dirname(cssFile), 'files', file)).toString('base64');
      return b
        .replace(/font-family:[^;]+;/, `font-family:'${family}';`)
        .replace(/src:[^;]+;/, `src:url(data:font/woff2;base64,${data}) format('woff2');`)
        .replace(/font-display:[^;]+;/, 'font-display:swap;')
        .replace(/\s+/g, ' ');
    });
}

const screenFonts = [
  ...faces(nm('@fontsource-variable', 'cairo', 'wght.css'), 'Cairo', ['arabic', 'latin']),
  ...faces(nm('@fontsource', 'el-messiri', '600.css'), 'El Messiri', ['arabic']),
  ...faces(nm('@fontsource', 'el-messiri', '700.css'), 'El Messiri', ['arabic']),
  ...faces(nm('@fontsource', 'amiri', '400.css'), 'Amiri', ['arabic', 'latin']),
  ...faces(nm('@fontsource', 'amiri', '700.css'), 'Amiri', ['arabic', 'latin']),
  // Optional faces chosen in the screen's settings (only the selected ones are ever decoded).
  ...faces(nm('@fontsource-variable', 'readex-pro', 'wght.css'), 'Readex Pro', ['arabic', 'latin']),
  ...faces(nm('@fontsource-variable', 'noto-kufi-arabic', 'wght.css'), 'Noto Kufi Arabic', ['arabic', 'latin']),
  ...faces(nm('@fontsource', 'almarai', '400.css'), 'Almarai', ['arabic', 'latin']),
  ...faces(nm('@fontsource', 'almarai', '700.css'), 'Almarai', ['arabic', 'latin']),
  ...faces(nm('@fontsource', 'almarai', '800.css'), 'Almarai', ['arabic', 'latin']),
  ...faces(nm('@fontsource-variable', 'noto-naskh-arabic', 'wght.css'), 'Noto Naskh Arabic', ['arabic', 'latin']),
  ...faces(nm('@fontsource', 'scheherazade-new', '400.css'), 'Scheherazade New', ['arabic', 'latin']),
  ...faces(nm('@fontsource', 'scheherazade-new', '700.css'), 'Scheherazade New', ['arabic', 'latin']),
].join('\n');
const pageFonts = [
  ...faces(nm('@fontsource-variable', 'cairo', 'wght.css'), 'Cairo', ['arabic', 'latin']),
].join('\n');
const phoneFonts = [
  ...faces(nm('@fontsource-variable', 'cairo', 'wght.css'), 'Cairo', ['arabic', 'latin']),
  ...faces(nm('@fontsource', 'el-messiri', '700.css'), 'El Messiri', ['arabic']),
].join('\n');

const stripMap = (s) => s.replace(/\/\/# sourceMappingURL=.*$/m, '');
const link = fs.readFileSync(path.join(root, 'src', 'link.js'), 'utf8');
const qrSrc = fs.readFileSync(nm('qrcode-generator', 'qrcode.js'), 'utf8');
const qrLib = '/* qrcode-generator 1.4.4 — MIT License, Copyright (c) 2009 Kazuhiko Arase */\n' +
  qrSrc.replace(/^\/\/-+[\s\S]*?\/\/-+\n/, '');
const adhanSrc = stripMap(fs.readFileSync(nm('adhan', 'lib', 'bundles', 'adhan.umd.min.js'), 'utf8'));
const adhanLicense = '/* adhan-js ' + ADHAN_VERSION + ' — MIT License, Copyright (c) 2016 Batoul Apps — https://github.com/batoulapps/adhan-js */';

const inline = (js) => '<script>' + js.replace(/<\/script/gi, '<\\/script') + '</script>';

let body = fs.readFileSync(path.join(root, 'src', 'body.html'), 'utf8')
  .replace('/*@FONTS@*/', () => screenFonts)
  .replace('<!--@QR@-->', () => inline(qrLib))
  .replace('<!--@LINK@-->', () => inline(link))
  .split('@REMOTE_URL@').join(REMOTE_URL)
  .split('@APP_URL@').join(APP_URL);

const head = '<title>مَنارة</title>\n<meta name="claude:viewport-fit-sides" content="cover">\n';
const artifact = head + body.replace('<!--@ADHAN@-->', () => `<script src="https://cdn.jsdelivr.net/npm/adhan@${ADHAN_VERSION}/lib/bundles/adhan.umd.min.js"></script>`);
const tv = '<!doctype html>\n<html lang="ar" dir="rtl">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n' + head + '</head>\n<body>\n' +
  body.replace('<!--@ADHAN@-->', () => inline(adhanLicense + '\n' + adhanSrc)) + '\n</body>\n</html>\n';
const remote = fs.readFileSync(path.join(root, 'src', 'remote.html'), 'utf8')
  .replace('/*@FONTS@*/', () => phoneFonts)
  .replace('<!--@LINK@-->', () => inline(link));

const appPage = fs.readFileSync(path.join(root, 'src', 'app.html'), 'utf8')
  .replace('/*@FONTS@*/', () => pageFonts)
  .split('@APK_URL@').join(APK_URL)
  .split('@WEB_URL@').join(WEB_URL);

for (const [name, text] of [['@FONTS@', tv], ['@QR@', tv], ['@LINK@', tv], ['@REMOTE_URL@', tv], ['@APP_URL@', tv], ['@FONTS@', remote], ['@LINK@', remote], ['@FONTS@', appPage], ['@APK_URL@', appPage], ['@WEB_URL@', appPage]]) {
  if (text.includes(name)) throw new Error('placeholder left in output: ' + name);
}

fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
fs.writeFileSync(path.join(root, 'dist', 'manara.html'), artifact);
fs.writeFileSync(path.join(root, 'dist', 'manara-tv.html'), tv);
fs.writeFileSync(path.join(root, 'dist', 'remote.html'), remote);
fs.writeFileSync(path.join(root, 'dist', 'app.html'), appPage);
const docs = path.join(root, '..', 'docs');
if (fs.existsSync(docs)) {
  fs.writeFileSync(path.join(docs, 'index.html'), tv);
  fs.writeFileSync(path.join(docs, 'remote.html'), remote);
  fs.mkdirSync(path.join(docs, 'app'), { recursive: true });
  fs.writeFileSync(path.join(docs, 'app', 'index.html'), appPage);
  fs.writeFileSync(path.join(docs, '.nojekyll'), '');
}
const kb = (s) => (Buffer.byteLength(s) / 1024).toFixed(0) + 'KB';
console.log('artifact', kb(artifact), '| tv', kb(tv), '| remote', kb(remote), '| app page', kb(appPage), '| QR', APP_URL);
