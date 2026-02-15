fn main() {
    #[cfg(feature = "clippy")]
    {
        println!("cargo:warning=Skipping tauri_build during Clippy");
    }

    // Export APP_VERSION from .env files
    let mut app_version = "1.0.0".to_string();
    let env_files = [".env.production", ".env.development", ".env"];
    let root = std::path::Path::new("..");

    for file in env_files {
        let path = root.join(file);
        if let Ok(content) = std::fs::read_to_string(path) {
            for line in content.lines() {
                if let Some(v) = line.strip_prefix("APP_VERSION=") {
                    app_version = v.trim().to_string();
                }
            }
        }
    }
    println!("cargo:rustc-env=APP_VERSION={}", app_version);

    #[cfg(not(feature = "clippy"))]
    tauri_build::build();
}
