/*
 * 파일 역할: mpg123 WASM으로 MP3를 PCM으로 디코딩하고 Web Audio 그래프로 재생합니다.
 * 재생 상태, 탐색, 볼륨, 이벤트 및 DSP AudioWorklet 연결을 함께 관리합니다.
 */
(function () {
    "use strict";

    class AudioEngine {
        /** Web Audio 지원을 확인하고 재생 상태의 초기값을 설정합니다. */
        constructor() {
            const AudioContextClass =
                window.AudioContext ||
                window.webkitAudioContext;

            if (!AudioContextClass) {
                throw new Error(
                    "이 기기는 Web Audio API를 지원하지 않습니다."
                );
            }

            this.AudioContextClass = AudioContextClass;
            this.mode = "web-audio";
            this.context = null;
            this.inputNode = null;
            this.processorNode = null;
            this.beforePlayHook = null;
            this.beforePlayPromise = null;

            this.buffer = null;
            this.sourceNode = null;
            this.sourceToken = 0;
            this.loadToken = 0;
            this.loadPromise = null;

            this.offset = 0;
            this.startedAt = 0;
            this.duration = 0;
            this.paused = true;
            this.ended = false;
            this.volume = 1;

            this.listeners = new Map();
            this.timeUpdateTimer = null;
        }

        /** AudioContext와 기본 입력·출력 노드를 필요할 때 한 번 생성합니다. */
        ensureContext() {
            if (this.context) {
                return;
            }

            this.context =
                new this.AudioContextClass();

            this.inputNode =
                this.context.createGain();

            this.inputNode.connect(
                this.context.destination
            );
        }

        /** 엔진의 사용자 정의 이벤트에 리스너를 등록합니다. */
        addEventListener(type, listener) {
            if (!this.listeners.has(type)) {
                this.listeners.set(type, new Set());
            }

            this.listeners.get(type).add(listener);
        }

        /** 등록된 사용자 정의 이벤트 리스너를 제거합니다. */
        removeEventListener(type, listener) {
            const typeListeners =
                this.listeners.get(type);

            if (typeListeners) {
                typeListeners.delete(listener);
            }
        }

        /** 지정한 타입의 엔진 이벤트를 모든 등록 리스너에 전달합니다. */
        dispatchEvent(type, detail) {
            const typeListeners =
                this.listeners.get(type);

            if (!typeListeners) {
                return;
            }

            const event = {
                type,
                target: this,
                detail: detail || null
            };

            typeListeners.forEach((listener) => {
                try {
                    listener.call(this, event);
                } catch (error) {
                    console.error(
                        `AudioEngine ${type} listener failed:`,
                        error
                    );
                }
            });
        }

        /** 기존 재생을 정리하고 지정한 MP3 파일의 비동기 로딩을 시작합니다. */
        async load(src) {
            if (!src) {
                throw new Error(
                    "재생할 MP3 경로가 없습니다."
                );
            }

            this.ensureContext();

            const currentLoadToken =
                this.loadToken + 1;

            this.loadToken = currentLoadToken;

            const wasPlaying = !this.paused;

            this.stopSource();
            this.stopTimeUpdates();

            this.buffer = null;
            this.offset = 0;
            this.duration = 0;
            this.paused = true;
            this.ended = false;

            this.dispatchEvent("timeupdate");

            if (wasPlaying) {
                this.dispatchEvent("pause");
            }

            this.loadPromise = this.fetchAndDecode(
                src,
                currentLoadToken
            );

            return this.loadPromise;
        }

        /** MP3 바이트를 가져와 mpg123 WASM으로 디코딩하고 AudioBuffer로 저장합니다. */
        async fetchAndDecode(
            src,
            currentLoadToken
        ) {
            try {
                const response = await fetch(src);

                if (!response.ok) {
                    throw new Error(
                        `오디오 파일 응답 오류: ${response.status}`
                    );
                }

                const bytes =
                    await response.arrayBuffer();

                const decodedBuffer =
                    await this.decodeMpegWithWasm(
                        bytes
                    );

                if (
                    currentLoadToken !== this.loadToken
                ) {
                    return false;
                }

                this.buffer = decodedBuffer;
                this.duration = decodedBuffer.duration;

                this.dispatchEvent("loadedmetadata");
                this.dispatchEvent("canplay");

                return true;
            } catch (error) {
                if (
                    currentLoadToken === this.loadToken
                ) {
                    this.buffer = null;
                    this.duration = 0;

                    this.dispatchEvent(
                        "error",
                        error
                    );
                }

                throw error;
            }
        }

        /** MP3 바이트를 채널별 Float32 PCM으로 디코딩해 Web Audio AudioBuffer를 만듭니다. */
        async decodeMpegWithWasm(bytes) {
            const decoderLibrary =
                window["mpg123-decoder"];

            if (
                !decoderLibrary ||
                !decoderLibrary.MPEGDecoder
            ) {
                throw new Error(
                    "WASM MP3 decoder is not available."
                );
            }

            const decoder =
                new decoderLibrary.MPEGDecoder();

            try {
                await decoder.ready;

                const result = decoder.decode(
                    new Uint8Array(bytes)
                );

                if (
                    !result.channelData ||
                    result.channelData.length === 0 ||
                    result.samplesDecoded <= 0
                ) {
                    throw new Error(
                        "WASM MP3 decoder returned no PCM data."
                    );
                }

                if (
                    result.errors &&
                    result.errors.length > 0
                ) {
                    console.warn(
                        "MP3 was decoded with recoverable errors:",
                        result.errors
                    );
                }

                const channelCount = Math.min(
                    result.channelData.length,
                    2
                );

                const audioBuffer =
                    this.context.createBuffer(
                        channelCount,
                        result.samplesDecoded,
                        result.sampleRate
                    );

                for (
                    let channel = 0;
                    channel < channelCount;
                    channel += 1
                ) {
                    audioBuffer
                        .getChannelData(channel)
                        .set(
                            result.channelData[
                                channel
                            ]
                        );
                }

                console.log(
                    "MP3 decoded to PCM with WASM mpg123."
                );

                return audioBuffer;
            } finally {
                decoder.free();
            }
        }

        /** 준비된 AudioBuffer를 현재 오프셋부터 새 source 노드로 재생합니다. */
        async play() {
            const resumePromise = this.resume();

            let pendingLoad = this.loadPromise;

            while (pendingLoad) {
                await pendingLoad;

                if (pendingLoad === this.loadPromise) {
                    break;
                }

                pendingLoad = this.loadPromise;
            }

            if (!this.buffer) {
                throw new Error(
                    "재생할 오디오가 준비되지 않았습니다."
                );
            }

            if (!this.paused && this.sourceNode) {
                return;
            }

            await resumePromise;
            await this.runBeforePlayHook();

            if (this.offset >= this.duration) {
                this.offset = 0;
            }

            const source =
                this.context.createBufferSource();

            const currentSourceToken =
                this.sourceToken + 1;

            this.sourceToken = currentSourceToken;
            this.sourceNode = source;

            source.buffer = this.buffer;
            source.connect(this.inputNode);

            source.onended = () => {
                this.handleSourceEnded(
                    source,
                    currentSourceToken
                );
            };

            this.startedAt =
                this.context.currentTime -
                this.offset;

            this.paused = false;
            this.ended = false;

            source.start(0, this.offset);

            this.startTimeUpdates();
            this.dispatchEvent("play");
        }

        /** 최초 재생 직전에 실행할 DSP 초기화 함수를 등록합니다. */
        setBeforePlayHook(hook) {
            this.beforePlayHook =
                typeof hook === "function"
                    ? hook
                    : null;

            this.beforePlayPromise = null;
        }

        /** 등록된 재생 전 훅을 한 번만 실행하고 같은 Promise를 재사용합니다. */
        async runBeforePlayHook() {
            if (!this.beforePlayHook) {
                return false;
            }

            if (!this.beforePlayPromise) {
                this.beforePlayPromise =
                    Promise.resolve()
                        .then(() => {
                            return this.beforePlayHook();
                        })
                        .catch((error) => {
                            console.warn(
                                "Audio processor initialization failed. " +
                                "Playback will continue without DSP.",
                                error
                            );

                            return false;
                        });
            }

            return this.beforePlayPromise;
        }

        /** 사용자 입력 이후 AudioContext가 중지 상태라면 다시 활성화합니다. */
        async resume() {
            this.ensureContext();

            if (this.context.state === "suspended") {
                await this.context.resume();
            }
        }

        /** 현재 위치를 저장하고 source 노드를 정지해 재생을 일시정지합니다. */
        pause() {
            if (this.paused) {
                return;
            }

            this.offset = this.currentTime;
            this.paused = true;
            this.ended = false;

            this.stopSource();
            this.stopTimeUpdates();

            this.dispatchEvent("timeupdate");
            this.dispatchEvent("pause");
        }

        /** 재생을 멈추고 재생 위치를 곡의 시작으로 초기화합니다. */
        stop() {
            const wasPlaying = !this.paused;

            this.paused = true;
            this.ended = false;
            this.offset = 0;

            this.stopSource();
            this.stopTimeUpdates();

            this.dispatchEvent("timeupdate");

            if (wasPlaying) {
                this.dispatchEvent("pause");
            }
        }

        /** 재생 위치를 지정한 초로 옮기고 필요하면 새 source로 재생을 재개합니다. */
        seek(seconds) {
            if (!this.buffer) {
                return;
            }

            const nextOffset = Math.min(
                this.duration,
                Math.max(0, Number(seconds) || 0)
            );

            const shouldResume = !this.paused;

            this.offset = nextOffset;
            this.ended =
                nextOffset >= this.duration;

            if (shouldResume) {
                this.stopSource();
                this.paused = true;

                if (this.ended) {
                    this.stopTimeUpdates();
                    this.dispatchEvent("timeupdate");
                    this.dispatchEvent("ended");
                } else {
                    this.play().catch((error) => {
                        this.dispatchEvent(
                            "error",
                            error
                        );
                    });
                }
            } else {
                this.dispatchEvent("timeupdate");
            }
        }

        /** 볼륨을 0~1 범위로 제한해 DSP PCM 프로세서에 전달합니다. */
        setVolume(volume) {
            const safeVolume = Math.min(
                1,
                Math.max(0, Number(volume) || 0)
            );

            this.volume = safeVolume;

            const processorGain =
                this.processorNode &&
                this.processorNode.parameters
                    ? this.processorNode.parameters.get(
                        "gain"
                    )
                    : null;

            if (processorGain && this.context) {
                processorGain.setValueAtTime(
                    safeVolume,
                    this.context.currentTime
                );
            }
        }

        /** 오디오 입력과 출력 사이에 PCM 처리용 AudioWorkletNode를 연결합니다. */
        setProcessorNode(processorNode) {
            this.ensureContext();
            this.inputNode.disconnect();

            if (this.processorNode) {
                this.processorNode.disconnect();
            }

            this.processorNode = processorNode || null;

            if (this.processorNode) {
                this.inputNode.connect(
                    this.processorNode
                );

                this.processorNode.connect(
                    this.context.destination
                );
            } else {
                this.inputNode.connect(
                    this.context.destination
                );
            }

            this.setVolume(this.volume);
        }

        /** 저장된 오프셋과 AudioContext 시간을 이용해 현재 재생 위치를 계산합니다. */
        get currentTime() {
            if (this.paused) {
                return this.offset;
            }

            return Math.min(
                this.duration,
                Math.max(
                    0,
                    (
                        this.context
                            ? this.context.currentTime
                            : this.startedAt
                    ) -
                    this.startedAt
                )
            );
        }

        /** currentTime 대입을 seek 호출로 변환합니다. */
        set currentTime(seconds) {
            this.seek(seconds);
        }

        /** UI 갱신용 timeupdate 이벤트를 250ms 간격으로 발생시킵니다. */
        startTimeUpdates() {
            this.stopTimeUpdates();

            this.timeUpdateTimer = window.setInterval(
                () => {
                    this.dispatchEvent("timeupdate");
                },
                250
            );
        }

        /** 실행 중인 timeupdate 타이머를 해제합니다. */
        stopTimeUpdates() {
            if (this.timeUpdateTimer !== null) {
                window.clearInterval(
                    this.timeUpdateTimer
                );

                this.timeUpdateTimer = null;
            }
        }

        /** 현재 AudioBufferSourceNode를 안전하게 정지하고 연결을 해제합니다. */
        stopSource() {
            this.sourceToken += 1;

            if (!this.sourceNode) {
                return;
            }

            const source = this.sourceNode;

            this.sourceNode = null;
            source.onended = null;

            try {
                source.stop();
            } catch (error) {
                console.debug(
                    "Audio source was already stopped.",
                    error
                );
            }

            source.disconnect();
        }

        /** 현재 source가 자연 종료된 경우 엔진 상태를 갱신하고 ended 이벤트를 보냅니다. */
        handleSourceEnded(
            source,
            currentSourceToken
        ) {
            if (
                source !== this.sourceNode ||
                currentSourceToken !== this.sourceToken
            ) {
                return;
            }

            this.sourceNode = null;
            this.offset = this.duration;
            this.paused = true;
            this.ended = true;

            source.disconnect();
            this.stopTimeUpdates();

            this.dispatchEvent("timeupdate");
            this.dispatchEvent("ended");
        }

        /** 모든 노드와 타이머, 버퍼, AudioContext 및 이벤트 리스너를 정리합니다. */
        async destroy() {
            this.stop();
            this.loadToken += 1;
            this.buffer = null;

            if (this.inputNode) {
                this.inputNode.disconnect();
            }

            if (this.processorNode) {
                this.processorNode.disconnect();
            }

            if (
                this.context &&
                this.context.state !== "closed"
            ) {
                await this.context.close();
            }

            this.listeners.clear();
        }
    }

    window.AudioEngine = AudioEngine;
})();
