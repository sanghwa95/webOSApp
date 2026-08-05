(function () {
    "use strict";

    class WasmDsp {
        constructor(audioEngine) {
            this.audioEngine = audioEngine;
            this.node = null;
            this.ready = false;
            this.wasmReady = false;
            this.initializationPromise = null;
        }

        initialize(options) {
            if (
                !this.audioEngine ||
                this.audioEngine.mode !== "web-audio"
            ) {
                return Promise.resolve(false);
            }

            if (this.ready) {
                return Promise.resolve(true);
            }

            if (!this.initializationPromise) {
                this.initializationPromise =
                    this.initializeProcessor(
                        options || {}
                    );
            }

            return this.initializationPromise;
        }

        async initializeProcessor(options) {
            const wasmPath =
                options.wasmPath ||
                "wasm/dsp.wasm";

            const workletPath =
                options.workletPath ||
                "js/dsp-worklet.js";

            this.audioEngine.ensureContext();

            const context =
                this.audioEngine.context;

            if (
                !context.audioWorklet ||
                typeof AudioWorkletNode ===
                    "undefined"
            ) {
                console.warn(
                    "AudioWorklet is not supported. " +
                    "Playback will continue without PCM interception."
                );

                return false;
            }

            const wasmUrl =
                new URL(
                    wasmPath,
                    window.location.href
                ).href;

            const workletUrl =
                new URL(
                    workletPath,
                    window.location.href
                ).href;

            const response = await fetch(wasmUrl);

            if (
                !response.ok &&
                response.status !== 0
            ) {
                throw new Error(
                    `WASM load failed: ${response.status}`
                );
            }

            const wasmBytes =
                await response.arrayBuffer();

            await WebAssembly.compile(wasmBytes);
            await context.audioWorklet.addModule(
                workletUrl
            );

            this.node = new AudioWorkletNode(
                context,
                "astnova-pcm-processor",
                {
                    numberOfInputs: 1,
                    numberOfOutputs: 1,
                    outputChannelCount: [2],
                    processorOptions: {
                        wasmBytes
                    }
                }
            );

            this.node.port.onmessage = (event) => {
                this.handleWorkletMessage(
                    event.data
                );
            };

            this.node.onprocessorerror = (error) => {
                console.error(
                    "DSP AudioWorklet processor failed:",
                    error
                );
            };

            this.audioEngine.setProcessorNode(
                this.node
            );

            this.ready = true;

            console.log(
                "PCM interception node connected."
            );

            return true;
        }

        handleWorkletMessage(message) {
            if (!message || !message.type) {
                return;
            }

            if (message.type === "wasm-ready") {
                this.wasmReady = true;

                console.log(
                    "WASM PCM processor is ready."
                );

                return;
            }

            if (message.type === "wasm-error") {
                this.wasmReady = false;

                console.error(
                    "WASM PCM processor initialization failed:",
                    message.message
                );
            }
        }
    }

    window.WasmDsp = WasmDsp;
})();
