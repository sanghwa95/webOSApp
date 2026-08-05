(function () {
    "use strict";

    const KEY = {
        ENTER: 13,
        PAUSE: 19,

        LEFT: 37,
        UP: 38,
        RIGHT: 39,
        DOWN: 40,

        REWIND: 412,
        STOP: 413,
        PLAY: 415,
        FAST_FORWARD: 417,

        BACK: 461
    };

    class RemoteControl {
        constructor(player) {
            this.player = player;
            this.focusableElements = [];
            this.currentFocusIndex = 0;

            this.handleKeyDown =
                this.handleKeyDown.bind(this);
        }

        initialize() {
            this.refreshFocusableElements();

            document.addEventListener(
                "keydown",
                this.handleKeyDown
            );

            if (this.focusableElements.length > 0) {
                this.focusableElements[0].focus();
            }
        }

        refreshFocusableElements() {
            this.focusableElements = Array.from(
                document.querySelectorAll(
                    ".focusable:not([disabled])"
                )
            );
        }

        handleKeyDown(event) {
            const keyCode =
                event.keyCode || event.which;

            switch (keyCode) {
                case KEY.LEFT:
                    event.preventDefault();
                    this.handleLeft();
                    break;

                case KEY.RIGHT:
                    event.preventDefault();
                    this.handleRight();
                    break;

                case KEY.UP:
                    event.preventDefault();
                    this.handleUp();
                    break;

                case KEY.DOWN:
                    event.preventDefault();
                    this.handleDown();
                    break;

                case KEY.ENTER:
                    this.handleEnter(event);
                    break;

                case KEY.PLAY:
                    event.preventDefault();
                    this.player.play();
                    break;

                case KEY.PAUSE:
                    event.preventDefault();
                    this.player.pause();
                    break;

                case KEY.STOP:
                    event.preventDefault();
                    this.player.stop();
                    break;

                case KEY.REWIND:
                    event.preventDefault();
                    this.player.seekBackward(10);
                    break;

                case KEY.FAST_FORWARD:
                    event.preventDefault();
                    this.player.seekForward(10);
                    break;

                case KEY.BACK:
                    /*
                     * 기본 webOS 뒤로가기 처리를 사용합니다.
                     * 별도 화면이 없는 단일 페이지 앱에서는
                     * 시스템이 앱 종료 또는 Home 이동을 처리합니다.
                     */
                    break;

                default:
                    break;
            }
        }

        handleLeft() {
            const active = document.activeElement;

            if (active === this.player.seekBar) {
                this.player.seekBackward(5);
                return;
            }

            if (active === this.player.volumeBar) {
                this.player.changeVolume(-0.05);
                return;
            }

            this.moveFocus(-1);
        }

        handleRight() {
            const active = document.activeElement;

            if (active === this.player.seekBar) {
                this.player.seekForward(5);
                return;
            }

            if (active === this.player.volumeBar) {
                this.player.changeVolume(0.05);
                return;
            }

            this.moveFocus(1);
        }

        handleUp() {
            const active = document.activeElement;

            if (
                active &&
                active.classList.contains(
                    "playlist-focusable"
                )
            ) {
                this.movePlaylistFocus(-1);
                return;
            }

            this.moveFocus(-1);
        }

        handleDown() {
            const active = document.activeElement;

            if (
                active &&
                active.classList.contains(
                    "playlist-focusable"
                )
            ) {
                this.movePlaylistFocus(1);
                return;
            }

            this.moveFocus(1);
        }

        handleEnter(event) {
            const active = document.activeElement;

            if (
                active &&
                (
                    active.tagName === "BUTTON" ||
                    active.tagName === "INPUT"
                )
            ) {
                return;
            }

            event.preventDefault();
            this.player.togglePlay();
        }

        moveFocus(direction) {
            this.refreshFocusableElements();

            if (this.focusableElements.length === 0) {
                return;
            }

            const activeIndex =
                this.focusableElements.indexOf(
                    document.activeElement
                );

            if (activeIndex >= 0) {
                this.currentFocusIndex = activeIndex;
            }

            this.currentFocusIndex =
                (
                    this.currentFocusIndex +
                    direction +
                    this.focusableElements.length
                ) % this.focusableElements.length;

            const target =
                this.focusableElements[
                    this.currentFocusIndex
                ];

            target.focus();

            target.scrollIntoView({
                block: "nearest",
                inline: "nearest"
            });
        }

        movePlaylistFocus(direction) {
            const playlistButtons = Array.from(
                document.querySelectorAll(
                    ".playlist-focusable"
                )
            );

            if (playlistButtons.length === 0) {
                return;
            }

            const currentIndex =
                playlistButtons.indexOf(
                    document.activeElement
                );

            const nextIndex =
                (
                    Math.max(currentIndex, 0) +
                    direction +
                    playlistButtons.length
                ) % playlistButtons.length;

            playlistButtons[nextIndex].focus();

            playlistButtons[nextIndex].scrollIntoView({
                block: "nearest"
            });
        }
    }

    window.RemoteControl = RemoteControl;
})();