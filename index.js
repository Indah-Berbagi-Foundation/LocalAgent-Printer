import dotenv from "dotenv";
dotenv.config();

import WebSocket from "ws";
import { Printer, Image } from "@node-escpos/core";
import USB from "@node-escpos/usb-adapter";
import sharp from "sharp";

const WS_URL = process.env.WS_URL;

function connect() {
  const ws = new WebSocket(WS_URL);

  ws.on("open", () => {
    console.log("Connected to server");

    ws.send(
      JSON.stringify({
        type: "register",
        printer_id: "kasir-1",
      }),
    );
  });

  ws.on("message", async (data) => {
    const message = JSON.parse(data);

    if (message.type === "print") {
      console.log("Received print job");

      const base64Data = message.image.replace(/^data:image\/\w+;base64,/, "");
      const buffer = Buffer.from(base64Data, "base64");

      const resizedBuffer = await sharp(buffer)
        .resize({ width: 384 })
        .png()
        .toBuffer();

      const device = new USB();

      device.open(async (err) => {
        if (err) {
          return console.error("Printer error:", err);
        }

        const escposImage = await Image.load(resizedBuffer, "image/png");

        const printer = new Printer(device, {});

        printer.align("ct").raster(escposImage).cut().close();

        console.log("Printed successfully");
      });
    }
  });

  ws.on("close", () => {
    console.log("Disconnected, reconnecting...");
    setTimeout(connect, 5000);
  });
}

connect();
