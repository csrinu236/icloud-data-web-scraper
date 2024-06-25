const puppeteer = require("puppeteer");
const fs = require("fs");
const https = require("https");
const path = require("path");
const archiver = require("archiver");

const express = require("express");
const app = express();

async function loginToInstagram(username, password) {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  try {
    await page.goto("https://www.instagram.com/accounts/login/", { waitUntil: "networkidle2" });
    await page.setViewport({ width: 1920, height: 1080 });

    // Wait for the login form to load
    await page.waitForSelector('input[name="username"]');

    // Enter username and password
    await page.type('input[name="username"]', username, { delay: 50 });
    await page.type('input[name="password"]', password, { delay: 50 });

    // Click on the login button
    await page.click('button[type="submit"]');

    // Wait for navigation after login
    await page.waitForNavigation({ waitUntil: "networkidle2" });

    // Click the "Save Info" button if it appears
    const saveInfoButtonSelector = "button._acan._acap._acas._aj1-._ap30";
    if ((await page.$(saveInfoButtonSelector)) !== null) {
      await page.click(saveInfoButtonSelector);
    }

    // Handle "Turn off Notifications" prompt
    const turnOffNotificationsButtonSelector = "button._a9--._ap36._a9_1";
    await page
      .waitForSelector(turnOffNotificationsButtonSelector, { timeout: 10000 })
      .catch(() => console.log("Turn off notifications button not found"));
    if ((await page.$(turnOffNotificationsButtonSelector)) !== null) {
      await page.click(turnOffNotificationsButtonSelector);
    }

    console.log("Logged in successfully!");

    // Scroll and collect image URLs
    const imageUrls = await collectImageUrls(page, 5);
    // console.log("Collected image URLs:", imageUrls);

    // Download images
    for (const [index, url] of imageUrls.entries()) {
      await downloadImage(url, path.join(__dirname + "/public", `image${index + 1}.jpg`));
    }

    const output = fs.createWriteStream(path.join(__dirname, "public.zip"));
    const archive = archiver("zip", {
      zlib: { level: 9 }, // Sets the compression level
    });
    output.on("close", function () {
      console.log(archive.pointer() + " total bytes");
      console.log("Archiver has been finalized and the output file descriptor has closed.");
    });
    output.on("end", function () {
      console.log("Data has been drained");
    });
    archive.on("warning", function (err) {
      if (err.code === "ENOENT") {
        // log warning
      } else {
        // throw error
        throw err;
      }
    });
    archive.on("error", function (err) {
      throw err;
    });
    archive.pipe(output);
    archive.directory(path.join(__dirname, "public"), false);
    await archive.finalize();
  } catch (error) {
    console.error("Error logging in:", error);
  } finally {
    // await browser.close();
  }
}

async function collectImageUrls(page, count) {
  let imageUrls = [];
  try {
    while (imageUrls.length < count) {
      // Scroll down the page
      await page.evaluate(() => {
        window.scrollBy(0, window.innerHeight);
      });

      const urls = await page.$$eval("._aagv > img", (imgs) => imgs.map((img) => img.src));
      imageUrls = [...new Set([...imageUrls, ...urls])];

      console.log(`Collected ${imageUrls.length} image URLs so far...`);
    }
  } catch (error) {
    console.error("Error collecting image URLs:", error);
  }
  return imageUrls.slice(0, count);
}

function downloadImage(url, filepath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(filepath);
    https
      .get(url, (response) => {
        response.pipe(file);
        file.on("finish", () => {
          file.close(resolve);
        });
      })
      .on("error", (error) => {
        fs.unlink(filepath, () => reject(error));
      });
  });
}

app.use("/data", express.static("public"));
app.use("/", (req, res) => {
  res.send();
});

// Replace with your Instagram credentials
const username = "csrinu6597";
const password = "1729236s";

loginToInstagram(username, password);
