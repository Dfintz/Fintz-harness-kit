#!/usr/bin/env node
/**
 * Patch @emotion/react to fix React 18 + react-is incompatibility
 * This script wraps the problematic exports.AsyncMode assignment in a try-catch
 */

const fs = require('fs');
const path = require('path');

// Check both frontend node_modules and root node_modules (workspace hoisting)
const possiblePaths = [
  path.join(__dirname, '../node_modules/@emotion/react/dist'),
  path.join(__dirname, '../../node_modules/@emotion/react/dist'),
];

console.log('Patching @emotion/react for React 18 compatibility...');

let emotionPath = null;
for (const p of possiblePaths) {
  try {
    if (fs.existsSync(p)) {
      emotionPath = p;
      console.log(`Found @emotion/react at: ${p}`);
      break;
    }
  } catch (e) {
    // Silently continue if path check fails
  }
}

if (!emotionPath) {
  console.log('⚠️  @emotion/react dist folder not found, skipping patch');
  process.exit(0);
}

try {
  // Find all .js files in @emotion/react/dist
  const files = fs.readdirSync(emotionPath).filter(f => f.endsWith('.js'));

  let patchedCount = 0;

  files.forEach(file => {
    const filePath = path.join(emotionPath, file);
    let content = fs.readFileSync(filePath, 'utf8');

    // Check if this file contains the problematic exports pattern
    if (content.includes('exports.AsyncMode') || content.includes('exports.ContextConsumer')) {
      console.log(`Patching ${file}...`);

      // Wrap exports assignments in try-catch to prevent errors
      // This regex finds patterns like: exports.AsyncMode = value;
      content = content.replace(
        /(exports\.(AsyncMode|ContextConsumer|ContextProvider|Element|ForwardRef|Fragment|Lazy|Memo|Portal|Profiler|StrictMode|Suspense|isAsyncMode|isConcurrentMode|isContextConsumer|isContextProvider|isElement|isForwardRef|isFragment|isLazy|isMemo|isPortal|isProfiler|isStrictMode|isSuspense|isValidElementType))\s*=/g,
        'try { $1 = '
      );

      // Add closing try-catch after each assignment
      content = content.replace(
        /(try \{ exports\.\w+ = [^;]+;)/g,
        '$1 } catch(e) { /* Ignore React internal property errors */ }'
      );

      fs.writeFileSync(filePath, content, 'utf8');
      patchedCount++;
    }
  });

  console.log(`✅ Patched ${patchedCount} file(s) in @emotion/react`);
  console.log('React 18 compatibility fix applied successfully!');
} catch (e) {
  console.log('⚠️  Error during patching, but continuing:', e.message);
  process.exit(0);
}
