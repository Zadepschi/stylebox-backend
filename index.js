const express = require("express");
const cors = require("cors");
require("dotenv").config();

const stripe = require("stripe")(process.env.STRIPE_SECRET_TEST);

const app = express();

// ✅ Body parser больше не нужен — Express умеет сам
app.use(express.json());

// ✅ Хорошая практика — ограничить CORS, например:
app.use(cors({
  origin: ["http://localhost:3000", "http://localhost:5173", "http://localhost:5174"],

  credentials: true,
}));

app.post("/stripe/create-payment-intent", async (req, res) => {
  console.log("Получен запрос /stripe/create-payment-intent", req.body);
  const { amount } = req.body;

  // ✅ Проверим, чтобы amount был числом > 0
  if (!amount || typeof amount !== "number" || amount <= 0) {
    return res.status(400).json({
      error: "Invalid or missing amount",
    });
  }

  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency: "usd",
      automatic_payment_methods: {
        enabled: true,
        allow_redirects: 'never',
      },
    });

    console.log("✅ PaymentIntent created:", paymentIntent.id);

    res.json({
      clientSecret: paymentIntent.client_secret,
    });
  } catch (error) {
    console.error("❌ Stripe error:", error);

    res.status(error.statusCode || 500).json({
      error: error.message,
    });
  }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`✅ Server started on port ${PORT}`);
});
