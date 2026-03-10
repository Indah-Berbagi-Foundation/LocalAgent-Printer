import dotenv from "dotenv";
dotenv.config();

import WebSocket from "ws";
import { Printer, Image } from "@node-escpos/core";
// If USB Printer
// import USB from "@node-escpos/usb-adapter";
// Else If Serial Printer / Bluetooth Printer
import Serial from "@node-escpos/serialport-adapter";
import { SerialPort } from "serialport";

import sharp from "sharp";

const WS_URL = process.env.WS_URL;
const COM_PORT = "COM4";

async function getPrinterPort() {
  const ports = await SerialPort.list();

  // Cari port yang kemungkinan printer (nama / manufacturer / pnpId bisa disesuaikan)
  const printerPort = ports.find(
    (p) =>
      (p.manufacturer && p.manufacturer.toLowerCase().includes("bluetooth")) ||
      (p.friendlyName && p.friendlyName.toLowerCase().includes("printer")) ||
      (p.vendorId && p.vendorId === "XXXX"), // optional filter vendorId
  );

  if (!printerPort) throw new Error("Printer COM port not found!");
  return printerPort.path;
}

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

      // If USB Printer
      // const device = new USB();
      // Else If Serial Printer / Bluetooth Printer
      const device = new Serial(COM_PORT, { baudRate: 9600 });

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
