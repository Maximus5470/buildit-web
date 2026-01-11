import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { admin, username } from "better-auth/plugins";
import db from "@/db";

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
  }),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
    minPasswordLength: 6,
  },
  plugins: [
    admin({
      defaultRole: "student",
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
    username({
      minUsernameLength: 5,
      maxUsernameLength: 100,
    }),
  ],
});
