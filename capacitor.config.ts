import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.zinbas.myplan",
  appName: "MY PLAN",
  webDir: "dist/public",
  android: { allowMixedContent: false },
  plugins: {
    PushNotifications: { presentationOptions: ["alert", "sound"] },
  },
};

export default config;
