import os
import json
import logging
import argparse
from tqdm import tqdm
import torch
import re
from transformers import AutoModelForCausalLM, AutoTokenizer, BitsAndBytesConfig, pipeline

# 로깅 설정
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler("/Users/link/Documents/SKN/4th_project_3/data_replace/batch_logs.txt"),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

class TextRestorer:
    def __init__(self, model_name="EleutherAI/polyglot-ko-1.3b", device="cuda", use_4bit=True, use_8bit=False):
        """
        생성형 모델을 사용한 텍스트 복원 클래스 초기화
        
        Args:
            model_name (str): 사용할 모델 이름
            device (str): 사용할 디바이스 (cuda 또는 cpu)
            use_4bit (bool): 4bit 양자화 사용 여부
            use_8bit (bool): 8bit 양자화 사용 여부 (4bit보다 우선순위 낮음)
        """
        logger.info(f"모델 로드 중: {model_name}, 디바이스: {device}")
        
        # CUDA 가용성 확인
        if device == "cuda" and not torch.cuda.is_available():
            logger.warning("CUDA를 사용할 수 없습니다. CPU로 전환합니다.")
            device = "cpu"
            use_4bit = False
            use_8bit = False
        
        # 토크나이저 로드
        self.tokenizer = AutoTokenizer.from_pretrained(model_name)
        
        # 양자화 설정
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
            model.to(device)
        
        # 텍스트 생성 파이프라인 설정
        self.text_generator = pipeline(
            "text-generation",
            model=model,
            tokenizer=self.tokenizer,
            device=0 if device == "cuda" else -1
        )
        
        logger.info("모델 로드 완료")
    
    def preprocess_text(self, text):
        """
        텍스트 전처리 - 자주 발생하는 패턴에 대한 규칙 기반 수정
        """
        patterns = {
            r'토피\b': '아토피',
            r'토피(가|는|도|를|에|의|과|와|로)': r'아토피\1',
            r'스테\b': '스테로이드',
            r'스테(가|는|도|를|에|의|과|와|로)': r'스테로이드\1',
            # 더 많은 패턴을 추가할 수 있습니다.
        }
        
        for pattern, replacement in patterns.items():
            text = re.sub(pattern, replacement, text)
        
        return text
    
    def restore_text(self, text, max_new_tokens=200):
        """
        텍스트 복원
        
        Args:
            text (str): 복원할 텍스트
            max_new_tokens (int): 생성할 최대 토큰 수
            
        Returns:
            str: 복원된 텍스트
        """
        # 전처리
        preprocessed_text = self.preprocess_text(text)
        
        # 프롬프트 구성
        prompt = f"""다음 텍스트는 한글자씩 빠져있는 문장입니다. 문맥을 이해하고 자연스러운 문장으로 복원해주세요:

원본: {preprocessed_text}

복원된 문장:"""
        
        # 텍스트 생성
        try:
            generated_texts = self.text_generator(
                prompt,
                max_new_tokens=max_new_tokens,
                do_sample=True,
                temperature=0.7,
                top_p=0.9,
                num_return_sequences=1,
                pad_token_id=self.tokenizer.eos_token_id
            )
            
            # 생성된 텍스트에서 응답 부분만 추출
            full_response = generated_texts[0]['generated_text']
            restored_text = full_response.split("복원된 문장:")[-1].strip()
            
            # 후처리 - 불필요한 부분 제거
            restored_text = restored_text.split("\n")[0].strip()
            
            return restored_text
            
        except Exception as e:
            logger.error(f"텍스트 생성 중 오류 발생: {str(e)}")
            return preprocessed_text  # 오류 발생 시 전처리된 텍스트 반환
    
    def restore_long_text(self, text, chunk_size=200):
        """
        긴 텍스트를 문장 단위로 나눠서 복원
        
        Args:
            text (str): 복원할 긴 텍스트
            chunk_size (int): 청크 최대 길이
            
        Returns:
            str: 복원된 텍스트
        """
        # 짧은 텍스트는 바로 처리
        if len(text) <= chunk_size:
            return self.restore_text(text)
        
        # 문장 단위로 분리
        import re
        sentences = re.split(r'([.!?]\s*)', text)
        combined_sentences = []
        
        # 문장 단위를 의미 있게 결합
        i = 0
        while i < len(sentences):
            sentence = sentences[i]
            if i + 1 < len(sentences):
                sentence += sentences[i+1]  # 구분자 추가
            combined_sentences.append(sentence)
            i += 2
        
        # 적절한 크기로 청크 생성
        chunks = []
        current_chunk = ""
        
        for sentence in combined_sentences:
            if len(current_chunk) + len(sentence) <= chunk_size:
                current_chunk += sentence
            else:
                if current_chunk:
                    chunks.append(current_chunk)
                current_chunk = sentence
        
        if current_chunk:
            chunks.append(current_chunk)
        
        # 각 청크 복원
        logger.info(f"텍스트를 {len(chunks)} 개의 청크로 나눠서 처리합니다.")
        restored_chunks = []
        
        for i, chunk in enumerate(chunks):
            logger.info(f"청크 {i+1}/{len(chunks)} 처리 중...")
            restored_chunk = self.restore_text(chunk)
            restored_chunks.append(restored_chunk)
        
        # 복원된 청크 결합
        restored_text = "".join(restored_chunks)
        
        return restored_text

