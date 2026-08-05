#include <stdint.h>

#define MAX_FRAMES 128
#define MAX_CHANNELS 2
#define MAX_SAMPLES (MAX_FRAMES * MAX_CHANNELS)

/*
 * dsp.wat의 현재 인터페이스를 C로 표현한 참고 구현입니다.
 *
 * Emscripten 등으로 C 구현을 빌드할 경우 다음 두 함수를
 * 동일한 이름으로 export해야 합니다.
 */
static float sample_buffer[MAX_SAMPLES];

float* get_sample_buffer(void) {
    return sample_buffer;
}

void process_pcm(
    int32_t frame_count,
    int32_t channel_count
) {
    /*
     * PCM layout:
     * sample_buffer[channel * frame_count + frame]
     *
     * 현재는 원본 PCM을 그대로 출력합니다.
     * 여기에 gain, EQ, FIR/IIR 등의 처리를 구현하세요.
     */
    (void) frame_count;
    (void) channel_count;
}
