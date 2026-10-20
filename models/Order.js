
const mongoose = require("mongoose");

const orderSchema = new mongoose.Schema(
  {
    // Auth0 ID покупателя
    userId: {
      type: String,
      required: true,
      index: true,
    },

    // Товары в заказе
   
items: [
  {
    productId: {
      type: String,
      required: true,
    },
    name: {
      type: String,
      required: true,
    },
    image: {
      type: String,
      default: "",
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
    },
  },
],


    totalAmount: {
      type: Number,
      required: true,
      min: 0,
    },

    currency: {
      type: String,
      default: "usd",
    },

    paymentIntentId: {
      type: String,
      required: true,
      unique: true,
    },

    paymentStatus: {
      type: String,
      enum: ["pending", "paid", "failed"],
      default: "pending",
    },

    orderStatus: {
      type: String,
      enum: ["new", "processing", "shipped", "delivered", "cancelled"],
      default: "new",
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Order", orderSchema);
