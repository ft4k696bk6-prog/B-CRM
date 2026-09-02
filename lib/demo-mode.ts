const demoModeSetting = process.env.NEXT_PUBLIC_DEMO_MODE;
const hasSupabaseBrowserConfig = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// A deployment without database credentials is intentionally a safe, in-memory
// product preview. Set NEXT_PUBLIC_DEMO_MODE=false to require Supabase explicitly.
export const demoModeEnabled =
  demoModeSetting === "true" || (demoModeSetting !== "false" && !hasSupabaseBrowserConfig);
