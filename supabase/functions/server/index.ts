import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import * as kv from "./kv_store.tsx";
import { Resend } from "npm:resend@4.0.1";

const app = new Hono();

// Initialize Resend with API key
const getResendClient = () => {
  const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
  if (!RESEND_API_KEY) {
    console.warn("RESEND_API_KEY is not set");
    return null;
  }
  return new Resend(RESEND_API_KEY);
};

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

async function sendOtpEmail(email: string, otp: string) {
  const resend = getResendClient();
  if (!resend) {
    console.warn("Resend client not initialized. OTP:", otp);
    return;
  }

  try {
    const otpDigits = otp.split('').join(' ');
    const html = `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        * {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', sans-serif;
        }
        body {
            background: linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%);
            margin: 0;
            padding: 20px;
        }
        .container {
            max-width: 600px;
            margin: 0 auto;
            background: white;
            border-radius: 12px;
            box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
            overflow: hidden;
        }
        .header {
            background: linear-gradient(135deg, #2563eb 0%, #1e40af 100%);
            padding: 40px 20px;
            text-align: center;
            color: white;
        }
        .header h1 {
            margin: 0;
            font-size: 28px;
            font-weight: 700;
        }
        .header p {
            margin: 10px 0 0 0;
            font-size: 14px;
            opacity: 0.9;
        }
        .content {
            padding: 40px;
        }
        .greeting {
            font-size: 16px;
            color: #1f2937;
            margin-bottom: 30px;
            line-height: 1.6;
        }
        .otp-section {
            text-align: center;
            background: #f9fafb;
            border: 2px solid #e5e7eb;
            border-radius: 8px;
            padding: 30px;
            margin: 30px 0;
        }
        .otp-label {
            font-size: 13px;
            color: #6b7280;
            text-transform: uppercase;
            letter-spacing: 1px;
            margin-bottom: 12px;
            font-weight: 600;
        }
        .otp-code {
            font-size: 36px;
            font-weight: 700;
            color: #2563eb;
            letter-spacing: 8px;
            font-family: 'Monaco', 'Courier New', monospace;
            margin: 15px 0;
            word-spacing: 12px;
        }
        .otp-expiry {
            font-size: 12px;
            color: #ef4444;
            margin-top: 15px;
            font-weight: 500;
        }
        .instructions {
            background: #dbeafe;
            border-left: 4px solid #2563eb;
            padding: 15px;
            border-radius: 4px;
            margin: 25px 0;
        }
        .instructions p {
            margin: 8px 0;
            font-size: 14px;
            color: #1e40af;
        }
        .instructions ul {
            margin: 10px 0;
            padding-left: 20px;
            font-size: 14px;
            color: #1e40af;
        }
        .instructions li {
            margin: 5px 0;
        }
        .security-note {
            background: #fef3c7;
            border-left: 4px solid #f59e0b;
            padding: 15px;
            border-radius: 4px;
            margin: 20px 0;
        }
        .security-note p {
            margin: 0;
            font-size: 13px;
            color: #b45309;
            font-weight: 500;
        }
        .footer {
            text-align: center;
            padding: 20px;
            background: #f9fafb;
            border-top: 1px solid #e5e7eb;
            font-size: 12px;
            color: #6b7280;
        }
        .footer p {
            margin: 5px 0;
        }
        .divider {
            height: 1px;
            background: #e5e7eb;
            margin: 20px 0;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>FinRatio</h1>
            <p>Verify Your Email</p>
        </div>
        
        <div class="content">
            <div class="greeting">
                <p>Hi there,</p>
                <p>Welcome to FinRatio! We're excited to have you on board. To complete your email verification, please use the code below:</p>
            </div>
            
            <div class="otp-section">
                <div class="otp-label">Your Verification Code</div>
                <div class="otp-code">${otpDigits}</div>
                <div class="otp-expiry">⏱️ This code expires in 5 minutes</div>
            </div>
            
            <div class="instructions">
                <p><strong>How to use this code:</strong></p>
                <ul>
                    <li>Enter this 6-digit code in the verification field</li>
                    <li>Do not share this code with anyone</li>
                    <li>Code is valid for 5 minutes only</li>
                </ul>
            </div>
            
            <div class="security-note">
                <p>🔒 <strong>Security Reminder:</strong> FinRatio will never ask you to share this code via email, phone, or message. If you didn't request this code, please ignore this email.</p>
            </div>
            
            <div class="divider"></div>
            
            <p style="font-size: 13px; color: #6b7280; margin-top: 20px;">
                Need help? If you didn't sign up for FinRatio, you can safely ignore this email.
            </p>
        </div>
        
        <div class="footer">
            <p>© 2026 FinRatio. All rights reserved.</p>
            <p>FinRatio | Financial Ratio Calculator</p>
        </div>
    </div>
</body>
</html>`;

    const response = await resend.emails.send({
      from: "FinRatio <noreply@finratio.sbs>",
      to: email,
      subject: `Your FinRatio Verification Code: ${otp}`,
      html: html,
    });

    if (response.error) {
      console.error("Failed to send email:", response.error);
    } else {
      console.log("Email sent successfully to", email, "OTP:", otp, "ID:", response.data?.id);
    }
  } catch (error) {
    console.error("Error sending email:", error);
  }
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
    await sendOtpEmail(email, otp);

    return c.json({ message: "OTP sent to your email" }, 201);
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
      user: { 
        id: user.id, 
        email: user.email, 
        name: user.name, 
        isVerified: true, 
        createdAt: user.createdAt,
        businessConstitution: user.businessConstitution
      }
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
      user: { 
        id: user.id, 
        email: user.email, 
        name: user.name, 
        isVerified: user.isVerified, 
        createdAt: user.createdAt,
        businessConstitution: user.businessConstitution
      }
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
    await sendOtpEmail(email, otp);

    return c.json({ message: "New OTP sent to your email" });
  } catch (error) {
    console.error("[resend-otp]", error);
    return c.json({ error: "An error occurred. Please try again." }, 500);
  }
});

