import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Format date like "10/06/2026 13:27"
 */
const formatIndianDate = (dateObj) => {
  const date = dateObj || new Date();
  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Kolkata"
  }).replace(",", "");
};

/**
 * Clean phone number to digits only.
 * If 10 digits, prepends "91" (default Indian country code)
 */
const cleanPhoneNumber = (phone) => {
  if (!phone) return "";
  const cleaned = String(phone).replace(/\D/g, "");
  if (cleaned.length === 10) {
    return "91" + cleaned;
  }
  return cleaned;
};

/**
 * Helper to write notification logs in sandbox mode
 */
const logNotificationSandbox = (mobile, type, content) => {
  try {
    const logsDir = path.join(__dirname, "../logs");
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }
    const logPath = path.join(logsDir, "notifications.log");
    const logEntry = `[${formatIndianDate()}] [TO: ${mobile}] [TYPE: ${type.toUpperCase()}] \n${content}\n----------------------------------------\n`;
    fs.appendFileSync(logPath, logEntry, "utf8");
    console.log(`\n📢 [NOTIFICATION SIMULATOR] Direct ${type.toUpperCase()} sent to ${mobile}:\n${content}\n(Log written to vyanjan_backend/logs/notifications.log)\n`);
    return true;
  } catch (err) {
    console.error("Error writing sandbox notification log:", err);
    return false;
  }
};

/**
 * Send WhatsApp Message
 */
