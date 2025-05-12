/**
 * 범용 유틸리티 모듈
 */

/**
 * 지정된 시간(밀리초) 동안 대기
 * @param {number} ms 대기 시간(밀리초)
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 랜덤 대기 시간 생성 (크롤링 감지 방지)
 * @param {number} min 최소 시간(밀리초)
 * @param {number} max 최대 시간(밀리초)
 * @returns {number} 랜덤 대기 시간
 */
function getRandomDelay(min = 1000, max = 3000) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * 텍스트에서 불필요한 공백 제거
 * @param {string} text 텍스트
 * @returns {string} 정리된 텍스트
 */
function cleanText(text) {
  if (!text) return '';
  return text.trim()
    .replace(/\s+/g, ' ')    // 연속된 공백을 하나로
    .replace(/\r?\n/g, ' ')  // 줄바꿈을 공백으로
    .replace(/\t/g, ' ');    // 탭을 공백으로
}

/**
 * HTML 태그 제거
 * @param {string} html HTML 문자열
 * @returns {string} 태그가 제거된 텍스트
 */
function stripHtmlTags(html) {
  if (!html) return '';
  return html
    .replace(/<\/?[^>]+(>|$)/g, ' ') // HTML 태그 제거
    .replace(/&nbsp;/g, ' ')         // &nbsp; 를 공백으로
    .replace(/&amp;/g, '&')          // &amp; 를 &로
    .replace(/&lt;/g, '<')           // &lt; 를 <로
    .replace(/&gt;/g, '>')           // &gt; 를 >로
    .replace(/&quot;/g, '"')         // &quot; 를 "로
    .replace(/&#39;/g, "'")          // &#39; 를 '로
    .replace(/\s+/g, ' ')            // 연속된 공백을 하나로
    .trim();
}

/**
 * URL이 상대 경로인 경우 절대 경로로 변환
 * @param {string} url URL 또는 경로
 * @param {string} baseUrl 기본 URL
 * @returns {string} 절대 경로 URL
 */
function resolveUrl(url, baseUrl = 'https://cafe.naver.com') {
  if (!url) return '';
  
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url; // 이미 절대 경로
  }
  
  if (url.startsWith('//')) {
    return `https:${url}`; // 프로토콜 상대 경로
  }
  
  // 상대 경로를 절대 경로로 변환
  if (url.startsWith('/')) {
    return `${baseUrl}${url}`;
  } else {
    return `${baseUrl}/${url}`;
  }
}

/**
 * URL에서 쿼리 파라미터 추출
 * @param {string} url URL
 * @param {string} param 파라미터 이름
 * @returns {string|null} 파라미터 값
 */
function getQueryParam(url, param) {
  try {
    const urlObj = new URL(url);
    return urlObj.searchParams.get(param);
  } catch (error) {
    return null;
  }
}

/**
 * URL에서 경로의 마지막 부분 추출 (ID로 사용)
 * @param {string} url URL
 * @returns {string|null} URL 경로의 마지막 부분
 */
function getLastPathSegment(url) {
  try {
    const urlObj = new URL(url);
    const pathSegments = urlObj.pathname.split('/').filter(segment => segment);
    return pathSegments[pathSegments.length - 1];
  } catch (error) {
    return null;
  }
}

/**
 * 객체 배열을 그룹으로 나누기
 * @param {Array} array 객체 배열
 * @param {number} size 그룹 크기
 * @returns {Array} 그룹화된 배열
 */
function chunkArray(array, size) {
  const result = [];
  for (let i = 0; i < array.length; i += size) {
    result.push(array.slice(i, i + size));
  }
  return result;
}

/**
 * URL에서 게시글 ID 추출
 * @param {string} url 게시글 URL
 * @returns {string} 게시글 ID
 */
function extractArticleId(url) {
  try {
    // 1. articles/{id} 형식
    if (url.includes('articles/')) {
      const matches = url.match(/articles\/(\d+)/);
      if (matches && matches[1]) {
        return matches[1];
      }
    }
    
    // 2. articleid={id} 형식
    if (url.includes('articleid=')) {
      const urlObj = new URL(url, 'https://cafe.naver.com');
      const articleId = urlObj.searchParams.get('articleid');
      if (articleId) {
        return articleId;
      }
    }
    
    // 3. number={id} 형식 (구형 URL)
    if (url.includes('number=')) {
      const urlObj = new URL(url, 'https://cafe.naver.com');
      const number = urlObj.searchParams.get('number');
      if (number) {
        return number;
      }
    }
    
    // 4. 기타 숫자 형식이 있는지 확인
    const numericMatches = url.match(/(\d{5,})/); // 5자리 이상 숫자 추출
    if (numericMatches && numericMatches[1]) {
      return numericMatches[1];
    }
    
    // 추출 실패 시 임의의 ID 반환
    return `unknown-${Date.now()}`;
  } catch (error) {
    return `unknown-${Date.now()}`;
  }
}

/**
 * 로그 출력 함수
 * @param {string} message 메시지
 * @param {string} level 로그 레벨 (info, warn, error, success)
 */
function log(message, level = 'info') {
  const now = new Date().toISOString();
  let prefix = '';
  switch (level) {
    case 'warn':
      prefix = '[경고]';
      break;
    case 'error':
      prefix = '[오류]';
      break;
    case 'success':
      prefix = '[성공]';
      break;
    default:
      prefix = '[정보]';
  }
  console.log(`${now} ${prefix} ${message}`);
}

module.exports = {
  sleep,
  getRandomDelay,
  cleanText,
  stripHtmlTags,
  resolveUrl,
  getQueryParam,
  getLastPathSegment,
  chunkArray,
  extractArticleId,
  log
};