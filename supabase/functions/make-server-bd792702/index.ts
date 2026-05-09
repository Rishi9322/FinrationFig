import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import * as kv from "./kv_store.tsx";

const app = new Hono();

app.use('*', logger(console.log));

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

function generateOTP(): string {
  return Math.floor(Math.random() * 1000000).toString().padStart(6, "0");
}

type StoredCalculation = {
  id: string;
  userId: string;
  calculatorType: string;
  inputs: Record<string, unknown>;
  results: Record<string, unknown>;
  createdAt: string;
};

async function getCalculationsForUser(userId: string): Promise<StoredCalculation[]> {
  const calculations = await kv.get(`calculations:${userId}`);
  return Array.isArray(calculations) ? calculations : [];
}

async function saveCalculationRecord(calculation: StoredCalculation): Promise<void> {
  const calculations = await getCalculationsForUser(calculation.userId);
  calculations.unshift(calculation);
  await kv.set(`calculations:${calculation.userId}`, calculations.slice(0, 200));
}

async function sendOtpEmail(email: string, otp: string) {
  const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
  if (!RESEND_API_KEY) {
    console.error("RESEND_API_KEY is not set");
    return { error: "API key not configured" };
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

    console.log("Sending email to:", email, "OTP:", otp);

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "FinRatio <noreply@finratio.sbs>",
        to: email,
        subject: `Your FinRatio Verification Code: ${otp}`,
        html,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      console.error("Email sending failed:", result);
      return { error: result };
    }

    console.log("Email sent successfully to", email, "ID:", result.id);
    return { success: true, id: result.id };
  } catch (error) {
    console.error("Error sending email:", error);
    return { error: String(error) };
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

app.get("/make-server-bd792702/health", (c) => {
  return c.json({ status: "ok" });
});

app.get("/make-server-bd792702/calculations/:userId", async (c) => {
  try {
    const userId = c.req.param("userId");
    const calculations = await getCalculationsForUser(userId);
    return c.json({ calculations });
  } catch (error) {
    console.error("[calculations:get]", error);
    return c.json({ error: "An error occurred. Please try again." }, 500);
  }
});

app.post("/make-server-bd792702/auth/signup", async (c) => {
  try {
    const body = await c.req.json();
    const { name, email, password } = body;

    const existingUser = await kv.get(`user:${email}`);
    if (existingUser) {
      return c.json({ error: "Email already registered" }, 409);
    }

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
    const emailResult = await sendOtpEmail(email, otp);
    if (emailResult?.error) {
      return c.json({ error: "Unable to send verification email" }, 502);
    }

    return c.json({
      message: "OTP sent to your email",
      emailId: emailResult?.id,
    }, 201);
  } catch (error) {
    console.error("[signup]", error);
    return c.json({ error: "An error occurred. Please try again." }, 500);
  }
});

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

app.post("/make-server-bd792702/auth/signin", async (c) => {
  try {
    const body = await c.req.json();
    const { email, password } = body;

    const user = await kv.get(`user:${email}`);
    if (!user) {
      return c.json({ error: "Invalid email or password" }, 401);
    }

    const passwordValid = await verifyPassword(password, user.passwordHash);
    if (!passwordValid) {
      return c.json({ error: "Invalid email or password" }, 401);
    }

    if (!user.isVerified) {
      return c.json({ error: "Please verify your email before signing in" }, 403);
    }

    return c.json({
      message: "Signin successful",
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
    console.error("[signin]", error);
    return c.json({ error: "An error occurred. Please try again." }, 500);
  }
});

app.post("/make-server-bd792702/auth/onboarding", async (c) => {
  try {
    const body = await c.req.json();
    const { email, businessConstitution } = body;

    if (!businessConstitution) {
      return c.json({ error: "Business constitution is required" }, 400);
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

app.post("/make-server-bd792702/calculations", async (c) => {
  try {
    const body = await c.req.json();
    const { userId, calculatorType, inputs, results } = body;

    if (!userId || !calculatorType) {
      return c.json({ error: "userId and calculatorType are required" }, 400);
    }

    const record: StoredCalculation = {
      id: crypto.randomUUID(),
      userId,
      calculatorType,
      inputs: inputs ?? {},
      results: results ?? {},
      createdAt: new Date().toISOString(),
    };

    await saveCalculationRecord(record);

    return c.json(record, 201);
  } catch (error) {
    console.error("[calculations:post]", error);
    return c.json({ error: "An error occurred. Please try again." }, 500);
  }
});

app.post("/make-server-bd792702/auth/resend-otp", async (c) => {
  try {
    const body = await c.req.json();
    const { email } = body;

    const user = await kv.get(`user:${email}`);
    if (!user) {
      return c.json({ error: "User not found" }, 404);
    }

    const otp = generateOTP();
    user.otpCode = otp;
    user.otpExpiry = new Date(Date.now() + 5 * 60 * 1000).toISOString();
    user.otpAttempts = 0;
    await kv.set(`user:${email}`, user);

    console.log(`[OTP RESEND] Email: ${email}, OTP: ${otp}`);
    const emailResult = await sendOtpEmail(email, otp);
    if (emailResult?.error) {
      return c.json({ error: "Unable to send verification email" }, 502);
    }

    return c.json({
      message: "New OTP sent to your email",
      emailId: emailResult?.id,
    });
  } catch (error) {
    console.error("[resend-otp]", error);
    return c.json({ error: "An error occurred. Please try again." }, 500);
  }
});

app.get("/make-server-bd792702/resend/api-keys", (c) => {
  return c.json([]);
});

app.post("/make-server-bd792702/resend/api-keys", (c) => {
  return c.json({ success: true });
});

app.delete("/make-server-bd792702/resend/api-keys/:id", (c) => {
  return c.json({ success: true });
});

Deno.serve(app.fetch);
