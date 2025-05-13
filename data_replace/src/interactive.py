import os
import argparse
import logging
from text_restoration import TextRestoration

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

def interactive_restoration(model_name="klue/bert-base"):
    """
    사용자 입력 텍스트를 대화형으로 복원
    
    Args:
        model_name (str): 사용할 모델 이름
    """
    # 텍스트 복원 객체 생성
    restorer = TextRestoration(model_name=model_name)
    
    print("\n=== 대화형 텍스트 복원 ===")
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
            restored_text = restorer.restore_missing_characters(user_input)
            
            # 결과 출력
            print("\n원본:", user_input)
            print("복원:", restored_text)
            print()
            
        except Exception as e:
            logger.error(f"복원 중 오류 발생: {str(e)}")
            print(f"오류가 발생했습니다: {str(e)}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="대화형 텍스트 복원")
    parser.add_argument("--model", type=str, default="klue/bert-base", help="사용할 모델 이름")
    
    args = parser.parse_args()
    
    # 대화형 복원 실행
    interactive_restoration(model_name=args.model)
