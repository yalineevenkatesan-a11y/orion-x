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
  html = html.replace(/src="autostatic\//g, 'src="_next/static/');
  html = html.replace(/href="autostatic\//g, 'href="_next/static/');
  html = html.replace(/src="auto\/static\//g, 'src="_next/static/');
  html = html.replace(/href="auto\/static\//g, 'href="_next/static/');
  
  fs.writeFileSync(indexPath, html, 'utf8');
  console.log('[Orion Post-Build] Path patching complete!');

  // Also create a directory junction for autostatic -> _next/static for bulletproof loading
  const autostaticDir = path.join(outDir, 'autostatic');
  const nextStaticDir = path.join(outDir, '_next', 'static');
  if (!fs.existsSync(autostaticDir) && fs.existsSync(nextStaticDir)) {
    try {
      fs.symlinkSync(nextStaticDir, autostaticDir, 'junction');
      console.log('[Orion Post-Build] Created autostatic junction to _next/static');
    } catch (e) {
      try {
        fs.cpSync(nextStaticDir, autostaticDir, { recursive: true });
        console.log('[Orion Post-Build] Copied _next/static to autostatic');
      } catch (cpErr) {}
    }
  }
} else {
  console.error('[Orion Post-Build] Error: index.html not found at ' + indexPath);
}