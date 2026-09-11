/*
 * 파일 역할: Web Audio 렌더링 스레드에서 PCM 블록을 받아 DSP WASM으로 전달합니다.
 * WASM 처리 결과를 출력 버퍼에 기록하며, 초기화 실패 시 원본 PCM을 통과시킵니다.
 */
"use strict";

const MAX_CHANNELS = 2;
const MAX_FRAMES = 128;
const MAX_SAMPLES =
    MAX_CHANNELS * MAX_FRAMES;

class AstnovaPcmProcessor
    extends AudioWorkletProcessor {

    /** 메인 스레드의 볼륨 값을 오디오 블록 단위로 안전하게 전달받습니다. */
    static get parameterDescriptors() {
        return [
            {
                name: "gain",
                defaultValue: 1,
                minValue: 0,
                maxValue: 1,
                automationRate: "k-rate"
            }
        ];
    }

    /** 전달받은 WASM 바이트를 인스턴스화하고 공유 PCM 메모리 뷰를 준비합니다. */
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

            if (
                typeof this.instance.exports
                    ._initialize === "function"
            ) {
                this.instance.exports._initialize();
            }

            this.memory =
                this.instance.exports.memory;

            // wasm 함수 호출
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
    /** 입력 PCM을 WASM에서 처리한 뒤 Web Audio 출력 버퍼에 기록합니다. */
    process(inputs, outputs, parameters) {
        const input = inputs[0];
        const output = outputs[0];
        const gainValues = parameters.gain;
        const gain =
            gainValues && gainValues.length > 0
                ? gainValues[0]
                : 1;

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

        // wasm 함수 호출
        this.instance.exports.process_pcm(
            frameCount,
            channelCount,
            gain
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

    /** WASM 메모리가 변경되었을 때 PCM용 Float32Array 뷰를 다시 생성합니다. */
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

    /** DSP를 사용할 수 없을 때 입력 채널을 출력 채널로 그대로 복사합니다. */
    copyInputToOutput(input, output) {
        for (
            let channel = 0;
            channel < output.length;
            channel += 1
        ) {
            const source =
                input[channel] || input[0];

            if (source) {
                const destination = output[channel];

                for (
                    let frame = 0;
                    frame < destination.length;
                    frame += 1
                ) {
                    destination[frame] =
                        source[frame];
                }
            } else {
                output[channel].fill(0);
            }
        }
    }

    /** 출력 가능한 PCM 버퍼의 모든 채널을 무음으로 초기화합니다. */
    clearOutput(output) {
        if (!output) {
            return;
        }

        // 각 출력 채널을 0으로 채우는 콜백입니다.
        output.forEach((channel) => {
            channel.fill(0);
        });
    }
}

registerProcessor(
    "astnova-pcm-processor",
    AstnovaPcmProcessor
);
