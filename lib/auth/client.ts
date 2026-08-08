"use client";

import { createAuthClient } from "better-auth/react";

// Browser-side Better Auth client. Same-origin, so baseURL is inferred.
// Exposes signIn / signOut / useSession for the auth UI.
export const authClient = createAuthClient();

export const { signIn, signOut, useSession } = authClient;
