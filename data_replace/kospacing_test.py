"""
KoSpacing을 사용하여 단일 JSON 파일의 'content' 필드에 띄어쓰기 적용하기 (테스트용)

사용법:
1. `pip install -r requirements_kospacing.txt` 명령으로 필요한 패키지 설치
2. `python kospacing_test.py` 명령으로 실행
"""

import os
import json
import time
from pykospacing import Spacing

def apply_spacing_to_single_file(input_path, output_path=None):
    """
    지정된 JSON 파일을 읽어 'content' 필드에 띄어쓰기를 적용하고 결과를 저장합니다.
    
    Args:
        input_path (str): 입력 JSON 파일 경로
        output_path (str, optional): 결과를 저장할 출력 파일 경로. 지정하지 않으면 입력 파일 경로에 '_spaced' 접미사 붙임
    """
    # 출력 파일 경로 설정
    if output_path is None:
        file_name = os.path.basename(input_path)
        file_name_without_ext, ext = os.path.splitext(file_name)
        dir_name = os.path.dirname(input_path)
        output_path = os.path.join(dir_name, f"{file_name_without_ext}_spaced{ext}")
    
    try:
        # JSON 파일 읽기
        with open(input_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        print(f"파일 '{input_path}'을 성공적으로 읽었습니다.")
        
        # 변경 전 첫 번째 항목의 'content' 필드 출력
        if data and 'content' in data[0]:
            print("\n원본 텍스트 샘플:")
            print(data[0]['content'])
        
        # 각 항목의 'content' 필드에 띄어쓰기 적용
        item_count = 0
        comment_count = 0
        
        for item in data:
            if 'content' in item and item['content']:
                # KoSpacing 모델을 사용하여 띄어쓰기 적용
                try:
                    item['content'] = Spacing(item['content'])
                    item_count += 1
                except Exception as e:
                    print(f"경고: content 처리 중 오류 발생: {str(e)}")
            
            # 댓글의 'content' 필드에도 띄어쓰기 적용 (있는 경우)
            if 'comments' in item and item['comments']:
                for comment in item['comments']:
                    if 'content' in comment and comment['content']:
                        try:
                            comment['content'] = Spacing(comment['content'])
                            comment_count += 1
                        except Exception as e:
                            print(f"경고: 댓글 처리 중 오류 발생: {str(e)}")
        
        # 변경 후 첫 번째 항목의 'content' 필드 출력
        if data and 'content' in data[0]:
            print("\n띄어쓰기 적용 후 텍스트 샘플:")
            print(data[0]['content'])
        
        # 결과 JSON 파일 저장
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=4)
        
        print(f"\n처리 완료! 총 {item_count}개 항목, {comment_count}개 댓글 처리됨")
        print(f"결과는 '{output_path}'에 저장되었습니다.")
        
    except Exception as e:
        print(f"오류: 파일 처리 중 실패: {str(e)}")

if __name__ == "__main__":
    # 테스트할 파일 경로 설정
    input_path = "/Users/link/Documents/SKN/4th_project_3/data_replace/fixed/1.json"
    output_path = "/Users/link/Documents/SKN/4th_project_3/data_replace/fixed_spaced/1.json"
    
    # 시작 시간 기록
    start_time = time.time()
    
    # 처리 실행
    apply_spacing_to_single_file(input_path, output_path)
    
    # 종료 시간 기록 및 소요 시간 출력
    end_time = time.time()
    elapsed_time = end_time - start_time
    print(f"총 소요 시간: {elapsed_time:.2f}초")
