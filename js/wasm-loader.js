/*
 * 파일 역할: DSP WASM과 AudioWorklet 모듈을 불러와 Web Audio 엔진 중간에 연결합니다.
 * Worklet의 준비·오류 메시지도 받아 DSP 초기화 상태를 관리합니다.
 */
(function () {
    "use strict";

    class WasmDsp {
        /** DSP 노드를 연결할 오디오 엔진과 초기화 상태를 저장합니다. */
        constructor(audioEngine) {
            this.audioEngine = audioEngine;
            this.node = null;
            this.ready = false;
            this.wasmReady = false;
            this.initializationPromise = null;
        }

        /** 지원 환경을 확인하고 DSP 초기화를 한 번만 실행합니다. */
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

        /** WASM과 Worklet을 로드해 AudioWorkletNode를 만들고 오디오 그래프에 연결합니다. */
        async initializeProcessor(options) {
            const wasmPath =
                options.wasmPath ||
                "wasm/dsp.wasm?v=0.0.3";

            const workletPath =
                options.workletPath ||
                "js/dsp-worklet.js?v=0.0.5";

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

            // Worklet이 보낸 WASM 준비 또는 오류 메시지를 전달합니다.
            this.node.port.onmessage = (event) => {
                this.handleWorkletMessage(
                    event.data
                );
            };

            // 오디오 렌더링 프로세서의 실행 오류를 콘솔에 기록합니다.
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

        /** Worklet의 상태 메시지를 해석해 WASM 준비 여부를 갱신합니다. */
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