def process_json_file(restorer, input_path, output_path):
    """
    단일 JSON 파일 처리
    
    Args:
        restorer (TextRestorer): 텍스트 복원 객체
        input_path (str): 입력 파일 경로
        output_path (str): 출력 파일 경로
    """
    try:
        # JSON 파일 읽기
        with open(input_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        # 데이터가 리스트인 경우
        if isinstance(data, list):
            for item in data:
                if 'content' in item and item['content']:
                    # content 필드의 텍스트 복원
                    original_content = item['content']
                    restored_content = restorer.restore_long_text(original_content)
                    item['content'] = restored_content
                    
                    # 로그 출력
                    logger.info(f"원본: {original_content}")
                    logger.info(f"복원: {restored_content}")
                    logger.info("-" * 50)
                    
                    # comments 필드가 있는 경우 각 댓글의 content도 복원
                    if 'comments' in item and isinstance(item['comments'], list):
                        for comment in item['comments']:
                            if 'content' in comment and comment['content']:
                                original_comment = comment['content']
                                restored_comment = restorer.restore_text(original_comment)
                                comment['content'] = restored_comment
                                
                                # 로그 출력
                                logger.debug(f"댓글 원본: {original_comment}")
                                logger.debug(f"댓글 복원: {restored_comment}")
        
        # 복원된 데이터 저장
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=4)
            
        logger.info(f"파일 처리 완료: {input_path} -> {output_path}")
        
    except Exception as e:
        logger.error(f"파일 처리 중 오류 발생 {input_path}: {str(e)}")

def process_directory(restorer, input_dir, output_dir):
    """
    디렉토리 내 모든 JSON 파일 처리
    
    Args:
        restorer (TextRestorer): 텍스트 복원 객체
        input_dir (str): 입력 디렉토리 경로
        output_dir (str): 출력 디렉토리 경로
    """
    # 출력 디렉토리가 없으면 생성
    if not os.path.exists(output_dir):
        os.makedirs(output_dir)
    
    # 모든 JSON 파일 목록
    files = [f for f in os.listdir(input_dir) if f.endswith('.json')]
    logger.info(f"총 {len(files)} 개의 파일을 처리합니다.")
    
    # 각 파일 처리
    for file in tqdm(files):
        input_path = os.path.join(input_dir, file)
        output_path = os.path.join(output_dir, file)
        process_json_file(restorer, input_path, output_path)
    
    logger.info("모든 파일 처리 완료")

def main():
    parser = argparse.ArgumentParser(description="생성형 모델 기반 텍스트 복원")
    parser.add_argument("--input", required=True, help="입력 파일 또는 디렉토리 경로")
    parser.add_argument("--output", required=True, help="출력 파일 또는 디렉토리 경로")
    parser.add_argument("--model", default="EleutherAI/polyglot-ko-1.3b", help="사용할 모델 이름")
    parser.add_argument("--device", default="cuda", choices=["cuda", "cpu"], help="사용할 디바이스")
    parser.add_argument("--use-4bit", action="store_true", help="4bit 양자화 사용")
    parser.add_argument("--use-8bit", action="store_true", help="8bit 양자화 사용")
    
    args = parser.parse_args()
    
    # 텍스트 복원 객체 생성
    restorer = TextRestorer(
        model_name=args.model,
        device=args.device,
        use_4bit=args.use_4bit,
        use_8bit=args.use_8bit
    )
    
    # 파일 또는 디렉토리 처리
    if os.path.isdir(args.input):
        process_directory(restorer, args.input, args.output)
    else:
        process_json_file(restorer, args.input, args.output)

if __name__ == "__main__":
    main()
