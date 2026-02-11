/**
 * SubLinks Client Configuration
 */
export const SUBLINKS_CONFIG = {
  // Product Name
  PRODUCT_NAME: "SubLinks Client",

  // Default API URL for SubLinks service
  DEFAULT_API_URL: import.meta.env.VITE_SUBLINKS_API_URL || "",

  // Background Image API for Home Page Welcome Banner
  // Example: https://api.paugram.com/wallpaper/
  // The seed is appended in the component to ensure refresh
  BACKGROUND_IMAGE_API: "https://api.horosama.com/random.php",

  // Hitokoto (一言) API for Home Page quotes
  HITOKOTO_API: "https://v1.hitokoto.cn/",

  // Storage keys
  STORAGE_KEYS: {
    TOKEN: "sublinks_token",
    REFRESH_TOKEN: "sublinks_refresh_token",
    USER: "sublinks_user",
    API_URL: "sublinks_api_url",
    SIDEBAR_VISIBILITY: "sublinks_sidebar_visibility",
    LOGOUT_REASON: "sublinks_logout_reason",
  },
};
