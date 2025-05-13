import os
import json
import logging
import argparse
from tqdm import tqdm
from text_restoration import TextRestoration

# 로깅 설정
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler("/Users/link/Documents/SKN/4th_project_3/data_replace/evaluation_logs.txt"),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

def evaluate_restoration(original_file, restored_file, output_file):
    """
    원본 파일과 복원된 파일을 비교하여 결과 평가
    
    Args:
        original_file (str): 원본 JSON 파일 경로
        restored_file (str): 복원된 JSON 파일 경로
        output_file (str): 평가 결과를 저장할 파일 경로
    """
    try:
        # 원본 파일 읽기
        with open(original_file, 'r', encoding='utf-8') as f:
            original_data = json.load(f)
        
        # 복원 파일 읽기
        with open(restored_file, 'r', encoding='utf-8') as f:
            restored_data = json.load(f)
        
        # 평가 결과
        evaluation_results = {
            "file": os.path.basename(original_file),
            "comparisons": []
        }
        
        # 데이터가 리스트인 경우
        if isinstance(original_data, list) and isinstance(restored_data, list):
            for i, (orig_item, rest_item) in enumerate(zip(original_data, restored_data)):
                # content 필드 비교
                if 'content' in orig_item and 'content' in rest_item:
                    orig_content = orig_item['content']
                    rest_content = rest_item['content']
                    
                    # 평가 항목 추가
                    comparison = {
                        "item_index": i,
                        "original_content": orig_content,
                        "restored_content": rest_content,
                        "changed": orig_content != rest_content,
                        "comments_comparisons": []
                    }
                    
                    # 댓글 필드 비교
                    if 'comments' in orig_item and 'comments' in rest_item:
                        for j, (orig_comment, rest_comment) in enumerate(zip(orig_item['comments'], rest_item['comments'])):
                            if 'content' in orig_comment and 'content' in rest_comment:
                                comment_comparison = {
                                    "comment_index": j,
                                    "original_content": orig_comment['content'],
                                    "restored_content": rest_comment['content'],
                                    "changed": orig_comment['content'] != rest_comment['content']
                                }
                                comparison["comments_comparisons"].append(comment_comparison)
                    
                    evaluation_results["comparisons"].append(comparison)
        
        # 평가 결과 저장
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(evaluation_results, f, ensure_ascii=False, indent=4)
            
        logger.info(f"평가 결과 저장 완료: {output_file}")
        
        # 변경된 항목 수 계산
        changed_items = sum(1 for comp in evaluation_results["comparisons"] if comp["changed"])
        total_items = len(evaluation_results["comparisons"])
        
        changed_comments = sum(
            1 for comp in evaluation_results["comparisons"] 
            for comment_comp in comp["comments_comparisons"] 
            if comment_comp["changed"]
        )
        total_comments = sum(len(comp["comments_comparisons"]) for comp in evaluation_results["comparisons"])
        
        logger.info(f"변경된 항목: {changed_items}/{total_items} ({changed_items/total_items*100:.2f}%)")
        if total_comments > 0:
            logger.info(f"변경된 댓글: {changed_comments}/{total_comments} ({changed_comments/total_comments*100:.2f}%)")
        
    except Exception as e:
        logger.error(f"평가 중 오류 발생: {str(e)}")

def evaluate_all_files(original_dir, restored_dir, output_dir):
    """
    지정된 디렉토리의 모든 복원 결과 평가
    
    Args:
        original_dir (str): 원본 파일 디렉토리
        restored_dir (str): 복원된 파일 디렉토리
        output_dir (str): 평가 결과 저장 디렉토리
    """
    # 출력 디렉토리가 없으면 생성
    if not os.path.exists(output_dir):
        os.makedirs(output_dir)
    
    # 원본 디렉토리의 모든 JSON 파일 목록
    files = [f for f in os.listdir(original_dir) if f.endswith('.json')]
    
    # 복원된 파일이 있는 것만 처리
    files = [f for f in files if os.path.exists(os.path.join(restored_dir, f))]
    
    logger.info(f"총 {len(files)} 개의 파일을 평가합니다.")
    
    for file in tqdm(files):
        original_file = os.path.join(original_dir, file)
        restored_file = os.path.join(restored_dir, file)
        output_file = os.path.join(output_dir, f"eval_{file}")
        
        evaluate_restoration(original_file, restored_file, output_file)
    
    logger.info("모든 파일 평가 완료")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="복원 결과 평가")
    parser.add_argument("--original", type=str, default="/Users/link/Documents/SKN/4th_project_3/data_replace/fixed_spaced", 
                        help="원본 파일 디렉토리")
    parser.add_argument("--restored", type=str, default="/Users/link/Documents/SKN/4th_project_3/data_replace/output", 
                        help="복원된 파일 디렉토리")
    parser.add_argument("--output", type=str, default="/Users/link/Documents/SKN/4th_project_3/data_replace/evaluation", 
                        help="평가 결과 저장 디렉토리")
    
    args = parser.parse_args()
    
    # 평가 실행
    evaluate_all_files(args.original, args.restored, args.output)
