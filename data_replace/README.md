# 텍스트 데이터 복원 프로젝트 (생성형 모델 기반)

텍스트 데이터에서 중간에 한 글자씩 빠져있는 부분을 생성형 언어 모델을 사용하여 자연스럽게 복원하는 프로젝트입니다.

## 개요

이 프로젝트는 JSON 형식의 데이터에서 content 필드에 중간 중간 누락된 텍스트를 복원합니다. 기존의 마스크드 언어 모델(BERT)에서 생성형 언어 모델로 변경하여 더 자연스러운 텍스트 복원을 구현합니다.

## 요구사항

- Python 3.8 이상
- CUDA 11.8
- NVIDIA RTX 4090 (24GB VRAM) 또는 이에 준하는 GPU
- PyTorch 2.0 이상
- Transformers 4.30.0 이상
- Accelerate 0.20.0 이상
- bitsandbytes 0.40.0 이상

## 설치 방법

```bash
# CUDA 11.8 기반 설치
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu118

# 필요한 라이브러리 설치
pip install transformers accelerate bitsandbytes tqdm
```

## 사용 모델

기본적으로 다음 한국어 생성형 모델을 사용합니다:
- **EleutherAI/polyglot-ko-1.3b**: 한국어에 특화된 소형 생성형 모델

더 높은 품질을 위해 다음 모델도 선택적으로 사용할 수 있습니다:
- **beomi/KoAlpaca-Polyglot-5.8B**: 한국어 지시어 튜닝 모델
- **paust/pko-t5-large**: 한국어 T5 모델
- **nlpai-lab/kullm-polyglot-5.8b-v2**: 한국어 대화 모델

## 프로젝트 구조

```
data_replace/
├── fixed_spaced/       # 입력 데이터 디렉토리
├── output/             # 출력 데이터 디렉토리
├── src/
│   ├── batch_processor.py    # 배치 처리 스크립트
│   ├── interactive_gen.py    # 대화형 텍스트 복원 스크립트
│   ├── test_model.py         # 모델 테스트 스크립트
│   └── run_gen.py            # 통합 명령줄 인터페이스
├── logs/                     # 로그 파일 디렉토리
└── README.md                 # 프로젝트 설명
```

## 사용 방법

### 1. 모델 테스트

```bash
python src/run_gen.py test --model EleutherAI/polyglot-ko-1.3b --use-4bit
```

### 2. 대화형 텍스트 복원

```bash
python src/run_gen.py interactive --model EleutherAI/polyglot-ko-1.3b
```

### 3. 배치 처리 (전체 디렉토리)

```bash
python src/run_gen.py batch --input fixed_spaced --output output --model EleutherAI/polyglot-ko-1.3b --use-4bit
```

### 4. 단일 파일 처리

```bash
python src/run_gen.py file --input fixed_spaced/1.json --output output/1.json --model EleutherAI/polyglot-ko-1.3b --use-4bit
```

## 메모리 최적화

RTX 4090 (24GB VRAM)을 사용할 경우, 다음과 같은 양자화 옵션을 사용할 수 있습니다:

- **4비트 양자화**: `--use-4bit` 옵션 사용
  - 24GB VRAM에서 최대 13B 모델 로드 가능
  - 예: `python src/run_gen.py batch --use-4bit`

- **8비트 양자화**: `--use-8bit` 옵션 사용
  - 24GB VRAM에서 최대 7B 모델 로드 가능
  - 예: `python src/run_gen.py batch --use-8bit`

- **양자화 없음**: 기본 FP16 또는 FP32 사용
  - 24GB VRAM에서 최대 3B 모델 로드 가능
  - 예: `python src/run_gen.py interactive --no-quantization`

## 작동 원리

본 프로젝트는 다음과 같은 방식으로 텍스트를 복원합니다:

1. **규칙 기반 전처리**: 자주 발생하는 패턴(예: "토피" → "아토피")을 사전에 정의된 규칙으로 복원

2. **생성형 모델 활용**: 전처리된 텍스트를 생성형 모델에 입력하여 자연스러운 문장으로 복원
   ```
   입력: "다음 텍스트는 한글자씩 빠져있는 문장입니다. 문맥을 이해하고 자연스러운 문장으로 복원해주세요:
   
   원본: 요즘 너무 덥지 않나요 여름 다시 찾온 것 같요 ㅠ
   
   복원된 문장:"
   
   출력: "요즘 너무 덥지 않나요 여름 다시 찾아온 것 같아요 ㅠ"
   ```

3. **청크 단위 처리**: 긴 텍스트는 문장 단위로 나누어 처리하고 결합

## 성능 최적화 팁

1. **모델 크기 선택**: 
   - 빠른 처리: EleutherAI/polyglot-ko-1.3b (기본 설정)
   - 높은 품질: beomi/KoAlpaca-Polyglot-5.8B (4비트 양자화 권장)

2. **배치 크기 조정**:
   - 기본적으로 단일 배치로 처리하지만, 필요시 `batch_processor.py`에서 배치 크기 조정 가능

3. **장기 실행 시 메모리 관리**:
   - 코드에 메모리 관리 로직 포함 (torch.cuda.empty_cache() 및 gc.collect())
