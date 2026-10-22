#!/usr/bin/env node

/**
 * Release Build Script for YouTube Freemium
 * 
 * Features:
 * - Safely strips all single-line (//) and multi-line (/* ... * /) comments
 *   without corrupting URLs, string literals, or regular expression literals
 * - Strips console.log and console.debug statements
 * - Compresses redundant whitespace and blank lines
 * - Minifies CSS and JSON
 * - Validates generated JavaScript syntax using Node's syntax checker
 * - Optional --obfuscate flag for advanced minification
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const args = process.argv.slice(2);
function getArg(flag, defaultValue) {
    const idx = args.indexOf(flag);
    if (idx !== -1 && idx + 1 < args.length) return args[idx + 1];
    return defaultValue;
}

const isObfuscate = args.includes('--obfuscate');
const rootDir = path.resolve(__dirname, '..');
const srcDir = path.resolve(getArg('--src', path.join(rootDir, 'src')));
const outDir = path.resolve(getArg('--out', path.join(rootDir, 'out', 'release')));

console.log(`[BUILD] Source directory: ${srcDir}`);
console.log(`[BUILD] Output directory: ${outDir}`);
console.log(`[BUILD] Mode: ${isObfuscate ? 'OBFUSCATE / MINIFY' : 'CLEAN RELEASE (Strip Comments & Logs)'}`);

if (!fs.existsSync(srcDir)) {
    console.error(`[ERROR] Source directory does not exist: ${srcDir}`);
    process.exit(1);
}

// Clean and recreate output directory
if (fs.existsSync(outDir)) {
    fs.rmSync(outDir, { recursive: true, force: true });
}
fs.mkdirSync(outDir, { recursive: true });

/**
 * Strips comments and console.logs from JavaScript code safely
 */
function cleanJavaScript(code) {
    // Matches:
    // 1) Strings ("...", '...', `...`)
    // 2) RegExp literals (/.../[flags])
    // 3) Multi-line comments (/* ... */)
    // 4) Single-line comments (// ...)
    const commentRegex = /("(?:\\[\s\S]|[^"\\])*"|'(?:\\[\s\S]|[^'\\])*'|`(?:\\[\s\S]|[^`\\])*`|\/(?![*\/])(?:\\.|[^\\\/\n])+\/[gimyus]*)|(\/\*[\s\S]*?\*\/|\/\/[^\n]*)/g;

    let result = code.replace(commentRegex, (match, preserved) => preserved || '');

    // Strip console.log and console.debug statements
    result = result.replace(/console\.(log|debug)\s*\((?:[^)(]+|\((?:[^)(]+|\([^)(]*\))*\))*\);?/g, '');

    // Trim trailing whitespace per line and remove redundant blank lines
    const lines = result.split('\n')
        .map(l => l.trimRight())
        .filter((line, idx, arr) => {
            if (line.trim().length > 0) return true;
            return idx > 0 && arr[idx - 1].trim().length > 0;
        });

    return lines.join('\n');
}

/**
 * Advanced minification / mangling when --obfuscate is enabled
 */
function obfuscateCode(code) {
    try {
        const terser = require('terser');
        const minified = terser.minify_sync(code, {
            mangle: { toplevel: false },
            compress: { drop_console: true, dead_code: true }
        });
        if (minified && minified.code) return minified.code;
    } catch (e) {
        // Fallback: compact whitespace
    }

    return code
        .split('\n')
        .map(l => l.trim())
        .filter(l => l.length > 0)
        .join('\n');
}

/**
 * Minifies CSS code by removing comments and extra whitespace
 */
function cleanCSS(css) {
    return css
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/\s+/g, ' ')
        .replace(/\s*([\{\}:;,])\s*/g, '$1')
        .trim();
}

/**
 * Minifies JSON code
 */
function cleanJSON(jsonStr) {
    try {
        return JSON.stringify(JSON.parse(jsonStr));
    } catch (e) {
        return jsonStr;
    }
}

/**
 * Recursively copies and processes directory
 */
function processDirectory(currentSrc, currentOut) {
    const entries = fs.readdirSync(currentSrc, { withFileTypes: true });

    for (const entry of entries) {
        // Skip OS files
        if (entry.name === '.DS_Store') continue;

        const srcPath = path.join(currentSrc, entry.name);
        const outPath = path.join(currentOut, entry.name);

        if (entry.isDirectory()) {
            fs.mkdirSync(outPath, { recursive: true });
            processDirectory(srcPath, outPath);
        } else if (entry.isFile()) {
            const ext = path.extname(entry.name).toLowerCase();

            if (ext === '.js') {
                let code = fs.readFileSync(srcPath, 'utf8');
                code = cleanJavaScript(code);
                if (isObfuscate) {
                    code = obfuscateCode(code);
                }
                fs.writeFileSync(outPath, code, 'utf8');

                // Validate syntax
                try {
                    execSync(`node -c "${outPath}"`);
                    console.log(`  [OK] Processed & validated: ${path.relative(srcDir, srcPath)}`);
                } catch (err) {
                    console.error(`  [FAIL] Syntax validation error on ${outPath}:`, err.message);
                    process.exit(1);
                }
            } else if (ext === '.css') {
                const css = fs.readFileSync(srcPath, 'utf8');
                fs.writeFileSync(outPath, cleanCSS(css), 'utf8');
                console.log(`  [OK] Minified CSS: ${path.relative(srcDir, srcPath)}`);
            } else if (ext === '.json') {
                const json = fs.readFileSync(srcPath, 'utf8');
                fs.writeFileSync(outPath, cleanJSON(json), 'utf8');
                console.log(`  [OK] Minified JSON: ${path.relative(srcDir, srcPath)}`);
            } else {
                // Copy assets, HTML, images as-is
                fs.copyFileSync(srcPath, outPath);
                console.log(`  [COPY] Asset: ${path.relative(srcDir, srcPath)}`);
            }
        }
    }
}

processDirectory(srcDir, outDir);
console.log(`[DONE] Release build successfully created at: ${outDir}`);
