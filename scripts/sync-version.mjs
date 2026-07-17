import fs from 'fs'
import fsp from 'fs/promises'
import path from 'path'

const cwd = process.cwd()

function log_info(msg) {
  console.log(`\x1b[44m${msg}\x1b[0m`)
}

function log_success(msg) {
  console.log(`\x1b[32m${msg}\x1b[0m`)
}

function log_error(msg) {
  console.log(`\x1b[31m${msg}\x1b[0m`)
}

function log_debug(msg) {
  console.log(`\x1b[90m${msg}\x1b[0m`)
}

async function syncVersion() {
  try {
    // Determine which .env file to use based on CLI argument
    const mode = process.argv[2] || 'production'
    const envFile = mode === 'dev' ? '.env.development' : '.env.production'

    const envPath = path.join(cwd, envFile)
    const tauriConfPath = path.join(cwd, 'src-tauri', 'tauri.conf.json')
    const packageJsonPath = path.join(cwd, 'package.json')

    if (!fs.existsSync(envPath) || !fs.existsSync(tauriConfPath)) {
      log_debug(`Version sync skipped: missing ${envFile} or tauri.conf.json`)
      return
    }

    // Read APP_VERSION from env file
    const envContent = await fsp.readFile(envPath, 'utf-8')
    const versionMatch = envContent.match(/^APP_VERSION=(.+)$/m)
    if (!versionMatch) {
      log_debug(`Version sync skipped: APP_VERSION not found in ${envFile}`)
      return
    }
    const appVersion = versionMatch[1].trim()

    // Read and update tauri.conf.json
    const tauriConf = JSON.parse(await fsp.readFile(tauriConfPath, 'utf-8'))
    const oldTauriVersion = tauriConf.version
    if (oldTauriVersion !== appVersion) {
      tauriConf.version = appVersion
      await fsp.writeFile(tauriConfPath, JSON.stringify(tauriConf, null, 2) + '\n')
      log_success(`tauri.conf.json version synced: ${oldTauriVersion} → ${appVersion}`)
    }

    // Read and update package.json
    if (fs.existsSync(packageJsonPath)) {
      const packageJson = JSON.parse(await fsp.readFile(packageJsonPath, 'utf-8'))
      const oldPkgVersion = packageJson.version
      if (oldPkgVersion !== appVersion) {
        packageJson.version = appVersion
        await fsp.writeFile(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n')
        log_success(`package.json version synced: ${oldPkgVersion} → ${appVersion}`)
      }
    }

    log_info(`All versions in sync: ${appVersion} (from ${envFile})`)
  } catch (err) {
    log_error('Version sync failed:', err.message)
  }
}

await syncVersion()
