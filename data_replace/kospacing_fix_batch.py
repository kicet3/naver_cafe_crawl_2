"""
KoSpacing을 사용하여 JSON 파일의 'content' 필드에 띄어쓰기 적용하기 (배치 처리 버전)

사용법:
1. `pip install -r requirements_kospacing.txt` 명령으로 필요한 패키지 설치
2. `python kospacing_fix_batch.py` 명령으로 실행
"""

import os
import json
import time
import re
from tqdm import tqdm
from kospacing import spacing

def clean_text_for_spacing(text):
    """
    KoSpacing에 전달하기 전에 문제가 될 수 있는 특수 문자를 처리합니다.
    """
    # 정규표현식 문제를 일으킬 수 있는 문자들을 임시로 대체
    text = re.sub(r'[\(\)\[\]\{\}]', ' ', text)  # 괄호 제거
    text = re.sub(r'[+*?]', ' ', text)  # 반복 관련 특수 문자 제거
    
    # 이모지나 특수 문자 패턴 제거
    text = re.sub(r'[^\w\s\.,;:!?~\-]', ' ', text)
    
    return text

def apply_spacing_safely(text):
    """
    안전하게 띄어쓰기를 적용합니다. 오류 발생 시 원본 텍스트 반환
    """
    if not text or len(text.strip()) == 0:
        return text
    
    try:
        # 특수 문자 처리
        cleaned_text = clean_text_for_spacing(text)
        # 띄어쓰기 적용
        spaced_text = spacing(cleaned_text)
        return spaced_text
    except Exception as e:
        print(f"경고: 텍스트 처리 중 오류 발생: {str(e)[:50]}")
        return text  # 오류 발생 시 원본 텍스트 반환

def apply_spacing_to_json_files_batch(input_dir, output_dir=None, batch_size=10):
    """
    지정된 디렉토리의 모든 JSON 파일을 배치 단위로 읽어 'content' 필드에 띄어쓰기를 적용하고 결과를 저장합니다.
    
    Args:
        input_dir (str): JSON 파일이 있는 입력 디렉토리 경로
        output_dir (str, optional): 결과를 저장할 출력 디렉토리 경로. 지정하지 않으면 입력 디렉토리에 '_spaced' 접미사를 붙인 경로 사용
        batch_size (int): 한 번에 처리할 파일 수
    """
    # 출력 디렉토리 설정
    if output_dir is None:
        parent_dir = os.path.dirname(input_dir)
        dir_name = os.path.basename(input_dir)
        output_dir = os.path.join(parent_dir, f"{dir_name}_spaced")
    
    # 출력 디렉토리가 없으면 생성
    if not os.path.exists(output_dir):
        os.makedirs(output_dir)
        print(f"생성된 출력 디렉토리: {output_dir}")
    
    # 입력 디렉토리의 모든 JSON 파일 목록 가져오기
    json_files = [f for f in os.listdir(input_dir) if f.endswith('.json')]
    total_files = len(json_files)
    print(f"총 {total_files}개의 JSON 파일을 처리합니다.")
    
    # 배치 처리
    success_count = 0
    fail_count = 0
    
    for i in range(0, total_files, batch_size):
        batch_files = json_files[i:min(i+batch_size, total_files)]
        print(f"배치 처리 중: {i+1}~{min(i+len(batch_files), total_files)} / {total_files}")
        
        for file_name in tqdm(batch_files, desc=f"배치 {i//batch_size + 1} 처리 중"):
            input_path = os.path.join(input_dir, file_name)
            output_path = os.path.join(output_dir, file_name)
            
            try:
                # JSON 파일 읽기
                with open(input_path, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                
                # 각 항목의 'content' 필드에 띄어쓰기 적용
                for item in data:
                    if 'content' in item and item['content']:
                        item['content'] = apply_spacing_safely(item['content'])
                    
                    # 댓글의 'content' 필드에도 띄어쓰기 적용 (있는 경우)
                    if 'comments' in item and item['comments']:
                        for comment in item['comments']:
                            if 'content' in comment and comment['content']:
                                comment['content'] = apply_spacing_safely(comment['content'])
                
                # 결과 JSON 파일 저장
                with open(output_path, 'w', encoding='utf-8') as f:
                    json.dump(data, f, ensure_ascii=False, indent=4)
                
                success_count += 1
                
            except Exception as e:
                print(f"오류: {file_name} 파일 처리 중 실패: {str(e)[:100]}")
                fail_count += 1
    
    print(f"처리 완료! 성공: {success_count}개, 실패: {fail_count}개")
    print(f"결과는 {output_dir} 디렉토리에 저장되었습니다.")

if __name__ == "__main__":
    # 입력 및 출력 디렉토리 설정
    input_dir = "/Users/link/Documents/SKN/4th_project_3/data_replace/fixed"
    output_dir = "/Users/link/Documents/SKN/4th_project_3/data_replace/fixed_spaced"
    
    # 배치 크기 설정
    batch_size = 10
    
    # 시작 시간 기록
    start_time = time.time()
    
    # 처리 실행
    apply_spacing_to_json_files_batch(input_dir, output_dir, batch_size)
    
    # 종료 시간 기록 및 소요 시간 출력
    end_time = time.time()
    elapsed_time = end_time - start_time
    print(f"총 소요 시간: {elapsed_time:.2f}초")