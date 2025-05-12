/**
 * 네이버 카페 게시글 목록 API 활용 모듈
 * 네이버 카페 웹 API를 직접 호출하여 데이터를 가져옵니다.
 */
const config = require('../../config/config');
const { log, logError } = require('../../lib/logger');
const { sleep, getRandomDelay } = require('../../lib/utils');
const axios = require('axios');

/**
 * 네이버 카페 게시글 목록 API 호출
 * @param {Object} page Playwright 페이지 객체 (필요 시 쿠키 활용)
 * @param {Object} options 호출 옵션
 * @param {number} options.pageNum 페이지 번호 (기본값: 1)
 * @param {number} options.pageSize 페이지당 게시글 수 (기본값: 50)
 * @param {string} options.sortBy 정렬 기준 (기본값: 'TIME')
 * @param {string} options.viewType 보기 모드 (기본값: 'L')
 * @param {string} options.menuId 메뉴 ID (기본값: '0', 전체글)
 * @returns {Promise<Array>} 게시글 목록 배열
 */
async function getArticleListFromApi(page, options = {}) {
  const {
    pageNum = 1,
    pageSize = 50,
    sortBy = 'TIME',
    viewType = 'L',
    menuId = '0'
  } = options;

  const cafeId = config.crawler.cafeId;
  
  try {
    // 네이버 쿠키 가져오기 (로그인 상태 유지를 위해)
    const cookies = await page.context().cookies();
    const cookieString = cookies
      .map(cookie => `${cookie.name}=${cookie.value}`)
      .join('; ');
    
    // API URL 구성
    const apiUrl = `https://apis.naver.com/cafe-web/cafe-boardlist-api/v1/cafes/${cafeId}/menus/${menuId}/articles?page=${pageNum}&pageSize=${pageSize}&sortBy=${sortBy}&viewType=${viewType}`;
    
    log(`게시글 목록 API 호출: ${apiUrl}`);
    
    // API 호출
    const response = await axios.get(apiUrl, {
      headers: {
        'User-Agent': config.browser.userAgent,
        'Referer': `https://cafe.naver.com/ca-fe/cafes/${cafeId}/menus/${menuId}?page=${pageNum}`,
        'Cookie': cookieString
      }
    });
    
    // 요청 간 딜레이 (봇 감지 방지)
    await sleep(getRandomDelay(config.crawler.delay.min, config.crawler.delay.max));
    
    // API 응답 검증
    if (!response.data || !response.data.result || !response.data.result.articleList) {
      log('API 응답에 게시글 목록이 없습니다.', 'warn');
      return [];
    }
    
    // 게시글 목록 정보 추출 및 변환
    const articles = processArticleListResponse(response.data.result.articleList);
    log(`API에서 ${articles.length}개의 게시글 정보 가져옴`);
    
    return articles;
  } catch (error) {
    logError(error, `게시글 목록 API 호출 실패 (페이지 ${pageNum})`);
    
    // 네트워크 오류 등의 경우 재시도 로직
    if (error.response && error.response.status >= 500) {
      log(`서버 오류 발생 (${error.response.status}), 5초 후 재시도...`, 'warn');
      await sleep(5000);
      
      // 재귀적 재시도 (최대 1번)
      if (!options.retried) {
        return getArticleListFromApi(page, { ...options, retried: true });
      }
    }
    
    return [];
  }
}

/**
 * API 응답에서 게시글 목록 정보 추출
 * @param {Array} articleList API 응답의 게시글 목록
 * @returns {Array} 처리된 게시글 목록
 */
function processArticleListResponse(articleList) {
  if (!Array.isArray(articleList)) {
    log('게시글 목록이 배열 형태가 아닙니다.', 'warn');
    return [];
  }
  
  const articles = [];
  
  for (const article of articleList) {
    try {
      // 네이버 카페 API 응답 형식 처리
      // 실제 게시글 데이터는 item 속성 안에 있음
      if (article.type !== 'ARTICLE' || !article.item) {
        continue;
      }
      
      const item = article.item;
      
      // 필요한 정보 추출
      const articleData = {
        id: item.articleId.toString(),
        title: item.subject || '제목 없음',
        author: getAuthorFromItem(item),
        date: formatDate(item.writeDateTimestamp),
        views: item.readCount || 0,
        commentCount: item.commentCount || 0,
        summary: item.summary || '',
        url: makeArticleUrl(item.cafeId, item.articleId)
      };
      
      articles.push(articleData);
    } catch (error) {
      log(`게시글 정보 변환 중 오류: ${error.message}`, 'warn');
    }
  }
  
  return articles;
}

/**
 * 작성자 정보 추출
 * @param {Object} item 게시글 아이템
 * @returns {string} 작성자 이름
 */
function getAuthorFromItem(item) {
  if (!item.writerInfo) {
    return '알 수 없음';
  }
  
  return item.writerInfo.nickName || '알 수 없음';
}

/**
 * 타임스탬프를 날짜 문자열로 변환
 * @param {number} timestamp 타임스탬프(밀리초)
 * @returns {string} 날짜 문자열 (YYYY-MM-DD HH:MM)
 */
function formatDate(timestamp) {
  if (!timestamp) {
    return '';
  }
  
  try {
    const date = new Date(timestamp);
    
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    
    return `${year}-${month}-${day} ${hours}:${minutes}`;
  } catch (error) {
    log(`날짜 변환 오류: ${error.message}`, 'warn');
    return '';
  }
}

/**
 * 게시글 URL 생성
 * @param {number|string} cafeId 카페 ID
 * @param {number|string} articleId 게시글 ID
 * @returns {string} 게시글 URL
 */
function makeArticleUrl(cafeId, articleId) {
  return `https://cafe.naver.com/ca-fe/cafes/${cafeId}/articles/${articleId}`;
}

/**
 * 여러 페이지의 게시글 목록 가져오기
 * @param {Object} page Playwright 페이지 객체
 * @param {Object} options 호출 옵션
 * @param {number} options.startPage 시작 페이지 (기본값: 1)
 * @param {number} options.endPage 종료 페이지 (기본값: 1)
 * @param {number} options.pageSize 페이지당 게시글 수 (기본값: 50)
 * @param {string} options.sortBy 정렬 기준 (기본값: 'TIME')
 * @param {string} options.menuId 메뉴 ID (기본값: '0', 전체글)
 * @returns {Promise<Array>} 모든 페이지의 게시글 목록 배열
 */
async function getMultiPageArticles(page, options = {}) {
  const {
    startPage = 1,
    endPage = 1,
    pageSize = 50,
    sortBy = 'TIME',
    menuId = '0'
  } = options;
  
  let allArticles = [];
  
  for (let pageNum = startPage; pageNum <= endPage; pageNum++) {
    log(`${pageNum}페이지 게시글 목록 가져오는 중...`);
    
    const articles = await getArticleListFromApi(page, {
      pageNum,
      pageSize,
      sortBy,
      menuId
    });
    
    allArticles = allArticles.concat(articles);
    
    // 페이지 간 딜레이
    if (pageNum < endPage) {
      await sleep(getRandomDelay(config.crawler.delay.min, config.crawler.delay.max));
    }
    
    // 더 이상 게시글이 없으면 종료
    if (articles.length === 0 || articles.length < pageSize) {
      log(`페이지 ${pageNum}에서 게시글이 ${articles.length}개 밖에 없어 종료합니다.`);
      break;
    }
  }
  
  log(`총 ${allArticles.length}개의 게시글 정보 수집 완료`);
  return allArticles;
}

module.exports = {
  getArticleListFromApi,
  getMultiPageArticles
};