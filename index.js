const puppeteer = require("puppeteer");
const express = require("express");
const app = express();
app.use(express.json());

let browser, page, frame, photosFrame;

const delay = (time) =>
  new Promise((resolve, reject) => {
    setTimeout(() => {
      resolve("");
    }, time);
  });

app.post("/login", async (req, res) => {
  const { ph, pwd } = req.body;
  appleLogin(ph, pwd);
  res.status(200).json({ msg: "plsease enter otp" });
});

app.post("/otp", async (req, res) => {
  const { otp } = req.body;
  console.log({ otp });
  appleOtp(otp);
  res.status(200).json({ msg: "success" });
});

const appleLogin = async (ph, pwd) => {
  browser = await puppeteer.launch({ headless: false });
  page = await browser.newPage();
  try {
    // Go to iCloud login page
    await page.goto("https://www.icloud.com/", { waitUntil: "networkidle2" });
    await page.setViewport({ width: 1920, height: 1080 });

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
    await frame.waitForSelector("input[aria-label='Please enter the verification code Digit 1']", { timeout: 60000 });
    await frame.type("input[aria-label='Please enter the verification code Digit 1']", inputs[0], { delay: 50 });
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

    console.log("Login successful");
  } catch (error) {
    console.error("Login failed:", error);
  } finally {
    // await browser.close();
  }
};

const start = async () => {
  try {
    app.listen(3200, () => {
      console.log("APIs are running on port 3200");
    });
  } catch (error) {}
};

start();
