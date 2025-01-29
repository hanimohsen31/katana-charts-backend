const puppeteer = require("puppeteer");
const path = require("path");
const fs = require("fs");
const express = require("express");
const bodyParser = require("body-parser");
const sharp = require("sharp");
const { jsPDF } = require("jspdf");
const baseHtml = path.resolve(__dirname, `./public/base.html`);
const app = express();
app.use(bodyParser.json());

// --------------------------  DIVIDER  make File Copy With Data ----------------------------------
function makeFileCopyWithData(timestamp, dashboardResponse) {
  try {
    let newCopyUpdatedFile = `./templates/base${timestamp}.html`;
    if (!fs.existsSync('./templates')) {
      fs.mkdirSync('./templates', { recursive: true });
    }
    const data = fs.readFileSync(baseHtml, "utf8");
    const updatedContent = data.replace(
      `"$$$RESPONSE$$$"`,
      JSON.stringify(dashboardResponse)
    );
    fs.writeFileSync(newCopyUpdatedFile, updatedContent, "utf8");
    console.log(`HTML Copied Successfully`);
  } catch (error) {
    console.error("Error copying HTML file:", error);
  }
}

function deleteAllFilesInDirectory(timestamp) {
  if (!fs.existsSync('./templates')) {
    fs.mkdirSync('./templates', { recursive: true });
  }
  const directoryPath = path.resolve(__dirname, "./templates");
  const fileName = `base${timestamp}.html`;
  const filePath = path.join(directoryPath, fileName);
  if (fs.existsSync(filePath)) {
    try {
      fs.unlinkSync(filePath);
      console.log(`File ${fileName} deleted successfully`);
    } catch (error) {
      console.error(`Error deleting file ${fileName}:`, error);
    }
  }
}

// --------------------------  DIVIDER  exportPNG -------------------------------------------------
async function exportPNG(timestamp) {
  if (!fs.existsSync('./output')) {
    fs.mkdirSync('./output', { recursive: true });
  }
  const imagePath = path.resolve(__dirname, `./output/${timestamp}.png`);

  try {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    const filePath = path.resolve(
      __dirname,
      `./templates/base${timestamp}.html`
    );

    await page.goto(filePath);
    await delay(5);

    const pageHeight = await page.evaluate(() => document.body.scrollHeight);
    await page.setViewport({ width: 1200, height: pageHeight });
    await delay(5);

    await page.screenshot({
      path: path.resolve(__dirname, imagePath),
      fullPage: true,
    });

    console.log(`PNG saved at "${imagePath}"`);

    await browser.close();
  } catch (error) {
    console.error("Error processing PDF file:", error);
  }
}

async function convertPNGtoPDF(timestamp) {
  if (!fs.existsSync('./output')) {
    fs.mkdirSync('./output', { recursive: true });
  }
  const imagePath = path.resolve(__dirname, `./output/${timestamp}.png`);
  const pdfPath = path.resolve(__dirname, `./output/${timestamp}.pdf`);

  try {
    // Get image dimensions
    const imageMetadata = await sharp(imagePath).metadata();
    const imgWidth = imageMetadata.width;
    const imgHeight = imageMetadata.height;

    // Convert pixels to mm (1px = 0.264583 mm)
    const widthMm = imgWidth * 0.264583;
    const heightMm = imgHeight * 0.264583;

    // Create PDF with image dimensions
    const pdf = new jsPDF({
      orientation: widthMm > heightMm ? "landscape" : "portrait",
      unit: "mm",
      format: [widthMm, heightMm],
    });

    const imageBuffer = fs.readFileSync(imagePath);
    const imageBase64 = imageBuffer.toString("base64");

    pdf.addImage(
      `data:image/png;base64,${imageBase64}`,
      "PNG",
      0,
      0,
      widthMm,
      heightMm
    );
    pdf.save(pdfPath);

    console.log(`PDF saved at ${pdfPath}`);
  } catch (error) {
    console.error("Error processing PNG file:", error);
  }
}

// --------------------------  DIVIDER  helper ----------------------------------------------------
async function delay(seconds) {
  return new Promise((resolve) => setTimeout(resolve, seconds * 1000));
}

// --------------------------  DIVIDER  server ----------------------------------------------------
// POST endpoint to accept payload
app.post("/export/png", async (req, res) => {
  try {
    let payload = req.body.data.dashboard;
    payload.op_commander_widgets.sort((a, b) => a.id - b.id);
    const timestamp = Date.now();

    if (!payload || Object.keys(payload).length === 0) {
      return res.status(400).json({ error: "Payload is required" });
    }

    makeFileCopyWithData(timestamp, payload);
    await exportPNG(timestamp);
    deleteAllFilesInDirectory(timestamp);

    res
      .status(200)
      .json({ success: true, imagePath: `output/${timestamp}.png` });
  } catch (err) {
    console.error("Error processing payload:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.post("/export/pdf", async (req, res) => {
  try {
    let payload = req.body.data.dashboard;
    payload.op_commander_widgets.sort((a, b) => a.id - b.id);
    const timestamp = Date.now();

    if (!payload || Object.keys(payload).length === 0) {
      return res.status(400).json({ error: "Payload is required" });
    }

    // ---------------------- start here -----------------------
    makeFileCopyWithData(timestamp, payload);
    await exportPNG(timestamp);
    await delay(1);
    await convertPNGtoPDF(timestamp);
    // ---------------------- end here -------------------------
    res
      .status(200)
      .json({ success: true, imagePath: `output/${timestamp}.pdf` });
    deleteAllFilesInDirectory(timestamp);
  } catch (err) {
    console.error("Error processing payload:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Start the server
// server : http://127.0.0.1:5000
let port = process.env.PORT || 5000;
// let host = "127.0.0.1";
app.listen(port, () => {
  console.log("Server Started");
});
