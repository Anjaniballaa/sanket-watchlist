import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";
import { upsertAuthUser } from "@/lib/upsert-user";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  pages: { signIn: "/", error: "/login-error" },
  callbacks: {
    async jwt({ token, user }) {
      const email = user?.email ?? (typeof token.email === "string" ? token.email : null);
      if (user && email) {
        try {
          token.sub = await upsertAuthUser({
            email,
            name: user.name,
            image: user.image,
          });
        } catch (err) {
          console.error("[sanket] persist user failed", err);
          throw err;
        }
        token.name = user.name;
        token.email = email;
        token.picture = user.image;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
        session.user.name = token.name ?? session.user.name;
        session.user.email = token.email ?? session.user.email;
        session.user.image = (token.picture as string | undefined) ?? session.user.image;
      }
      return session;
    },
  },
});
