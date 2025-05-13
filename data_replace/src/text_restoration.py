import torch
from transformers import AutoModelForMaskedLM, AutoTokenizer
import re
import os
import logging

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
    def __init__(self, model_name="klue/bert-base"):
        """
        빠진 글자를 복원하는 클래스 초기화
        
        Args:
            model_name (str): 사용할 사전 훈련된 모델 이름
        """
        logger.info(f"모델 로드 중: {model_name}")
        self.tokenizer = AutoTokenizer.from_pretrained(model_name)
        self.model = AutoModelForMaskedLM.from_pretrained(model_name)
        self.model.eval()  # 평가 모드로 설정
        logger.info("모델 로드 완료")
    
    def identify_missing_chars(self, text):
        """
        텍스트에서 한 글자씩 빠진 패턴을 찾아 마스크 토큰으로 대체
        
        Args:
            text (str): 처리할 텍스트
            
        Returns:
            tuple: (마스크된 텍스트, 마스크 위치 목록)
        """
        # 자연스럽지 않은 패턴 찾기
        # 예: '토피에' -> '아토피에', '장래' -> '장래에' 등
        
        # 한글 자모 패턴 (초성, 중성, 종성)
        # 한글 글자 간에 무작위로 한 글자가 빠진 것으로 보이는 패턴 찾기
        
        # 마스크 위치 저장
        mask_positions = []
        masked_text = text
        
        # 규칙 1: 단어 사이에 띄어쓰기가 없는 경우 (예: "집에가요" -> "집에 가요")
        # 규칙 2: 조사가 생략된 경우 (예: "학교갔어요" -> "학교에 갔어요")
        # 규칙 3: 자음이나 모음만 있는 경우 (예: "ㅁ시" -> "맛있다")
        
        # 한글만 추출하여 분석
        korean_words = re.findall(r'[가-힣]+', text)
        
        # 문맥상 부자연스러운 표현 찾기 (수동으로 정의한 패턴)
        # 여기에서는 전체 문장을 고려하는 방식으로 변경
        # 문장 단위로 분석 (마침표, 물음표, 느낌표 등으로 구분)
        sentences = re.split(r'[.!?]\s*', text)
        processed_text = text
        
        # 문맥 기반 복원을 위한 전처리
        for i, sentence in enumerate(sentences):
            if not sentence.strip():
                continue
            
            # 의미 있는 패턴 찾기
            # 예: '요즘 너무 덥지 않나요 여름 다시 찾온 것 같요'에서 '찾온'은 '찾아온'으로 복원해야 함
            
            # 여기서는 모든 단어를 BERT 모델에 넣어 빠진 글자 가능성 확인
            words = sentence.split()
            for j, word in enumerate(words):
                if len(word) >= 2:  # 2글자 이상의 단어만 처리
                    # 각 글자 사이에 마스크 토큰을 넣어보고 확률 확인
                    for k in range(len(word)-1):
                        # word[k]와 word[k+1] 사이에 글자가 빠졌을 가능성 확인
                        pass
        
        # 여기서는 단순히 모든 가능한 위치에 마스킹을 적용하는 대신
        # 전체 문장을 BERT에 입력하여 빠진 글자를 예측
        return processed_text, mask_positions
    
    def _get_context_window(self, text, start_idx, end_idx, window_size=50):
        """
        주어진 인덱스 주변의 문맥 윈도우를 추출
        
        Args:
            text (str): 전체 텍스트
            start_idx (int): 시작 인덱스
            end_idx (int): 종료 인덱스
            window_size (int): 앞뒤 문맥 윈도우 크기
            
        Returns:
            str: 문맥 윈도우 텍스트
        """
        text_len = len(text)
        context_start = max(0, start_idx - window_size)
        context_end = min(text_len, end_idx + window_size)
        
        return text[context_start:context_end]
    
    def restore_missing_characters(self, text):
        """
        텍스트에서 빠진 글자를 복원
        
        Args:
            text (str): 빠진 글자가 있는 텍스트
            
        Returns:
            str: 복원된 텍스트
        """
        logger.info("텍스트 복원 시작")
        
        # 문장 분리
        sentences = re.split(r'([.!?]\s*)', text)
        restored_text = ""
        
        for i in range(0, len(sentences), 2):
            sentence = sentences[i]
            if i + 1 < len(sentences):
                ending = sentences[i+1]
            else:
                ending = ""
            
            if not sentence.strip():
                restored_text += sentence + ending
                continue
            
            # 각 문장 내에서 빠진 글자 복원
            restored_sentence = self._restore_sentence(sentence)
            restored_text += restored_sentence + ending
        
        logger.info("텍스트 복원 완료")
        return restored_text
    
    def _restore_sentence(self, sentence):
        """
        한 문장 내에서 빠진 글자를 복원
        
        Args:
            sentence (str): 복원할 문장
            
        Returns:
            str: 복원된 문장
        """
        # 입력 문장
        original_sentence = sentence
        
        # 문장 토큰화
        tokens = self.tokenizer.tokenize(sentence)
        token_ids = self.tokenizer.convert_tokens_to_ids(tokens)
        
        # 전체 문장에 대한 마스킹 확률 검사
        restored_sentence = sentence
        
        # 한글 단어 찾기
        korean_words = re.findall(r'[가-힣]+', sentence)
        
        for word in korean_words:
            # 2글자 이상인 단어만 처리
            if len(word) < 2:
                continue
                
            # 단어 내에서 빠진 글자가 있을 수 있는 위치 모두 확인
            for i in range(len(word) + 1):
                # i 위치에 마스크 토큰 삽입
                test_word = word[:i] + self.tokenizer.mask_token + word[i:]
                
                # 원래 문장에서 해당 단어를 찾아 마스크 토큰 있는 단어로 대체한 문장 생성
                test_sentence = sentence.replace(word, test_word, 1)
                
                # 마스크 토큰 위치 찾기
                inputs = self.tokenizer(test_sentence, return_tensors="pt")
                mask_idx = torch.where(inputs["input_ids"][0] == self.tokenizer.mask_token_id)[0]
                
                # 마스크가 없으면 다음으로
                if len(mask_idx) == 0:
                    continue
                
                # 예측 실행
                with torch.no_grad():
                    outputs = self.model(**inputs)
                
                # 마스크 토큰 위치에서 가장 확률 높은 토큰 추출
                logits = outputs.logits
                mask_token_logits = logits[0, mask_idx, :]
                top_tokens = torch.topk(mask_token_logits, 5, dim=1).indices.tolist()[0]
                
                # 예측된 토큰을 문자로 변환
                predicted_tokens = [self.tokenizer.convert_ids_to_tokens(token) for token in top_tokens]
                
                # 예측된 토큰이 완전한 한글 글자인 경우만 고려
                valid_tokens = []
                for token in predicted_tokens:
                    # 워드피스 토큰의 ##은 제거
                    if token.startswith('##'):
                        token = token[2:]
                    # 한글 글자만 고려
                    if re.match(r'^[가-힣]$', token):
                        valid_tokens.append(token)
                
                if valid_tokens:
                    # 첫 번째 후보를 선택
                    predicted_char = valid_tokens[0]
                    
                    # 원래 단어에 예측 글자 삽입
                    new_word = word[:i] + predicted_char + word[i:]
                    
                    # 문맥에서 더 자연스러운지 확인 (나중에 구현)
                    
                    # 원래 문장에서 해당 단어를 새 단어로 대체 (한 번만)
                    restored_sentence = restored_sentence.replace(word, new_word, 1)
                    
                    # 로그 출력
                    logger.debug(f"단어: {word} -> {new_word} (삽입된 글자: {predicted_char})")
                    
                    # 단어가 이미 복원되었으므로 다음 단어로
                    break
        
        # 결과 출력
        if restored_sentence != original_sentence:
            logger.debug(f"원본 문장: {original_sentence}")
            logger.debug(f"복원 문장: {restored_sentence}")
        
        return restored_sentence
    
    def restore_text_from_json(self, content):
        """
        JSON content 필드의 텍스트에서 빠진 글자를 복원
        
        Args:
            content (str): JSON content 필드의 텍스트
            
        Returns:
            str: 복원된 텍스트
        """
        return self.restore_missing_characters(content)
