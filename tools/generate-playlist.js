"use strict";

const fs = require("fs");
const path = require("path");

const projectRoot = path.resolve(__dirname, "..");
const mp3Directory = path.join(projectRoot, "mp3");
const outputFile = path.join(mp3Directory, "playlist.json");

const supportedExtensions = new Set([
    ".mp3"
]);

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