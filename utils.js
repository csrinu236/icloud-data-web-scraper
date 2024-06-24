const archiver = require("archiver");
const fs = require("fs");
const fsPromises = require("fs").promises;
const path = require("path");

const downloadBlobImage = async (blobUrl) => {
  const dataUrl = async (blobUrl) => {
    const response = await fetch(blobUrl);
    const blob = await response.blob();
    const reader = new FileReader();
    return new Promise((resolve) => {
      reader.onloadend = () => resolve(reader.result.split(",")[1]);
      reader.readAsDataURL(blob);
    });
  };

  // Extract the base64 encoded string from the data URL
  const base64Data = await dataUrl();

  // Write the base64 string to a file
  fs.writeFile("downloaded_image.png", base64Data, "base64", (err) => {
    if (err) {
      console.error("Failed to save image:", err);
    } else {
      console.log("Image saved successfully!");
    }
  });
};

const startZipping = async () => {
  console.log("here 3");

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
  console.log("here 4");

  console.log("Zipping Completed Enjoy...");
};

const FRAMES = {
  frame: null,
};

async function cleanPublicFolder() {
  const publicFolderPath = path.join(__dirname, "/public");
  try {
    const files = await fsPromises.readdir(publicFolderPath);
    for (const file of files) {
      const filePath = path.join(publicFolderPath, file);
      try {
        await fsPromises.unlink(filePath);
        console.log(`Deleted file: ${filePath}`);
      } catch (err) {
        console.error(`Failed to delete file: ${filePath} - ${err}`);
      }
    }
  } catch (err) {
    console.error(`Failed to list contents of directory: ${err}`);
  }
  // deleting zip file
  const zipFilePath = path.join(__dirname, "public.zip");
  console.log({ zipFilePath });
  try {
    await fsPromises.unlink(zipFilePath);
    console.log(`Deleted file: ${zipFilePath}`);
  } catch (err) {
    console.error(`Failed to delete file: ${zipFilePath} - ${err}`);
  }
}

module.exports = {
  downloadBlobImage,
  startZipping,
  FRAMES,
  cleanPublicFolder,
};
