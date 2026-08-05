"use strict";

const MAX_CHANNELS = 2;
const MAX_FRAMES = 128;
const MAX_SAMPLES =
    MAX_CHANNELS * MAX_FRAMES;

class AstnovaPcmProcessor
    extends AudioWorkletProcessor {

    constructor(options) {
        super();

        this.instance = null;
        this.memory = null;
        this.samplePointer = 0;
        this.sampleView = null;

        try {
            const wasmBytes =
                options.processorOptions.wasmBytes;

            const wasmModule =
                new WebAssembly.Module(wasmBytes);

            this.instance =
                new WebAssembly.Instance(
                    wasmModule,
                    {}
                );

            this.memory =
                this.instance.exports.memory;

            this.samplePointer =
                this.instance.exports
                    .get_sample_buffer();

            this.refreshSampleView();

            this.port.postMessage({
                type: "wasm-ready"
            });
        } catch (error) {
            this.port.postMessage({
                type: "wasm-error",
                message:
                    error instanceof Error
                        ? error.message
                        : String(error)
            });
        }
    }

    process(inputs, outputs) {
        const input = inputs[0];
        const output = outputs[0];

        if (
            !input ||
            input.length === 0 ||
            !output ||
            output.length === 0
        ) {
            this.clearOutput(output);
            return true;
        }

        const frameCount = output[0].length;
        const channelCount = Math.min(
            input.length,
            output.length,
            MAX_CHANNELS
        );

        if (
            !this.instance ||
            frameCount > MAX_FRAMES ||
            channelCount === 0
        ) {
            this.copyInputToOutput(
                input,
                output
            );

            return true;
        }

        this.refreshSampleView();

        for (
            let channel = 0;
            channel < channelCount;
            channel += 1
        ) {
            const offset =
                channel * frameCount;

            this.sampleView.set(
                input[channel],
                offset
            );
        }

        this.instance.exports.process_pcm(
            frameCount,
            channelCount
        );

        for (
            let channel = 0;
            channel < output.length;
            channel += 1
        ) {
            const sourceChannel =
                channel < channelCount
                    ? channel
                    : 0;

            const offset =
                sourceChannel * frameCount;

            output[channel].set(
                this.sampleView.subarray(
                    offset,
                    offset + frameCount
                )
            );
        }

        return true;
    }

    refreshSampleView() {
        if (
            this.sampleView &&
            this.sampleView.buffer ===
                this.memory.buffer
        ) {
            return;
        }

        this.sampleView = new Float32Array(
            this.memory.buffer,
            this.samplePointer,
            MAX_SAMPLES
        );
    }

    copyInputToOutput(input, output) {
        for (
            let channel = 0;
            channel < output.length;
            channel += 1
        ) {
            const source =
                input[channel] || input[0];

            if (source) {
                output[channel].set(source);
            } else {
                output[channel].fill(0);
            }
        }
    }

    clearOutput(output) {
        if (!output) {
            return;
        }

        output.forEach((channel) => {
            channel.fill(0);
        });
    }
}

registerProcessor(
    "astnova-pcm-processor",
    AstnovaPcmProcessor
);
