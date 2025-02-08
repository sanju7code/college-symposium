// Import required modules
const express = require("express");
const mongoose = require("mongoose");
const multer = require("multer");
const qrcode = require("qrcode");
const nodemailer = require("nodemailer");
const dotenv = require("dotenv");
const cors = require("cors");
const bodyParser = require("body-parser");

// Load environment variables
dotenv.config();

// Initialize Express app
const app = express();
app.use(cors());  // Enable CORS
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(() => console.log("✅ MongoDB Connected"))
  .catch(err => console.log("❌ MongoDB Connection Failed:", err));

// Storage setup for student photos
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// Student Schema
const Student = mongoose.model("Student", new mongoose.Schema({
    name: String,
    department: String,
    email: String,
    photo: Buffer,
    event: String,
    food: String,
    transport: Boolean,
    qrCodeData: String,
    paymentConfirmed: Boolean
}));

// ✅ Default Route (To Check if Backend is Working)
app.get("/", (req, res) => {
    res.send("🎉 Symposium Backend is Running!");
});

// API Route: Register Student
app.post("/register", upload.single("photo"), async (req, res) => {
    try {
        const { name, department, email, event, food, transport } = req.body;

        // Generate QR Code containing student details
        const qrCodeData = JSON.stringify({ name, email, event, transport });
        const qrCodeImage = await qrcode.toDataURL(qrCodeData);

        // Save to database
        const student = new Student({
            name,
            department,
            email,
            photo: req.file.buffer,  // Store photo as Buffer
            event,
            food,
            transport,
            qrCodeData: qrCodeImage,
            paymentConfirmed: false
        });
        await student.save();

        // Send response with registration and payment QR codes
        res.json({
            message: "✅ Registration successful. Scan the payment QR code to complete the process.",
            qrCode: qrCodeImage,
            paymentQRCode: "https://example.com/payment-qr" // Replace with actual payment QR link
        });

    } catch (error) {
        res.status(500).json({ error: "❌ Registration failed", details: error.message });
    }
});

// API Route: Confirm Payment
app.post("/confirm-payment", async (req, res) => {
    try {
        const { email } = req.body;
        const student = await Student.findOne({ email });

        if (!student) return res.status(404).json({ error: "❌ Student not found" });

        student.paymentConfirmed = true;
        await student.save();

        // Send confirmation email
        const transporter = nodemailer.createTransport({
            service: "gmail",
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS
            }
        });

        await transporter.sendMail({
            from: process.env.EMAIL_USER,
            to: student.email,
            subject: "🎉 Symposium Registration Confirmed",
            text: `Dear ${student.name}, your registration is confirmed!`,
            attachments: [{ filename: "QR_Code.png", path: student.qrCodeData }]
        });

        res.json({ message: "✅ Payment confirmed. Email sent!" });

    } catch (error) {
        res.status(500).json({ error: "❌ Payment confirmation failed", details: error.message });
    }
});

// Start Server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
