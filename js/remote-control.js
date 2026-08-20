/*
 * 파일 역할: webOS 리모컨 키 입력을 플레이어 명령과 화면 포커스 이동으로 변환합니다.
 * 방향키, 확인, 재생, 일시정지, 정지 및 탐색 키를 처리합니다.
 */
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
        /** 제어할 플레이어를 저장하고 키 이벤트 핸들러를 바인딩합니다. */
        constructor(player) {
            this.player = player;
            this.focusableElements = [];
            this.currentFocusIndex = 0;

            this.handleKeyDown =
                this.handleKeyDown.bind(this);
        }

        /** 포커스 가능한 요소를 수집하고 전역 리모컨 키 이벤트를 등록합니다. */
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

        /** 현재 화면에서 활성화된 포커스 가능 요소 목록을 다시 수집합니다. */
        refreshFocusableElements() {
            this.focusableElements = Array.from(
                document.querySelectorAll(
                    ".focusable:not([disabled])"
                )
            );
        }

        /** webOS 키 코드를 해당 플레이어 또는 포커스 명령으로 분기합니다. */
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

        /** 탐색·볼륨 입력을 조절하거나 일반 포커스를 왼쪽으로 이동합니다. */
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

        /** 탐색·볼륨 입력을 조절하거나 일반 포커스를 오른쪽으로 이동합니다. */
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

        /** 재생 목록 내부 또는 전체 포커스를 위쪽 항목으로 이동합니다. */
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

        /** 재생 목록 내부 또는 전체 포커스를 아래쪽 항목으로 이동합니다. */
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

        /** 버튼·입력이 아닌 영역에서 확인 키를 재생/일시정지로 처리합니다. */
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

        /** 전체 포커스 가능 요소 사이를 지정한 방향으로 순환 이동합니다. */
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

        /** 재생 목록 버튼 사이에서만 포커스를 순환 이동합니다. */
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
