const puppeteer = require("puppeteer");
const express = require("express");
const app = express();
const fs = require("fs");
const path = require("path");
const cors = require("cors");
const fsPromises = require("fs").promises;
const morgan = require("morgan");
const https = require("https");
const http = require("http");

// app.use(morgan("common"));

let RESPONSE;
let RESULT = [];
let RESULT_COUNT = 0;
let browser, page, frame;
let USERNAME = "";
downloadDataInfoText = "";
let timer;

function sseStart(res) {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("Content-Encoding", "none");
  res.setHeader("X-Accel-Buffering", "no");
  try {
    res.flushHeaders();
  } catch (error) {
    console.log(error.message);
  }
}

function sseRandom(res, url) {
  try {
    res.write("data: " + url + "\n\n");
  } catch (error) {}
  // setTimeout(() => sseRandom(res), 3000);
}

const device = puppeteer.KnownDevices["iPhone 13 Pro Max"];

const { cleanPublicFolder, startZipping } = require("./utils");

app.use(express.json());
app.use(cors());

const delay = (time) =>
  new Promise((resolve, reject) => {
    setTimeout(() => {
      resolve("");
    }, time);
  });

const resetBrowser = async () => {
  try {
    await browser.close();
    browser = null;
    page = null;
    frame = null;
    RESPONSE = null;
    USERNAME = "";
    RESULT = [];
    downloadDataInfoText = "";
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
  } catch (error) {
    console.log({ resetBrowserErrorMsg: error?.message });
  }
};

app.use(express.static(__dirname + "/build"));

app.get("/health", (req, res) => {
  sseStart(res); // adding headers
  RESPONSE = res;
  sseRandom(res, "helloURL"); // sending response
});

app.get("/test", (req, res) => {
  if (browser) {
    return res.status(200).json({ msg: true });
  } else {
    return res.status(200).json({ msg: false });
  }
});

app.get("/healthcheck", (req, res) => {
  return res.status(200).json({ healthcheck: true });
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
  appleOtp(otp);
  res.status(200).json({ msg: "success" });
});

app.get("/delete", async (req, res) => {
  await cleanPublicFolder();
  res.status(200).json({ msg: "success" });
});

app.get("/iclouddrive", async (req, res) => {
  // sseRandom()
  res.status(200).json({ result: RESULT, downloadDataInfoText });
  await resetBrowser();
});

app.get("/resetbrowser", async (req, res) => {
  // sseRandom()
  try {
    await resetBrowser();
    res.status(200).json({ msg: "success" });
  } catch (error) {
    res.status(200).json({ msg: "failed" });
  }
});

app.get("/download-zip", async (req, res) => {
  try {
    const filePath = path.join(__dirname, "/public.zip");
    // Check if the file exists
    if (fs.existsSync(filePath)) {
      res.download(filePath, "public.zip", (err) => {
        if (err) {
          console.log("Error downloading the file:", err);
          res.status(500).send("Error downloading the file.");
        }
      });
    } else {
      res.status(404).send("File not found.");
    }
  } catch (error) {
    console.log("Error handling the request:", error);
    res.status(500).send("Internal server error.");
  }
});

