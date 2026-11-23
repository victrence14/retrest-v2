export type ThemePreference = "system" | "light" | "dark";
export type ResolvedTheme = Exclude<ThemePreference, "system">;

export const THEME_STORAGE_KEY = "retrest.appearance";

export function isThemePreference(value: unknown): value is ThemePreference {
  return value === "system" || value === "light" || value === "dark";
}

// Only fixed application text is inserted into the document head.
// Apply the saved preference before paint without making every route dynamic.
export const themeBootstrapScript = `(function(){var p="system";try{var s=localStorage.getItem("${THEME_STORAGE_KEY}");if(s==="light"||s==="dark"||s==="system")p=s}catch(e){}var t=p==="system"?(matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"):p;document.documentElement.dataset.theme=t;document.documentElement.dataset.themePreference=p})()`;
