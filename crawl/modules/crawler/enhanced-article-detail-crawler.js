/**
 * 향상된 네이버 카페 게시글 상세 정보 크롤러
 * API를 우선 사용하고, 실패 시 기존 HTML 파싱 방식으로 폴백합니다.
 */
const config = require('../../config/config');
const { log, logError } = require('../../lib/logger');
const { sleep, getRandomDelay } = require('../../lib/utils');
const { getArticleDetail: getLegacyArticleDetail } = require('./article-detail-crawler');
const { getArticleDetailFromApi } = require('../api/article-detail-api');
const { saveHtmlForDebug } = require('../../lib/file-manager');

/**
 * 향상된 네이버 카페 게시글 상세 정보 크롤링
 * API 호출을 먼저 시도하고, 실패 시 HTML 파싱을 사용합니다.
 * @param {Object} page Playwright 페이지 객체
 * @param {Object} article 게시글 기본 정보 객체
 * @param {string} article.id 게시글 ID
 * @param {string} article.url 게시글 URL
 * @param {Object} options 크롤링 옵션
 * @param {boolean} options.forceHtml HTML 파싱 방식 강제 사용 (기본값: false)
 * @param {boolean} options.forceApi API 방식 강제 사용 (기본값: false)
 * @param {boolean} options.includeComments 댓글 포함 여부 (기본값: true)
 * @param {boolean} options.includeImages 이미지 포함 여부 (기본값: true)
 * @returns {Promise<Object>} 게시글 상세 정보
 */
async function getArticleDetail(page, article, options = {}) {
  const {
    forceHtml = false,
    forceApi = false,
    includeComments = true,
    includeImages = true
  } = options;

  // API 방식과 HTML 파싱 방식 중 어떤 방식을 사용할지 결정
  const useApi = !forceHtml || forceApi;
  const useHtml = !forceApi || forceHtml;

  let detailedArticle = null;

  // 1. API 방식 시도
  if (useApi) {
    log(`API 방식으로 게시글 ID ${article.id} 상세 정보 가져오기 시도`);
    
    try {
      detailedArticle = await getArticleDetailFromApi(page, article);
      
      // API 호출이 성공적으로 게시글을 가져왔다면
      if (detailedArticle) {
        log(`API에서 게시글 ID ${article.id} 상세 정보를 성공적으로 가져옴`);
        
        // 옵션에 따라 불필요한 정보 제거
        if (!includeComments) {
          detailedArticle.comments = [];
        }
        
        if (!includeImages) {
          detailedArticle.images = [];
        }
        
        // contentHtml 제거 (요구사항에 따라)
        if (detailedArticle.hasOwnProperty('contentHtml')) {
          delete detailedArticle.contentHtml;
        }
        
        return detailedArticle;
      } else {
        log('API에서 게시글 상세 정보를 가져오지 못함, HTML 파싱 방식으로 전환', 'warn');
      }
    } catch (error) {
      logError(error, 'API 게시글 상세 정보 가져오기 실패');
      log('HTML 파싱 방식으로 전환', 'warn');
    }
  }

  // 2. API 방식이 실패하거나 강제 HTML 파싱 모드인 경우, HTML 파싱 방식 시도
  if (useHtml && !detailedArticle) {
    log(`HTML 파싱 방식으로 게시글 ID ${article.id} 상세 정보 가져오기 시도`);
    
    try {
      // 기존 HTML 파싱 방식 호출
      detailedArticle = await getLegacyArticleDetail(page, article);
      log(`HTML 파싱에서 게시글 ID ${article.id} 상세 정보를 가져옴`);
      
      // contentHtml 제거 (요구사항에 따라)
      if (detailedArticle.hasOwnProperty('contentHtml')) {
        delete detailedArticle.contentHtml;
      }
      
      // HTML 방식에서는 옵션 적용이 불가능할 수 있음
      return detailedArticle;
    } catch (error) {
      logError(error, 'HTML 파싱 게시글 상세 정보 가져오기 실패');
      
      // 두 방식 모두 실패한 경우 기본 정보만 반환
      return {
        ...article,
        content: '',
        contentText: '',
        comments: [],
        images: [],
        tags: [],
        hasAttachments: false,
        attachments: [],
        error: '게시글 내용 가져오기 실패'
      };
    }
  }

  // 두 방식 모두 실패한 경우 기본 정보만 반환
  if (!detailedArticle) {
    return {
      ...article,
      content: '',
      contentText: '',
      comments: [],
      images: [],
      tags: [],
      hasAttachments: false,
      attachments: [],
      error: '게시글 내용 가져오기 실패'
    };
  }
  
  return detailedArticle;
}

