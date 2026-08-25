import { Capacitor } from "@capacitor/core";

export const MY_PLAN_PUBLIC_ORIGIN = (import.meta.env.VITE_MY_PLAN_PUBLIC_ORIGIN || "https://acadcal26-9ch8welq.manus.space").replace(/\/+$/, "");

export function isNativeMyPlanApp() {
  return Capacitor.isNativePlatform();
}

export function isNativeAndroidMyPlanApp() {
  return isNativeMyPlanApp() && Capacitor.getPlatform() === "android";
}

export function myPlanApiOrigin() {
  return MY_PLAN_PUBLIC_ORIGIN;
}
