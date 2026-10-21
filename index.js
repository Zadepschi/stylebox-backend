const express = require("express");
const cors = require("cors");
require("dotenv").config();
const mongoose = require("mongoose");
const stripe = require("stripe")(process.env.STRIPE_SECRET_TEST);

const Order = require("./models/Order");
const CustomerAddress = require("./models/CustomerAddress");
const checkJwt = require("./middleware/checkJwt");

const app = express();

// Middleware
app.use(express.json());

app.use(
  cors({
    origin: [
      "http://localhost:3000",
      "http://localhost:5173",
      "http://localhost:5174",
      "https://stylebox-shop.vercel.app",
      "https://style-box-new.vercel.app",
    ],
    credentials: true,
  })
);

// Health check
app.get("/", (req, res) => {
  res.json({
    message: "StyleBox API is running.",
  });
});

// Protected Auth0 test route
app.get("/api/private", checkJwt, (req, res) => {
  res.json({
    message: "Auth0 token verified successfully!",
  });
});


function normalizeShippingAddress(input) {
  if (!input || typeof input !== "object") {
    return null;
  }

  const address = {
    address: String(input.address ?? "").trim(),
    city: String(input.city ?? "").trim(),
    state: String(input.state ?? "").trim(),
    postalCode: String(input.postalCode ?? "").trim(),
    country: String(input.country ?? "").trim(),
    latitude: input.latitude,
    longitude: input.longitude,
  };

  if (
    !address.address ||
    !address.city ||
    !address.state ||
    !address.postalCode ||
    address.country !== "United States" ||
    typeof address.latitude !== "number" ||
    !Number.isFinite(address.latitude) ||
    address.latitude < -90 ||
    address.latitude > 90 ||
    typeof address.longitude !== "number" ||
    !Number.isFinite(address.longitude) ||
    address.longitude < -180 ||
    address.longitude > 180
  ) {
    return null;
  }

  return address;
}

// Get the current user's saved address.
app.get("/api/me/shipping-address", checkJwt, async (req, res) => {
  try {
    const userId = req.auth.payload.sub;

    const saved = await CustomerAddress.findOne({ userId }).lean();

    if (!saved) {
      return res.status(200).json({ address: null });
    }

    const { address, city, state, postalCode, country, latitude, longitude } =
      saved;

    return res.status(200).json({
      address: {
        address,
        city,
        state,
        postalCode,
        country,
        latitude,
        longitude,
      },
    });
  } catch (error) {
    console.error("Load shipping address error:", error.message);
    return res.status(500).json({
      error: "Failed to load shipping address.",
    });
  }
});

// Save or update the current user's address.
app.put("/api/me/shipping-address", checkJwt, async (req, res) => {
  try {
    const userId = req.auth.payload.sub;
    const address = normalizeShippingAddress(req.body);

    if (!address) {
      return res.status(400).json({
        error: "Please provide a complete valid US shipping address.",
      });
    }

    const saved = await CustomerAddress.findOneAndUpdate(
      { userId },
      { $set: address },
      {
        new: true,
        upsert: true,
        runValidators: true,
        setDefaultsOnInsert: true,
      }
    );

    return res.status(200).json({
      message: "Shipping address saved.",
      address: {
        address: saved.address,
        city: saved.city,
        state: saved.state,
        postalCode: saved.postalCode,
        country: saved.country,
        latitude: saved.latitude,
        longitude: saved.longitude,
      },
    });
  } catch (error) {
    console.error("Save shipping address error:", error.message);
    return res.status(500).json({
      error: "Failed to save shipping address.",
    });
  }
});

app.get("/api/debug/routes", (req, res) => {
  res.json({
    service: "StyleBox API",
    shippingAddressRouteLoaded:
      app._router.stack.some(
        (layer) =>
          layer.route?.path === "/api/me/shipping-address"
      ),
  });
});

// Create Stripe PaymentIntent
app.post("/stripe/create-payment-intent", async (req, res) => {
  const { amount } = req.body;

  if (!Number.isInteger(amount) || amount <= 0) {
    return res.status(400).json({
      error: "Invalid or missing amount.",
    });
  }

  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency: "usd",
      automatic_payment_methods: {
        enabled: true,
        allow_redirects: "never",
      },
    });

    return res.json({
      clientSecret: paymentIntent.client_secret,
    });
  } catch (error) {
    console.error("Stripe PaymentIntent error:", error.message);

    return res.status(500).json({
      error: "Unable to initialize payment.",
    });
  }
});

