/*
 * 파일 역할: npm에 설치된 mpg123-decoder 브라우저 번들을 vendor 폴더로 복사합니다.
 * webOS 패키지가 node_modules 없이도 MP3 WASM 디코더를 로드할 수 있게 합니다.
 */
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
