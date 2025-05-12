/**
 * 네이버 카페 게시글 상세 정보 배치 크롤러
 * 여러 게시글을 동시에 처리하여 크롤링 속도를 향상시킵니다.
 */
const config = require('../../config/config');
const { log, logError } = require('../../lib/logger');
const { sleep, getRandomDelay, chunkArray } = require('../../lib/utils');
const { getArticleDetail } = require('./enhanced-article-detail-crawler');

/**
 * 여러 게시글의 상세 정보를 배치로 가져오기
 * @param {Object} page Playwright 페이지 객체
 * @param {Array} articles 게시글 기본 정보 객체 배열
 * @param {Object} options 크롤링 옵션
 * @param {number} options.batchSize 한 번에 처리할 게시글 수 (기본값: 5)
 * @param {number} options.minBatchDelay 배치 간 최소 지연 시간(ms) (기본값: 5000)
 * @param {number} options.maxBatchDelay 배치 간 최대 지연 시간(ms) (기본값: 10000)
 * @param {boolean} options.forceHtml HTML 파싱 방식 강제 사용 여부 (기본값: false)
 * @param {boolean} options.forceApi API 방식 강제 사용 여부 (기본값: false)
 * @param {boolean} options.includeComments 댓글 포함 여부 (기본값: true)
 * @param {boolean} options.includeImages 이미지 포함 여부 (기본값: true)
 * @param {boolean} options.safeModeEnabled 안전 모드 활성화 여부 (기본값: true)
 * @param {Function} options.progressCallback 진행 상황 콜백 함수 (선택사항)
 * @returns {Promise<Array>} 게시글 상세 정보 배열
 */
async function getBatchArticleDetails(page, articles, options = {}) {
  const {
    batchSize = 5,
    minBatchDelay = 1500,
    maxBatchDelay = 3000,
    forceHtml = false,
    forceApi = false,
    includeComments = true,
    includeImages = true,
    safeModeEnabled = true, // 안전 모드 기본 활성화
    progressCallback = null
  } = options;

  // 총 게시글 수
  const totalArticles = articles.length;
  log(`총 ${totalArticles}개 게시글을 ${batchSize}개씩 배치 처리 시작`);

  // 전체 결과를 저장할 배열
  const detailedArticles = [];
  
  // 게시글을 batchSize 단위로 그룹화
  const batches = chunkArray(articles, batchSize);
  log(`${batches.length}개의 배치로 나누어 처리합니다.`);

  // 각 배치별 처리
  for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
    const batch = batches[batchIndex];
    log(`배치 ${batchIndex + 1}/${batches.length} (${batch.length}개 게시글) 처리 시작`);
    
    try {
      // 배치 내 게시글 병렬 처리
      let batchResults;
      
      if (safeModeEnabled) {
        // 안전 모드: 약간의 지연을 두고 순차적으로 처리
        batchResults = [];
        for (let i = 0; i < batch.length; i++) {
          const article = batch[i];
          const globalIndex = batchIndex * batchSize + i;
          
          log(`게시글 ${globalIndex + 1}/${totalArticles} (ID: ${article.id}) 처리 중...`);
          const detailedArticle = await getArticleDetail(page, article, {
            forceHtml,
            forceApi,
            includeComments,
            includeImages
          });
          
          batchResults.push(detailedArticle);
          
          // 게시글 간 약간의 지연
          if (i < batch.length - 1) {
            const delay = getRandomDelay(1000, 2000);
            await sleep(delay);
          }
          
          // 진행 상황 콜백
          if (progressCallback) {
            progressCallback(globalIndex + 1, totalArticles, detailedArticle);
          }
        }
      } else {
        // 병렬 모드: 완전히 동시에 처리 (네이버가 감지하면 차단할 수 있음)
        const promises = batch.map(async (article, index) => {
          const globalIndex = batchIndex * batchSize + index;
          log(`게시글 ${globalIndex + 1}/${totalArticles} (ID: ${article.id}) 처리 중...`);
          
          const detailedArticle = await getArticleDetail(page, article, {
            forceHtml,
            forceApi,
            includeComments,
            includeImages
          });
          
          // 진행 상황 콜백
          if (progressCallback) {
            progressCallback(globalIndex + 1, totalArticles, detailedArticle);
          }
          
          return detailedArticle;
        });
        
        batchResults = await Promise.all(promises);
      }
      
      // 배치 결과를 전체 결과에 추가
      detailedArticles.push(...batchResults);
      log(`배치 ${batchIndex + 1}/${batches.length} 처리 완료 (${batchResults.length}개 게시글)`);
      
    } catch (error) {
      logError(error, `배치 ${batchIndex + 1}/${batches.length} 처리 중 오류 발생`);
      
      // 배치 처리 중 오류가 발생한 경우, 해당 배치의 개별 게시글을 순차적으로 재처리
      log('각 게시글 개별적으로 재시도 중...');
      for (const article of batch) {
        try {
          const detailedArticle = await getArticleDetail(page, article, {
            forceHtml,
            forceApi,
            includeComments,
            includeImages
          });
          detailedArticles.push(detailedArticle);
          
          // 재시도 시 더 긴 지연
          await sleep(getRandomDelay(2000, 3000));
        } catch (innerError) {
          logError(innerError, `게시글 ID ${article.id} 재처리 중 오류 발생`);
          // 기본 정보만 추가
          detailedArticles.push({
            ...article,
            content: '',
            contentText: '',
            comments: [],
            images: [],
            tags: [],
            hasAttachments: false,
            attachments: [],
            error: `게시글 처리 중 오류: ${innerError.message}`
          });
        }
      }
    }
    
    // 마지막 배치가 아니면 배치 간 딜레이 적용
    if (batchIndex < batches.length - 1) {
      const batchDelay = getRandomDelay(minBatchDelay, maxBatchDelay);
      log(`다음 배치 처리 전 ${batchDelay}ms 대기 중...`);
      await sleep(batchDelay);
    }
  }
  
  log(`총 ${detailedArticles.length}개의 게시글 상세 정보 수집 완료`);
  return detailedArticles;
}

module.exports = {
  getBatchArticleDetails
};