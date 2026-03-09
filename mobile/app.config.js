import "dotenv/config";

export default {
  expo: {
    name: "כחולבן",
    slug: "kahol-lavan",
    version: "1.1.0",
    orientation: "portrait",
    icon: "./assets/icon.png",
    userInterfaceStyle: "light",
    newArchEnabled: true,
    scheme: "kahollavan",
    splash: {
      image: "./assets/loading_image.jpg",
      resizeMode: "contain",
      backgroundColor: "#667eea",
    },
    ios: {
      supportsTablet: false,
      bundleIdentifier: "com.kahollavan.app",
      config: {
        googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY_IOS,
      },
      infoPlist: {
        NSLocationWhenInUseUsageDescription:
          "This app needs access to your location to show parking spots near you.",
        ITSAppUsesNonExemptEncryption: false,
      },
    },
    android: {
      adaptiveIcon: {
        foregroundImage: "./assets/adaptive-icon.png",
        backgroundColor: "#667eea",
      },
      package: "com.kahollavan.app",
      permissions: ["ACCESS_FINE_LOCATION", "ACCESS_COARSE_LOCATION"],
      config: {
        googleMaps: {
          apiKey: process.env.GOOGLE_MAPS_API_KEY_ANDROID,
        },
      },
    },
    web: {
      favicon: "./assets/favicon.png",
    },
    plugins: [
      "expo-web-browser",
      [
        "expo-location",
        {
          locationAlwaysAndWhenInUsePermission:
            "Allow Kahol-Lavan to use your location to show nearby parking spots.",
        },
      ],
    ],
    extra: {
      supabaseUrl: process.env.SUPABASE_URL,
      supabaseAnonKey: process.env.SUPABASE_ANON_KEY,
      streamApiKey: process.env.STREAM_API_KEY,
      eas: {
        projectId: "cf10e21d-9f18-4b9c-a2bc-313c1bde0568",
      },
    },
  },
};
