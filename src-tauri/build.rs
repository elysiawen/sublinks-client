fn main() {
    #[cfg(feature = "clippy")]
    {
        println!("cargo:warning=Skipping tauri_build during Clippy");
    }

    // Export APP_VERSION from .env files
    let mut app_version = "1.0.0".to_string();
    let profile = std::env::var("PROFILE").unwrap_or_else(|_| "debug".to_string());
    let env_files = if profile == "release" {
        vec![".env.production", ".env"]
    } else {
        vec![".env.development", ".env"]
    };
    let root = std::path::Path::new("..");

    let mut found = false;
    for file in &env_files {
        let path = root.join(file);
        if !path.exists() {
            continue;
        }
        println!("cargo:rerun-if-changed={}", path.display());
        if let Ok(content) = std::fs::read_to_string(&path) {
            for line in content.lines() {
                if let Some(v) = line.strip_prefix("APP_VERSION=") {
                    app_version = v.trim().to_string();
                    found = true;
                    break;
                }
            }
        }
        if found {
            break;
        }
    }
    println!("cargo:rustc-env=APP_VERSION={}", app_version);

    #[cfg(not(feature = "clippy"))]
    tauri_build::build();
}
