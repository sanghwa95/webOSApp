(module
    ;; AudioWorklet은 최대 128 프레임, 스테레오 PCM을 이 메모리에 씁니다.
    ;; samples[channel * frame_count + frame] 형식의 Float32 데이터입니다.
    (memory (export "memory") 1)

    (func (export "get_sample_buffer") (result i32)
        i32.const 0
    )

    (func (export "process_pcm")
        (param $frame_count i32)
        (param $channel_count i32)

        ;; 현재 구현은 PCM을 수정하지 않는 패스스루입니다.
        ;; 이후 이 함수에서 0번 주소부터 시작하는 Float32 PCM을
        ;; 직접 변경하면 재생 중인 오디오에 반영됩니다.
    )
)
