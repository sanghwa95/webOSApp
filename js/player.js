(function () {
    "use strict";

    class Mp3Player {
        constructor(options) {
            this.audio = options.audio;
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

            this.loadTrack(0, false);
        }

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

            this.audio.addEventListener(
                "timeupdate",
                this.handleTimeUpdate
            );

            this.audio.addEventListener(
                "loadedmetadata",
                this.handleLoadedMetadata
            );

            this.audio.addEventListener(
                "ended",
                this.handleTrackEnded
            );

            this.audio.addEventListener(
                "error",
                this.handleAudioError
            );

            this.audio.addEventListener(
                "play",
                () => this.updatePlayingState(true)
            );

            this.audio.addEventListener(
                "pause",
                () => {
                    if (!this.audio.ended) {
                        this.updatePlayingState(false);
                    }
                }
            );
        }

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

        loadTrack(index, autoPlay) {
            if (
                index < 0 ||
                index >= this.tracks.length
            ) {
                return;
            }

            const track = this.tracks[index];

            this.currentTrackIndex = index;
            this.audio.src = track.src;
            this.audio.load();

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

            this.setMessage(
                `${track.title}을(를) 불러왔습니다.`,
                false
            );

            if (autoPlay) {
                this.play();
            } else {
                this.updatePlayingState(false);
            }
        }

        async play() {
            if (this.currentTrackIndex < 0) {
                this.loadTrack(0, false);
            }

            try {
                await this.audio.play();
            } catch (error) {
                console.error("Audio play failed:", error);

                this.setMessage(
                    "음악을 재생하지 못했습니다. 파일 경로와 형식을 확인하세요.",
                    true
                );
            }
        }

        pause() {
            this.audio.pause();
        }

        togglePlay() {
            if (this.audio.paused) {
                this.play();
            } else {
                this.pause();
            }
        }

        stop() {
            this.audio.pause();
            this.audio.currentTime = 0;

            this.seekBar.value = "0";
            this.currentTimeElement.textContent = "00:00";

            this.updatePlayingState(false);
            this.statusElement.textContent = "정지";

            this.setMessage("재생을 정지했습니다.", false);
        }

        playPrevious() {
            const previousIndex =
                (
                    this.currentTrackIndex - 1 +
                    this.tracks.length
                ) % this.tracks.length;

            this.loadTrack(previousIndex, true);
        }

        playNext() {
            const nextIndex =
                (this.currentTrackIndex + 1) %
                this.tracks.length;

            this.loadTrack(nextIndex, true);
        }

        seekBackward(seconds) {
            if (!Number.isFinite(this.audio.duration)) {
                return;
            }

            this.audio.currentTime = Math.max(
                0,
                this.audio.currentTime - seconds
            );
        }

        seekForward(seconds) {
            if (!Number.isFinite(this.audio.duration)) {
                return;
            }

            this.audio.currentTime = Math.min(
                this.audio.duration,
                this.audio.currentTime + seconds
            );
        }

        previewSeek() {
            if (!Number.isFinite(this.audio.duration)) {
                return;
            }

            const ratio =
                Number(this.seekBar.value) /
                Number(this.seekBar.max);

            const previewTime =
                ratio * this.audio.duration;

            this.currentTimeElement.textContent =
                this.formatTime(previewTime);
        }

        seek() {
            if (!Number.isFinite(this.audio.duration)) {
                return;
            }

            const ratio =
                Number(this.seekBar.value) /
                Number(this.seekBar.max);

            this.audio.currentTime =
                ratio * this.audio.duration;
        }

        setVolume(volume) {
            const safeVolume = Math.min(
                1,
                Math.max(0, volume)
            );

            this.audio.volume = safeVolume;

            const percent = Math.round(
                safeVolume * 100
            );

            this.volumeBar.value = String(percent);
            this.volumeValueElement.textContent =
                `${percent}%`;
        }

        changeVolume(amount) {
            this.setVolume(
                this.audio.volume + amount
            );
        }

        handleTimeUpdate() {
            if (!this.isSeeking) {
                if (
                    Number.isFinite(this.audio.duration) &&
                    this.audio.duration > 0
                ) {
                    const ratio =
                        this.audio.currentTime /
                        this.audio.duration;

                    this.seekBar.value = String(
                        Math.round(
                            ratio *
                            Number(this.seekBar.max)
                        )
                    );
                }

                this.currentTimeElement.textContent =
                    this.formatTime(
                        this.audio.currentTime
                    );
            }
        }

        handleLoadedMetadata() {
            this.durationElement.textContent =
                this.formatTime(this.audio.duration);
        }

        handleTrackEnded() {
            this.playNext();
        }

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
                    this.audio.currentTime > 0
                        ? "일시정지"
                        : "준비";

                this.statusElement.className =
                    this.audio.currentTime > 0
                        ? "status paused"
                        : "status";

                this.albumArtElement.classList.remove(
                    "rotating"
                );
            }
        }

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

        setMessage(message, isError) {
            this.messageElement.textContent = message;
            this.messageElement.classList.toggle(
                "error",
                Boolean(isError)
            );
        }

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

        getTrackInitial(title) {
            if (!title || title.length === 0) {
                return "♪";
            }

            return title.trim().charAt(0).toUpperCase();
        }

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