const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "../..");
const sourcePath = path.join(root, "data", "lotto_results.yaml");
const targetDirectory = path.join(__dirname, "../electron-package/data");
const targetPath = path.join(targetDirectory, "lotto_results.yaml");

fs.mkdirSync(targetDirectory, { recursive: true });
fs.copyFileSync(sourcePath, targetPath);
console.log(`Copied ${sourcePath} to ${targetPath}`);