// Save order after successful Stripe payment
app.post("/api/orders", checkJwt, async (req, res) => {
  try {
    // Authenticated Auth0 user
    const userId = req.auth.payload.sub;

    const { paymentIntentId, items, shippingAddress: inputAddress } =
  req.body;

const shippingAddress = normalizeShippingAddress(inputAddress);

if (!shippingAddress) {
  return res.status(400).json({
    error: "A valid shipping address is required.",
  });
}


    if (
      typeof paymentIntentId !== "string" ||
      !Array.isArray(items) ||
      items.length === 0
    ) {
      return res.status(400).json({
        error: "Payment ID and order items are required.",
      });
    }

    // Verify payment directly with Stripe
    const paymentIntent =
      await stripe.paymentIntents.retrieve(paymentIntentId);

    if (paymentIntent.status !== "succeeded") {
      return res.status(400).json({
        error: "Payment has not been completed.",
      });
    }

    // Prevent duplicate orders
    const existingOrder = await Order.findOne({
      paymentIntentId: paymentIntent.id,
    });

    if (existingOrder) {
      if (existingOrder.userId !== userId) {
        return res.status(403).json({
          error: "This payment belongs to another user.",
        });
      }

      return res.status(200).json({
        message: "Order already saved.",
        order: existingOrder,
      });
    }

    // Normalize incoming cart items
   
    // Normalize incoming cart items
    const cleanItems = items.map((item) => ({
      productId: String(item.id ?? item.productId ?? ""),
      name: String(item.name ?? item.title ?? ""),
      image: String(item.image ?? ""),
      price: Number(item.price),
      quantity: Number(item.quantity),
    }));

console.log(
  "CHECK 3 — Clean items:",
  JSON.stringify(cleanItems, null, 2)
);

    const validItems = cleanItems.every(
      (item) =>
        item.productId.length > 0 &&
        item.name.length > 0 &&
        Number.isFinite(item.price) &&
        item.price >= 0 &&
        Number.isInteger(item.quantity) &&
        item.quantity >= 1
    );

    if (!validItems) {
      return res.status(400).json({
        error: "Order contains invalid items.",
      });
    }

    // Prices in the cart are dollars; Stripe amount is in cents
    const calculatedTotal = cleanItems.reduce(
      (sum, item) =>
        sum + Math.round(item.price * 100) * item.quantity,
      0
    );

    // Verify the cart total matches the actual Stripe payment
    if (
      paymentIntent.currency !== "usd" ||
      paymentIntent.amount !== calculatedTotal
    ) {
      return res.status(400).json({
        error: "Order total does not match the payment.",
      });
    }



    // Save order in MongoDB
 const order = await Order.create({
  userId,
  shippingAddress,
  items: cleanItems,
  totalAmount: paymentIntent.amount,
  currency: paymentIntent.currency,
  paymentIntentId: paymentIntent.id,
  paymentStatus: "paid",
  orderStatus: "new",
});

    console.log(
  "5. Saved order items:",
  JSON.stringify(order.items, null, 2)
);

    return res.status(201).json({
      message: "Order saved successfully.",
      order,
    });
  } catch (error) {
    console.error("Order save error:", error.message);

    if (error.code === 11000) {
      return res.status(409).json({
        error: "An order for this payment already exists.",
      });
    }

    return res.status(500).json({
      error: "Failed to save order.",
    });
  }
});



app.get("/api/orders", checkJwt, async (req, res) => {
  try {
    const userId = req.auth.payload.sub;

    const orders = await Order.find({ userId })
      .sort({ createdAt: -1 })
      .lean();

    console.log(
      "CHECK 6 — Images from MongoDB:",
      JSON.stringify(
        orders.map((order) => ({
          id: order._id,
          items: order.items.map((item) => ({
            name: item.name,
            image: item.image,
            hasImage: Boolean(item.image),
          })),
        })),
        null,
        2
      )
    );

    return res.status(200).json({ orders });
  } catch (error) {
    console.error("Fetch orders error:", error.message);

    return res.status(500).json({
      error: "Failed to fetch orders.",
    });
  }
});


// Start server
const PORT = process.env.PORT || 8080;

async function startServer() {
  try {
    if (!process.env.MONGODB_URI) {
      throw new Error("MONGODB_URI is not configured.");
    }

    if (!process.env.STRIPE_SECRET_TEST) {
      throw new Error("STRIPE_SECRET_TEST is not configured.");
    }

    await mongoose.connect(process.env.MONGODB_URI);

    console.log("MongoDB connected successfully.");

    app.listen(PORT, () => {
      console.log(`StyleBox API started on port ${PORT}.`);
    });
  } catch (error) {
    console.error("Backend startup error:", error.message);
    process.exit(1);
  }
}

startServer();