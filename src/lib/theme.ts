// Reads the saved Light / Dark / Auto choice (see components/ThemeSwitch).

import { cookies } from "next/headers";
import type { Theme } from "@/components/ThemeSwitch";

export async function savedTheme(): Promise<Theme> {
  const value = (await cookies()).get("theme")?.value;
  return value === "light" || value === "dark" ? value : "auto";
}
