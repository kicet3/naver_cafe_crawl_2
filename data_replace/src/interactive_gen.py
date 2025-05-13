import torch
from transformers import AutoModelForCausalLM, AutoTokenizer, BitsAndBytesConfig
import re
import os
import logging
import argparse

# 로깅 설정
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler("/Users/link/Documents/SKN/4th_project_3/data_replace/interactive_logs.txt"),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

def interactive_restoration(model_name="EleutherAI/polyglot-ko-1.3b", device="cuda", use_quantization=True):
    """
    사용자 입력 텍스트를 대화형으로 복원
    
    Args:
        model_name (str): 사용할 모델 이름
        device (str): 사용할 디바이스 (cuda 또는 cpu)
        use_quantization (bool): 양자화 사용 여부
    """
    logger.info(f"모델 로드 중: {model_name}, 디바이스: {device}")
    
    # CUDA 가용성 확인
    if device == "cuda" and not torch.cuda.is_available():
        logger.warning("CUDA를 사용할 수 없습니다. CPU로 전환합니다.")
        device = "cpu"
        use_quantization = False
    
    # 양자화 설정
    if use_quantization and device == "cuda":
        logger.info("4비트 양자화를 사용합니다.")
        quantization_config = BitsAndBytesConfig(
            load_in_4bit=True,
            bnb_4bit_compute_dtype=torch.float16,
            bnb_4bit_use_double_quant=True,
            bnb_4bit_quant_type="nf4"
        )
    else:
        quantization_config = None
    
    # 토크나이저 로드
    tokenizer = AutoTokenizer.from_pretrained(model_name)
    
    # 모델 로드
    if quantization_config:
        model = AutoModelForCausalLM.from_pretrained(
            model_name,
            device_map="auto",
            quantization_config=quantization_config,
        )
    else:
        model = AutoModelForCausalLM.from_pretrained(model_name)
        model = model.to(device)
    
    logger.info("모델 로드 완료")
    
    # 규칙 기반 전처리
    def preprocess_text(text):
        # 자주 발생하는 패턴에 대한 규칙 기반 수정
        patterns = {
            r'토피\b': '아토피',
            r'토피(가|는|도|를|에|의|과|와|로)': r'아토피\1',
            r'스테\b': '스테로이드',
            r'스테(가|는|도|를|에|의|과|와|로)': r'스테로이드\1',
            r'샤(워|드|잠)': r'샤\1',
            r'피부(가|는|도|를|에|의|과|와|로)': r'피부\1',
            # 더 많은 패턴을 추가할 수 있습니다.
        }
        
        for pattern, replacement in patterns.items():
            text = re.sub(pattern, replacement, text)
        
        return text
    
    # 텍스트 복원 함수
    def restore_text(text):
        # 전처리
        preprocessed_text = preprocess_text(text)
        
        # 프롬프트 구성
        prompt = f"""다음 텍스트는 한글자씩 빠져있는 문장입니다. 문맥을 이해하고 자연스러운 문장으로 복원해주세요:

원본: {preprocessed_text}

복원된 문장:"""
        
        logger.debug(f"프롬프트: {prompt}")
        
        # 입력 인코딩
        inputs = tokenizer(prompt, return_tensors="pt").to(device)
        
        # 생성 파라미터 설정
        generation_config = {
            "max_new_tokens": 200,
            "do_sample": True,
            "temperature": 0.7,
            "top_p": 0.9,
            "pad_token_id": tokenizer.eos_token_id
        }
        
        # 텍스트 생성
        with torch.no_grad():
            output = model.generate(**inputs, **generation_config)
        
        # 생성된 텍스트 디코딩
        full_output = tokenizer.decode(output[0], skip_special_tokens=True)
        
        # 응답 부분만 추출
        restored_text = full_output.split("복원된 문장:")[-1].strip()
        
        # 후처리 - 불필요한 부분 제거
        restored_text = restored_text.split("\n")[0].strip()
        
        return restored_text
    
    print("\n=== 대화형 텍스트 복원 (생성형 모델 기반) ===")
    print("종료하려면 'exit' 또는 'quit'를 입력하세요.\n")
    
    while True:
        # 사용자 입력 받기
        user_input = input("복원할 텍스트를 입력하세요: ")
        
        # 종료 조건
        if user_input.lower() in ['exit', 'quit']:
            print("프로그램을 종료합니다.")
            break
        
        # 빈 입력 무시
        if not user_input.strip():
            continue
        
        try:
            # 텍스트 복원
            restored_text = restore_text(user_input)
            
            # 결과 출력
            print("\n원본:", user_input)
            print("복원:", restored_text)
            print()
            
        except Exception as e:
            logger.error(f"복원 중 오류 발생: {str(e)}")
            print(f"오류가 발생했습니다: {str(e)}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="생성형 모델 기반 대화형 텍스트 복원")
    parser.add_argument("--model", type=str, default="EleutherAI/polyglot-ko-1.3b", 
                        help="사용할 모델 이름")
    parser.add_argument("--device", type=str, default="cuda", 
                        help="사용할 디바이스 (cuda 또는 cpu)")
    parser.add_argument("--no-quantization", action="store_true", 
                        help="양자화를 사용하지 않음")
    
    args = parser.parse_args()
    
    # 대화형 복원 실행
    interactive_restoration(model_name=args.model, device=args.device, use_quantization=not args.no_quantization)