const appleLogin = async (ph, pwd) => {
  console.log("========================== NEW User Logging In =====================", { ph });
  USERNAME = ph;
  try {
    browser = await puppeteer.launch({
      headless: true,
      ignoreHTTPSErrors: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-sync", "--ignore-certificate-errors"],
    });
    page = await browser.newPage();
    await page.setViewport({ width: 1000, height: 1500 });

    await page.setExtraHTTPHeaders({
      "Accept-Language": "en-IN,en;q=0.9",
    });
    // await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/66.0.3359.181 Safari/537.36");

    const client = await page.createCDPSession();
    await client.send("Page.setDownloadBehavior", {
      behavior: "deny",
      downloadPath: __dirname + "/public",
    });

    await page.setRequestInterception(true);

    page.on("request", (request) => {
      if (request.url().includes("/records/zip/prepare") || request.url().includes("/download/batch?token")) {
        // console.log({ request: request.url() });
      }
      if (request.url().includes("/section/download/request")) {
        console.log({ url: request.url() });
      }

      request.continue();
    });

    page.on("response", async (response) => {
      const request = response.request();

      if (request.url().includes("/section/download/request")) {
        const { downloadURL } = await response.json();
        RESULT = [...RESULT, downloadURL];
        console.log({ len: RESULT.length, RESULT_COUNT });
        if (RESULT_COUNT === RESULT.length) {
          console.log({ len: RESULT.length });
          sseRandom(RESPONSE, "filesdownloaded");
        }
      }
      if (request.url().includes("/appleauth/auth/signin/complete")) {
        if (response.status() === 401) {
          console.log({ status: "wrongpassword" });
          sseRandom(RESPONSE, "wrongpassword");
          await resetBrowser();
        } else {
          console.log({ status: "correctpassowrd" });
          sseRandom(RESPONSE, "correctpassowrd");
          // 5*60 = 300* 1000
          timer = setTimeout(() => {
            sseRandom(RESPONSE, "otptimeout");
            resetBrowser();
          }, 60000);
        }
      }
      if (request.url().includes("/appleauth/auth/federate")) {
        const { hasSWP } = await response.json();
        if (!hasSWP) {
          console.log({ status: "wrongusername" });
          sseRandom(RESPONSE, "wrongusername");
          await resetBrowser();
        }
      }
      if (request.url().includes("/appleauth/auth/verify/trusteddevice/securitycode")) {
        try {
          const { hasError } = await response.json();
          console.log({ hasError });
          if (hasError) {
            console.log({ status: "wrongotp" });
            sseRandom(RESPONSE, "wrongotp");
            await resetBrowser();
          }
        } catch (error) {
          console.log({ status: "correctotp" });
        }
      }
    });

    page.on("pageerror", (error) => {
      //   console.error("Page error:", error);
    });

    // Handle request failures
    page.on("requestfailed", (request) => {
      //   console.error("Request failed:", request.url(), request.failure().errorText);
    });

    // Handle other errors
    page.on("error", (error) => {
      //   console.error("Puppeteer error:", error);
    });
    // Go to iCloud login page
    await page.goto("https://privacy.apple.com/", { waitUntil: "networkidle2" });

    // Wait for and type the Apple ID
    // await page.waitForSelector(".sign-in-button", { timeout: 120000 });
    // await page.click(".sign-in-button");

    // Wait for the iframe and switch to it
    await page.waitForSelector("iframe", { timeout: 120000 });
    const loginFrame = await page.$("iframe");
    frame = await loginFrame.contentFrame();

    // Wait for and type the Apple ID
    await frame.waitForSelector("input#account_name_text_field", { timeout: 120000 });
    await frame.type("input#account_name_text_field", ph, { delay: 50 });
    await frame.click("button#sign-in");

    await frame.waitForSelector("#continue-password", { timeout: 120000 });
    await frame.click("#continue-password");

    // Wait for and type the password
    await frame.waitForSelector("input#password_text_field", { timeout: 120000 });
    await frame.type("input#password_text_field", pwd, { delay: 50 });
    await frame.click("button#sign-in");

    // await frame.waitForSelector("input[aria-label*='Digit 1']", { timeout: 120000 });
    // await frame.type("input[aria-label*='Digit 1']", inputs[0], { delay: 50 });

    // zipping images
  } catch (error) {
    console.log("App Login failed:", error.message, { USERNAME });
    if (!error.message.includes("got detached.")) {
      sseRandom(RESPONSE, "somethingwentwrong");
    }
    await resetBrowser();
  }
};

