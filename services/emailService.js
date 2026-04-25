const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
});

const sendOtpEmail = async (toEmail, otp) => {
    const mailOptions = {
        from: `"PureChef" <${process.env.EMAIL_USER}>`,
        to: toEmail,
        subject: 'Your PureChef Password Reset Code',
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 480px; margin: auto; padding: 32px; border-radius: 16px; border: 1px solid #e5e7eb;">
                <h2 style="color: #4184ed; margin-bottom: 8px;">PureChef</h2>
                <h3 style="color: #1a1a2e;">Password Reset Code</h3>
                <p style="color: #6b7280;">Use the code below to reset your password. It expires in <strong>10 minutes</strong>.</p>
                <div style="background: #f1f7ff; border-radius: 12px; padding: 24px; text-align: center; margin: 24px 0;">
                    <span style="font-size: 40px; font-weight: 900; letter-spacing: 12px; color: #4184ed;">${otp}</span>
                </div>
                <p style="color: #6b7280; font-size: 13px;">If you didn't request this, you can safely ignore this email.</p>
            </div>
        `,
    };

    await transporter.sendMail(mailOptions);
};

module.exports = { sendOtpEmail };
