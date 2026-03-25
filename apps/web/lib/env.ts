import { z } from "zod";

const publicSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1)
});

const serverSchema = publicSchema.extend({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  ANALYSIS_API_URL: z.string().url(),
  ANALYSIS_API_TOKEN: z.string().min(1),
  SESSION_ZIPS_BUCKET: z.string().default("session-zips"),
  SESSION_EXPORTS_BUCKET: z.string().default("session-exports")
});

export function getPublicEnv() {
  return publicSchema.parse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  });
}

export function getServerEnv() {
  return serverSchema.parse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    ANALYSIS_API_URL: process.env.ANALYSIS_API_URL,
    ANALYSIS_API_TOKEN: process.env.ANALYSIS_API_TOKEN,
    SESSION_ZIPS_BUCKET: process.env.SESSION_ZIPS_BUCKET,
    SESSION_EXPORTS_BUCKET: process.env.SESSION_EXPORTS_BUCKET
  });
}
