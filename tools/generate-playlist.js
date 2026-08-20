/*
 * 파일 역할: mp3 폴더를 검색해 앱이 읽을 mp3/playlist.json을 자동 생성합니다.
 */
"use strict";

const fs = require("fs");
const path = require("path");

const projectRoot = path.resolve(__dirname, "..");
const mp3Directory = path.join(projectRoot, "mp3");
const outputFile = path.join(mp3Directory, "playlist.json");

const supportedExtensions = new Set([
    ".mp3"
]);

/** MP3 파일명에서 확장자와 구분 문자를 정리해 화면 표시용 제목을 만듭니다. */
function createTitleFromFilename(filename) {
    const extension = path.extname(filename);
    const nameWithoutExtension = path.basename(
        filename,
        extension
    );

    return nameWithoutExtension
        .replace(/[_-]+/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

/** 숫자가 포함된 파일명을 사람이 기대하는 순서로 정렬합니다. */
function compareFilenames(left, right) {
    return left.localeCompare(
        right,
        undefined,
        {
            numeric: true,
            sensitivity: "base"
        }
    );
}

/** MP3 파일을 수집·정렬하고 트랙 객체로 변환해 playlist.json에 저장합니다. */
function generatePlaylist() {
    if (!fs.existsSync(mp3Directory)) {
        throw new Error(
            `MP3 폴더가 존재하지 않습니다: ${mp3Directory}`
        );
    }

    const directoryEntries = fs.readdirSync(
        mp3Directory,
        {
            withFileTypes: true
        }
    );

    const mp3Files = directoryEntries
        // 일반 파일이면서 지원 확장자를 가진 항목만 남깁니다.
        .filter((entry) => {
            if (!entry.isFile()) {
                return false;
            }

            const extension = path
                .extname(entry.name)
                .toLowerCase();

            return supportedExtensions.has(extension);
        })
        .map((entry) => entry.name)
        .sort(compareFilenames);

    const tracks = mp3Files.map(
        // 각 파일명을 플레이어가 사용하는 트랙 객체로 변환합니다.
        (filename, index) => {
            return {
                id: index + 1,
                title: createTitleFromFilename(filename),
                artist: "Unknown Artist",
                filename,
                src: `mp3/${encodeURIComponent(filename)}`
            };
        }
    );

    const playlistData = {
        generatedAt: new Date().toISOString(),
        count: tracks.length,
        tracks
    };

    fs.writeFileSync(
        outputFile,
        JSON.stringify(playlistData, null, 2),
        "utf8"
    );

    console.log(
        `재생 목록 생성 완료: ${tracks.length}개`
    );

    console.log(`출력 파일: ${outputFile}`);

    // 생성된 재생 목록을 개발자가 확인할 수 있도록 출력합니다.
    tracks.forEach((track, index) => {
        console.log(
            `${index + 1}. ${track.filename}`
        );
    });
}

try {
    generatePlaylist();
} catch (error) {
    console.error(
        "재생 목록 생성 실패:",
        error.message
    );

    process.exitCode = 1;
}
