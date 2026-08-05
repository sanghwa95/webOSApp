(function () {
    "use strict";

    class AudioEngine {
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
            this.gainNode = null;
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

        ensureContext() {
            if (this.context) {
                return;
            }

            this.context =
                new this.AudioContextClass();

            this.inputNode =
                this.context.createGain();

            this.gainNode =
                this.context.createGain();

            this.gainNode.gain.setValueAtTime(
                this.volume,
                this.context.currentTime
            );

            this.inputNode.connect(this.gainNode);
            this.gainNode.connect(
                this.context.destination
            );
        }

        addEventListener(type, listener) {
            if (!this.listeners.has(type)) {
                this.listeners.set(type, new Set());
            }

            this.listeners.get(type).add(listener);
        }

        removeEventListener(type, listener) {
            const typeListeners =
                this.listeners.get(type);

            if (typeListeners) {
                typeListeners.delete(listener);
            }
        }

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

        setBeforePlayHook(hook) {
            this.beforePlayHook =
                typeof hook === "function"
                    ? hook
                    : null;

            this.beforePlayPromise = null;
        }

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

        async resume() {
            this.ensureContext();

            if (this.context.state === "suspended") {
                await this.context.resume();
            }
        }

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

        setVolume(volume) {
            const safeVolume = Math.min(
                1,
                Math.max(0, Number(volume) || 0)
            );

            this.volume = safeVolume;

            if (this.gainNode && this.context) {
                this.gainNode.gain.setValueAtTime(
                    safeVolume,
                    this.context.currentTime
                );
            }
        }

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
                    this.gainNode
                );
            } else {
                this.inputNode.connect(this.gainNode);
            }
        }

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

        set currentTime(seconds) {
            this.seek(seconds);
        }

        startTimeUpdates() {
            this.stopTimeUpdates();

            this.timeUpdateTimer = window.setInterval(
                () => {
                    this.dispatchEvent("timeupdate");
                },
                250
            );
        }

        stopTimeUpdates() {
            if (this.timeUpdateTimer !== null) {
                window.clearInterval(
                    this.timeUpdateTimer
                );

                this.timeUpdateTimer = null;
            }
        }

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

        async destroy() {
            this.stop();
            this.loadToken += 1;
            this.buffer = null;

            if (this.inputNode) {
                this.inputNode.disconnect();
            }

            if (this.gainNode) {
                this.gainNode.disconnect();
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
