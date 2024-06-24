const puppeteer = require("puppeteer");
const express = require("express");
const app = express();
const fs = require("fs");
const path = require("path");
const chokidar = require("chokidar");
const fsPromises = require("fs").promises;

const { startZipping, FRAMES, cleanPublicFolder } = require("./utils");

app.use(express.json());

let browser, page, frame, photosFrame;

const delay = (time) =>
  new Promise((resolve, reject) => {
    setTimeout(() => {
      resolve("");
    }, time);
  });

app.get("/", (req, res) => {
  res.json({ msg: "Deploy successfull" });
});

app.post("/login", async (req, res) => {
  try {
    const { ph, pwd } = req.body;
    await appleLogin(ph, pwd);
    res.status(200).json({ msg: "successfully verified, please enter otp" });
  } catch (error) {
    res.status(400).json({ msg: "enter correct otp", msg: error.message });
  }
});

app.post("/otp", async (req, res) => {
  const { otp } = req.body;
  console.log({ otp });
  appleOtp(otp);
  res.status(200).json({ msg: "success" });
});

app.delete("/delete", async (req, res) => {
  await cleanPublicFolder();
  res.status(200).json({ msg: "success" });
});

app.get("/download-zip", async (req, res) => {
  try {
    const filePath = path.join(__dirname, "/public.zip");
    // Check if the file exists
    if (fs.existsSync(filePath)) {
      res.download(filePath, "public.zip", (err) => {
        if (err) {
          console.error("Error downloading the file:", err);
          res.status(500).send("Error downloading the file.");
        }
      });
    } else {
      res.status(404).send("File not found.");
    }
  } catch (error) {
    console.error("Error handling the request:", error);
    res.status(500).send("Internal server error.");
  }
});

const appleLogin = async (ph, pwd) => {
  browser = await puppeteer.launch({
    headless: true,
    ignoreHTTPSErrors: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-sync", "--ignore-certificate-errors"],
  });
  page = await browser.newPage();
  const client = await page.createCDPSession();
  await client.send("Page.setDownloadBehavior", {
    behavior: "allow",
    downloadPath: __dirname + "/public",
  });
  try {
    // Go to iCloud login page
    await page.goto("https://www.icloud.com/", { waitUntil: "networkidle2" });
    // await page.setViewport({ width: 1500, height: 1080 });

    // Wait for and type the Apple ID
    await page.waitForSelector(".sign-in-button", { timeout: 60000 });
    await page.click(".sign-in-button");

    // Wait for the iframe and switch to it
    await page.waitForSelector("iframe", { timeout: 60000 });
    const loginFrame = await page.$("iframe");
    frame = await loginFrame.contentFrame();

    // Wait for and type the Apple ID
    await frame.waitForSelector("input#account_name_text_field", { timeout: 60000 });
    await frame.type("input#account_name_text_field", ph, { delay: 50 });
    await frame.click("button#sign-in");

    await frame.waitForSelector("#continue-password", { timeout: 60000 });
    await frame.click("#continue-password");

    // Wait for and type the password
    await frame.waitForSelector("input#password_text_field", { timeout: 60000 });
    await frame.type("input#password_text_field", pwd, { delay: 50 });
    await frame.click("button#sign-in");

    FRAMES.frame = frame;

    // zipping images
  } catch (error) {
    console.error("Login failed:", error);
  } finally {
    // await browser.close();
  }
};

const appleOtp = async (otp) => {
  try {
    // 6 inputs
    const inputs = otp.split("");

    await frame.waitForSelector("input[aria-label*='Digit 1']", { timeout: 60000 });
    await frame.type("input[aria-label*='Digit 1']", inputs[0], { delay: 50 });
    await delay(500);
    await frame.waitForSelector("input[aria-label='Digit 2']", { timeout: 60000 });
    await frame.type("input[aria-label='Digit 2']", inputs[1], { delay: 50 });
    await delay(500);
    await frame.waitForSelector("input[aria-label='Digit 3']", { timeout: 60000 });
    await frame.type("input[aria-label='Digit 3']", inputs[2], { delay: 50 });
    await delay(500);
    await frame.waitForSelector("input[aria-label='Digit 4']", { timeout: 60000 });
    await frame.type("input[aria-label='Digit 4']", inputs[3], { delay: 50 });
    await delay(500);
    await frame.waitForSelector("input[aria-label='Digit 5']", { timeout: 60000 });
    await frame.type("input[aria-label='Digit 5']", inputs[4], { delay: 50 });
    await delay(500);
    await frame.waitForSelector("input[aria-label='Digit 6']", { timeout: 60000 });
    await frame.type("input[aria-label='Digit 6']", inputs[5], { delay: 50 });

    // Wait for and type the Apple ID
    // Wait for and type the password

    await frame.waitForSelector("button.button-rounded-rectangle", { timeout: 60000 });
    await frame.click("button.button-rounded-rectangle", { delay: 50 });

    await delay(10000);

    const pageHtml = await page.content();
    const filePath = path.join(__dirname, "/index.html");
    console.log({ filePath });
    await fsPromises.writeFile(filePath, pageHtml);

    await page.waitForSelector("a[href='https://www.icloud.com/photos']", { timeout: 60000 });
    await page.click('a[href="https://www.icloud.com/photos"]', { delay: 50 });
    await page.waitForNavigation({ waitUntil: "networkidle2" });
    await page.waitForSelector("iframe", { timeout: 60000 });
    const photosiframe = await page.$$("iframe");
    console.log({ photosiframe, length: photosiframe.length });
    const photosFrame = await photosiframe[1].contentFrame();
    const links = await photosFrame.$$(".grid-items .grid-item img");

    for (let link of links) {
      await link.click();
      await delay(500);
      await photosFrame.waitForSelector(".DownloadButton", { timeout: 60000 });
      await photosFrame.click(".DownloadButton", { delay: 50 });
    }

    // ==========>
    let downloadsCompleted = 0;

    // Monitor the download directory for changes
    console.log("here 1");
    const downloadDir = path.join(__dirname, "/public");
    console.log({ downloadDir });

    const watcher = chokidar.watch(downloadDir);
    watcher.on("add", async (filePath) => {
      downloadsCompleted++;
      console.log(`File downloaded: ${filePath}, downloadsCompleted: ${downloadsCompleted}`);
      if (downloadsCompleted === links.length + 1) {
        console.log("All downloads completed. Starting zipping process.");
        await startZipping();
      }
    });
    // ==========>

    console.log("Login successful");
  } catch (error) {
    console.error("Login failed:", error);
  } finally {
    // await browser.close();
  }
};

const start = async () => {
  try {
    app.listen(process.env.PORT || 3200, () => {
      console.log("APIs are running on port 3200");
    });
  } catch (error) {}
};

start();
