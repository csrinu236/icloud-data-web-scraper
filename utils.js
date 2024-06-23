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

module.exports = {
  downloadBlobImage,
};
