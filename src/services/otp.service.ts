// ============================================================
// src/services/otp.service.ts
// OTP generation, storage (in-memory), and email delivery
// ============================================================

import nodemailer from "nodemailer";
// import prisma from "../config/prisma";

// --------------- OTP store ---------------
// Replace with Redis/DB in production
interface OtpEntry {
  otp: string;
  expiresAt: Date;
}
const otpStore: Map<string, OtpEntry> = new Map(); // key = email

const HARDCODED_OTP = "123456";

export async function generateAndSendOtp(email: string): Promise<void> {
  otpStore.set(email, {
    otp: HARDCODED_OTP,
    expiresAt: new Date(Date.now() + 5 * 60 * 1000),
  });
}

export async function verifyOtp(email: string, submittedOtp: string): Promise<boolean> {
  const entry = otpStore.get(email);
  if (!entry) return false;
  if (new Date() > entry.expiresAt) {
    otpStore.delete(email);
    return false;
  }
  if (entry.otp !== submittedOtp) return false;
  otpStore.delete(email);
  return true;
}

// // ================================================================
// // verifyOtp — checks the submitted OTP against the store
// // ================================================================
// export function verifyOtp(email: string, submittedOtp: string): boolean {
//   const entry = otpStore.get(email);
//   if (!entry) return false;                        // no OTP issued
//   if (new Date() > entry.expiresAt) {              // expired
//     otpStore.delete(email);
//     return false;
//   }
//   if (entry.otp !== submittedOtp) return false;    // wrong code

//   otpStore.delete(email); // one-time use — delete after successful verify
//   return true;
// }

// --------------- Email transport ---------------
// const transporter = nodemailer.createTransport({
//   host: process.env.SMTP_HOST,
//   port: Number(process.env.SMTP_PORT) || 587,
//   secure: process.env.SMTP_SECURE === "true", // true for 465, false for 587
//   auth: {
//     user: process.env.SMTP_USER,
//     pass: process.env.SMTP_PASS,
//   },
// });

// ================================================================
// generateOtp — creates a 6-digit OTP, stores it, sends the email
// ================================================================
// export async function generateAndSendOtp(email: string): Promise<void> {
//   // Generate 6-digit code
//   const otp = Math.floor(100000 + Math.random() * 900000).toString();

//   // Store with 5-minute expiry
//   otpStore.set(email, {
//     otp,
//     expiresAt: new Date(Date.now() + 5 * 60 * 1000),
//   });

//   // Send email
//   await transporter.sendMail({
//     from: `"Primaverse" <${process.env.SMTP_USER}>`,
//     to: email,
//     subject: "Your Primaverse verification code",
//     text: `Your OTP is: ${otp}\n\nThis code expires in 5 minutes.`,
//     html: `
//       <div style="font-family:sans-serif;max-width:400px;margin:auto">
//         <h2 style="color:#333">Email Verification</h2>
//         <p>Use the code below to verify your Primaverse account:</p>
//         <div style="font-size:36px;font-weight:bold;letter-spacing:8px;color:#5347B7;padding:16px 0">
//           ${otp}
//         </div>
//         <p style="color:#888;font-size:13px">This code expires in 5 minutes.</p>
//       </div>
//     `,
//   });
// }