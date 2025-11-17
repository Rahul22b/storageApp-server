import { Resend } from "resend";
import OTP from "../models/otpModel.js";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendOtpService(email) {
  const otp = Math.floor(1000 + Math.random() * 9000).toString();

  // Upsert OTP (replace if it already exists)
  await OTP.findOneAndUpdate(
    { email },
    { otp, createdAt: new Date() },
    { upsert: true }
  );

  // const html = `
  //   <div style="font-family:sans-serif;">
  //     <h2>Your OTP is: ${otp}</h2>
  //     <p>This OTP is valid for 10 minutes.</p>
  //   </div>
  // `;

  const html = `
  <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #f4f7f6; padding: 40px 20px; text-align: center;">
    <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 550px; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);">
      <tr>
        <td style="padding: 40px 30px;">
          <h1 style="color: #333333; font-size: 26px; margin-bottom: 20px; border-bottom: 2px solid #007bff; display: inline-block; padding-bottom: 5px;">
            Storage App Security
          </h1>

          <p style="color: #555555; font-size: 16px; line-height: 1.6; margin-bottom: 30px;">
            Use the following One-Time Password (OTP) to complete your login or verification process.
          </p>
          
          <div style="background-color: #e6f0ff; border: 1px solid #007bff; border-radius: 8px; padding: 20px; margin: 30px auto; max-width: 300px;">
            <p style="color: #007bff; font-size: 14px; margin: 0 0 10px 0; text-transform: uppercase;">
              Your One-Time Password
            </p>
            <h2 style="color: #1a1a1a; font-size: 38px; font-weight: 700; letter-spacing: 5px; margin: 0;">
              ${otp}
            </h2>
          </div>
          
          <p style="color: #999999; font-size: 14px; margin-top: 20px;">
            This OTP is valid for **10 minutes** only. For security reasons, please do not share this code.
          </p>

          <p style="color: #777777; font-size: 12px; margin-top: 40px; border-top: 1px solid #eeeeee; padding-top: 20px;">
            If you did not request this code, please ignore this email.
          </p>
        </td>
      </tr>
    </table>
  </div>
`;

  await resend.emails.send({
    from: "Storage App <otp@storage22b.space>",
    to: email,
    subject: "Storage App OTP",
    html,
  });

  return { success: true, message: `OTP sent successfully on ${email}` };
}
