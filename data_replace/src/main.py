import os
import json
import logging
from tqdm import tqdm
from text_restoration import TextRestoration

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
        
        # 복원된 데이터 저장
        with open(output_file_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=4)
            
        logger.info(f"파일 처리 완료: {input_file_path} -> {output_file_path}")
        
    except Exception as e:
        logger.error(f"파일 처리 중 오류 발생 {input_file_path}: {str(e)}")

def process_all_files(input_dir, output_dir, model_name="klue/bert-base"):
    """
    지정된 디렉토리의 모든 JSON 파일을 처리
    
    Args:
        input_dir (str): 입력 디렉토리 경로
        output_dir (str): 출력 디렉토리 경로
        model_name (str): 사용할 모델 이름
    """
    # 출력 디렉토리가 없으면 생성
    if not os.path.exists(output_dir):
        os.makedirs(output_dir)
    
    # 텍스트 복원 객체 생성
    restorer = TextRestoration(model_name=model_name)
    
    # 입력 디렉토리의 모든 JSON 파일 처리
    files = [f for f in os.listdir(input_dir) if f.endswith('.json')]
    logger.info(f"총 {len(files)} 개의 파일을 처리합니다.")
    
    for file in tqdm(files):
        input_file_path = os.path.join(input_dir, file)
        output_file_path = os.path.join(output_dir, file)
        process_json_file(input_file_path, output_file_path, restorer)
    
    logger.info("모든 파일 처리 완료")

if __name__ == "__main__":
    # 설정
    input_dir = "/Users/link/Documents/SKN/4th_project_3/data_replace/fixed_spaced"
    output_dir = "/Users/link/Documents/SKN/4th_project_3/data_replace/output"
    model_name = "klue/bert-base"  # 또는 다른 한국어 모델
    
    # 모든 파일 처리
    process_all_files(input_dir, output_dir, model_name)
