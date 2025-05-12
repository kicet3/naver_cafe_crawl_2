/**
 * 로깅 관련 유틸리티 모듈
 */

/**
 * 로그 타입에 따른 색상 설정
 */
const colors = {
  info: '\x1b[36m', // 청록색
  warn: '\x1b[33m', // 노란색
  error: '\x1b[31m', // 빨간색
  success: '\x1b[32m', // 초록색
  reset: '\x1b[0m' // 기본값으로 리셋
};

/**
 * 로그 출력 함수
 * @param {string} message 로그 메시지
 * @param {string} type 로그 타입 (info, warn, error, success)
 * @param {boolean} showTimestamp 타임스탬프 표시 여부
 */
function log(message, type = 'info', showTimestamp = true) {
  const timestamp = showTimestamp ? `[${new Date().toISOString()}] ` : '';
  const typeFormatted = type.toUpperCase();
  
  switch(type) {
    case 'error':
      console.error(`${colors.error}${timestamp}ERROR: ${message}${colors.reset}`);
      break;
    case 'warn':
      console.warn(`${colors.warn}${timestamp}WARNING: ${message}${colors.reset}`);
      break;
    case 'success':
      console.log(`${colors.success}${timestamp}SUCCESS: ${message}${colors.reset}`);
      break;
    case 'info':
    default:
      console.log(`${colors.info}${timestamp}INFO: ${message}${colors.reset}`);
      break;
  }
}

/**
 * 진행 상황 표시
 * @param {number} current 현재 진행 수
 * @param {number} total 전체 수
 * @param {string} label 라벨
 */
function showProgress(current, total, label = '') {
  const percentage = Math.floor((current / total) * 100);
  const progressBar = '='.repeat(Math.floor(percentage / 2)) + '>' + ' '.repeat(50 - Math.floor(percentage / 2));
  const labelText = label ? `[${label}] ` : '';
  
  process.stdout.write(`\r${labelText}[${progressBar}] ${percentage}% (${current}/${total})`);
  
  if (current === total) {
    process.stdout.write('\n');
  }
}

/**
 * 에러 로깅 및 스택 트레이스 출력
 * @param {Error} error 에러 객체
 * @param {string} context 에러 발생 컨텍스트
 */
function logError(error, context = '') {
  const contextText = context ? `(${context}) ` : '';
  console.error(`${colors.error}[${new Date().toISOString()}] ERROR ${contextText}${error.message}${colors.reset}`);
  console.error(`${colors.error}Stack: ${error.stack}${colors.reset}`);
}

/**
 * 디버그 로깅 (DEBUG=true 환경변수에서만 출력)
 * @param {string} message 로그 메시지
 */
function debug(message) {
  if (process.env.DEBUG === 'true') {
    console.log(`${colors.info}[${new Date().toISOString()}] DEBUG: ${message}${colors.reset}`);
  }
}

module.exports = {
  log,
  showProgress,
  logError,
  debug
};