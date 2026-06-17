import express from "express";
import cors from "cors";
import { createTransport } from "nodemailer";

const app = express();

app.use(cors());
app.use(express.json());

const transporter = createTransport({
  host: "smtp.gmail.com",
  port: 587,
  secure: false,
  family: 4,
  auth: {
    user: "04sharadkumar@gmail.com",
    pass: "xtml jnfg otqc lwps",
  },
  connectionTimeout: 60000,
  greetingTimeout: 60000,
  socketTimeout: 60000,
} as any);

app.get("/", (_req, res) => {
  res.json({
    success: true,
    message: "Gmail Nodemailer test server running",
  });
});

app.post("/api/send-mail", async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required",
      });
    }

    const info = await transporter.sendMail({
      from: '"Sharad Kumar" <04sharadkumar@gmail.com>',
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

    return res.status(200).json({
      success: true,
      message: "Mail sent successfully",
      messageId: info.messageId,
    });
  } catch (error: any) {
    console.error("MAIL ERROR:", error);

    return res.status(500).json({
      success: false,
      message: error.message,
      code: error.code,
      command: error.command,
    });
  }
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});