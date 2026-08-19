const fs = require('fs');
const path = require('path');

const outDir = path.join(__dirname, 'out');
const indexPath = path.join(outDir, 'index.html');

if (fs.existsSync(indexPath)) {
  console.log('[Orion Post-Build] Patching paths inside index.html...');
  let html = fs.readFileSync(indexPath, 'utf8');
  
  // Re-write absolute leading script and link slash paths down to local relative points
  html = html.replace(/src="\/_next\//g, 'src="_next/');
  html = html.replace(/href="\/_next\//g, 'href="_next/');
  
  fs.writeFileSync(indexPath, html, 'utf8');
  console.log('[Orion Post-Build] Path patching complete!');
} else {
  console.error('[Orion Post-Build] Error: index.html not found at ' + indexPath);
}