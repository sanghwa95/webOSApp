"use strict";

const fs = require("fs");
const path = require("path");

const projectRoot = path.resolve(__dirname, "..");
const packageDirectory = path.dirname(
    require.resolve("mpg123-decoder")
);

const sourceFile = path.join(
    packageDirectory,
    "dist",
    "mpg123-decoder.min.js"
);

const vendorDirectory = path.join(
    projectRoot,
    "vendor"
);

const outputFile = path.join(
    vendorDirectory,
    "mpg123-decoder.min.js"
);

fs.mkdirSync(
    vendorDirectory,
    {
        recursive: true
    }
);

fs.copyFileSync(
    sourceFile,
    outputFile
);

console.log(
    `Vendor preparation complete: ${outputFile}`
);
