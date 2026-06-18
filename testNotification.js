import { sendInvoiceNotification } from "./utils/notification.js";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

console.log("Starting notification test...");

const testPayload = {
  invoiceNumber: "INV-20260610-1815-9999",
  customerName: "Jagriti Singh",
  customerMobile: "7088038656",
  totalAmount: 250.00,
  notificationMethod: "WhatsApp",
  branchName: "Kamla Sweets"
};

console.log("Payload:", testPayload);

sendInvoiceNotification(testPayload)
  .then((success) => {
    console.log(`Test finished. Success status: ${success}`);
    console.log("Please check if 'vyanjan_backend/logs/notifications.log' was created and contains the message.");
  })
  .catch((err) => {
    console.error("Test failed with error:", err);
  });
