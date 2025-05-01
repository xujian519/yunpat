import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs'
import { join } from 'path'

function fixImports(dir) {
  const files = readdirSync(dir, { withFileTypes: true })

  for (const file of files) {
    const fullPath = join(dir, file.name)

    if (file.isDirectory()) {
      fixImports(fullPath)
    } else if (file.name.endsWith('.js')) {
      let content = readFileSync(fullPath, 'utf-8')
      let modified = false

      // 修复相对导入路径
      content = content.replace(/from ['"](\.\.\/[^'"]+)['"]/g, (match, path) => {
        // 如果路径没有扩展名，添加 .js
        if (!path.endsWith('.js') && !path.endsWith('.json')) {
          modified = true
          return `from '${path}.js'`
        }
        return match
      })

      if (modified) {
        writeFileSync(fullPath, content)
        console.log(`Fixed: ${fullPath}`)
      }
    }
  }
}

// 修复所有 packages 目录
fixImports('packages')
console.log('Import paths fixed!')
