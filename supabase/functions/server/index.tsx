import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import * as kv from "./kv_store.tsx";

const app = new Hono();

// Enable logger
app.use('*', logger(console.log));

// Enable CORS for all routes and methods
app.use(
  "/*",
  cors({
    origin: "*",
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
  }),
);

// Helper functions
function generateOTP(): string {
  return Math.floor(Math.random() * 1000000).toString().padStart(6, "0");
}

async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const inputHash = await hashPassword(password);
  return inputHash === hash;
}

// Health check endpoint
app.get("/make-server-bd792702/health", (c) => {
  return c.json({ status: "ok" });
});

// Auth: Signup
app.post("/make-server-bd792702/auth/signup", async (c) => {
  try {
    const body = await c.req.json();
    const { name, email, password } = body;

    // Check if user exists
    const existingUser = await kv.get(`user:${email}`);
    if (existingUser) {
      return c.json({ error: "Email already registered" }, 409);
    }

    // Create user
    const otp = generateOTP();
    const otpExpiry = new Date(Date.now() + 5 * 60 * 1000).toISOString();
    const user = {
      id: crypto.randomUUID(),
      email,
      name,
      passwordHash: await hashPassword(password),
      isVerified: false,
      otpCode: otp,
      otpExpiry,
      otpAttempts: 0,
      createdAt: new Date().toISOString(),
    };

    await kv.set(`user:${email}`, user);

    console.log(`[OTP] Email: ${email}, OTP: ${otp}`);

    return c.json({ message: "OTP sent to your email (check server logs)" }, 201);
  } catch (error) {
    console.error("[signup]", error);
    return c.json({ error: "An error occurred. Please try again." }, 500);
  }
});

// Auth: Verify OTP
app.post("/make-server-bd792702/auth/verify-otp", async (c) => {
  try {
    const body = await c.req.json();
    const { email, otp } = body;

    const user = await kv.get(`user:${email}`);
    if (!user) {
      return c.json({ error: "User not found" }, 404);
    }

    if (user.isVerified) {
      return c.json({
        message: "Already verified",
        user: { id: user.id, email: user.email, name: user.name, isVerified: true }
      });
    }

    if (user.otpAttempts >= 5) {
      return c.json({ error: "Too many attempts. Please request a new OTP." }, 429);
    }

    if (new Date(user.otpExpiry) < new Date()) {
      return c.json({ error: "OTP has expired. Please request a new one." }, 400);
    }

    if (user.otpCode !== otp) {
      user.otpAttempts++;
      await kv.set(`user:${email}`, user);
      return c.json({ error: "Invalid OTP. Please check and try again." }, 400);
    }

    // Success - verify user
    user.isVerified = true;
    user.otpCode = null;
    user.otpExpiry = null;
    user.otpAttempts = 0;
    await kv.set(`user:${email}`, user);

    return c.json({
      message: "Email verified successfully",
      user: { id: user.id, email: user.email, name: user.name, isVerified: true, createdAt: user.createdAt }
    });
  } catch (error) {
    console.error("[verify-otp]", error);
    return c.json({ error: "An error occurred. Please try again." }, 500);
  }
});

// Auth: Signin
app.post("/make-server-bd792702/auth/signin", async (c) => {
  try {
    const body = await c.req.json();
    const { email, password } = body;

    const user = await kv.get(`user:${email}`);
    if (!user) {
      return c.json({ error: "Invalid credentials" }, 401);
    }

    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) {
      return c.json({ error: "Invalid credentials" }, 401);
    }

    if (!user.isVerified) {
      return c.json({
        error: "Please verify your email first.",
        needsVerification: true
      }, 403);
    }

    return c.json({
      message: "Signed in successfully",
      user: { id: user.id, email: user.email, name: user.name, isVerified: user.isVerified, createdAt: user.createdAt }
    });
  } catch (error) {
    console.error("[signin]", error);
    return c.json({ error: "An error occurred. Please try again." }, 500);
  }
});

// Auth: Resend OTP
app.post("/make-server-bd792702/auth/resend-otp", async (c) => {
  try {
    const body = await c.req.json();
    const { email } = body;

    const user = await kv.get(`user:${email}`);
    if (!user) {
      return c.json({ error: "User not found" }, 404);
    }

    if (user.isVerified) {
      return c.json({ error: "Account is already verified" }, 400);
    }

    const otp = generateOTP();
    const otpExpiry = new Date(Date.now() + 5 * 60 * 1000).toISOString();

    user.otpCode = otp;
    user.otpExpiry = otpExpiry;
    user.otpAttempts = 0;
    await kv.set(`user:${email}`, user);

    console.log(`[OTP RESEND] Email: ${email}, OTP: ${otp}`);

    return c.json({ message: "New OTP sent to your email (check server logs)" });
  } catch (error) {
    console.error("[resend-otp]", error);
    return c.json({ error: "An error occurred. Please try again." }, 500);
  }
});

// Calculations: Save
app.post("/make-server-bd792702/calculations", async (c) => {
  try {
    const body = await c.req.json();
    const { userId, calculatorType, inputs, results } = body;

    if (!userId) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const calculation = {
      id: crypto.randomUUID(),
      userId,
      calculatorType,
      inputs,
      results,
      createdAt: new Date().toISOString(),
    };

    // Store calculation
    const userCalcsKey = `calculations:${userId}`;
    const existingCalcs = await kv.get(userCalcsKey) || [];
    existingCalcs.push(calculation);
    await kv.set(userCalcsKey, existingCalcs);

    return c.json({ id: calculation.id, message: "Result saved successfully" }, 201);
  } catch (error) {
    console.error("[save-calculation]", error);
    return c.json({ error: "An error occurred. Please try again." }, 500);
  }
});

// Calculations: Get user's calculations
app.get("/make-server-bd792702/calculations/:userId", async (c) => {
  try {
    const userId = c.req.param("userId");

    if (!userId) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const userCalcsKey = `calculations:${userId}`;
    const calculations = await kv.get(userCalcsKey) || [];

    // Sort by createdAt descending
    calculations.sort((a: any, b: any) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    return c.json({ calculations });
  } catch (error) {
    console.error("[get-calculations]", error);
    return c.json({ error: "An error occurred. Please try again." }, 500);
  }
});

Deno.serve(app.fetch);