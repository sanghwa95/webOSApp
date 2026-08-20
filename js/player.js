/*
 * 파일 역할: 오디오 엔진을 화면 UI와 연결하는 MP3 플레이어 컨트롤러입니다.
 * 재생 목록, 곡 선택, 재생 제어, 탐색, 볼륨 및 상태 표시를 관리합니다.
 */
(function () {
    "use strict";

    class Mp3Player {
        /** 오디오 엔진과 플레이어 UI 요소를 저장하고 이벤트 핸들러를 바인딩합니다. */
        constructor(options) {
            this.audioEngine = options.audioEngine;
            this.playlistElement = options.playlistElement;
            this.trackTitleElement = options.trackTitleElement;
            this.trackArtistElement = options.trackArtistElement;
            this.currentTimeElement = options.currentTimeElement;
            this.durationElement = options.durationElement;
            this.seekBar = options.seekBar;
            this.volumeBar = options.volumeBar;
            this.volumeValueElement = options.volumeValueElement;
            this.playButton = options.playButton;
            this.previousButton = options.previousButton;
            this.nextButton = options.nextButton;
            this.stopButton = options.stopButton;
            this.statusElement = options.statusElement;
            this.messageElement = options.messageElement;
            this.albumArtElement = options.albumArtElement;
            this.albumInitialElement = options.albumInitialElement;

            this.tracks = [];
            this.currentTrackIndex = -1;
            this.loadedTrackIndex = -1;
            this.isSeeking = false;

            this.handleTimeUpdate =
                this.handleTimeUpdate.bind(this);

            this.handleLoadedMetadata =
                this.handleLoadedMetadata.bind(this);

            this.handleTrackEnded =
                this.handleTrackEnded.bind(this);

            this.handleAudioError =
                this.handleAudioError.bind(this);
        }

        /** 트랙 목록을 검증하고 UI·이벤트·초기 선택 곡과 볼륨을 준비합니다. */
        initialize(tracks) {
            if (!Array.isArray(tracks) || tracks.length === 0) {
                throw new Error(
                    "재생 목록에 하나 이상의 음악이 필요합니다."
                );
            }

            this.tracks = tracks;

            this.renderPlaylist();
            this.attachEvents();

            this.setVolume(
                Number(this.volumeBar.value) / 100
            );

            const firstTrack =
                this.selectTrack(0);

            this.setMessage(
                `${firstTrack.title}을(를) 재생하려면 재생 버튼을 누르세요.`,
                false
            );

            this.updatePlayingState(false);
        }

        /** 화면 컨트롤과 오디오 엔진 이벤트를 플레이어 동작에 연결합니다. */
        attachEvents() {
            this.playButton.addEventListener(
                "click",
                () => this.togglePlay()
            );

            this.previousButton.addEventListener(
                "click",
                () => this.playPrevious()
            );

            this.nextButton.addEventListener(
                "click",
                () => this.playNext()
            );

            this.stopButton.addEventListener(
                "click",
                () => this.stop()
            );

            this.seekBar.addEventListener(
                "input",
                () => {
                    this.isSeeking = true;
                    this.previewSeek();
                }
            );

            this.seekBar.addEventListener(
                "change",
                () => {
                    this.seek();
                    this.isSeeking = false;
                }
            );

            this.volumeBar.addEventListener(
                "input",
                () => {
                    this.setVolume(
                        Number(this.volumeBar.value) / 100
                    );
                }
            );

            this.audioEngine.addEventListener(
                "timeupdate",
                this.handleTimeUpdate
            );

            this.audioEngine.addEventListener(
                "loadedmetadata",
                this.handleLoadedMetadata
            );

            this.audioEngine.addEventListener(
                "ended",
                this.handleTrackEnded
            );

            this.audioEngine.addEventListener(
                "error",
                this.handleAudioError
            );

            this.audioEngine.addEventListener(
                "play",
                () => this.updatePlayingState(true)
            );

            this.audioEngine.addEventListener(
                "pause",
                () => {
                    if (!this.audioEngine.ended) {
                        this.updatePlayingState(false);
                    }
                }
            );
        }

        /** 트랙 배열을 선택 가능한 재생 목록 버튼으로 렌더링합니다. */
        renderPlaylist() {
            this.playlistElement.innerHTML = "";

            this.tracks.forEach((track, index) => {
                const item = document.createElement("li");
                const button = document.createElement("button");

                item.className = "playlist-item";

                button.type = "button";
                button.className =
                    "playlist-button focusable playlist-focusable";

                button.dataset.trackIndex = String(index);

                button.innerHTML = `
                    <span class="track-number">
                        ${String(index + 1).padStart(2, "0")}
                    </span>

                    <span class="track-text">
                        <span class="track-name">
                            ${this.escapeHtml(track.title)}
                        </span>

                        <span class="track-artist">
                            ${this.escapeHtml(
                                track.artist || "Unknown Artist"
                            )}
                        </span>
                    </span>
                `;

                button.addEventListener("click", () => {
                    this.loadTrack(index, true);
                });

                item.appendChild(button);
                this.playlistElement.appendChild(item);
            });
        }

        /** 현재 곡 인덱스와 곡 정보 UI를 변경하고 선택된 트랙을 반환합니다. */
        selectTrack(index) {
            if (
                index < 0 ||
                index >= this.tracks.length
            ) {
                return null;
            }

            const track = this.tracks[index];

            this.currentTrackIndex = index;
            this.loadedTrackIndex = -1;

            this.trackTitleElement.textContent =
                track.title;

            this.trackArtistElement.textContent =
                track.artist || "Unknown Artist";

            this.albumInitialElement.textContent =
                this.getTrackInitial(track.title);

            this.currentTimeElement.textContent = "00:00";
            this.durationElement.textContent = "00:00";
            this.seekBar.value = "0";

            this.highlightCurrentTrack();

            return track;
        }

        /** 지정한 트랙을 오디오 엔진에 로드하고 요청에 따라 바로 재생합니다. */
        async loadTrack(index, autoPlay) {
            const track = this.selectTrack(index);

            if (!track) {
                return;
            }

            const resumePromise = autoPlay
                ? this.audioEngine.resume()
                : Promise.resolve();

            this.setMessage(
                `${track.title}을(를) 불러오는 중입니다.`,
                false
            );

            try {
                const loaded =
                    await this.audioEngine.load(
                        track.src
                    );

                if (
                    !loaded ||
                    this.currentTrackIndex !== index
                ) {
                    return;
                }

                this.loadedTrackIndex = index;

                this.setMessage(
                    `${track.title}을(를) 불러왔습니다.`,
                    false
                );

                if (autoPlay) {
                    await resumePromise;
                    await this.play();
                } else {
                    this.updatePlayingState(false);
                }
            } catch (error) {
                if (this.currentTrackIndex === index) {
                    console.error(
                        "Track loading failed:",
                        error
                    );
                }
            }
        }

        /** 선택한 곡이 준비되지 않았으면 로드한 뒤 오디오 엔진 재생을 시작합니다. */
        async play() {
            if (this.currentTrackIndex < 0) {
                this.selectTrack(0);
            }

            if (
                this.loadedTrackIndex !==
                this.currentTrackIndex
            ) {
                await this.loadTrack(
                    this.currentTrackIndex,
                    true
                );

                return;
            }

            try {
                await this.audioEngine.play();
            } catch (error) {
                console.error("Audio play failed:", error);

                this.setMessage(
                    "음악을 재생하지 못했습니다. 파일 경로와 형식을 확인하세요.",
                    true
                );
            }
        }

        /** 오디오 엔진에 일시정지를 요청합니다. */
        pause() {
            this.audioEngine.pause();
        }

        /** 현재 상태에 따라 재생과 일시정지를 전환합니다. */
        togglePlay() {
            if (this.audioEngine.paused) {
                this.play();
            } else {
                this.pause();
            }
        }

        /** 재생을 중지하고 시간·상태 UI를 시작 상태로 되돌립니다. */
        stop() {
            this.audioEngine.stop();

            this.seekBar.value = "0";
            this.currentTimeElement.textContent = "00:00";

            this.updatePlayingState(false);
            this.statusElement.textContent = "정지";

            this.setMessage("재생을 정지했습니다.", false);
        }

        /** 현재 곡의 이전 트랙을 순환 방식으로 선택해 재생합니다. */
        playPrevious() {
            const previousIndex =
                (
                    this.currentTrackIndex - 1 +
                    this.tracks.length
                ) % this.tracks.length;

            this.loadTrack(previousIndex, true);
        }

        /** 현재 곡의 다음 트랙을 순환 방식으로 선택해 재생합니다. */
        playNext() {
            const nextIndex =
                (this.currentTrackIndex + 1) %
                this.tracks.length;

            this.loadTrack(nextIndex, true);
        }

        /** 현재 위치에서 지정한 초만큼 뒤로 이동합니다. */
        seekBackward(seconds) {
            if (!Number.isFinite(
                this.audioEngine.duration
            )) {
                return;
            }

            this.audioEngine.currentTime = Math.max(
                0,
                this.audioEngine.currentTime - seconds
            );
        }

        /** 현재 위치에서 지정한 초만큼 앞으로 이동합니다. */
        seekForward(seconds) {
            if (!Number.isFinite(
                this.audioEngine.duration
            )) {
                return;
            }

            this.audioEngine.currentTime = Math.min(
                this.audioEngine.duration,
                this.audioEngine.currentTime + seconds
            );
        }

        /** 탐색 바를 드래그하는 동안 실제 이동 전 예상 시간을 표시합니다. */
        previewSeek() {
            if (!Number.isFinite(
                this.audioEngine.duration
            )) {
                return;
            }

            const ratio =
                Number(this.seekBar.value) /
                Number(this.seekBar.max);

            const previewTime =
                ratio * this.audioEngine.duration;

            this.currentTimeElement.textContent =
                this.formatTime(previewTime);
        }

        /** 탐색 바 비율을 실제 재생 시간으로 변환해 엔진에 적용합니다. */
        seek() {
            if (!Number.isFinite(
                this.audioEngine.duration
            )) {
                return;
            }

            const ratio =
                Number(this.seekBar.value) /
                Number(this.seekBar.max);

            this.audioEngine.currentTime =
                ratio * this.audioEngine.duration;
        }

        /** 볼륨을 안전한 범위로 제한해 엔진과 UI에 함께 적용합니다. */
        setVolume(volume) {
            const safeVolume = Math.min(
                1,
                Math.max(0, volume)
            );

            this.audioEngine.setVolume(safeVolume);

            const percent = Math.round(
                safeVolume * 100
            );

            this.volumeBar.value = String(percent);
            this.volumeValueElement.textContent =
                `${percent}%`;
        }

        /** 현재 볼륨에 상대적인 변화량을 더해 볼륨을 조절합니다. */
        changeVolume(amount) {
            this.setVolume(
                this.audioEngine.volume + amount
            );
        }

        /** 엔진의 현재 재생 시간을 시간 문자열과 탐색 바에 반영합니다. */
        handleTimeUpdate() {
            if (!this.isSeeking) {
                if (
                    Number.isFinite(
                        this.audioEngine.duration
                    ) &&
                    this.audioEngine.duration > 0
                ) {
                    const ratio =
                        this.audioEngine.currentTime /
                        this.audioEngine.duration;

                    this.seekBar.value = String(
                        Math.round(
                            ratio *
                            Number(this.seekBar.max)
                        )
                    );
                }

                this.currentTimeElement.textContent =
                    this.formatTime(
                        this.audioEngine.currentTime
                    );
            }
        }

        /** 곡 메타데이터가 준비되면 전체 재생 시간을 표시합니다. */
        handleLoadedMetadata() {
            this.durationElement.textContent =
                this.formatTime(
                    this.audioEngine.duration
                );
        }

        /** 현재 곡이 끝나면 다음 곡을 자동 재생합니다. */
        handleTrackEnded() {
            this.playNext();
        }

        /** 오디오 오류를 기록하고 사용자에게 실패 상태를 표시합니다. */
        handleAudioError() {
            const track =
                this.tracks[this.currentTrackIndex];

            console.error(
                "Audio loading error:",
                track ? track.src : "unknown"
            );

            this.setMessage(
                "MP3 파일을 열 수 없습니다. mp3 폴더와 파일명을 확인하세요.",
                true
            );

            this.statusElement.textContent = "오류";
            this.statusElement.className = "status";
        }

        /** 재생 여부에 맞춰 버튼, 상태 문구, 앨범 애니메이션을 갱신합니다. */
        updatePlayingState(isPlaying) {
            if (isPlaying) {
                this.playButton.textContent = "Ⅱ";
                this.playButton.setAttribute(
                    "aria-label",
                    "일시정지"
                );

                this.statusElement.textContent = "재생 중";
                this.statusElement.className =
                    "status playing";

                this.albumArtElement.classList.add(
                    "rotating"
                );

                this.setMessage(
                    "음악을 재생하고 있습니다.",
                    false
                );
            } else {
                this.playButton.textContent = "▶";
                this.playButton.setAttribute(
                    "aria-label",
                    "재생"
                );

                this.statusElement.textContent =
                    this.audioEngine.currentTime > 0
                        ? "일시정지"
                        : "준비";

                this.statusElement.className =
                    this.audioEngine.currentTime > 0
                        ? "status paused"
                        : "status";

                this.albumArtElement.classList.remove(
                    "rotating"
                );
            }
        }

        /** 재생 목록에서 현재 선택된 트랙에 active 클래스를 적용합니다. */
        highlightCurrentTrack() {
            const buttons =
                this.playlistElement.querySelectorAll(
                    ".playlist-button"
                );

            buttons.forEach((button, index) => {
                button.classList.toggle(
                    "active",
                    index === this.currentTrackIndex
                );
            });
        }

        /** 현재 트랙 버튼에 포커스를 주고 보이는 영역으로 스크롤합니다. */
        focusCurrentTrack() {
            const selector =
                `[data-track-index="${this.currentTrackIndex}"]`;

            const currentButton =
                this.playlistElement.querySelector(selector);

            if (currentButton) {
                currentButton.focus();
                currentButton.scrollIntoView({
                    block: "nearest"
                });
            }
        }

        /** 안내 문구를 표시하고 오류 여부에 따라 스타일을 전환합니다. */
        setMessage(message, isError) {
            this.messageElement.textContent = message;
            this.messageElement.classList.toggle(
                "error",
                Boolean(isError)
            );
        }

        /** 초 단위 시간을 MM:SS 또는 HH:MM:SS 문자열로 변환합니다. */
        formatTime(seconds) {
            if (!Number.isFinite(seconds) || seconds < 0) {
                return "00:00";
            }

            const totalSeconds = Math.floor(seconds);
            const hours = Math.floor(
                totalSeconds / 3600
            );

            const minutes = Math.floor(
                (totalSeconds % 3600) / 60
            );

            const remainingSeconds =
                totalSeconds % 60;

            if (hours > 0) {
                return [
                    hours,
                    String(minutes).padStart(2, "0"),
                    String(remainingSeconds).padStart(2, "0")
                ].join(":");
            }

            return [
                String(minutes).padStart(2, "0"),
                String(remainingSeconds).padStart(2, "0")
            ].join(":");
        }

        /** 앨범 자리 표시자에 사용할 제목의 첫 글자를 반환합니다. */
        getTrackInitial(title) {
            if (!title || title.length === 0) {
                return "♪";
            }

            return title.trim().charAt(0).toUpperCase();
        }

        /** 트랙 문자열의 HTML 특수 문자를 이스케이프해 안전하게 렌더링합니다. */
        escapeHtml(value) {
            return String(value)
                .replace(/&/g, "&amp;")
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;")
                .replace(/"/g, "&quot;")
                .replace(/'/g, "&#039;");
        }
    }

    window.Mp3Player = Mp3Player;
})();
