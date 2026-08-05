(function () {
    "use strict";

    document.addEventListener(
        "DOMContentLoaded",
        initializeApp
    );

    async function initializeApp() {
        const messageElement =
            document.getElementById("messageText");

        try {
            setLoadingState(
                messageElement,
                "MP3 파일 목록을 불러오는 중입니다."
            );

            const tracks = await loadTracks();

            if (tracks.length === 0) {
                throw new Error(
                    "mp3 폴더에 MP3 파일이 없습니다."
                );
            }

            const player = createPlayer();

            player.initialize(tracks);

            const remoteControl =
                new window.RemoteControl(player);

            remoteControl.initialize();

            const wasmDsp =
                new window.WasmDsp(
                    window.astnovaAudioEngine
                );

            if (
                window.astnovaAudioEngine.mode ===
                "web-audio"
            ) {
                window.astnovaAudioEngine
                    .setBeforePlayHook(
                        () => wasmDsp.initialize()
                    );
            }

            window.astnovaPlayer = player;
            window.astnovaDsp = wasmDsp;

            console.log(
                `${tracks.length}개의 MP3 파일을 불러왔습니다.`
            );
        } catch (error) {
            console.error(
                "Application initialization failed:",
                error
            );

            showInitializationError(
                messageElement,
                error
            );
        }
    }

    async function loadTracks() {
        const response = await fetch(
            `mp3/playlist.json?t=${Date.now()}`,
            {
                cache: "no-store"
            }
        );

        if (!response.ok) {
            throw new Error(
                "playlist.json을 불러오지 못했습니다. " +
                "npm run playlist 명령을 먼저 실행하세요."
            );
        }

        const playlist = await response.json();

        if (!playlist || !Array.isArray(playlist.tracks)) {
            throw new Error(
                "playlist.json 형식이 올바르지 않습니다."
            );
        }

        return playlist.tracks
            .filter(isValidTrack)
            .map(normalizeTrack);
    }

    function isValidTrack(track) {
        return Boolean(
            track &&
            typeof track.title === "string" &&
            typeof track.src === "string"
        );
    }

    function normalizeTrack(track) {
        return {
            id: track.id,
            title:
                track.title.trim() ||
                track.filename ||
                "Unknown Track",

            artist:
                typeof track.artist === "string" &&
                track.artist.trim()
                    ? track.artist.trim()
                    : "Unknown Artist",

            filename:
                track.filename || "",

            src: track.src
        };
    }

    function createPlayer() {
        const audioEngine =
            createAudioEngine();

        window.astnovaAudioEngine =
            audioEngine;

        window.astnovaAudioMode =
            audioEngine.mode;

        return new window.Mp3Player({
            audioEngine,

            playlistElement:
                document.getElementById("playlist"),

            trackTitleElement:
                document.getElementById("trackTitle"),

            trackArtistElement:
                document.getElementById("trackArtist"),

            currentTimeElement:
                document.getElementById("currentTime"),

            durationElement:
                document.getElementById("duration"),

            seekBar:
                document.getElementById("seekBar"),

            volumeBar:
                document.getElementById("volumeBar"),

            volumeValueElement:
                document.getElementById("volumeValue"),

            playButton:
                document.getElementById("playButton"),

            previousButton:
                document.getElementById(
                    "previousButton"
                ),

            nextButton:
                document.getElementById("nextButton"),

            stopButton:
                document.getElementById("stopButton"),

            statusElement:
                document.getElementById("statusText"),

            messageElement:
                document.getElementById("messageText"),

            albumArtElement:
                document.querySelector(".album-art"),

            albumInitialElement:
                document.getElementById(
                    "albumInitial"
                )
        });
    }

    function createAudioEngine() {
        const query =
            new URLSearchParams(
                window.location.search
            );

        const forcedEngine =
            query.get("audioEngine");

        const useHtmlAudio =
            forcedEngine === "html";

        if (useHtmlAudio) {
            console.info(
                "HTML audio fallback is active."
            );

            return new window.HtmlAudioEngine(
                document.getElementById(
                    "audioPlayer"
                )
            );
        }

        console.info(
            "Web Audio engine with WASM mpg123 decoding is active."
        );

        return new window.AudioEngine();
    }

    function setLoadingState(element, message) {
        element.textContent = message;
        element.classList.remove("error");
    }

    function showInitializationError(
        element,
        error
    ) {
        element.textContent =
            error instanceof Error
                ? error.message
                : "앱 초기화 중 오류가 발생했습니다.";

        element.classList.add("error");

        const statusElement =
            document.getElementById("statusText");

        if (statusElement) {
            statusElement.textContent = "오류";
            statusElement.className = "status";
        }
    }
})();
