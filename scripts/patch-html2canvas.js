const fs = require('fs')
const path = require('path')

function patchFile(filePath) {
  if (!fs.existsSync(filePath)) return
  let content = fs.readFileSync(filePath, 'utf8')
  let modified = false

  const targetPattern1 = /if\s*\(\s*typeof\s+colorFunction\s*===\s*['"]undefined['"]\s*\)\s*\{\s*throw\s+new\s+Error\s*\(\s*['"]Attempting to parse an unsupported color function[^'"]*['"]\s*\+[^)]*\)\s*;\s*\}/g
  if (targetPattern1.test(content)) {
    content = content.replace(targetPattern1, 'if (typeof colorFunction === "undefined") { return 0; }')
    modified = true
  }

  const targetPattern2 = /if\s*\(\s*void\s+0\s*===\s*t\s*\)\s*throw\s+new\s+Error\s*\(\s*['"]Attempting to parse an unsupported color function\s*["'][^)]*\)\s*;/g
  if (targetPattern2.test(content)) {
    content = content.replace(targetPattern2, 'if(void 0===t)return 0;')
    modified = true
  }

  if (content.includes('Attempting to parse an unsupported color function')) {
    content = content.replace(/throw\s+new\s+Error\s*\(\s*["']Attempting to parse an unsupported color function[^)]*\)\s*;/g, 'return 0;')
    modified = true
  }

  if (modified) {
    fs.writeFileSync(filePath, content, 'utf8')
    console.log(`[patch-html2canvas] Successfully patched: ${filePath}`)
  }
}

function findAndPatch(dir) {
  if (!fs.existsSync(dir)) return
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true })
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        findAndPatch(fullPath)
      } else if (entry.isFile() && (entry.name.includes('html2canvas') || entry.name === 'color.js')) {
        patchFile(fullPath)
      }
    }
  } catch (err) {}
}

const nodeModulesDir = path.join(__dirname, '..', 'node_modules')
findAndPatch(nodeModulesDir)
console.log('[patch-html2canvas] Done patching html2canvas color parser.')
