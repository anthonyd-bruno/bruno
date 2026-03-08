import { z } from 'zod';

export enum TrustTier {
  OfficialDocs = 'official_docs',
  Repo = 'repo',
  Community = 'community',
  External = 'external'
}

export const trustTierSchema = z.nativeEnum(TrustTier);