/**
 * 여러 게시글의 상세 정보 가져오기
 * @param {Object} page Playwright 페이지 객체
 * @param {Array} articles 게시글 기본 정보 객체 배열
 * @param {Object} options 크롤링 옵션
 * @param {boolean} options.forceHtml HTML 파싱 방식 강제 사용 (기본값: false)
 * @param {boolean} options.forceApi API 방식 강제 사용 (기본값: false)
 * @param {boolean} options.includeComments 댓글 포함 여부 (기본값: true)
 * @param {boolean} options.includeImages 이미지 포함 여부 (기본값: true)
 * @param {Function} options.progressCallback 진행 상황 콜백 함수 (선택사항)
 * @returns {Promise<Array>} 게시글 상세 정보 배열
 */
async function getMultipleArticleDetails(page, articles, options = {}) {
  const detailedArticles = [];
  let counter = 0;
  const totalArticles = articles.length;
  
  for (const article of articles) {
    counter++;
    log(`게시글 ${counter}/${totalArticles} 상세 정보 수집 중...`);
    
    try {
      // 디버깅 정보 저장을 위한 기본 정보 기록
      if (process.env.DEBUG === 'true') {
        await saveDebugInfo(page, article);
      }
      
      // 게시글 상세 정보 가져오기
      const detailedArticle = await getArticleDetail(page, article, options);
      
      // contentHtml 필드 제거 (요구사항에 따라)
      if (detailedArticle.hasOwnProperty('contentHtml')) {
        delete detailedArticle.contentHtml;
      }
      
      detailedArticles.push(detailedArticle);
      
      // 진행 상황 콜백 호출 (있는 경우)
      if (options.progressCallback && typeof options.progressCallback === 'function') {
        options.progressCallback(counter, totalArticles, detailedArticle);
      }
    } catch (error) {
      logError(error, `게시글 ID ${article.id} (${counter}/${totalArticles}) 처리 중 오류 발생`);
      
      // 오류가 발생한 게시글은 기본 정보만 포함
      detailedArticles.push({
        ...article,
        content: '',
        contentText: '',
        comments: [],
        images: [],
        tags: [],
        hasAttachments: false,
        attachments: [],
        error: `게시글 처리 중 오류: ${error.message}`
      });
    }
    
    // 게시글 간 딜레이 (크롤링 감지 방지)
    if (counter < totalArticles) {
      await sleep(getRandomDelay(config.crawler.delay.min, config.crawler.delay.max));
    }
  }
  
  log(`총 ${detailedArticles.length}개의 게시글 상세 정보 수집 완료`);
  return detailedArticles;
}

/**
 * 디버깅 정보 저장
 * @param {Object} page Playwright 페이지 객체
 * @param {Object} article 게시글 기본 정보
 */
async function saveDebugInfo(page, article) {
  try {
    // 현재 URL 가져오기
    const currentUrl = page.url();
    const articleId = article.id;
    
    // 디버깅 정보 저장
    await page.screenshot({ path: `${config.output.debugDir}/article_${articleId}_before.png` });
    await saveHtmlForDebug(`${config.output.debugDir}/article_${articleId}_before.html`, await page.content());
    
    log(`게시글 ID ${articleId} 디버깅 정보 저장 완료 (URL: ${currentUrl})`);
  } catch (error) {
    log(`디버깅 정보 저장 실패: ${error.message}`, 'warn');
  }
}

module.exports = {
  getArticleDetail,
  getMultipleArticleDetails
};