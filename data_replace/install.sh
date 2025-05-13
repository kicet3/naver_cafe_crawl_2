#!/bin/bash

# 필요한 패키지 설치 스크립트
# CUDA 11.8 환경에 최적화된 설치를 수행합니다.

# 에러 발생 시 스크립트 중단
set -e

echo "===== 텍스트 복원 프로젝트 설치 스크립트 ====="
echo "CUDA 11.8 및 Python 3.8+ 환경에 최적화되어 있습니다."

# Python 버전 확인
python_version=$(python --version 2>&1)
echo "감지된 Python 버전: $python_version"

# CUDA 확인 시도
if command -v nvidia-smi &> /dev/null; then
    echo "NVIDIA GPU 감지됨:"
    nvidia-smi --query-gpu=name,memory.total --format=csv,noheader
else
    echo "경고: NVIDIA GPU가 감지되지 않았습니다. CUDA 없이 CPU 모드로 설치를 진행합니다."
fi

# 가상 환경 생성 (선택적)
read -p "가상 환경을 생성하시겠습니까? (y/n) " create_venv
if [[ $create_venv == "y" || $create_venv == "Y" ]]; then
    echo "가상 환경 생성 중..."
    python -m venv text-restore-env
    
    # 가상 환경 활성화 안내
    if [[ "$OSTYPE" == "msys" || "$OSTYPE" == "win32" ]]; then
        echo "가상 환경을 활성화하려면 다음 명령어를 실행하세요: text-restore-env\\Scripts\\activate"
        echo "가상 환경을 활성화한 후 이 스크립트를 다시 실행하세요."
        exit 0
    else
        echo "가상 환경을 활성화하려면 다음 명령어를 실행하세요: source text-restore-env/bin/activate"
        echo "가상 환경을 활성화한 후 이 스크립트를 다시 실행하세요."
        exit 0
    fi
fi

# 필요한 패키지 설치
echo "필수 패키지 설치 중..."

# PyTorch 설치 (CUDA 11.8)
echo "PyTorch 설치 중 (CUDA 11.8 지원)..."
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu118

# Transformers 및 관련 라이브러리
echo "Transformers 및 관련 라이브러리 설치 중..."
pip install transformers>=4.30.0 accelerate>=0.20.0 bitsandbytes>=0.40.0 tqdm

# 추가 유틸리티
echo "추가 유틸리티 설치 중..."
pip install sentencepiece protobuf

echo "설치 완료!"
echo "텍스트 복원 프로젝트 사용 방법:"
echo "1. 모델 테스트: python src/run_gen.py test --model EleutherAI/polyglot-ko-1.3b --use-4bit"
echo "2. 대화형 모드: python src/run_gen.py interactive"
echo "3. 배치 처리: python src/run_gen.py batch --input fixed_spaced --output output --use-4bit"
