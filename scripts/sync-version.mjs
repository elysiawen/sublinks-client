import fs from "fs";
import path from "path";

/**
 * 从 .env 文件中读取 APP_VERSION
 */
function getVersionFromEnv() {
  const mode = process.argv[2] || "production";
  const envFiles = mode === "production" 
    ? [".env.production", ".env"] 
    : [".env.development", ".env"];
  
  const root = process.cwd();

  console.log(`[Sync Version] Searching for version in ${mode} mode...`);

  for (const file of envFiles) {
    const filePath = path.join(root, file);
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, "utf8");
      const match = content.match(/^APP_VERSION=(.+)$/m);
      if (match && match[1]) {
        console.log(`[Sync Version] Found version in ${file}`);
        return match[1].trim();
      }
    }
  }
  return null;
}

/**
 * 更新 package.json
 */
function updatePackageJson(version) {
  const filePath = path.join(process.cwd(), "package.json");
  if (!fs.existsSync(filePath)) return;

  const content = JSON.parse(fs.readFileSync(filePath, "utf8"));
  if (content.version !== version) {
    content.version = version;
    fs.writeFileSync(filePath, JSON.stringify(content, null, 2) + "\n", "utf8");
    console.log(`[Sync Version] Updated package.json to ${version}`);
  }
}

/**
 * 更新 tauri.conf.json
 */
function updateTauriConfig(version) {
  const filePath = path.join(process.cwd(), "src-tauri", "tauri.conf.json");
  if (!fs.existsSync(filePath)) return;

  const content = JSON.parse(fs.readFileSync(filePath, "utf8"));
  if (content.version !== version) {
    content.version = version;
    fs.writeFileSync(filePath, JSON.stringify(content, null, 2) + "\n", "utf8");
    console.log(`[Sync Version] Updated tauri.conf.json to ${version}`);
  }
}

/**
 * 更新 src-tauri/Cargo.toml
 */
function updateCargoToml(version) {
  const filePath = path.join(process.cwd(), "src-tauri", "Cargo.toml");
  if (!fs.existsSync(filePath)) return;

  let content = fs.readFileSync(filePath, "utf8");
  const versionRegex = /^version\s*=\s*"[^"]+"/m;
  const newVersionLine = `version = "${version}"`;

  if (versionRegex.test(content)) {
    const oldLineMatch = content.match(versionRegex);
    if (oldLineMatch && oldLineMatch[0] !== newVersionLine) {
      content = content.replace(versionRegex, newVersionLine);
      fs.writeFileSync(filePath, content, "utf8");
      console.log(`[Sync Version] Updated src-tauri/Cargo.toml to ${version}`);
    }
  }
}

/**
 * 规范化版本号为 SemVer 格式 (x.y.z)
 */
function normalizeVersion(version) {
  if (!version) return null;

  // 移除开头的 v
  let v = version.startsWith("v") ? version.slice(1) : version;

  // 处理只有两个数字的情况，例如 0.9 -> 0.9.0
  const parts = v.split(".");
  if (parts.length === 1) {
    v = `${parts[0]}.0.0`;
  } else if (parts.length === 2) {
    v = `${parts[0]}.${parts[1]}.0`;
  }

  return v;
}

const rawVersion = getVersionFromEnv();
const version = normalizeVersion(rawVersion);

if (version) {
  console.log(`[Sync Version] Found APP_VERSION=${rawVersion} in .env, normalized to ${version}`);
  updatePackageJson(version);
  updateTauriConfig(version);
  updateCargoToml(version);
} else {
  console.error("[Sync Version] Could not find APP_VERSION in .env files");
  process.exit(1);
}
