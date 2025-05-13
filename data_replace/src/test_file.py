import os
import logging
import argparse
import json
from text_restoration import TextRestoration

# 로깅 설정
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler("/Users/link/Documents/SKN/4th_project_3/data_replace/test_file_logs.txt"),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

def test_single_file(file_path, output_file_path, model_name="klue/bert-base"):
    """
    단일 JSON 파일로 복원 기능 테스트
    
    Args:
        file_path (str): 테스트할 JSON 파일 경로
        output_file_path (str): 복원 결과를 저장할 파일 경로
        model_name (str): 사용할 모델 이름
    """
    # 텍스트 복원 객체 생성
    restorer = TextRestoration(model_name=model_name)
    
    # 출력 디렉토리가 없으면 생성
    output_dir = os.path.dirname(output_file_path)
    if not os.path.exists(output_dir):
        os.makedirs(output_dir)
    
    try:
        # JSON 파일 읽기
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        # 원본 데이터 백업
        original_data = json.loads(json.dumps(data))
        
        # JSON 데이터가 리스트인 경우
        if isinstance(data, list):
            # 첫 번째 항목만 처리 (테스트 목적)
            item = data[0]
            if 'content' in item and item['content']:
                # content 필드의 텍스트 복원
                original_content = item['content']
                restored_content = restorer.restore_text_from_json(original_content)
                item['content'] = restored_content
                
                # 로그 출력
                logger.info(f"원본: {original_content}")
                logger.info(f"복원: {restored_content}")
                logger.info("-" * 50)
                
                # comments 필드의 첫 3개 댓글만 처리 (테스트 목적)
                if 'comments' in item and isinstance(item['comments'], list):
                    for i, comment in enumerate(item['comments'][:3]):
                        if 'content' in comment and comment['content']:
                            original_comment = comment['content']
                            restored_comment = restorer.restore_text_from_json(original_comment)
                            comment['content'] = restored_comment
                            
                            # 로그 출력
                            logger.info(f"댓글 {i+1} 원본: {original_comment}")
                            logger.info(f"댓글 {i+1} 복원: {restored_comment}")
                            logger.info("-" * 30)
        
        # 복원된 데이터 저장
        with open(output_file_path, 'w', encoding='utf-8') as f:
            json.dump([data[0], original_data[0]], f, ensure_ascii=False, indent=4)
            
        logger.info(f"복원 결과 저장 완료: {output_file_path}")
        
    except Exception as e:
        logger.error(f"파일 처리 중 오류 발생 {file_path}: {str(e)}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="단일 JSON 파일로 복원 기능 테스트")
    parser.add_argument("--file", type=str, default="/Users/link/Documents/SKN/4th_project_3/data_replace/fixed_spaced/1.json", 
                        help="테스트할 JSON 파일 경로")
    parser.add_argument("--output", type=str, default="/Users/link/Documents/SKN/4th_project_3/data_replace/output/test_result.json", 
                        help="복원 결과를 저장할 파일 경로")
    parser.add_argument("--model", type=str, default="klue/bert-base", 
                        help="사용할 모델 이름")
    
    args = parser.parse_args()
    
    # 테스트 실행
    test_single_file(args.file, args.output, args.model)
