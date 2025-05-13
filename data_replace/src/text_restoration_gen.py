import torch
from transformers import AutoModelForCausalLM, AutoTokenizer, pipeline
import re
import os
import json
import logging
import tqdm
import gc

# 로깅 설정
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler("/Users/link/Documents/SKN/4th_project_3/data_replace/logs.txt"),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

class TextRestoration:
    def __init__(self, model_name="EleutherAI/polyglot-ko-1.3b", device="cuda", use_8bit=True):
        """
        생성형 모델을 사용한 텍스트 복원 클래스 초기화
        
        Args:
            model_name (str): 사용할 사전 훈련된 모델 이름
            device (str): 사용할 디바이스 (cuda 또는 cpu)
            use_8bit (bool): 8bit 양자화 사용 여부 (메모리 절약)
        """
        logger.info(f"모델 로드 중: {model_name}, 디바이스: {device}, 8bit: {use_8bit}")
        
        # CUDA 가용성 확인
        if device == "cuda" and not torch.cuda.is_available():
            logger.warning("CUDA를 사용할 수 없습니다. CPU로 전환합니다.")
            device = "cpu"
            use_8bit = False
        
        self.device = device
        
        # 토크나이저 로드
        self.tokenizer = AutoTokenizer.from_pretrained(model_name)
        
        # 모델 로드
        load_in_8bit = use_8bit and device == "cuda"
        if load_in_8bit:
            self.model = AutoModelForCausalLM.from_pretrained(
                model_name,
                device_map="auto",
                load_in_8bit=True,
                torch_dtype=torch.float16
            )
        else:
            self.model = AutoModelForCausalLM.from_pretrained(model_name)
            self.model = self.model.to(device)
        
        # 텍스트 생성 파이프라인 설정
        self.text_generator = pipeline(
            "text-generation",
            model=self.model,
            tokenizer=self.tokenizer,
            device=0 if device == "cuda" else -1
        )
        
        logger.info("모델 로드 완료")
        
        # 메모리 관리를 위한 가비지 컬렉션
        gc.collect()
        if device == "cuda":
            torch.cuda.empty_cache()
    
    def preprocess_text(self, text):
        """
        텍스트 전처리 - 자주 발생하는 패턴에 대한 규칙 기반 수정
        
        Args:
            text (str): 처리할 텍스트
            
        Returns:
            str: 전처리된 텍스트
        """
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
    
    def restore_text(self, text, max_length=200, prompt_prefix="다음 문장의 빠진 글자를 복원해주세요: "):
        """
        텍스트 복원 메인 함수
        
        Args:
            text (str): 복원할 텍스트
            max_length (int): 생성할 최대 토큰 수
            prompt_prefix (str): 프롬프트 접두사
            
        Returns:
            str: 복원된 텍스트
        """
        # 전처리
        preprocessed_text = self.preprocess_text(text)
        
        # 프롬프트 구성
        prompt = f"{prompt_prefix}{preprocessed_text}\n\n복원된 문장: "
        
        # 텍스트 생성
        try:
            logger.debug(f"프롬프트: {prompt}")
            
            # 생성 파라미터 설정
            generation_config = {
                "max_new_tokens": max_length,
                "do_sample": True,
                "temperature": 0.7,
                "top_p": 0.9,
                "num_return_sequences": 1,
                "pad_token_id": self.tokenizer.eos_token_id
            }
            
            # 텍스트 생성
            generated_texts = self.text_generator(
                prompt,
                **generation_config
            )
            
            # 생성된 텍스트에서 응답 부분만 추출
            full_response = generated_texts[0]['generated_text']
            restored_text = full_response.split("복원된 문장: ")[-1].strip()
            
            # 후처리 - 불필요한 부분 제거
            restored_text = restored_text.split("\n")[0].strip()
            
            logger.debug(f"복원 결과: {restored_text}")
            return restored_text
            
        except Exception as e:
            logger.error(f"텍스트 생성 중 오류 발생: {str(e)}")
            return preprocessed_text  # 오류 발생 시 전처리된 텍스트 반환
    
    def restore_long_text(self, text, chunk_size=150, overlap=20):
        """
        긴 텍스트를 청크 단위로 나눠서 복원
        
        Args:
            text (str): 복원할 긴 텍스트
            chunk_size (int): 청크 크기
            overlap (int): 청크 간 중복 크기
            
        Returns:
            str: 복원된 텍스트
        """
        # 짧은 텍스트는 바로 처리
        if len(text) <= chunk_size:
            return self.restore_text(text)
        
        # 문장 단위로 분리
        sentences = re.split(r'([.!?]\s*)', text)
        
        # 청크 구성
        chunks = []
        current_chunk = ""
        
        for i in range(0, len(sentences), 2):
            if i + 1 < len(sentences):
                sentence = sentences[i] + sentences[i+1]
            else:
                sentence = sentences[i]
            
            if len(current_chunk) + len(sentence) <= chunk_size:
                current_chunk += sentence
            else:
                chunks.append(current_chunk)
                current_chunk = sentence
        
        if current_chunk:
            chunks.append(current_chunk)
        
        # 각 청크 복원
        restored_chunks = []
        for i, chunk in enumerate(chunks):
            logger.info(f"청크 {i+1}/{len(chunks)} 복원 중...")
            restored_chunk = self.restore_text(chunk)
            restored_chunks.append(restored_chunk)
        
        # 복원된 청크 결합
        restored_text = "".join(restored_chunks)
        
        return restored_text
    
    def restore_text_from_json(self, content):
        """
        JSON content 필드의 텍스트에서 빠진 글자를 복원
        
        Args:
            content (str): JSON content 필드의 텍스트
            
        Returns:
            str: 복원된 텍스트
        """
        return self.restore_long_text(content)
    
    def clear_memory(self):
        """
        메모리 정리
        """
        gc.collect()
        if self.device == "cuda":
            torch.cuda.empty_cache()

