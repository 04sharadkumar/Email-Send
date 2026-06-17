import express from "express";
import cors from "cors";
import nodemailer from "nodemailer";
import dotenv from "dotenv";
import dns from "dns";

dotenv.config();

dns.setDefaultResultOrder("ipv4first");

const app = express();

app.use(cors());
app.use(express.json());

const EMAIL_USER = process.env.EMAIL_USER!;
const EMAIL_PASS = process.env.EMAIL_PASS!;

if (!EMAIL_USER || !EMAIL_PASS) {
  throw new Error("EMAIL_USER and EMAIL_PASS are required in .env");
}

const TIMEOUT = 15000;

const smtpMethods = [
  {
    name: "Gmail 587 STARTTLS IPv4",
    config: {
      host: "smtp.gmail.com",
      port: 587,
      secure: false,
      requireTLS: true,
      family: 4,
    },
  },
  {
    name: "Gmail 465 SSL IPv4",
    config: {
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      family: 4,
    },
  },
  {
    name: "Gmail 587 STARTTLS default DNS",
    config: {
      host: "smtp.gmail.com",
      port: 587,
      secure: false,
      requireTLS: true,
    },
  },
  {
    name: "Gmail 465 SSL default DNS",
    config: {
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
    },
  },
  {
    name: "Gmail 587 TLS min v1.2 IPv4",
    config: {
      host: "smtp.gmail.com",
      port: 587,
      secure: false,
      requireTLS: true,
      family: 4,
      tls: {
        minVersion: "TLSv1.2",
      },
    },
  },
  {
    name: "Gmail 465 TLS min v1.2 IPv4",
    config: {
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      family: 4,
      tls: {
        minVersion: "TLSv1.2",
      },
    },
  },
  {
    name: "Gmail 587 rejectUnauthorized false IPv4",
    config: {
      host: "smtp.gmail.com",
      port: 587,
      secure: false,
      requireTLS: true,
      family: 4,
      tls: {
        rejectUnauthorized: false,
      },
    },
  },
  {
    name: "Gmail 465 rejectUnauthorized false IPv4",
    config: {
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      family: 4,
      tls: {
        rejectUnauthorized: false,
      },
    },
  },
];

function withTimeout<T>(promise: Promise<T>, ms: number, methodName: string) {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => {
        reject(new Error(`${methodName} timeout after ${ms / 1000} sec`));
      }, ms);
    }),
  ]);
}

function createTransporter(config: any) {
  return nodemailer.createTransport({
    ...config,
    auth: {
      user: EMAIL_USER,
      pass: EMAIL_PASS,
    },
    connectionTimeout: TIMEOUT,
    greetingTimeout: TIMEOUT,
    socketTimeout: TIMEOUT,
    pool: false,
    logger: true,
    debug: false,
  });
}

async function verifyTransporter(method: any) {
  const transporter = createTransporter(method.config);

  await withTimeout(
    transporter.verify(),
    TIMEOUT,
    `${method.name} verify`
  );

  return transporter;
}

async function sendMailWithFallback(mailOptions: any) {
  const errors: any[] = [];

  for (const method of smtpMethods) {
    try {
      console.log("=======================================");
      console.log(`Trying method: ${method.name}`);

      const transporter = await verifyTransporter(method);

      const info = await withTimeout(
        transporter.sendMail(mailOptions),
        TIMEOUT,
        `${method.name} sendMail`
      );

      console.log(`SUCCESS: Mail sent using ${method.name}`);

      return {
        success: true,
        method: method.name,
        messageId: info.messageId,
        accepted: info.accepted,
        rejected: info.rejected,
        previousErrors: errors,
      };
    } catch (error: any) {
      console.log(`FAILED: ${method.name}`);
      console.log(error.message);

      errors.push({
        method: method.name,
        message: error.message,
        code: error.code || null,
        command: error.command || null,
        address: error.address || null,
        port: error.port || null,
      });
    }
  }

  return {
    success: false,
    message: "All SMTP methods failed",
    errors,
  };
}

app.get("/", (_req, res) => {
  res.json({
    success: true,
    message: "Advanced Gmail Nodemailer fallback server running",
    totalMethods: smtpMethods.length,
  });
});

app.post("/api/send-mail", async (req, res) => {
  try {
    const { email, subject, message } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required",
      });
    }

    const result = await sendMailWithFallback({
      from: `"Sharad Kumar" <${EMAIL_USER}>`,
      to: email,
      subject: subject || "Greetings From Sharad",
      html: `
        <div style="font-family:Arial;padding:20px;background:#f8fafc">
          <div style="max-width:500px;margin:auto;background:white;padding:24px;border-radius:12px">
            <h2 style="color:#2563eb;margin-top:0">Hello 👋</h2>
            <p>${message || "Hello from Sharad's side."}</p>
            <p>Have a great evening for you 🌙</p>
            <br/>
            <p>Best Regards,</p>
            <strong>Sharad Kumar</strong>
          </div>
        </div>
      `,
      text: message || "Hello from Sharad's side. Have a great evening for you.",
    });

    if (!result.success) {
      return res.status(500).json(result);
    }

    return res.status(200).json({
      success: true,
      message: "Mail sent successfully",
      ...result,
    });
  } catch (error: any) {
    console.error("MAIN ERROR:", error);

    return res.status(500).json({
      success: false,
      message: error.message,
      code: error.code || null,
    });
  }
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});