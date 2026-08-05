(function () {
    "use strict";

    class HtmlAudioEngine {
        constructor(audioElement) {
            if (!audioElement) {
                throw new Error(
                    "HTML 오디오 요소를 찾을 수 없습니다."
                );
            }

            this.audio = audioElement;
            this.mode = "html-audio";
            this.loadToken = 0;
        }

        addEventListener(type, listener) {
            this.audio.addEventListener(
                type,
                listener
            );
        }

        removeEventListener(type, listener) {
            this.audio.removeEventListener(
                type,
                listener
            );
        }

        load(src) {
            if (!src) {
                return Promise.reject(
                    new Error(
                        "재생할 MP3 경로가 없습니다."
                    )
                );
            }

            const currentLoadToken =
                this.loadToken + 1;

            this.loadToken = currentLoadToken;
            this.audio.pause();
            this.audio.src = src;

            return new Promise((resolve, reject) => {
                const handleLoadedMetadata = () => {
                    cleanup();

                    resolve(
                        currentLoadToken ===
                        this.loadToken
                    );
                };

                const handleError = () => {
                    cleanup();

                    if (
                        currentLoadToken !==
                        this.loadToken
                    ) {
                        resolve(false);
                        return;
                    }

                    reject(
                        new Error(
                            "HTML 오디오 엔진이 MP3 파일을 불러오지 못했습니다."
                        )
                    );
                };

                const cleanup = () => {
                    this.audio.removeEventListener(
                        "loadedmetadata",
                        handleLoadedMetadata
                    );

                    this.audio.removeEventListener(
                        "error",
                        handleError
                    );
                };

                this.audio.addEventListener(
                    "loadedmetadata",
                    handleLoadedMetadata
                );

                this.audio.addEventListener(
                    "error",
                    handleError
                );

                this.audio.load();
            });
        }

        async play() {
            await this.audio.play();
        }

        resume() {
            return Promise.resolve();
        }

        pause() {
            this.audio.pause();
        }

        stop() {
            this.audio.pause();

            try {
                this.audio.currentTime = 0;
            } catch (error) {
                console.debug(
                    "HTML audio position reset skipped.",
                    error
                );
            }
        }

        seek(seconds) {
            if (!Number.isFinite(this.audio.duration)) {
                return;
            }

            this.audio.currentTime = Math.min(
                this.audio.duration,
                Math.max(0, Number(seconds) || 0)
            );
        }

        setVolume(volume) {
            this.audio.volume = Math.min(
                1,
                Math.max(0, Number(volume) || 0)
            );
        }

        setProcessorNode() {
            return false;
        }

        get currentTime() {
            return Number.isFinite(
                this.audio.currentTime
            )
                ? this.audio.currentTime
                : 0;
        }

        set currentTime(seconds) {
            this.seek(seconds);
        }

        get duration() {
            return this.audio.duration;
        }

        get paused() {
            return this.audio.paused;
        }

        get ended() {
            return this.audio.ended;
        }

        get volume() {
            return this.audio.volume;
        }

        async destroy() {
            this.loadToken += 1;
            this.stop();
            this.audio.removeAttribute("src");
            this.audio.load();
        }
    }

    window.HtmlAudioEngine = HtmlAudioEngine;
})();
