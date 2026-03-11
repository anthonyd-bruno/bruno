import { z } from 'zod';
export declare enum TrustTier {
    OfficialDocs = "official_docs",
    Repo = "repo",
    Community = "community",
    External = "external"
}
export declare const trustTierSchema: z.ZodNativeEnum<typeof TrustTier>;