const sendWhatsApp = async (mobile, message, branchName) => {
  const provider = (process.env.NOTIFICATION_PROVIDER || "sandbox").toLowerCase();

  if (provider === "sandbox") {
    return logNotificationSandbox(mobile, "WhatsApp", message);
  }

  // 1. MSG91 Integration
  if (provider === "msg91") {
    const authKey = process.env.MSG91_AUTH_KEY;
    const sender = process.env.MSG91_WHATSAPP_SENDER;
    const templateId = process.env.MSG91_WHATSAPP_TEMPLATE_ID;

    if (!authKey) {
      console.warn("Msg91 AUTH Key missing. Simulating sending.");
      return logNotificationSandbox(mobile, "WhatsApp (Msg91-Simulated)", message);
    }

    try {
      // MSG91 WhatsApp API requires template variables. We try to call Msg91 API.
      // Here is a standard payload using Msg91 WhatsApp flow or direct WhatsApp API.
      const response = await fetch("https://api.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "authkey": authKey
        },
        body: JSON.stringify({
          to: mobile,
          sender: sender,
          type: "template",
          template_name: templateId || "invoice_notification",
          language: { code: "en" },
          components: [
            {
              type: "body",
              parameters: [
                { type: "text", text: message }
              ]
            }
          ]
        })
      });
      const data = await response.json();
      console.log("Msg91 WhatsApp Response:", data);
      return data.status === "success" || data.type === "success";
    } catch (err) {
      console.error("Msg91 WhatsApp Send Error:", err);
      throw err;
    }
  }

  // 2. Twilio Integration
  if (provider === "twilio") {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const from = process.env.TWILIO_WHATSAPP_FROM || "whatsapp:+14155238886";

    if (!accountSid || !authToken) {
      console.warn("Twilio credentials missing. Simulating sending.");
      return logNotificationSandbox(mobile, "WhatsApp (Twilio-Simulated)", message);
    }

    try {
      const formattedTo = mobile.startsWith("whatsapp:") ? mobile : `whatsapp:+${mobile}`;
      const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
      const basicAuth = Buffer.from(`${accountSid}:${authToken}`).toString("base64");

      const params = new URLSearchParams();
      params.append("To", formattedTo);
      params.append("From", from);
      params.append("Body", message);

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "Authorization": `Basic ${basicAuth}`
        },
        body: params.toString()
      });

      const data = await response.json();
      console.log("Twilio WhatsApp Response:", data);
      if (response.ok) return true;
      throw new Error(data.message || "Twilio WhatsApp send failed");
    } catch (err) {
      console.error("Twilio WhatsApp Send Error:", err);
      throw err;
    }
  }

  // 3. Custom Gateway Integration
  if (provider === "custom") {
    let customUrl = process.env.CUSTOM_WHATSAPP_URL;
    if (!customUrl) {
      console.warn("Custom WhatsApp Gateway URL missing. Simulating sending.");
      return logNotificationSandbox(mobile, "WhatsApp (Custom-Simulated)", message);
    }

    try {
      const method = (process.env.CUSTOM_WHATSAPP_METHOD || "POST").toUpperCase();
      let headers = {};
      try {
        headers = JSON.parse(process.env.CUSTOM_WHATSAPP_HEADERS || "{}");
      } catch (e) {
        console.error("Failed to parse CUSTOM_WHATSAPP_HEADERS. Using default headers.", e);
        headers = { "Content-Type": "application/json" };
      }

      // Interpolate parameters in URL
      customUrl = customUrl
        .replace(/\{\{MOBILE\}\}/g, encodeURIComponent(mobile))
        .replace(/\{\{MESSAGE\}\}/g, encodeURIComponent(message));

      let fetchOptions = { method, headers };

      if (method !== "GET" && method !== "HEAD") {
        let bodyTemplate = process.env.CUSTOM_WHATSAPP_BODY || "";
        if (bodyTemplate) {
          // Replace template placeholders in body
          const interpolatedBody = bodyTemplate
            .replace(/\{\{MOBILE\}\}/g, mobile)
            .replace(/\{\{MESSAGE\}\}/g, message.replace(/"/g, '\\"').replace(/\n/g, '\\n'));
          fetchOptions.body = interpolatedBody;
        }
      }

      console.log(`Calling Custom WhatsApp Gateway: ${method} to ${customUrl}`);
      const response = await fetch(customUrl, fetchOptions);
      const resText = await response.text();
      console.log("Custom WhatsApp Response:", resText);
      return response.ok;
    } catch (err) {
      console.error("Custom WhatsApp Send Error:", err);
      throw err;
    }
  }

  return false;
};

/**
 * Send SMS Message
 */
const sendSMS = async (mobile, message) => {
  const provider = (process.env.NOTIFICATION_PROVIDER || "sandbox").toLowerCase();

  if (provider === "sandbox") {
    return logNotificationSandbox(mobile, "SMS", message);
  }

  // 1. MSG91 Integration
  if (provider === "msg91") {
    const authKey = process.env.MSG91_AUTH_KEY;
    const sender = process.env.MSG91_SMS_SENDER_ID;
    const route = process.env.MSG91_SMS_ROUTE || "4";
    const templateId = process.env.MSG91_SMS_TEMPLATE_ID;

    if (!authKey) {
      console.warn("Msg91 AUTH Key missing. Simulating sending.");
      return logNotificationSandbox(mobile, "SMS (Msg91-Simulated)", message);
    }

    try {
      const response = await fetch("https://api.msg91.com/api/v5/flow/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "authkey": authKey
        },
        body: JSON.stringify({
          flow_id: templateId || "sms_notification",
          sender: sender,
          mobiles: mobile,
          VAR1: message // or configure according to your template
        })
      });
      const data = await response.json();
      console.log("Msg91 SMS Response:", data);
      return data.type === "success";
    } catch (err) {
      console.error("Msg91 SMS Send Error:", err);
      throw err;
    }
  }

  // 2. Twilio Integration
  if (provider === "twilio") {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const from = process.env.TWILIO_SMS_FROM;

    if (!accountSid || !authToken || !from) {
      console.warn("Twilio SMS credentials missing. Simulating sending.");
      return logNotificationSandbox(mobile, "SMS (Twilio-Simulated)", message);
    }

    try {
      const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
      const basicAuth = Buffer.from(`${accountSid}:${authToken}`).toString("base64");

      const params = new URLSearchParams();
      params.append("To", `+${mobile}`);
      params.append("From", from);
      params.append("Body", message);

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "Authorization": `Basic ${basicAuth}`
        },
        body: params.toString()
      });

      const data = await response.json();
      console.log("Twilio SMS Response:", data);
      if (response.ok) return true;
      throw new Error(data.message || "Twilio SMS send failed");
    } catch (err) {
      console.error("Twilio SMS Send Error:", err);
      throw err;
    }
  }

  // 3. Custom Gateway Integration
  if (provider === "custom") {
    let customUrl = process.env.CUSTOM_SMS_URL;
    if (!customUrl) {
      console.warn("Custom SMS Gateway URL missing. Simulating sending.");
      return logNotificationSandbox(mobile, "SMS (Custom-Simulated)", message);
    }

    try {
      const method = (process.env.CUSTOM_SMS_METHOD || "POST").toUpperCase();
      let headers = {};
      try {
        headers = JSON.parse(process.env.CUSTOM_SMS_HEADERS || "{}");
      } catch (e) {
        console.error("Failed to parse CUSTOM_SMS_HEADERS. Using default headers.", e);
        headers = { "Content-Type": "application/json" };
      }

      // Interpolate parameters in URL
      customUrl = customUrl
        .replace(/\{\{MOBILE\}\}/g, encodeURIComponent(mobile))
        .replace(/\{\{MESSAGE\}\}/g, encodeURIComponent(message));

      let fetchOptions = { method, headers };

      if (method !== "GET" && method !== "HEAD") {
        let bodyTemplate = process.env.CUSTOM_SMS_BODY || "";
        if (bodyTemplate) {
          const interpolatedBody = bodyTemplate
            .replace(/\{\{MOBILE\}\}/g, mobile)
            .replace(/\{\{MESSAGE\}\}/g, message.replace(/"/g, '\\"').replace(/\n/g, '\\n'));
          fetchOptions.body = interpolatedBody;
        }
      }

      console.log(`Calling Custom SMS Gateway: ${method} to ${customUrl}`);
      const response = await fetch(customUrl, fetchOptions);
      const resText = await response.text();
      console.log("Custom SMS Response:", resText);
      return response.ok;
    } catch (err) {
      console.error("Custom SMS Send Error:", err);
      throw err;
    }
  }

  return false;
};

/**
 * Main function called after invoice creation
 */
export const sendInvoiceNotification = async ({
  invoiceNumber,
  customerName,
  customerMobile,
  totalAmount,
  notificationMethod,
  branchName
}) => {
  if (!customerMobile) return false;

  const cleanedMobile = cleanPhoneNumber(customerMobile);
  if (cleanedMobile.length < 10) {
    console.warn(`Invalid phone number length: ${customerMobile}`);
    return false;
  }

  const safeName = customerName || "Customer";
  const safeBranchName = branchName || "Vyanjan";
  const formattedDate = formatIndianDate(new Date());

  const publicAppUrl = process.env.PUBLIC_APP_URL || "http://localhost:5173";
  const billLink = `${publicAppUrl}/#/public/invoice/${invoiceNumber}`;

  // Premium message format matching the user's template
  const messageContent = `Dear ${safeName},\n\nThank you for your recent order at ${safeBranchName}!\nYour invoice is now available. 🌟\n\n💰 Amount : Rs.${Number(totalAmount).toFixed(2)}\n📅 Date : ${formattedDate}\n🔗 View Invoice : ${billLink}\n\nHow was your experience with your order at ${safeBranchName} today?`;

  console.log(`📬 Initiating background notification flow for Invoice ${invoiceNumber}. Preference: ${notificationMethod}`);

  // Flow control:
  // 1. If method is WhatsApp (or automatic), attempt WhatsApp. If it fails, fall back to SMS.
  // 2. If method is SMS, send SMS.
  if (notificationMethod === "WhatsApp") {
    try {
      const whatsappSuccess = await sendWhatsApp(cleanedMobile, messageContent, safeBranchName);
      if (whatsappSuccess) {
        console.log(`✅ WhatsApp sent successfully to ${cleanedMobile}`);
        return true;
      } else {
        console.warn(`⚠️ WhatsApp send returned false. Falling back to SMS.`);
        const smsSuccess = await sendSMS(cleanedMobile, messageContent);
        return smsSuccess;
      }
    } catch (err) {
      console.error(`❌ WhatsApp send failed: ${err.message}. Falling back to SMS.`);
      try {
        const smsSuccess = await sendSMS(cleanedMobile, messageContent);
        return smsSuccess;
      } catch (smsErr) {
        console.error(`❌ Fallback SMS also failed: ${smsErr.message}`);
        return false;
      }
    }
  } else if (notificationMethod === "SMS") {
    try {
      const smsSuccess = await sendSMS(cleanedMobile, messageContent);
      return smsSuccess;
    } catch (err) {
      console.error(`❌ SMS send failed: ${err.message}`);
      return false;
    }
  }

  return false;
};
