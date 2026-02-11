/// <reference types="vite/client" />
/// <reference types="vite-plugin-svgr/client" />

interface ImportMetaEnv {
  readonly VITE_SUBLINKS_API_URL: string;
  readonly UPDATE_API_URL: string;
  readonly UPDATE_APP_NAME: string;
  readonly APP_VERSION: string;
  readonly UPDATE_ENABLED: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