def process_json_file(input_file_path, output_file_path, restorer):
    """
    JSON 파일에서 content 필드의 텍스트를 복원하여 새 파일로 저장
    
    Args:
        input_file_path (str): 입력 JSON 파일 경로
        output_file_path (str): 출력 JSON 파일 경로
        restorer (TextRestoration): 텍스트 복원 객체
    """
    try:
        # JSON 파일 읽기
        with open(input_file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
            
        # JSON 데이터가 리스트인 경우
        if isinstance(data, list):
            for item in data:
                if 'content' in item and item['content']:
                    # content 필드의 텍스트 복원
                    original_content = item['content']
                    restored_content = restorer.restore_text_from_json(original_content)
                    item['content'] = restored_content
                    
                    # 로그 출력
                    logger.info(f"원본: {original_content}")
                    logger.info(f"복원: {restored_content}")
                    logger.info("-" * 50)
                    
                    # 메모리 정리
                    restorer.clear_memory()
                    
                    # comments 필드가 있는 경우 각 댓글의 content도 복원
                    if 'comments' in item and isinstance(item['comments'], list):
                        for comment in item['comments']:
                            if 'content' in comment and comment['content']:
                                original_comment = comment['content']
                                restored_comment = restorer.restore_text_from_json(original_comment)
                                comment['content'] = restored_comment
                                
                                # 로그 출력
                                logger.debug(f"댓글 원본: {original_comment}")
                                logger.debug(f"댓글 복원: {restored_comment}")
                                
                                # 메모리 정리
                                restorer.clear_memory()
        
        # 복원된 데이터 저장
        with open(output_file_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=4)
            
        logger.info(f"파일 처리 완료: {input_file_path} -> {output_file_path}")
        
    except Exception as e:
        logger.error(f"파일 처리 중 오류 발생 {input_file_path}: {str(e)}")

def process_all_files(input_dir, output_dir, model_name="EleutherAI/polyglot-ko-1.3b", device="cuda", use_8bit=True):
    """
    지정된 디렉토리의 모든 JSON 파일을 처리
    
    Args:
        input_dir (str): 입력 디렉토리 경로
        output_dir (str): 출력 디렉토리 경로
        model_name (str): 사용할 모델 이름
        device (str): 사용할 디바이스 (cuda 또는 cpu)
        use_8bit (bool): 8bit 양자화 사용 여부
    """
    # 출력 디렉토리가 없으면 생성
    if not os.path.exists(output_dir):
        os.makedirs(output_dir)
    
    # 텍스트 복원 객체 생성
    restorer = TextRestoration(model_name=model_name, device=device, use_8bit=use_8bit)
    
    # 입력 디렉토리의 모든 JSON 파일 처리
    files = [f for f in os.listdir(input_dir) if f.endswith('.json')]
    logger.info(f"총 {len(files)} 개의 파일을 처리합니다.")
    
    for file in tqdm.tqdm(files):
        input_file_path = os.path.join(input_dir, file)
        output_file_path = os.path.join(output_dir, file)
        process_json_file(input_file_path, output_file_path, restorer)
    
    logger.info("모든 파일 처리 완료")

if __name__ == "__main__":
    # 설정
    input_dir = "/Users/link/Documents/SKN/4th_project_3/data_replace/fixed_spaced"
    output_dir = "/Users/link/Documents/SKN/4th_project_3/data_replace/output"
    model_name = "EleutherAI/polyglot-ko-1.3b"  # 한국어 생성형 모델
    device = "cuda"  # GPU 사용
    use_8bit = True  # 메모리 절약을 위한 8bit 양자화
    
    # 모든 파일 처리
    process_all_files(input_dir, output_dir, model_name, device, use_8bit)
