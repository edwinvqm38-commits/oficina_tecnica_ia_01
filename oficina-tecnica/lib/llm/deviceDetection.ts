// Client-side device profile detection
// Stores results in localStorage key `ot:device:profile`

export type DeviceProfile = {
  tier: "low" | "mid" | "high";
  threads: number;
  memoryGB: number;
  deviceType: "mobile" | "tablet" | "desktop";
  detectedAt: number;
  recommendedMaxModelSize: "3b" | "7b" | "14b";
};

export async function detectDeviceProfile(): Promise<DeviceProfile> {
  const threads = navigator.hardwareConcurrency ?? 4;
  const memoryGB = (navigator as { deviceMemory?: number }).deviceMemory ?? 4;
  const width = window.innerWidth;
  const deviceType = width < 768 ? "mobile" : width < 1024 ? "tablet" : "desktop";

  let tier: DeviceProfile["tier"];
  let recommendedMaxModelSize: DeviceProfile["recommendedMaxModelSize"];

  if (threads >= 8 && memoryGB >= 16) {
    tier = "high";
    recommendedMaxModelSize = "14b";
  } else if (threads >= 4 && memoryGB >= 8) {
    tier = "mid";
    recommendedMaxModelSize = "7b";
  } else {
    tier = "low";
    recommendedMaxModelSize = "3b";
  }

  // Note: navigator.deviceMemory is capped at 8 by browsers for privacy.
  // Real RAM is likely higher. If threads >= 8 and memory reports 8, assume high.
  if (threads >= 8 && memoryGB >= 8) {
    tier = "high";
    recommendedMaxModelSize = "14b";
  }

  const profile: DeviceProfile = {
    tier,
    threads,
    memoryGB,
    deviceType,
    detectedAt: Date.now(),
    recommendedMaxModelSize,
  };

  localStorage.setItem("ot:device:profile", JSON.stringify(profile));
  return profile;
}

export function getStoredDeviceProfile(): DeviceProfile | null {
  try {
    const raw = localStorage.getItem("ot:device:profile");
    return raw ? (JSON.parse(raw) as DeviceProfile) : null;
  } catch {
    return null;
  }
}
