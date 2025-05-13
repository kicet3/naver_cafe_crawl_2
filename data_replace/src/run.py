import os
import argparse
import logging
from text_restoration import TextRestoration

def main():
    """
    명령줄에서 텍스트 복원 도구 실행
    """
    parser = argparse.ArgumentParser(description="텍스트 복원 도구")
    subparsers = parser.add_subparsers(dest="command", help="실행할 명령")
    
    # 단일 파일 처리 명령
    file_parser = subparsers.add_parser("file", help="단일 JSON 파일 처리")
    file_parser.add_argument("--input", type=str, required=True, help="입력 JSON 파일 경로")
    file_parser.add_argument("--output", type=str, required=True, help="출력 JSON 파일 경로")
    file_parser.add_argument("--model", type=str, default="klue/bert-base", help="사용할 모델 이름")
    
    # 디렉토리 처리 명령
    dir_parser = subparsers.add_parser("dir", help="디렉토리 내 모든 JSON 파일 처리")
    dir_parser.add_argument("--input", type=str, required=True, help="입력 디렉토리 경로")
    dir_parser.add_argument("--output", type=str, required=True, help="출력 디렉토리 경로")
    dir_parser.add_argument("--model", type=str, default="klue/bert-base", help="사용할 모델 이름")
    
    # 샘플 테스트 명령
    sample_parser = subparsers.add_parser("sample", help="샘플 텍스트로 테스트")
    sample_parser.add_argument("--model", type=str, default="klue/bert-base", help="사용할 모델 이름")
    
    # 대화형 모드 명령
    interactive_parser = subparsers.add_parser("interactive", help="대화형 텍스트 복원")
    interactive_parser.add_argument("--model", type=str, default="klue/bert-base", help="사용할 모델 이름")
    
    # 평가 명령
    eval_parser = subparsers.add_parser("evaluate", help="복원 결과 평가")
    eval_parser.add_argument("--original", type=str, required=True, help="원본 파일 또는 디렉토리 경로")
    eval_parser.add_argument("--restored", type=str, required=True, help="복원된 파일 또는 디렉토리 경로")
    eval_parser.add_argument("--output", type=str, required=True, help="평가 결과 저장 경로")
    
    args = parser.parse_args()
    
    # 명령에 따라 처리
    if args.command == "file":
        from test_file import test_single_file
        test_single_file(args.input, args.output, args.model)
    
    elif args.command == "dir":
        from main import process_all_files
        process_all_files(args.input, args.output, args.model)
    
    elif args.command == "sample":
        from test_sample import test_sample_text
        test_sample_text(args.model)
    
    elif args.command == "interactive":
        from interactive import interactive_restoration
        interactive_restoration(args.model)
    
    elif args.command == "evaluate":
        # 파일인지 디렉토리인지 확인
        if os.path.isdir(args.original) and os.path.isdir(args.restored):
            from evaluate import evaluate_all_files
            evaluate_all_files(args.original, args.restored, args.output)
        elif os.path.isfile(args.original) and os.path.isfile(args.restored):
            from evaluate import evaluate_restoration
            evaluate_restoration(args.original, args.restored, args.output)
        else:
            print("오류: 원본과 복원 경로는 모두 파일이거나 모두 디렉토리여야 합니다.")
    
    else:
        parser.print_help()

if __name__ == "__main__":
    main()
