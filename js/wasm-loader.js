(function () {
    "use strict";

    class WasmDsp {
        constructor() {
            this.instance = null;
            this.memory = null;
            this.ready = false;
        }

        async initialize(wasmPath) {
            if (!wasmPath) {
                console.log(
                    "WASM DSP is not configured yet."
                );

                return false;
            }

            try {
                const response = await fetch(wasmPath);

                if (!response.ok) {
                    throw new Error(
                        `WASM load failed: ${response.status}`
                    );
                }

                const bytes =
                    await response.arrayBuffer();

                const result =
                    await WebAssembly.instantiate(
                        bytes,
                        {}
                    );

                this.instance = result.instance;
                this.memory =
                    result.instance.exports.memory ||
                    null;

                this.ready = true;

                console.log(
                    "WASM DSP initialized."
                );

                return true;
            } catch (error) {
                console.warn(
                    "WASM DSP initialization skipped:",
                    error
                );

                this.ready = false;
                return false;
            }
        }

        process(samples) {
            /*
             * 이후 C DSP 함수가 구현되면
             * Float32Array PCM 데이터를
             * WASM 메모리에 전달합니다.
             */
            return samples;
        }
    }

    window.WasmDsp = WasmDsp;
})();