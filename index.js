import dotenv from "dotenv";
dotenv.config();

import WebSocket from "ws";
import { Printer, Image } from "@node-escpos/core";
import Serial from "@node-escpos/serialport-adapter";
import sharp from "sharp";
import { SerialPort } from "serialport";

const WS_URL = process.env.WS_URL;

let device; // device tetap reuse di semua print job

// Fungsi auto-detect printer COM port
async function getPrinterPort() {
  const ports = await SerialPort.list();

  if (!ports.length) throw new Error("No COM ports found!");

  console.log(
    "Available COM ports:",
    ports.map((p) => p.path),
  );

  // Fallback: ambil port terakhir (printer biasanya baru)
  return ports[ports.length - 1].path;
}

// Inisialisasi device printer
async function initPrinter() {
  if (!device) {
    const comPort = process.env.PRINTER_COM || (await getPrinterPort());
    console.log("Using printer at:", comPort);

    device = new Serial(comPort, { baudRate: 9600 });

    await new Promise((resolve, reject) => {
      device.open((err) => (err ? reject(err) : resolve()));
    });

    console.log("Printer ready");
  }
  return device;
}

async function connect() {
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

      try {
        const buffer = Buffer.from(
          message.image.replace(/^data:image\/\w+;base64,/, ""),
          "base64",
        );

        const resizedBuffer = await sharp(buffer)
          .resize({ width: 384 })
          .png()
          .toBuffer();

        const comDevice = await initPrinter();

        const escposImage = await Image.load(resizedBuffer, "image/png");

        const printer = new Printer(comDevice, {});
        printer.align("ct").raster(escposImage).cut().flush(); // flush, jangan close

        console.log("Printed successfully");
      } catch (err) {
        console.error("Print error:", err);
      }
    }
  });

  ws.on("close", () => {
    console.log("Disconnected, reconnecting...");
    setTimeout(connect, 5000);
  });
}

// Tutup port printer saat app exit
process.on("exit", () => device?.close());
process.on("SIGINT", () => {
  device?.close();
  process.exit();
});

connect();
