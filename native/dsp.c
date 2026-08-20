/*
 * 파일 역할: 실시간 PCM 볼륨 DSP를 구현하고 WebAssembly로 컴파일되는 원본입니다.
 */
#include <stdint.h>

#define MAX_FRAMES 128
#define MAX_CHANNELS 2
#define MAX_SAMPLES (MAX_FRAMES * MAX_CHANNELS)

/*
 * AudioWorklet이 사용하는 두 함수를 Emscripten 빌드에서 동일한 이름으로
 * export합니다.
 */
static float sample_buffer[MAX_SAMPLES];

/* AudioWorklet이 PCM을 복사할 고정 샘플 버퍼의 시작 주소를 반환합니다. */
float* get_sample_buffer(void) {
    return sample_buffer;
}

/* 채널 우선으로 저장된 PCM 블록을 제자리에서 처리하는 DSP 진입점입니다. */
void process_pcm(
    int32_t frame_count,
    int32_t channel_count,
    float gain
) {
    /*
     * PCM layout:
     * sample_buffer[channel * frame_count + frame]
     *
     * 각 PCM 샘플에 실시간 볼륨 gain을 적용합니다.
     */
    int32_t sample_count = frame_count * channel_count;

    for (int32_t index = 0; index < sample_count; index += 1) {
        sample_buffer[index] *= gain;
    }
}
