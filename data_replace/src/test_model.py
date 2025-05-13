import os
import logging
import argparse
import torch
from transformers import pipeline, AutoModelForCausalLM, AutoTokenizer, BitsAndBytesConfig

# 로깅 설정
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler("/Users/link/Documents/SKN/4th_project_3/data_replace/test_model_logs.txt"),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

def test_model(model_name, device="cuda", use_4bit=True, use_8bit=False):
    """
    모델 테스트
    
    Args:
        model_name (str): 테스트할 모델 이름
        device (str): 사용할 디바이스 (cuda 또는 cpu)
        use_4bit (bool): 4bit 양자화 사용 여부
        use_8bit (bool): 8bit 양자화 사용 여부
    """
    # 시간 측정 시작
    import time
    start_time = time.time()
    
    logger.info(f"모델 테스트: {model_name}, 디바이스: {device}")
    
    # CUDA 가용성 확인
    if device == "cuda" and not torch.cuda.is_available():
        logger.warning("CUDA를 사용할 수 없습니다. CPU로 전환합니다.")
        device = "cpu"
        use_4bit = False
        use_8bit = False
    
    # GPU 정보 출력
    if device == "cuda":
        gpu_info = torch.cuda.get_device_properties(0)
        logger.info(f"GPU: {gpu_info.name}, 메모리: {gpu_info.total_memory / 1024**3:.2f} GB")
    
    try:
        # 토크나이저 로드
        tokenizer = AutoTokenizer.from_pretrained(model_name)
        
        # 양자화 설정 및 모델 로드
        if use_4bit and device == "cuda":
            logger.info("4비트 양자화를 사용합니다.")
            quantization_config = BitsAndBytesConfig(
                load_in_4bit=True,
                bnb_4bit_compute_dtype=torch.float16,
                bnb_4bit_use_double_quant=True,
                bnb_4bit_quant_type="nf4"
            )
            model = AutoModelForCausalLM.from_pretrained(
                model_name,
                device_map="auto",
                quantization_config=quantization_config
            )
        elif use_8bit and device == "cuda":
            logger.info("8비트 양자화를 사용합니다.")
            model = AutoModelForCausalLM.from_pretrained(
                model_name,
                device_map="auto",
                load_in_8bit=True
            )
        else:
            model = AutoModelForCausalLM.from_pretrained(model_name)
            model = model.to(device)
        
        # 모델 로드 시간 측정
        load_time = time.time() - start_time
        logger.info(f"모델 로드 시간: {load_time:.2f}초")
        
        # 텍스트 생성 파이프라인 설정
        generator = pipeline(
            "text-generation",
            model=model,
            tokenizer=tokenizer,
            device=0 if device == "cuda" else -1
        )
        
        # 테스트 프롬프트
        test_prompts = [
            "다음 텍스트는 한글자씩 빠져있는 문장입니다. 문맥을 이해하고 자연스러운 문장으로 복원해주세요:\n\n"
            "원본: 요즘 너무 덥지 않나요 여름 다시 찾온 것 같요 ㅠ\n\n"
            "복원된 문장:",
            
            "다음 텍스트는 한글자씩 빠져있는 문장입니다. 문맥을 이해하고 자연스러운 문장으로 복원해주세요:\n\n"
            "원본: 토피들 날씨렇게 요 한 날에는 비사태되는 거 같요!\n\n"
            "복원된 문장:",
            
            "다음 텍스트는 한글자씩 빠져있는 문장입니다. 문맥을 이해하고 자연스러운 문장으로 복원해주세요:\n\n"
            "원본: 긁지 마라소리 안하니 너무 좋요 혹시나 좋졌다 말하면 부정탈까봐 조용히 살고 있어요\n\n"
            "복원된 문장:"
        ]
        
        for i, prompt in enumerate(test_prompts):
            logger.info(f"테스트 프롬프트 {i+1}:\n{prompt}")
            
            # 추론 시간 측정 시작
            infer_start = time.time()
            
            # 텍스트 생성
            generated_texts = generator(
                prompt,
                max_new_tokens=50,
                do_sample=True,
                temperature=0.7,
                top_p=0.9,
                num_return_sequences=1,
                pad_token_id=tokenizer.eos_token_id
            )
            
            # 추론 시간 측정 종료
            infer_time = time.time() - infer_start
            
            # 결과 추출
            full_response = generated_texts[0]['generated_text']
            restored_text = full_response.split("복원된 문장:")[-1].strip()
            
            logger.info(f"생성 결과: {restored_text}")
            logger.info(f"추론 시간: {infer_time:.2f}초")
            logger.info("-" * 50)
        
        # 메모리 사용량 출력
        if device == "cuda":
            memory_allocated = torch.cuda.memory_allocated(0) / 1024**3
            memory_reserved = torch.cuda.memory_reserved(0) / 1024**3
            logger.info(f"GPU 메모리 사용량: 할당됨 {memory_allocated:.2f} GB, 예약됨 {memory_reserved:.2f} GB")
        
        # 성공 메시지
        logger.info(f"모델 테스트 완료: {model_name}")
        return True
        
    except Exception as e:
        logger.error(f"모델 테스트 중 오류 발생: {str(e)}")
        return False

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="생성형 모델 테스트")
    parser.add_argument("--model", default="EleutherAI/polyglot-ko-1.3b", 
                        help="테스트할 모델 이름")
    parser.add_argument("--device", default="cuda", choices=["cuda", "cpu"], 
                        help="사용할 디바이스")
    parser.add_argument("--use-4bit", action="store_true", 
                        help="4bit 양자화 사용")
    parser.add_argument("--use-8bit", action="store_true", 
                        help="8bit 양자화 사용")
    
    args = parser.parse_args()
    
    # 모델 테스트
    test_model(
        model_name=args.model,
        device=args.device,
        use_4bit=args.use_4bit,
        use_8bit=args.use_8bit
    )
