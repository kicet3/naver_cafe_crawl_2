import os
import logging
import argparse
from text_restoration import TextRestoration

# 로깅 설정
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler("/Users/link/Documents/SKN/4th_project_3/data_replace/sample_test_logs.txt"),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

def test_sample_text(model_name="klue/bert-base"):
    """
    샘플 텍스트로 복원 기능 테스트
    
    Args:
        model_name (str): 사용할 모델 이름
    """
    # 텍스트 복원 객체 생성
    restorer = TextRestoration(model_name=model_name)
    
    # 테스트 케이스들
    test_cases = [
        "요즘 너무 덥지 않나요 여름 다시 찾온 것 같요 ㅠ",
        "빙수 넣어놓으려 구했는데 게으른 저..칭찬합니다ㅋㅋㅋ",
        "토피들 날씨렇게 요 한 날에는 비사태되는 거 같요!",
        "저희는 보습을 예전보다 많줄여서 침저녁 두 번만 하는데..어린 집다니는 둘째는 어린 집에서 한 번 더 해주시고요!",
        "을에는 확실히 계절뀌는 간에 애들 피부 좀 푸석하더라구요 !",
        "명절 앞두고 피부관리해서야 해요 🥲🥲",
        "세부 한 달 동안 피부 다 뒤집어져서 포하고 집에 와서 관리하니 좋졌어요",
        "긁지 마라소리 안하니 너무 좋요 혹시나 좋졌다 말하면 부정탈까봐 조용히 살고 있어요",
        "모든 들 피부 안정되길라요",
        "차영검에서 토피 소견 받고 락티케어 에스반 4일 르고 쏙 들어서에 스트라md림 처방 받쓰는 중예요",
        "에스트라는 얼굴 3번씩 하루 5번 르라 하셨어요",
        "다리는 들어갈 미안보여서 요카페 검색해 보니",
    ]
    
    for i, test_case in enumerate(test_cases):
        logger.info(f"테스트 케이스 {i+1}:")
        logger.info(f"원본: {test_case}")
        
        # 빠진 글자 복원
        restored_text = restorer.restore_missing_characters(test_case)
        
        logger.info(f"복원: {restored_text}")
        logger.info("-" * 50)

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="샘플 텍스트로 복원 기능 테스트")
    parser.add_argument("--model", type=str, default="klue/bert-base", help="사용할 모델 이름")
    
    args = parser.parse_args()
    
    # 테스트 실행
    test_sample_text(model_name=args.model)
