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



const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #000000;">
  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
    <tr>
      <td style="padding: 40px 20px;">
        
        <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 560px; background-color: #1a1a1a; border-radius: 16px; border: 1px solid #2a2a2a;">
          
          <!-- Header -->
          <tr>
            <td style="padding: 48px 40px 32px; text-align: center;">
              <h1 style="color: #ffffff; font-size: 28px; font-weight: 600; margin: 0 0 8px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
                Storage App
              </h1>
              <p style="color: #9ca3af; font-size: 15px; margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
                Your verification code is ready
              </p>
            </td>
          </tr>
          
          <!-- OTP Section -->
          <tr>
            <td style="padding: 0 40px 32px;">
              <table border="0" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td style="text-align: center;">
                    <div style="background-color: #0a0a0a; border: 2px solid #2a2a2a; border-radius: 12px; padding: 32px 24px;">
                      <p style="color: #6b7280; font-size: 13px; font-weight: 500; margin: 0 0 12px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; text-transform: uppercase; letter-spacing: 0.5px;">
                        Verification Code
                      </p>
                      <h2 style="color: #ffffff; font-size: 48px; font-weight: 700; letter-spacing: 8px; margin: 0; font-family: 'Courier New', monospace;">
                        ${otp}
                      </h2>
                    </div>
                  </td>
                </tr>
              </table>
              
              <p style="color: #6b7280; font-size: 14px; margin: 20px 0 0; text-align: center; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
                This code expires in <strong style="color: #9ca3af;">10 minutes</strong>
              </p>
            </td>
          </tr>
          
          <!-- Info Section -->
          <tr>
            <td style="padding: 0 40px 40px;">
              <div style="background-color: #2a2a2a; border-left: 3px solid #f59e0b; border-radius: 8px; padding: 16px 20px;">
                <p style="color: #d1d5db; font-size: 13px; line-height: 1.5; margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
                  <strong style="color: #ffffff;">Security reminder:</strong> Never share this code with anyone. Storage App will never ask for your code.
                </p>
              </div>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 32px 40px; border-top: 1px solid #2a2a2a; text-align: center;">
              <p style="color: #6b7280; font-size: 13px; margin: 0 0 4px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
                Didn't request this? You can safely ignore this email.
              </p>
              <p style="color: #4b5563; font-size: 12px; margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
                © ${new Date().getFullYear()} Storage App
              </p>
            </td>
          </tr>
          
        </table>
        
      </td>
    </tr>
  </table>
</body>
</html>
`;


  await resend.emails.send({
    from: "Storage App <otp@storage22b.space>",
    to: email,
    subject: "Storage App OTP",
    html,
  });

  return { success: true, message: `OTP sent successfully on ${email}` };
}