// Auth: Onboarding
app.post("/make-server-bd792702/auth/onboarding", async (c) => {
  try {
    const body = await c.req.json();
    const { email, businessConstitution } = body;

    if (!email || !businessConstitution) {
      return c.json({ error: "Missing required fields" }, 400);
    }

    const user = await kv.get(`user:${email}`);
    if (!user) {
      return c.json({ error: "User not found" }, 404);
    }

    user.businessConstitution = businessConstitution;
    await kv.set(`user:${email}`, user);

    return c.json({
      message: "Onboarding completed successfully",
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        isVerified: user.isVerified,
        createdAt: user.createdAt,
        businessConstitution: user.businessConstitution
      }
    });
  } catch (error) {
    console.error("[onboarding]", error);
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

// Resend API Key Management
// List all API keys
app.get("/make-server-bd792702/resend/api-keys", async (c) => {
  try {
    const resend = getResendClient();
    if (!resend) {
      return c.json({ error: "Resend not configured" }, 500);
    }

    const response = await resend.apiKeys.list();
    if (response.error) {
      return c.json({ error: response.error.message }, 500);
    }

    return c.json({ apiKeys: response.data });
  } catch (error) {
    console.error("[list-api-keys]", error);
    return c.json({ error: "An error occurred. Please try again." }, 500);
  }
});

// Create a new API key
app.post("/make-server-bd792702/resend/api-keys", async (c) => {
  try {
    const body = await c.req.json();
    const { name } = body;

    if (!name) {
      return c.json({ error: "API key name is required" }, 400);
    }

    const resend = getResendClient();
    if (!resend) {
      return c.json({ error: "Resend not configured" }, 500);
    }

    const response = await resend.apiKeys.create({ name });
    if (response.error) {
      return c.json({ error: response.error.message }, 500);
    }

    return c.json({ apiKey: response.data }, 201);
  } catch (error) {
    console.error("[create-api-key]", error);
    return c.json({ error: "An error occurred. Please try again." }, 500);
  }
});

// Remove an API key
app.delete("/make-server-bd792702/resend/api-keys/:keyId", async (c) => {
  try {
    const keyId = c.req.param("keyId");

    if (!keyId) {
      return c.json({ error: "API key ID is required" }, 400);
    }

    const resend = getResendClient();
    if (!resend) {
      return c.json({ error: "Resend not configured" }, 500);
    }

    const response = await resend.apiKeys.remove(keyId);
    if (response.error) {
      return c.json({ error: response.error.message }, 500);
    }

    return c.json({ message: "API key removed successfully" });
  } catch (error) {
    console.error("[remove-api-key]", error);
    return c.json({ error: "An error occurred. Please try again." }, 500);
  }
});

Deno.serve(app.fetch);