/*
 * 파일 역할: Web Audio를 사용할 수 없을 때 HTMLAudioElement로 재생하는 수동 대체 엔진입니다.
 * ?audioEngine=html 옵션에서만 사용하며 DSP PCM 처리 경로는 제공하지 않습니다.
 */
(function () {
    "use strict";

    class HtmlAudioEngine {
        /** 사용할 HTMLAudioElement를 검증하고 대체 엔진 상태를 초기화합니다. */
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

        /** 오디오 요소에 이벤트 리스너를 등록합니다. */
        addEventListener(type, listener) {
            this.audio.addEventListener(
                type,
                listener
            );
        }

        /** 오디오 요소에서 이벤트 리스너를 제거합니다. */
        removeEventListener(type, listener) {
            this.audio.removeEventListener(
                type,
                listener
            );
        }

        /** 지정한 MP3 경로를 HTMLAudioElement에 설정하고 메타데이터 로드를 기다립니다. */
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
                /** 메타데이터가 준비되면 임시 리스너를 제거하고 로드 성공을 알립니다. */
                const handleLoadedMetadata = () => {
                    cleanup();

                    resolve(
                        currentLoadToken ===
                        this.loadToken
                    );
                };

                /** 현재 로드 요청에서 오류가 발생하면 정리 후 실패를 전달합니다. */
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

                /** 한 번만 필요한 로드 완료·오류 리스너를 모두 제거합니다. */
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

        /** HTML 오디오 요소의 비동기 재생을 시작합니다. */
        async play() {
            await this.audio.play();
        }

        /** Web Audio 호환 인터페이스를 위해 즉시 완료되는 Promise를 반환합니다. */
        resume() {
            return Promise.resolve();
        }

        /** HTML 오디오 재생을 일시정지합니다. */
        pause() {
            this.audio.pause();
        }

        /** 재생을 멈추고 가능한 경우 재생 위치를 0초로 되돌립니다. */
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

        /** 재생 가능한 범위 안에서 HTML 오디오의 현재 위치를 변경합니다. */
        seek(seconds) {
            if (!Number.isFinite(this.audio.duration)) {
                return;
            }

            this.audio.currentTime = Math.min(
                this.audio.duration,
                Math.max(0, Number(seconds) || 0)
            );
        }

        /** 볼륨을 0~1 범위로 제한해 HTML 오디오 요소에 적용합니다. */
        setVolume(volume) {
            this.audio.volume = Math.min(
                1,
                Math.max(0, Number(volume) || 0)
            );
        }

        /** HTML Audio 엔진은 DSP 노드를 지원하지 않으므로 실패 상태를 반환합니다. */
        setProcessorNode() {
            return false;
        }

        /** 유효한 현재 재생 시간을 반환하고 값이 없으면 0을 반환합니다. */
        get currentTime() {
            return Number.isFinite(
                this.audio.currentTime
            )
                ? this.audio.currentTime
                : 0;
        }

        /** currentTime 대입을 seek 호출로 변환합니다. */
        set currentTime(seconds) {
            this.seek(seconds);
        }

        /** HTML 오디오 요소가 보고한 전체 재생 시간을 반환합니다. */
        get duration() {
            return this.audio.duration;
        }

        /** 현재 일시정지 여부를 반환합니다. */
        get paused() {
            return this.audio.paused;
        }

        /** 현재 곡이 끝났는지 반환합니다. */
        get ended() {
            return this.audio.ended;
        }

        /** 현재 HTML 오디오 볼륨을 반환합니다. */
        get volume() {
            return this.audio.volume;
        }

        /** 재생을 중지하고 src를 제거해 오디오 리소스를 정리합니다. */
        async destroy() {
            this.loadToken += 1;
            this.stop();
            this.audio.removeAttribute("src");
            this.audio.load();
        }
    }

    window.HtmlAudioEngine = HtmlAudioEngine;
})();
