import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { Pool } from "pg";
import bcrypt from "bcryptjs";
import speakeasy from "speakeasy";

// Lazy-load database connection - only create when actually needed
let pool: Pool | null = null;

function getPool() {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
    });
  }
  return pool;
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    CredentialsProvider({
      id: "credentials",
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        mfaToken: { label: "MFA Token", type: "text", optional: true },
      },
      async authorize(credentials) {
        console.log("🔐 AUTHORIZE CALLED");
        console.log("Credentials received:", { 
          email: credentials?.email,
          hasPassword: !!credentials?.password,
          hasMfaToken: !!credentials?.mfaToken
        });

        if (!credentials?.email || !credentials?.password) {
          console.log("❌ Missing credentials");
          throw new Error("Missing credentials");
        }

        // Type assertion for credentials
        const { email, password, mfaToken } = credentials as {
          email: string;
          password: string;
          mfaToken?: string;
        };

        console.log("📧 Email:", email);

        const client = await getPool().connect();
        try {
          console.log("🔍 Querying database...");
          
          // Get user from database
          const result = await client.query(
            `SELECT id, email, password_hash, role, is_active, mfa_enabled, mfa_secret 
             FROM users 
             WHERE email = $1`,
            [email]
          );

          console.log("📊 Query result:", result.rows.length, "rows");

          if (result.rows.length === 0) {
            console.log("❌ No user found with email:", email);
            throw new Error("Invalid credentials");
          }

          const user = result.rows[0];
          console.log("👤 User found:", { id: user.id, email: user.email, role: user.role, is_active: user.is_active });

          // Check if account is active
          if (!user.is_active) {
            console.log("❌ Account is disabled");
            throw new Error("Account is disabled");
          }

          // Verify password
          console.log("🔑 Verifying password...");
          console.log("Hash preview:", user.password_hash.substring(0, 30));
          
          const isValidPassword = await bcrypt.compare(
            password,
            user.password_hash
          );

          console.log("🔑 Password valid:", isValidPassword);

          if (!isValidPassword) {
            console.log("❌ Invalid password");
            throw new Error("Invalid credentials");
          }

          // Check MFA if enabled
          if (user.mfa_enabled) {
            console.log("🔐 MFA is enabled");
            if (!mfaToken) {
              console.log("❌ MFA token required but not provided");
              throw new Error("MFA_REQUIRED");
            }

            const isValidMFA = speakeasy.totp.verify({
              secret: user.mfa_secret,
              encoding: "base32",
              token: mfaToken,
              window: parseInt(process.env.MFA_WINDOW || "1"),
            });

            if (!isValidMFA) {
              console.log("❌ Invalid MFA token");
              throw new Error("Invalid MFA token");
            }
          }

          // Update last login
          console.log("📝 Updating last login...");
          await client.query(
            "UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1",
            [user.id]
          );

          // Log the login
          console.log("📝 Logging access...");
          await client.query(
            `INSERT INTO access_logs (user_id, action, metadata) 
             VALUES ($1, 'login', $2)`,
            [user.id, JSON.stringify({ email: user.email })]
          );

          console.log("✅ Login successful!");
          
          const returnValue = {
            id: user.id,
            email: user.email,
            role: user.role,
            mfaEnabled: user.mfa_enabled,
          };
          
          console.log("🎉 Returning user:", returnValue);

          return returnValue;
        } catch (error) {
          console.error("💥 ERROR in authorize:", error);
          throw error;
        } finally {
          client.release();
        }
      },
    }),
  ],

  pages: {
    signIn: "/auth/signin",
    error: "/auth/error",
  },

  session: {
    strategy: "jwt",
    maxAge: parseInt(process.env.AUTH_SESSION_MAX_AGE || "2592000"), // 30 days
    updateAge: 86400, // 24 hours
  },

  callbacks: {
    async jwt({ token, user }) {
      console.log("📝 JWT callback - user:", user ? "present" : "null");
      if (user) {
        token.role = user.role;
        token.id = user.id;
        token.mfaEnabled = user.mfaEnabled;
        console.log("📝 JWT token updated:", { id: token.id, role: token.role });
      }
      return token;
    },

    async session({ session, token }) {
      console.log("📝 Session callback");
      if (session?.user && token) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
        session.user.mfaEnabled = token.mfaEnabled as boolean;
        console.log("📝 Session updated:", { id: session.user.id, role: session.user.role });
      }
      return session;
    },

    async signIn({ user, account }) {
      console.log("📝 SignIn callback - user:", user ? "present" : "null");
      // Log successful sign in
      const client = await getPool().connect();
      try {
        await client.query(
          `INSERT INTO access_logs (user_id, action, metadata) 
           VALUES ($1, 'signin', $2)`,
          [user.id, JSON.stringify({ provider: account?.provider })]
        );
      } finally {
        client.release();
      }
      return true;
    },
  },

  events: {
    // Note: signOut event in NextAuth v5 doesn't provide reliable user context
    // User signouts are tracked via middleware or client-side instead
  },

  secret: process.env.AUTH_SECRET,
  trustHost: true,
  
  debug: true, // Enable debug mode
});

// Middleware helper to check roles
export async function requireRole(allowedRoles: string[]) {
  const session = await auth();
  
  if (!session?.user) {
    throw new Error("Unauthorized");
  }

  if (!allowedRoles.includes(session.user.role)) {
    throw new Error("Forbidden");
  }

  return session;
}

// Middleware helper to check if user can edit
export async function requireEditAccess() {
  const session = await auth();
  
  if (!session?.user) {
    throw new Error("Unauthorized");
  }

  if (session.user.role !== "admin_edit") {
    throw new Error("Forbidden - Edit access required");
  }

  return session;
}

// Get database client
export function getDbClient() {
  return getPool().connect();
}
