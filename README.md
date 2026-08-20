# webOS용 tuning tool

이 프로젝트는 MP3를 mpg123 WASM으로 PCM 데이터로 디코딩하고, Web Audio의
AudioWorklet에서 PCM을 DSP WASM으로 전달해 실시간 볼륨을 적용하는 webOS
오디오 튜닝 도구입니다.

## 파일 역할

- `index.html`: 앱의 화면 구조와 스크립트 로드 순서
- `css/style.css`: TV 화면 레이아웃, 색상, 포커스와 애니메이션
- `js/main.js`: 앱 초기화와 구성 요소 연결
- `js/audio-engine.js`: mpg123 디코딩과 Web Audio 재생
- `js/html-audio-engine.js`: 수동 HTML Audio 대체 재생 엔진
- `js/player.js`: 플레이어 UI와 재생 상태 관리
- `js/remote-control.js`: webOS 리모컨 입력과 포커스 이동
- `js/wasm-loader.js`: DSP WASM 및 AudioWorklet 초기화
- `js/dsp-worklet.js`: 실시간 PCM 가로채기와 DSP 호출
- `native/dsp.c`: 실시간 PCM DSP를 구현하는 C 원본
- `wasm/dsp.wasm`: `dsp.c`에서 생성되는 실행용 바이너리
- `tools/build-wasm.js`: Emscripten으로 C를 WASM으로 컴파일하고 검증
- `tools/generate-playlist.js`: MP3 목록 JSON 생성
- `tools/prepare-vendor.js`: mpg123 브라우저 번들을 vendor 폴더에 준비
- `appinfo.json`: webOS 앱 메타데이터
- `package.json`, `package-lock.json`: npm 명령과 의존성 정보
- `mp3/playlist.json`: 자동 생성된 재생 목록 데이터
- `mp3/*.mp3`: 테스트 및 재생용 오디오 파일
- `vendor/mpg123-decoder.min.js`: 외부 mpg123 WASM 디코더 배포 번들
- `webOSTVjs-1.2.13/`: LG webOS TV JavaScript SDK
- `icon.png`, `largeIcon.png`: webOS 런처 아이콘

JSON, 이미지, MP3, WASM 바이너리와 축소된 외부 라이브러리에는 형식 손상과
외부 코드 변경을 피하기 위해 소스 주석을 삽입하지 않습니다.

## DSP WASM 빌드

[Emscripten SDK](https://emscripten.org/docs/getting_started/downloads.html)를 설치하고
현재 셸에서 활성화한 뒤 다음 명령을 실행합니다.

```powershell
npm run build:wasm
```

`EMCC` 환경 변수에 `emcc` 실행 파일의 경로를 지정하거나, `EMSDK` 환경 변수에
활성화된 emsdk 루트 경로를 지정하는 방식도 지원합니다. 빌드 스크립트는 C에서
`wasm/dsp.wasm`을 생성한 뒤 필수 export와 PCM gain 연산을 검증합니다.
