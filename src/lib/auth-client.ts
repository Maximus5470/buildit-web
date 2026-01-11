import { adminClient, usernameClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
  baseURL: "http://localhost:3000",
  plugins: [
    adminClient({
      roles: {
        student: {
          // biome-ignore lint/suspicious/noExplicitAny: better-auth internal type
          authorize: () => true as any,
          statements: [],
        },
        instructor: {
          authorize: () => true as any,
          statements: [],
        },
        admin: {
          authorize: () => true as any,
          statements: [],
        },
      },
    }),
    usernameClient(),
  ],
});

export const { signIn, signOut, signUp, useSession } = authClient;
