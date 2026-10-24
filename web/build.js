// Builds the Manara mosque screen from src/body.html:
//   dist/manara.html     – artifact page (no document skeleton; prayer library from jsDelivr)
//   dist/manara-tv.html  – standalone offline file for the TV (everything inlined),
//                          also written to ../docs/index.html
const fs = require('fs');
const path = require('path');
const root = __dirname;
const nm = (...p) => path.join(root, 'node_modules', ...p);
const ADHAN_VERSION = '4.4.6';

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

const fontCss = [
  ...faces(nm('@fontsource-variable', 'cairo', 'wght.css'), 'Cairo', ['arabic', 'latin']),
  ...faces(nm('@fontsource', 'el-messiri', '600.css'), 'El Messiri', ['arabic']),
  ...faces(nm('@fontsource', 'el-messiri', '700.css'), 'El Messiri', ['arabic']),
  ...faces(nm('@fontsource', 'amiri', '400.css'), 'Amiri', ['arabic', 'latin']),
  ...faces(nm('@fontsource', 'amiri', '700.css'), 'Amiri', ['arabic', 'latin']),
].join('\n');

const body = fs.readFileSync(path.join(root, 'src', 'body.html'), 'utf8').replace('/*@FONTS@*/', fontCss);
const adhanSrc = fs.readFileSync(nm('adhan', 'lib', 'bundles', 'adhan.umd.min.js'), 'utf8').replace(/\/\/# sourceMappingURL=.*$/m, '');
const license = '/* adhan-js ' + ADHAN_VERSION + ' — MIT License, Copyright (c) 2016 Batoul Apps — https://github.com/batoulapps/adhan-js */';

const head = '<title>مَنارة</title>\n<meta name="claude:viewport-fit-sides" content="cover">\n';
const artifact = head + body.replace('<!--@ADHAN@-->', `<script src="https://cdn.jsdelivr.net/npm/adhan@${ADHAN_VERSION}/lib/bundles/adhan.umd.min.js"></script>`);
const tv = '<!doctype html>\n<html lang="ar" dir="rtl">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n' + head + '</head>\n<body>\n' +
  body.replace('<!--@ADHAN@-->', `<script>${license}\n${adhanSrc}</script>`) + '\n</body>\n</html>\n';

fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
fs.writeFileSync(path.join(root, 'dist', 'manara.html'), artifact);
fs.writeFileSync(path.join(root, 'dist', 'manara-tv.html'), tv);
// The repo serves the offline page from docs/ (GitHub Pages and the Android app both use it).
const docs = path.join(root, '..', 'docs');
if (fs.existsSync(docs)) fs.writeFileSync(path.join(docs, 'index.html'), tv);
console.log('fonts', (fontCss.length / 1024).toFixed(0) + 'KB', '| artifact', (artifact.length / 1024).toFixed(0) + 'KB', '| tv', (tv.length / 1024).toFixed(0) + 'KB');
