/*
 * 파일 역할: native/dsp.c를 Emscripten으로 컴파일해 실행 가능한 DSP WASM을 만듭니다.
 */
"use strict";

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const projectRoot = path.resolve(__dirname, "..");
const sourceFile = path.join(
    projectRoot,
    "native",
    "dsp.c"
);

const outputFile = path.join(
    projectRoot,
    "wasm",
    "dsp.wasm"
);

/** 운영체제에 따라 컴파일러를 셸로 실행할지 결정합니다. */
function shouldUseShell() {
    const isWin = process.platform === "win32";
    const isMac = process.platform === "darwin";
    const isLinux = process.platform === "linux";

    if (isWin) {
        // Windows의 emcc는 일반적으로 emcc.bat이므로 cmd.exe가 필요합니다.
        return true;
    } else if (isMac) {
        // macOS에서는 실행 가능한 emcc 스크립트를 직접 실행합니다.
        return false;
    } else if (isLinux) {
        // Linux에서는 실행 가능한 emcc 스크립트를 직접 실행합니다.
        return false;
    }

    throw new Error(
        `Unsupported operating system: ${process.platform}`
    );
}

/** emsdk 경로가 제공된 경우 emcc가 사용할 설정 파일도 자식 프로세스에 전달합니다. */
function createCompilerEnvironment() {
    const environment = { ...process.env };

    if (!environment.EM_CONFIG && environment.EMSDK) {
        const configFile = path.join(
            environment.EMSDK,
            ".emscripten"
        );

        if (fs.existsSync(configFile)) {
            environment.EM_CONFIG = configFile;
        }
    }

    return environment;
}

/** 생성된 WASM의 ABI와 PCM gain 연산을 실행해 C 빌드 결과를 검증합니다. */
function validateWasm(bytes) {
    const module = new WebAssembly.Module(bytes);
    const imports = WebAssembly.Module.imports(module);

    if (imports.length > 0) {
        throw new Error(
            "DSP WASM must not require runtime imports."
        );
    }

    const instance = new WebAssembly.Instance(
        module,
        {}
    );

    const exports = instance.exports;

    if (
        !(exports.memory instanceof WebAssembly.Memory) ||
        typeof exports.get_sample_buffer !== "function" ||
        typeof exports.process_pcm !== "function"
    ) {
        throw new Error(
            "DSP WASM exports are incomplete."
        );
    }

    if (typeof exports._initialize === "function") {
        exports._initialize();
    }

    const samples = new Float32Array(
        exports.memory.buffer,
        exports.get_sample_buffer(),
        2
    );

    samples.set([1, -0.5]);
    exports.process_pcm(2, 1, 0.5);

    if (
        Math.abs(samples[0] - 0.5) > 0.000001 ||
        Math.abs(samples[1] + 0.25) > 0.000001
    ) {
        throw new Error(
            "DSP WASM PCM gain validation failed."
        );
    }
}

/** C 소스를 최적화된 독립 WASM으로 컴파일하고 검증된 결과만 배포 경로에 저장합니다. */
function build() {
    const compiler = "emcc";
    const argumentsList = [
        sourceFile,
        "-O3",
        "--no-entry",
        "-sSTANDALONE_WASM=1",
        "-sEXPORTED_FUNCTIONS=_get_sample_buffer,_process_pcm",
        "-sINITIAL_MEMORY=131072",
        "-sSTACK_SIZE=32768",
        "-sALLOW_MEMORY_GROWTH=0",
        "-o",
        outputFile
    ];

    const result = spawnSync(
        compiler,
        argumentsList,
        {
            cwd: projectRoot,
            env: createCompilerEnvironment(),
            shell: shouldUseShell(),
            stdio: "inherit"
        }
    );

    if (result.error) {
        throw new Error(
            "Emscripten emcc를 실행할 수 없습니다. " +
            "emsdk를 설치·활성화하거나 EMCC 환경 변수를 설정하세요.",
            { cause: result.error }
        );
    }

    if (result.status !== 0) {
        throw new Error(
            `Emscripten build failed with exit code ${result.status}.`
        );
    }

    const bytes = fs.readFileSync(outputFile);

    validateWasm(bytes);

    console.log(
        `C to WASM build complete: ${outputFile}`
    );
}

try {
    build();
} catch (error) {
    console.error(
        "WASM build failed:",
        error
    );

    process.exitCode = 1;
}
