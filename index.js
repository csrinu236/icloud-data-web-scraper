const puppeteer = require("puppeteer");

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

const apple = async () => {
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();

  try {
    // Go to iCloud login page
    await page.goto("https://www.icloud.com/", { waitUntil: "networkidle2" });

    // Wait for and type the Apple ID
    await page.waitForSelector(".sign-in-button", { timeout: 60000 });
    await page.click(".sign-in-button");

    // Wait for the iframe and switch to it
    await page.waitForSelector("iframe", { timeout: 60000 });
    const loginFrame = await page.$("iframe");
    const frame = await loginFrame.contentFrame();

    // Wait for and type the Apple ID
    await frame.waitForSelector("input#account_name_text_field", { timeout: 60000 });
    await frame.type("input#account_name_text_field", "+919867398783", { delay: 50 });
    await frame.click("button#sign-in");

    await frame.waitForSelector("#continue-password", { timeout: 60000 });
    await frame.click("#continue-password");

    // Wait for and type the password
    await frame.waitForSelector("input#password_text_field", { timeout: 60000 });
    await frame.type("input#password_text_field", "Holyshit@031", { delay: 50 });
    await frame.click("button#sign-in");

    // Wait for the OTP input (assuming 2FA is enabled)
    // await frame.waitForSelector("input#two-factor-code", { timeout: 60000 });
    // const otp = await getOtp(); // Implement this function to retrieve the OTP
    // await frame.type("input#two-factor-code", otp);
    // await frame.click("button#verify-code");

    //evaluation

    // Example: Check if login was successful (adjust based on your application)
    // const loginSuccess = await page.evaluate(() => {
    //   return document.querySelector("body").innerText.includes("Welcome");
    //   // Example check for success message
    // });
    // await frame.waitForSelector("input#two-factor-code", { timeout: 60000 });
    // await frame.waitForTimeout(30000);

    // trust button

    const delay = (time) =>
      new Promise((resolve, reject) => {
        setTimeout(() => {
          resolve("");
        }, time);
      });

    await delay(30000);

    await frame.waitForSelector("button.button-rounded-rectangle", { timeout: 60000 });
    await frame.click("button.button-rounded-rectangle", { delay: 50 });

    await page.waitForSelector("a[href='https://www.icloud.com/photos']", { timeout: 60000 });
    await page.click('a[href="https://www.icloud.com/photos"]', { delay: 50 });

    // await page.waitForNavigation({ waitUntil: "networkidle2" });
    // await page.goto("https://www.icloud.com/photos", { waitUntil: "networkidle2" });

    await page.waitForNavigation({ waitUntil: "networkidle2" });

    await page.waitForSelector("iframe", { timeout: 60000 });
    const photosiframe = await page.$$("iframe");
    console.log({ photosiframe, length: photosiframe.length });
    const photosFrame = await photosiframe[1].contentFrame();
    // console.log({ photosFrame });

    // const iframeHTML = await photosFrame.evaluate(() => document.documentElement.outerHTML);

    // console.log({ iframeHTML });

    const links = await photosFrame.$$(".grid-items .grid-item img");
    // console.log({ links });
    for (let i = 0; i < links.length; i++) {
      // const linkFrame = await link.contentFrame();
      const divSelector = `.grid-items .grid-item img:nth-child(${i + 1})`;
      console.log({ divSelector, linkI: links[i] });
      // Replace with the actual selector of the div
      await photosFrame.waitForSelector(divSelector, { timeout: 60000 });

      // Click on the <div> element
      await photosFrame.click(divSelector);
      // await links[i].click();
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

apple();
