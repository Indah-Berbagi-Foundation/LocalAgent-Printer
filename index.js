import dotenv from "dotenv";
dotenv.config();

import express from "express";
import http from "http";

import { Printer, Image } from "@node-escpos/core";
import USB from "@node-escpos/usb-adapter";
import sharp from "sharp";

const PORT = process.env.PORT;

try {
  const app = express();

  app.use(express.json({ limit: "10mb" }));

  app.post("/print", async (req, res) => {
    const { image } = req.body;

    const base64Data = image.replace(/^data:image\/\w+;base64,/, "");
    const buffer = Buffer.from(base64Data, "base64");

    try {
      const resizedBuffer = await sharp(buffer)
        .resize({ width: 384 })
        .png()
        .toBuffer();

      const device = new USB();
      device.open(async (err) => {
        if (err) {
          console.error("Error opening device:", err);
          return res.status(500).json({ message: "Failed to open printer" });
        }

        const escposImage = await Image.load(resizedBuffer, "image/png");
        const printer = new Printer(device, {});
        printer.align("ct").raster(escposImage).cut().close();
      });

      console.log("Image sent to printer successfully");
      return res
        .status(200)
        .json({ message: "Success, Image sent to printer" });
    } catch (err) {
      console.error("Print error:", err);
      return res
        .status(500)
        .json({ message: "Failed to print image", error: err.message });
    }
  });

  const server = http.createServer(app);

  server.listen(PORT, () => {
    console.log(`Local printer agent running on port ${PORT}`);
  });
} catch (error) {
  console.error("Error starting server:", error);
  process.exit(1);
}