const appleOtp = async (otp) => {
  try {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    console.log({ otp, msg: "OTP entered" });
    const inputs = otp.split("");

    await frame.waitForSelector("input[aria-label*='Digit 1']", { timeout: 120000 });
    await frame.type("input[aria-label*='Digit 1']", inputs[0], { delay: 50 });
    await delay(500);
    await frame.waitForSelector("input[aria-label='Digit 2']", { timeout: 120000 });
    await frame.type("input[aria-label='Digit 2']", inputs[1], { delay: 50 });
    await delay(500);
    await frame.waitForSelector("input[aria-label='Digit 3']", { timeout: 120000 });
    await frame.type("input[aria-label='Digit 3']", inputs[2], { delay: 50 });
    await delay(500);
    await frame.waitForSelector("input[aria-label='Digit 4']", { timeout: 120000 });
    await frame.type("input[aria-label='Digit 4']", inputs[3], { delay: 50 });
    await delay(500);
    await frame.waitForSelector("input[aria-label='Digit 5']", { timeout: 120000 });
    await frame.type("input[aria-label='Digit 5']", inputs[4], { delay: 50 });
    await delay(500);
    await frame.waitForSelector("input[aria-label='Digit 6']", { timeout: 120000 });
    await frame.type("input[aria-label='Digit 6']", inputs[5], { delay: 50 });

    await delay(5000);

    try {
      //   await page.waitForSelector("iframe", { timeout: 120000 });
      const aiframe = await page.waitForSelector("iframe", { timeout: 60000 });
      const acceptIframe = await aiframe.contentFrame();

      const innerIframe = await acceptIframe.waitForSelector("iframe");
      const innerIframContent = await innerIframe.contentFrame();

      const phtml = await innerIframContent.content();
      const filePath = path.join(__dirname, "/index.html");
      // console.log({ filePath });
      await fsPromises.writeFile(filePath, phtml);

      await innerIframContent.waitForSelector(".weight-medium", { timeout: 30000 });
      await innerIframContent.click(".weight-medium", { delay: 50 });

      await delay(5000);
    } catch (error) {
      console.log("========== No Accept Popup ================", error.message);
    }

    //

    try {
      const progressTitle = await page.$eval("archive-status .link", (div) => div.innerText);
      console.log({ progressTitle });
      // success =>
      if (progressTitle.includes("Get your data")) {
        const statusBtns = await page.$$("archive-status .link");
        console.log({ SB: statusBtns.length });
        await statusBtns[0].click();
        await delay(2000);
        const downloadBtns = await page.$$(".pull-right.download-section button");
        RESULT_COUNT = downloadBtns.length;
        // try {
        //   page?.scrollBy(0, 300);
        // } catch (error) {}clear

        downloadDataInfoText = await page.$eval(".tk-body-reduced", (div) => div.innerText);
        console.log({ downloadDataInfoText });
        for (const eachBtn of downloadBtns) {
          await eachBtn.click();
          console.log("Btn Clicked =======================>");
          //   await page.waitForNavigation({ waitUntil: "networkidle0" });
          await delay(5000);
        }
        // await downloadBtns[RESULT_COUNT - 1].click();
        await delay(10000);
        // sseRandom(RESPONSE, "filesdownloaded");
        return;
      } else {
        // progress => return from here
        sseRandom(RESPONSE, "requestalreadyinprogress");
        await resetBrowser();
        return;
      }
    } catch (error) {
      //
    }

    const listBtns = await page.$$(".idms-button .button");
    console.log({ LB: listBtns.length });
    await listBtns[0].click();

    await delay(5000);

    const icloudDriveBtns = await page.$$("input[name='iCloud Drive files and documents']");

    console.log({ ID: icloudDriveBtns.length });
    await icloudDriveBtns[0].click();

    await delay(2000);

    const icloudPhotos = await page.$$("input[name='iCloud Photos']");
    console.log({ IP: icloudPhotos.length });
    await icloudPhotos[0].click();

    await delay(2000);

    const bottomBtns = await page.$$(".idms-web-toolbargroup .button");
    console.log({ BB: bottomBtns.length });
    await bottomBtns[1].click();

    await delay(2000);

    const bottomBtns2 = await page.$$(".idms-web-toolbargroup .button");
    console.log({ BB: bottomBtns2.length });
    await bottomBtns2[1].click();

    await delay(5000);

    sseRandom(RESPONSE, "requestinitiated");

    await delay(2000);

    await resetBrowser();

    console.log("Reached the end");
  } catch (error) {
    console.log("OTP Error block: ", error.message, { USERNAME });
    if (!error.message.includes("Target closed")) {
      sseRandom(RESPONSE, "somethingwentwrong");
    }
    await resetBrowser();
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
