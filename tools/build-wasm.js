"use strict";

const fs = require("fs");
const path = require("path");
const wabtFactory = require("wabt");

const projectRoot = path.resolve(__dirname, "..");
const sourceFile = path.join(
    projectRoot,
    "wasm",
    "dsp.wat"
);

const outputFile = path.join(
    projectRoot,
    "wasm",
    "dsp.wasm"
);

async function build() {
    const wabt = await wabtFactory();
    const source = fs.readFileSync(
        sourceFile,
        "utf8"
    );

    const module = wabt.parseWat(
        sourceFile,
        source
    );

    module.resolveNames();
    module.validate();

    const result = module.toBinary({
        log: false,
        write_debug_names: true
    });

    fs.writeFileSync(
        outputFile,
        Buffer.from(result.buffer)
    );

    module.destroy();

    console.log(
        `WASM build complete: ${outputFile}`
    );
}

build().catch((error) => {
    console.error(
        "WASM build failed:",
        error
    );

    process.exitCode = 1;
});
