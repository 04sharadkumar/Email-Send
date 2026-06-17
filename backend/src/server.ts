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
    name: "Gmail 587 STARTTLS Default",
    config: {
      host: "smtp.gmail.com",
      port: 587,
      secure: false,
      requireTLS: true,
    },
  },
  {
    name: "Gmail 465 SSL Default",
    config: {
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
    },
  },
];

function sendMailPromise(transporter: any, mailData: any) {
  return new Promise((resolve, reject) => {
    transporter.sendMail(mailData, (err: any, info: any) => {
      if (err) {
        console.error("SEND MAIL ERROR:", err);
        reject(err);
      } else {
        resolve(info);
      }
    });
  });
}

function withTimeout<T>(promise: Promise<T>, ms: number, methodName: string) {
  let timer: NodeJS.Timeout;

  const timeoutPromise = new Promise<T>((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error(`${methodName} timeout after ${ms / 1000} sec`));
    }, ms);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => {
    clearTimeout(timer);
  });
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
  });
}

async function sendMailWithFallback(mailData: any) {
  const errors: any[] = [];

  for (const method of smtpMethods) {
    try {
      console.log(`Trying method: ${method.name}`);

      const transporter = createTransporter(method.config);

      const info: any = await withTimeout(
        sendMailPromise(transporter, mailData),
        TIMEOUT,
        method.name
      );

      return {
        success: true,
        method: method.name,
        messageId: info.messageId,
        accepted: info.accepted,
        rejected: info.rejected,
        previousErrors: errors,
      };
    } catch (error: any) {
      console.log(`Failed method: ${method.name}`, error.message);

      errors.push({
        method: method.name,
        message: error.message,
        code: error.code || null,
        command: error.command || null,
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
    message: "Gmail callback promise server running",
  });
});

app.post("/api/send-mail", async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({
      success: false,
      message: "Email is required",
    });
  }

  const result = await sendMailWithFallback({
    from: `"Sharad Kumar" <${EMAIL_USER}>`,
    to: email,
    subject: "Greetings From Sharad",
    html: `
      <div style="font-family:Arial;padding:20px">
        <h2>Hello 👋</h2>
        <p>Hello from Sharad's side.</p>
        <p>Have a great evening for you 🌙</p>
        <br/>
        <p>Best Regards,</p>
        <strong>Sharad Kumar</strong>
      </div>
    `,
    text: "Hello from Sharad's side. Have a great evening for you.",
  });

  if (!result.success) {
    return res.status(500).json(result);
  }

  return res.status(200).json({
    success: true,
    message: "Mail sent successfully",
    ...result,
  });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});