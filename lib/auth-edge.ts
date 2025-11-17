import NextAuth from "next-auth";

// Edge-compatible auth configuration for middleware
// This file does NOT import any Node.js modules (pg, bcrypt, etc.)
// Authentication logic stays in lib/auth.ts for API routes

export const { auth } = NextAuth({
  providers: [], // No providers needed for session checking in middleware
  
  session: {
    strategy: "jwt",
    maxAge: parseInt(process.env.AUTH_SESSION_MAX_AGE || "2592000"),
  },

  pages: {
    signIn: "/auth/signin",
    error: "/auth/error",
  },

  secret: process.env.AUTH_SECRET,
  trustHost: true,
});
