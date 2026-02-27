import nodemailer from "nodemailer";

// Create reusable transporter
const createTransporter = () => {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT),
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASSWORD,
    },
  });
};

interface EmailData {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

/**
 * Send email
 */
export async function sendEmail(data: EmailData): Promise<void> {
  try {
    const transporter = createTransporter();

    await transporter.sendMail({
      from: `${process.env.EMAIL_FROM_NAME} <${process.env.EMAIL_FROM}>`,
      to: data.to,
      subject: data.subject,
      html: data.html,
      text: data.text,
    });

    console.log(`Email sent successfully to ${data.to}`);
  } catch (error) {
    console.error("Email sending error:", error);
    throw new Error("Failed to send email");
  }
}

/**
 * Send verification email
 */
export async function sendVerificationEmail(
  email: string,
  name: string,
  verificationToken: string,
): Promise<void> {
  const verificationUrl = `${process.env.CLIENT_URL}/verify-email?token=${verificationToken}`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Verify Your Email</title>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #C71EFF 0%, #C8944D 100%); padding: 30px; text-align: center; color: white; }
        .content { padding: 30px; background: #fff; border: 1px solid #e7e7e7; }
        .button { display: inline-block; padding: 12px 30px; background: #C71EFF; color: white; text-decoration: none; border-radius: 5px; }
        .footer { text-align: center; padding: 20px; color: #999; font-size: 14px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>EquipUniverse</h1>
        </div>
        <div class="content">
          <h2>Welcome, ${name}!</h2>
          <p>Thank you for registering. Please verify your email address by clicking the button below:</p>
          <p style="text-align: center; margin: 30px 0;">
            <a href="${verificationUrl}" class="button">Verify Email Address</a>
          </p>
          <p>Or copy and paste this link: ${verificationUrl}</p>
          <p style="color: #666; font-size: 14px;">If you didn't create an account, please ignore this email.</p>
        </div>
        <div class="footer">
          <p>© ${new Date().getFullYear()} EquipUniverse. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  await sendEmail({
    to: email,
    subject: "Verify Your Email Address",
    html,
    text: `Welcome ${name}! Please verify your email by visiting: ${verificationUrl}`,
  });
}

/**
 * Send password reset email
 */
export async function sendPasswordResetEmail(
  email: string,
  name: string,
  resetToken: string,
): Promise<void> {
  const resetUrl = `${process.env.CLIENT_URL}/reset-password?token=${resetToken}`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Reset Your Password</title>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #C71EFF 0%, #C8944D 100%); padding: 30px; text-align: center; color: white; }
        .content { padding: 30px; background: #fff; border: 1px solid #e7e7e7; }
        .button { display: inline-block; padding: 12px 30px; background: #C71EFF; color: white; text-decoration: none; border-radius: 5px; }
        .footer { text-align: center; padding: 20px; color: #999; font-size: 14px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>EquipUniverse</h1>
        </div>
        <div class="content">
          <h2>Reset Your Password</h2>
          <p>Hi ${name},</p>
          <p>We received a request to reset your password. Click the button below to create a new password:</p>
          <p style="text-align: center; margin: 30px 0;">
            <a href="${resetUrl}" class="button">Reset Password</a>
          </p>
          <p>Or copy and paste this link: ${resetUrl}</p>
          <p style="color: #666; font-size: 14px;">This link will expire in 1 hour. If you didn't request a password reset, please ignore this email.</p>
        </div>
        <div class="footer">
          <p>© ${new Date().getFullYear()} EquipUniverse. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  await sendEmail({
    to: email,
    subject: "Reset Your Password",
    html,
    text: `Hi ${name}, reset your password by visiting: ${resetUrl}`,
  });
}

/**
 * Send welcome email
 */
export async function sendWelcomeEmail(
  email: string,
  name: string,
): Promise<void> {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Welcome!</title>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #C71EFF 0%, #C8944D 100%); padding: 30px; text-align: center; color: white; }
        .content { padding: 30px; background: #fff; border: 1px solid #e7e7e7; }
        .button { display: inline-block; padding: 12px 30px; background: #C71EFF; color: white; text-decoration: none; border-radius: 5px; }
        .footer { text-align: center; padding: 20px; color: #999; font-size: 14px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>EquipUniverse</h1>
        </div>
        <div class="content">
          <h2>Welcome to EquipUniverse!</h2>
          <p>Hi ${name},</p>
          <p>Your email has been verified successfully. You can now enjoy shopping for premium industrial kitchen equipment.</p>
          <p style="text-align: center; margin: 30px 0;">
            <a href="${process.env.CLIENT_URL}/products" class="button">Start Shopping</a>
          </p>
          <p>If you have any questions, feel free to contact us at ${process.env.EMAIL_FROM}</p>
        </div>
        <div class="footer">
          <p>© ${new Date().getFullYear()} EquipUniverse. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  await sendEmail({
    to: email,
    subject: "Welcome to EquipUniverse!",
    html,
    text: `Welcome ${name}! Your email has been verified. Start shopping at ${process.env.CLIENT_URL}/products`,
  });
}

/**
 * Send order confirmation email
 */
export async function sendOrderConfirmationEmail(
  email: string,
  name: string,
  orderNumber: string,
  orderTotal: number,
): Promise<void> {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Order Confirmation</title>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #C71EFF 0%, #C8944D 100%); padding: 30px; text-align: center; color: white; }
        .content { padding: 30px; background: #fff; border: 1px solid #e7e7e7; }
        .order-details { background: #f9f9f9; padding: 20px; border-radius: 5px; margin: 20px 0; }
        .footer { text-align: center; padding: 20px; color: #999; font-size: 14px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Order Confirmed!</h1>
        </div>
        <div class="content">
          <p>Hi ${name},</p>
          <p>Thank you for your order! We've received your order and will process it shortly.</p>
          <div class="order-details">
            <p><strong>Order Number:</strong> ${orderNumber}</p>
            <p><strong>Total Amount:</strong> ₦${orderTotal.toLocaleString()}</p>
          </div>
          <p>You can track your order status in your account dashboard.</p>
        </div>
        <div class="footer">
          <p>© ${new Date().getFullYear()} EquipUniverse. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  await sendEmail({
    to: email,
    subject: `Order Confirmation - ${orderNumber}`,
    html,
  });
}

/**
 * Send tracking update email
 */
export async function sendTrackingUpdateEmail(
  email: string,
  name: string,
  orderNumber: string,
  status: string,
  message: string,
  location?: string,
): Promise<void> {
  const trackingUrl = `${process.env.CLIENT_URL}/orders/${orderNumber}/tracking`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Order Update</title>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #C71EFF 0%, #C8944D 100%); padding: 30px; text-align: center; color: white; }
        .content { padding: 30px; background: #fff; border: 1px solid #e7e7e7; }
        .tracking-update { background: #f0f7ff; padding: 20px; border-left: 4px solid #C71EFF; margin: 20px 0; border-radius: 5px; }
        .button { display: inline-block; padding: 12px 30px; background: #C71EFF; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
        .footer { text-align: center; padding: 20px; color: #999; font-size: 14px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>📦 Order Update</h1>
        </div>
        <div class="content">
          <p>Hi ${name},</p>
          <p>Your order <strong>${orderNumber}</strong> has been updated:</p>
          
          <div class="tracking-update">
            <h3 style="margin-top: 0; color: #C71EFF;">🚚 ${status}</h3>
            <p style="margin: 10px 0;">${message}</p>
            ${location ? `<p style="margin: 10px 0; color: #666;"><strong>📍 Location:</strong> ${location}</p>` : ""}
            <p style="margin: 10px 0 0 0; color: #999; font-size: 14px;">
              ${new Date().toLocaleString("en-NG", {
                dateStyle: "full",
                timeStyle: "short",
              })}
            </p>
          </div>

          <p style="text-align: center;">
            <a href="${trackingUrl}" class="button">Track Your Order</a>
          </p>

          <p>You can view the complete tracking history and order details by clicking the button above.</p>
        </div>
        <div class="footer">
          <p>© ${new Date().getFullYear()} EquipUniverse. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  await sendEmail({
    to: email,
    subject: `Order Update: ${status} - ${orderNumber}`,
    html,
    text: `Hi ${name}, your order ${orderNumber} has been updated: ${status} - ${message}. Track at: ${trackingUrl}`,
  });
}

/**
 * Send order shipped email with tracking
 */
export async function sendOrderShippedEmail(
  email: string,
  name: string,
  orderNumber: string,
  trackingNumber?: string,
  trackingUrl?: string,
  estimatedDelivery?: Date,
): Promise<void> {
  const orderTrackingUrl = `${process.env.CLIENT_URL}/orders/${orderNumber}/tracking`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Order Shipped</title>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 30px; text-align: center; color: white; }
        .content { padding: 30px; background: #fff; border: 1px solid #e7e7e7; }
        .shipping-info { background: #f0fdf4; padding: 20px; border-radius: 5px; margin: 20px 0; border: 1px solid #86efac; }
        .button { display: inline-block; padding: 12px 30px; background: #10b981; color: white; text-decoration: none; border-radius: 5px; margin: 10px 5px; }
        .footer { text-align: center; padding: 20px; color: #999; font-size: 14px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🚚 Your Order Has Shipped!</h1>
        </div>
        <div class="content">
          <p>Hi ${name},</p>
          <p>Great news! Your order <strong>${orderNumber}</strong> is on its way!</p>
          
          <div class="shipping-info">
            ${trackingNumber ? `<p><strong>Tracking Number:</strong> ${trackingNumber}</p>` : ""}
            ${estimatedDelivery ? `<p><strong>Estimated Delivery:</strong> ${estimatedDelivery.toLocaleDateString("en-NG", { dateStyle: "full" })}</p>` : ""}
          </div>

          <p style="text-align: center;">
            <a href="${orderTrackingUrl}" class="button">Track on Our Site</a>
            ${trackingUrl ? `<a href="${trackingUrl}" class="button">Track with Carrier</a>` : ""}
          </p>

          <p>We'll keep you updated as your package makes its way to you!</p>
        </div>
        <div class="footer">
          <p>© ${new Date().getFullYear()} EquipUniverse. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  await sendEmail({
    to: email,
    subject: `Order Shipped - ${orderNumber}`,
    html,
    text: `Hi ${name}, your order ${orderNumber} has shipped! ${trackingNumber ? `Tracking: ${trackingNumber}` : ""} Track at: ${orderTrackingUrl}`,
  });
}

/**
 * Send order delivered email
 */
export async function sendOrderDeliveredEmail(
  email: string,
  name: string,
  orderNumber: string,
): Promise<void> {
  const reviewUrl = `${process.env.CLIENT_URL}/orders/${orderNumber}`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Order Delivered</title>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 30px; text-align: center; color: white; }
        .content { padding: 30px; background: #fff; border: 1px solid #e7e7e7; }
        .button { display: inline-block; padding: 12px 30px; background: #C71EFF; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
        .footer { text-align: center; padding: 20px; color: #999; font-size: 14px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>✅ Order Delivered!</h1>
        </div>
        <div class="content">
          <p>Hi ${name},</p>
          <p>Your order <strong>${orderNumber}</strong> has been successfully delivered!</p>
          
          <p>We hope you love your purchase! If you have any questions or concerns, please don't hesitate to contact us.</p>

          <p style="text-align: center;">
            <a href="${reviewUrl}" class="button">Rate Your Purchase</a>
          </p>

          <p>Thank you for shopping with EquipUniverse!</p>
        </div>
        <div class="footer">
          <p>© ${new Date().getFullYear()} EquipUniverse. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  await sendEmail({
    to: email,
    subject: `Order Delivered - ${orderNumber}`,
    html,
    text: `Hi ${name}, your order ${orderNumber} has been delivered! Thank you for shopping with us.`,
  });
}
