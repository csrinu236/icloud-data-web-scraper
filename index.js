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
    headless: true,
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
    await page.waitForNavigation({ waitUntil: "networkidle2" });
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

const httpServer = http.createServer(app);
const httpsServer = https.createServer(
  {
    cert: `-----BEGIN CERTIFICATE-----
MIIDmDCCAx6gAwIBAgISA9gd6E0X2VzotNEz0usWCb4xMAoGCCqGSM49BAMDMDIx
CzAJBgNVBAYTAlVTMRYwFAYDVQQKEw1MZXQncyBFbmNyeXB0MQswCQYDVQQDEwJF
NTAeFw0yNDA2MjYxMzEyMzdaFw0yNDA5MjQxMzEyMzZaMBsxGTAXBgNVBAMTEHdl
YmRldi1tZWRpYS5jb20wWTATBgcqhkjOPQIBBggqhkjOPQMBBwNCAATr0jzfkM62
5f0zKROwgj3yXH3vZ8SbwlprlW6N0jZJjW3o/LMqjabC5bRIwP0tQWH8FTeCInB+
OuPH7Q/j44aVo4ICKTCCAiUwDgYDVR0PAQH/BAQDAgeAMB0GA1UdJQQWMBQGCCsG
AQUFBwMBBggrBgEFBQcDAjAMBgNVHRMBAf8EAjAAMB0GA1UdDgQWBBQB6guM9Lhv
66LyQhSvjfdLcRHpOzAfBgNVHSMEGDAWgBSfK1/PPCFPnQS37SssxMZwi9LXDTBV
BggrBgEFBQcBAQRJMEcwIQYIKwYBBQUHMAGGFWh0dHA6Ly9lNS5vLmxlbmNyLm9y
ZzAiBggrBgEFBQcwAoYWaHR0cDovL2U1LmkubGVuY3Iub3JnLzAxBgNVHREEKjAo
ghB3ZWJkZXYtbWVkaWEuY29tghR3d3cud2ViZGV2LW1lZGlhLmNvbTATBgNVHSAE
DDAKMAgGBmeBDAECATCCAQUGCisGAQQB1nkCBAIEgfYEgfMA8QB3AD8XS0/XIkdY
lB1lHIS+DRLtkDd/H4Vq68G/KIXs+GRuAAABkFTkK3IAAAQDAEgwRgIhAMON7+RX
NP7DZnWWItQ0ff98MZqAhJ37/NUszgZnAB0tAiEA8ZzVPPWYEhICDqktOr3+VZnt
U8xbvgkM/LSdR92PqKQAdgAZmBBxCfDWUi4wgNKeP2S7g24ozPkPUo7u385KPxa0
ygAAAZBU5Cu2AAAEAwBHMEUCIFNhNy+vq2vAkxRpIO8EA9TYqFCx+oGtHxrQWf8t
/LanAiEA2IUUMyuUmxWzga1nO366tzz3ZmZCkxjV/gVyLNHh5zgwCgYIKoZIzj0E
AwMDaAAwZQIwEzLKHVyQQmnXfik2QgC56xeTJEnu5VaH1QQHfTO3ABkd19xM50Rz
rWoEx9KmG3ZgAjEAhUEkRx/qizSxvq+Qtnsl0+3n9qvC9Ox0n+OWgisbnATDKCTC
UVPOnJt/Hfym+TTG
-----END CERTIFICATE-----
-----BEGIN CERTIFICATE-----
MIIEVzCCAj+gAwIBAgIRAIOPbGPOsTmMYgZigxXJ/d4wDQYJKoZIhvcNAQELBQAw
TzELMAkGA1UEBhMCVVMxKTAnBgNVBAoTIEludGVybmV0IFNlY3VyaXR5IFJlc2Vh
cmNoIEdyb3VwMRUwEwYDVQQDEwxJU1JHIFJvb3QgWDEwHhcNMjQwMzEzMDAwMDAw
WhcNMjcwMzEyMjM1OTU5WjAyMQswCQYDVQQGEwJVUzEWMBQGA1UEChMNTGV0J3Mg
RW5jcnlwdDELMAkGA1UEAxMCRTUwdjAQBgcqhkjOPQIBBgUrgQQAIgNiAAQNCzqK
a2GOtu/cX1jnxkJFVKtj9mZhSAouWXW0gQI3ULc/FnncmOyhKJdyIBwsz9V8UiBO
VHhbhBRrwJCuhezAUUE8Wod/Bk3U/mDR+mwt4X2VEIiiCFQPmRpM5uoKrNijgfgw
gfUwDgYDVR0PAQH/BAQDAgGGMB0GA1UdJQQWMBQGCCsGAQUFBwMCBggrBgEFBQcD
ATASBgNVHRMBAf8ECDAGAQH/AgEAMB0GA1UdDgQWBBSfK1/PPCFPnQS37SssxMZw
i9LXDTAfBgNVHSMEGDAWgBR5tFnme7bl5AFzgAiIyBpY9umbbjAyBggrBgEFBQcB
AQQmMCQwIgYIKwYBBQUHMAKGFmh0dHA6Ly94MS5pLmxlbmNyLm9yZy8wEwYDVR0g
BAwwCjAIBgZngQwBAgEwJwYDVR0fBCAwHjAcoBqgGIYWaHR0cDovL3gxLmMubGVu
Y3Iub3JnLzANBgkqhkiG9w0BAQsFAAOCAgEAH3KdNEVCQdqk0LKyuNImTKdRJY1C
2uw2SJajuhqkyGPY8C+zzsufZ+mgnhnq1A2KVQOSykOEnUbx1cy637rBAihx97r+
bcwbZM6sTDIaEriR/PLk6LKs9Be0uoVxgOKDcpG9svD33J+G9Lcfv1K9luDmSTgG
6XNFIN5vfI5gs/lMPyojEMdIzK9blcl2/1vKxO8WGCcjvsQ1nJ/Pwt8LQZBfOFyV
XP8ubAp/au3dc4EKWG9MO5zcx1qT9+NXRGdVWxGvmBFRAajciMfXME1ZuGmk3/GO
koAM7ZkjZmleyokP1LGzmfJcUd9s7eeu1/9/eg5XlXd/55GtYjAM+C4DG5i7eaNq
cm2F+yxYIPt6cbbtYVNJCGfHWqHEQ4FYStUyFnv8sjyqU8ypgZaNJ9aVcWSICLOI
E1/Qv/7oKsnZCWJ926wU6RqG1OYPGOi1zuABhLw61cuPVDT28nQS/e6z95cJXq0e
K1BcaJ6fJZsmbjRgD5p3mvEf5vdQM7MCEvU0tHbsx2I5mHHJoABHb8KVBgWp/lcX
GWiWaeOyB7RP+OfDtvi2OsapxXiV7vNVs7fMlrRjY1joKaqmmycnBvAq14AEbtyL
sVfOS66B8apkeFX2NY4XPEYV4ZSCe8VHPrdrERk2wILG3T/EGmSIkCYVUMSnjmJd
VQD9F6Na/+zmXCc=
-----END CERTIFICATE-----
`,
    key: `-----BEGIN PRIVATE KEY-----
MIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQgUTJHoszNlEO49dyh
GHYpXRTkYqTiQMM+BC4Jy6eYiAShRANCAATr0jzfkM625f0zKROwgj3yXH3vZ8Sb
wlprlW6N0jZJjW3o/LMqjabC5bRIwP0tQWH8FTeCInB+OuPH7Q/j44aV
-----END PRIVATE KEY-----
`,
  },
  app
);

httpServer.listen(80, () => {
  console.log("HTTP Server running on port 80");
});

httpsServer.listen(443, () => {
  console.log("HTTPS Server running on port 443");
});

// const start = async () => {
//   try {
//     app.listen(process.env.PORT || 3200, () => {
//       console.log("APIs are running on port 3200");
//     });
//   } catch (error) {}
// };

// start();
