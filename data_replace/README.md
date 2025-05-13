# 텍스트 데이터 복원 프로젝트

텍스트 데이터에서 중간에 한 글자씩 빠져있는 부분을 자연어 처리 모델을 사용하여 복원하는 프로젝트입니다.

## 개요

이 프로젝트는 JSON 형식의 데이터에서 content 필드에 중간중간 누락된 한글자를 복원합니다. 딥러닝 기반의 마스크드 언어 모델(Masked Language Model)을 사용하여 문맥을 이해하고 빠진 글자를 자동으로 찾아 채워넣습니다.

## 설치 방법

먼저 필요한 라이브러리를 설치합니다:

```bash
pip install torch transformers tqdm
```

## 프로젝트 구조

```
data_replace/
├── fixed_spaced/       # 입력 데이터 디렉토리
├── output/             # 출력 데이터 디렉토리
├── evaluation/         # 평가 결과 저장 디렉토리
├── src/
│   ├── text_restoration.py  # 텍스트 복원 핵심 클래스
│   ├── main.py              # 전체 파일 처리 스크립트
│   ├── test_sample.py       # 샘플 텍스트 테스트 스크립트
│   ├── test_file.py         # 단일 파일 테스트 스크립트
│   ├── evaluate.py          # 복원 결과 평가 스크립트
│   ├── interactive.py       # 대화형 텍스트 복원 스크립트
│   └── run.py               # 통합 명령줄 인터페이스
├── logs.txt                 # 로그 파일
└── README.md                # 프로젝트 설명
```

## 사용 방법

### 1. 단일 파일 테스트

```bash
python src/run.py file --input fixed_spaced/1.json --output output/1.json
```

### 2. 디렉토리 전체 처리

```bash
python src/run.py dir --input fixed_spaced --output output
```

### 3. 샘플 텍스트 테스트

```bash
python src/run.py sample
```

### 4. 대화형 텍스트 복원

```bash
python src/run.py interactive
```

### 5. 복원 결과 평가

```bash
python src/run.py evaluate --original fixed_spaced --restored output --output evaluation
```

## 모델 옵션

기본적으로 `klue/bert-base` 모델을 사용하지만, 다음과 같이 다른 모델로 변경할 수 있습니다:

```bash
python src/run.py interactive --model monologg/kobert
```

## 결과 예시

원본: 요즘 너무 덥지 않나요 여름 다시 찾온 것 같요 ㅠ
복원: 요즘 너무 덥지 않나요 여름 다시 찾아온 것 같아요 ㅠ

원본: 토피들 날씨렇게 요 한 날에는 비사태되는 거 같요!
복원: 아토피들 날씨이렇게 더운 날에는 비상사태되는 거 같아요!
