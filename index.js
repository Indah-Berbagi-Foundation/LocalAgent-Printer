import { Printer, Image } from "@node-escpos/core";
import USB from "@node-escpos/usb-adapter";
import sharp from "sharp";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const imagePath = path.join(__dirname, "assets/img/invoice-1749541455175.png");

const resizedImagePath = path.join(
  __dirname,
  "assets/temp/resized-invoice.png"
);
const resizeImage = async () => {
  await sharp(imagePath).resize({ width: 384 }).toFile(resizedImagePath);
};

const device = new USB();

device.open(async (err) => {
  if (err) {
    console.error("Error opening device:", err);
    return;
  }

  try {
    await resizeImage();

    const image = await Image.load(resizedImagePath);
    const printer = new Printer(device, {});

    printer.align("ct").raster(image).cut().close();
  } catch (e) {
    console.error("Print error:", e);
  }
});
