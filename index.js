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

app.use(morgan("common"));

let RESPONSE;
let RESULT = [];
let RESULT_COUNT = 0;
let browser, page, frame;
let currentPuppeterStatus = "LOGIN";

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
  res.write("data: " + url + "\n\n");
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
  await browser.close();
  browser = null;
  page = null;
  frame = null;
  RESPONSE = null;
};

app.use(express.static(__dirname + "/build"));

app.get("/health", (req, res) => {
  sseStart(res); // adding headers
  RESPONSE = res;
  sseRandom(res, "helloURL"); // sending response
});

app.get("/test", (req, res) => {
  res.status(200).json({ msg: "testing success" });
});

app.post("/login", async (req, res) => {
  try {
    const { ph, pwd } = req.body;
    await appleLogin(ph, pwd);
    currentPuppeterStatus = "OTP";
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
  res.status(200).json({ result: RESULT });
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
    headless: false,
    ignoreHTTPSErrors: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-sync", "--ignore-certificate-errors"],
  });
  page = await browser.newPage();

  await page.setExtraHTTPHeaders({
    "Accept-Language": "en-IN,en;q=0.9",
  });
  // await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/66.0.3359.181 Safari/537.36");

  const client = await page.createCDPSession();
  await client.send("Page.setDownloadBehavior", {
    behavior: "allow",
    downloadPath: __dirname + "/public",
  });
  try {
    // Go to iCloud login page
    await page.goto("https://www.icloud.com/", { waitUntil: "networkidle2" });

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

    // await frame.waitForSelector("input[aria-label*='Digit 1']", { timeout: 60000 });
    // await frame.type("input[aria-label*='Digit 1']", inputs[0], { delay: 50 });

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

    await delay(5000);

    // await page.waitForSelector("a[href='https://www.icloud.com/photos']", { timeout: 60000 });
    // await page.click('a[href="https://www.icloud.com/photos"]', { delay: 50 });
    // await page.waitForNavigation({ waitUntil: "networkidle2" });
    // await page.emulate(device);

    // await page.waitForSelector("iframe", { timeout: 60000 });
    // const photosiframe = await page.$$("iframe");
    // const photosFrame = await photosiframe[0].contentFrame();

    // await photosFrame.waitForSelector("span[class='Typography PhotosButton-text Typography-coarsePointerButton']", { timeout: 60000 });
    // await photosFrame.click("span[class='Typography PhotosButton-text Typography-coarsePointerButton']", { delay: 50 });

    // await photosFrame.waitForSelector("span[class='Typography PhotosButton-text Typography-coarsePointerButton']", { timeout: 60000 });
    // await photosFrame.click("span[class='Typography PhotosButton-text Typography-coarsePointerButton']", { delay: 50 });

    // await photosFrame.waitForSelector(
    //   ".push.primary.PhotosButton.ToolbarButton.ToolbarMenuButton.GridMoreButton.icon.is-coarse-pointer.icloud-touch div",
    //   { timeout: 60000 }
    // );
    // await photosFrame.click(".push.primary.PhotosButton.ToolbarButton.ToolbarMenuButton.GridMoreButton.icon.is-coarse-pointer.icloud-touch div", {
    //   delay: 50,
    // });

    // await delay(2000);

    // const popoverElement = await photosFrame.$(".standard.arrow-hidden.PhotosMenu.MenuButton-menu.MeatballMenu.no-arrow");
    // const menuItems = await popoverElement.$$("ui-menu-item.menuItem");
    // const secondMenuItem = menuItems[1];

    await page.setRequestInterception(true);
    page.on("request", (request) => {
      if (request.url().includes("/records/zip/prepare") || request.url().includes("/download/batch?token")) {
        // console.log({ request: request.url() });
      }
      request.continue();
    });

    page.on("response", async (response) => {
      const request = response.request();
      if (request.url().includes("/records/zip/prepare")) {
        const { downloadURL } = await response.json();
        sseRandom(RESPONSE, downloadURL);
        await resetBrowser();
      } else if (request.url().includes("/download/batch?token")) {
        const data = await response.json();
        console.log({ dataLength: data.length });
        if (data.length === RESULT_COUNT) {
          const result = data.map((item) => {
            const {
              data_token: { url },
            } = item;
            return url;
          });
          RESULT = result;
          await cleanPublicFolder();
          sseRandom(RESPONSE, "filesdownloaded");
        }
        // await resetBrowser();
      }
    });

    // await secondMenuItem.click();

    // await page.goto("https://www.icloud.com/", { waitUntil: "networkidle2" });

    await page.waitForSelector("a[href='https://www.icloud.com/iclouddrive']", { timeout: 60000 });
    await page.click('a[href="https://www.icloud.com/iclouddrive"]', { delay: 50 });
    await page.waitForNavigation({ waitUntil: "networkidle2", timeout: 60000 });
    await page.emulate(device);

    await delay(5000);

    await page.waitForSelector("iframe", { timeout: 60000 });
    const photosiframe = await page.$$("iframe");
    const photosFrame = await photosiframe[0].contentFrame();

    const phtml = await photosFrame.content();

    const filePath = path.join(__dirname, "/index.html");
    // console.log({ filePath });
    await fsPromises.writeFile(filePath, phtml);

    // div.actions-group.end ui-button
    const list = await photosFrame.$$(".actions-group.end");
    await list[0].click();
    await delay(2000);

    const selectBtn = await photosFrame.$$("[role='menuitem'].contains-icon");
    // console.log({ SL: selectBtn.length });
    await selectBtn[0].click();

    await delay(1000);

    const clickAllBtn = await photosFrame.$$(".actions-group.start .icloud-touch");
    // console.log({ CL: clickAllBtn.length });
    await clickAllBtn[0].click();

    await delay(2000);

    // RESULT_COUNT;

    const navigationTitle = await photosFrame.$eval(".navigation-title", (div) => div.innerText);
    RESULT_COUNT = Number(navigationTitle.split(" ")[0]);

    const downloadAllBtns = await photosFrame.$$(".actions-group.middle .icloud-touch");
    // console.log({ DL: downloadAllBtns.length });
    await downloadAllBtns[0].click();

    console.log("here 1");
    const downloadDir = path.join(__dirname, "/public");
    console.log({ downloadDir });

    console.log("Reached the end");
  } catch (error) {
    console.error("Error block: ", error.message);
    await resetBrowser();
  }
};

// const httpServer = http.createServer(app);
// const httpsServer = https.createServer(
//   {
//     cert: fs.readFileSync(__dirname + "/ssl/fullchain.pem"),
//     key: fs.readFileSync(__dirname + "/ssl/privkey.pem"),
//   },
//   app
// );

// httpServer.listen(3300, () => {
//   console.log("HTTP Server running on port 80");
// });

// httpsServer.listen(3400, () => {
//   console.log("HTTPS Server running on port 443");
// });

const start = async () => {
  try {
    app.listen(process.env.PORT || 3200, () => {
      console.log("APIs are running on port 3200");
    });
  } catch (error) {}
};

start();
