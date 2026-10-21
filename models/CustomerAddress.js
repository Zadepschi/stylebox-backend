
const mongoose = require("mongoose");

const customerAddressSchema = new mongoose.Schema(
  {
    // Auth0 ID — адрес принадлежит конкретному покупателю
    userId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    address: { type: String, required: true, trim: true },
    city: { type: String, required: true, trim: true },
    state: { type: String, required: true, trim: true },
    postalCode: { type: String, required: true, trim: true },
    country: {
      type: String,
      required: true,
      enum: ["United States"],
      default: "United States",
    },
    latitude: { type: Number, required: true },
    longitude: { type: Number, required: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model(
  "CustomerAddress",
  customerAddressSchema
);
