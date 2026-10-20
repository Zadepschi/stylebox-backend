const Order = require("../models/Order");

const getMyOrders = async (req, res) => {
  try {
    // Auth0 ID должен приходить из проверенного middleware авторизации
    const userId = req.auth?.payload?.sub;

    if (!userId) {
      return res.status(401).json({
        message: "Unauthorized",
      });
    }

    const orders = await Order.find({ userId }).sort({
      createdAt: -1,
    });

    return res.status(200).json({ orders });
  } catch (error) {
    console.error("Failed to fetch orders:", error);

    return res.status(500).json({
      message: "Failed to fetch orders",
    });
  }
};

module.exports = { getMyOrders };