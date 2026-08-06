import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const distDir = join(__dirname, 'dist')
const releaseDir = join(distDir, 'release')

function getVersion() {
  const pkg = JSON.parse(readFileSync(join(__dirname, 'package.json'), 'utf-8'))
  return pkg.version
}

function main() {
  const version = getVersion()
  console.log(`\n=== Packaging Chat Float v${version} ===\n`)

  const browsers = [
    {
      name: 'Chrome',
      outDir: join(distDir, 'chrome'),
      zipName: `Chat-Float-Chrome-${version}.zip`,
    },
    {
      name: 'Firefox',
      outDir: join(distDir, 'firefox'),
      zipName: `Chat-Float-Firefox-${version}.zip`,
    },
    {
      name: 'Edge',
      outDir: join(distDir, 'edge'),
      zipName: `Chat-Float-Edge-${version}.zip`,
    },
  ]

  rmSync(releaseDir, { recursive: true, force: true })
  mkdirSync(releaseDir, { recursive: true })

  for (const b of browsers) {
    if (!existsSync(b.outDir)) {
      throw new Error(`Missing build output: ${b.outDir}`)
    }

    const zipPath = join(releaseDir, b.zipName)
    console.log(`  Creating: dist/release/${b.zipName}`)
    execFileSync('zip', ['-qr', zipPath, '.', '-x', '*.DS_Store'], {
      cwd: b.outDir,
      stdio: 'inherit',
    })
  }

  console.log('\n=== Packaging complete ===\n')
  console.log('Output files:')
  for (const b of browsers) {
    console.log(`  dist/release/${b.zipName}`)
  }
}

try {
  main()
} catch (err) {
  console.error(
    '\nRelease packaging failed:',
    err instanceof Error ? err.message : String(err),
  )
  process.exit(1)
}
