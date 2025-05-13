import os
import argparse
import subprocess

def run_command(cmd, desc):
    """
    명령어 실행 함수
    
    Args:
        cmd (str): 실행할 명령어
        desc (str): 명령어 설명
    """
    print(f"\n[실행] {desc}")
    print(f"명령어: {cmd}")
    
    # 명령어 실행
    process = subprocess.Popen(
        cmd,
        shell=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True
    )
    
    # 실시간 출력
    for line in process.stdout:
        print(line.strip())
    
    # 종료 코드 확인
    process.wait()
    if process.returncode != 0:
        print(f"오류 발생: {process.stderr.read()}")
        return False
    
    return True

def main():
    parser = argparse.ArgumentParser(description="텍스트 복원 프로젝트 실행 스크립트")
    subparsers = parser.add_subparsers(dest="command", help="실행할 명령")
    
    # 모델 테스트 명령
    test_parser = subparsers.add_parser("test", help="모델 테스트")
    test_parser.add_argument("--model", default="EleutherAI/polyglot-ko-1.3b", help="테스트할 모델 이름")
    test_parser.add_argument("--device", default="cuda", choices=["cuda", "cpu"], help="사용할 디바이스")
    test_parser.add_argument("--use-4bit", action="store_true", help="4bit 양자화 사용")
    test_parser.add_argument("--use-8bit", action="store_true", help="8bit 양자화 사용")
    
    # 대화형 모드 명령
    interactive_parser = subparsers.add_parser("interactive", help="대화형 텍스트 복원")
    interactive_parser.add_argument("--model", default="EleutherAI/polyglot-ko-1.3b", help="사용할 모델 이름")
    interactive_parser.add_argument("--device", default="cuda", choices=["cuda", "cpu"], help="사용할 디바이스")
    interactive_parser.add_argument("--no-quantization", action="store_true", help="양자화를 사용하지 않음")
    
    # 배치 처리 명령
    batch_parser = subparsers.add_parser("batch", help="배치 처리")
    batch_parser.add_argument("--input", default="/Users/link/Documents/SKN/4th_project_3/data_replace/fixed_spaced", help="입력 디렉토리 경로")
    batch_parser.add_argument("--output", default="/Users/link/Documents/SKN/4th_project_3/data_replace/output", help="출력 디렉토리 경로")
    batch_parser.add_argument("--model", default="EleutherAI/polyglot-ko-1.3b", help="사용할 모델 이름")
    batch_parser.add_argument("--device", default="cuda", choices=["cuda", "cpu"], help="사용할 디바이스")
    batch_parser.add_argument("--use-4bit", action="store_true", help="4bit 양자화 사용")
    batch_parser.add_argument("--use-8bit", action="store_true", help="8bit 양자화 사용")
    
    # 단일 파일 처리 명령
    file_parser = subparsers.add_parser("file", help="단일 파일 처리")
    file_parser.add_argument("--input", required=True, help="입력 파일 경로")
    file_parser.add_argument("--output", required=True, help="출력 파일 경로")
    file_parser.add_argument("--model", default="EleutherAI/polyglot-ko-1.3b", help="사용할 모델 이름")
    file_parser.add_argument("--device", default="cuda", choices=["cuda", "cpu"], help="사용할 디바이스")
    file_parser.add_argument("--use-4bit", action="store_true", help="4bit 양자화 사용")
    file_parser.add_argument("--use-8bit", action="store_true", help="8bit 양자화 사용")
    
    args = parser.parse_args()
    
    # 명령에 따라 처리
    if args.command == "test":
        # 모델 테스트
        cmd = f"python src/test_model.py --model {args.model} --device {args.device}"
        if args.use_4bit:
            cmd += " --use-4bit"
        if args.use_8bit:
            cmd += " --use-8bit"
        run_command(cmd, "모델 테스트")
        
    elif args.command == "interactive":
        # 대화형 모드
        cmd = f"python src/interactive_gen.py --model {args.model} --device {args.device}"
        if args.no_quantization:
            cmd += " --no-quantization"
        run_command(cmd, "대화형 텍스트 복원")
        
    elif args.command == "batch":
        # 배치 처리
        cmd = f"python src/batch_processor.py --input {args.input} --output {args.output} --model {args.model} --device {args.device}"
        if args.use_4bit:
            cmd += " --use-4bit"
        if args.use_8bit:
            cmd += " --use-8bit"
        run_command(cmd, "배치 처리")
        
    elif args.command == "file":
        # 단일 파일 처리
        cmd = f"python src/batch_processor.py --input {args.input} --output {args.output} --model {args.model} --device {args.device}"
        if args.use_4bit:
            cmd += " --use-4bit"
        if args.use_8bit:
            cmd += " --use-8bit"
        run_command(cmd, "단일 파일 처리")
        
    else:
        parser.print_help()

if __name__ == "__main__":
    main()
