/**
 * 네이버 카페 크롤러 메인 파일 (API 기반 개선된 버전)
 */
const fs = require('fs-extra');
const path = require('path');
const config = require('./config/config');
const { login } = require('./modules/auth/login');
const { getMultiPageArticles } = require('./modules/crawler/enhanced-article-list-crawler');
const { getBatchArticleDetails } = require('./modules/crawler/batch-article-detail-crawler');
const { ensureDirectoryExists, saveAsJson } = require('./lib/file-manager');
const { log, sleep, getRandomDelay, chunkArray } = require('./lib/utils');
const { updateLastArticleId, findLatestArticleId } = require('./lib/update-last-article-id');

/**
 * 메인 크롤링 함수
 */
async function main() {
  log('네이버 카페 크롤링 시작', 'info');
  
  // 출력 디렉토리 생성
  await ensureDirectoryExists(config.output.dir);
  
  // 디버그 및 에러 디렉토리 생성
  if (process.env.DEBUG === 'true') {
    await ensureDirectoryExists(config.output.debugDir);
    await ensureDirectoryExists(config.output.errorDir);
  }
  
  // 브라우저 시작 및 로그인
  let browser, context, page;
  try {
    ({ browser, context, page } = await login());
    log('로그인 성공');

    // 로그인 후 네이버 카페로 이동
    const cafeUrl = config.crawler.cafeUrl;
    log(`네이버 카페로 이동: ${cafeUrl}`);
    await page.goto(cafeUrl, { timeout: config.browser.timeout });
    await page.waitForLoadState('networkidle', { timeout: config.browser.timeout })
      .catch(() => log('카페 페이지 로딩 대기 시간 초과, 계속 진행합니다.', 'warn'));
    
    // 페이지 로딩 대기
    await sleep(getRandomDelay(config.crawler.delay.min, config.crawler.delay.max));
    
    // 디버깅용 스크린샷
    if (process.env.DEBUG === 'true') {
      await page.screenshot({ path: `${config.output.debugDir}/cafe_main_page.png` });
      await fs.writeFile(`${config.output.debugDir}/cafe_main_page.html`, await page.content(), 'utf8');
    }
    
    log('네이버 카페 페이지 로드 완료, 크롤링 시작');
  } catch (error) {
    log(`초기화 실패로 종료합니다: ${error.message}`, 'error');
    
    // 디버깅용 스크린샷
    if (process.env.DEBUG === 'true' && page) {
      await page.screenshot({ path: `${config.output.errorDir}/init_error.png` });
      await fs.writeFile(`${config.output.errorDir}/init_error.html`, await page.content(), 'utf8');
    }
    
    if (browser) await browser.close();
    return;
  }
  
  try {
    // 수집할 게시글 수
    const totalArticles = config.crawler.totalArticles;
    // 파일당 게시글 수
    const articlesPerFile = config.crawler.articlesPerFile;
    // 페이지당 게시글 수 (API는 최대 50개까지 지원)
    const pageSize = 50;
    // 필요한 페이지 수 계산 (API 기반)
    const requiredPages = Math.ceil(totalArticles / pageSize);
    
    log(`총 ${totalArticles}개의 게시글 수집 시작 (예상 페이지 수: ${requiredPages})`);
    
    // 1. 개선된 게시글 목록 수집기 사용 (API 우선, 실패 시 HTML 파싱)
    log('게시글 목록 수집 중...');
    
    // 마지막으로 수집한 게시글 ID 가져오기
    const lastArticleId = config.crawler.lastArticleId;
    const continueFromLast = config.crawler.continueFromLast;
    
    if (continueFromLast && lastArticleId) {
      log(`마지막으로 수집한 게시글 ID ${lastArticleId} 이후부터 크롤링을 진행합니다.`);
    }
    
    const allArticles = await getMultiPageArticles(page, {
      startPage: 1,
      endPage: requiredPages + 3, // 여유롭게 더 많은 페이지 확인
      pageSize,
      sortBy: 'TIME',
      menuId: '0', // 전체글
      totalRequired: totalArticles,
      lastArticleId: lastArticleId,
      continueFromLast: continueFromLast
    });
    
    // 목록이 없으면 종료
    if (allArticles.length === 0) {
      log('수집된 게시글이 없어 종료합니다.', 'warn');
      
      if (browser) await browser.close();
      return;
    }
    
    log(`최종 ${allArticles.length}개의 게시글 목록 수집 완료`);
    
    // 2. 게시글을 파일당 게시글 수로 그룹화
    const articleGroups = chunkArray(allArticles, articlesPerFile);
    log(`게시글을 ${articleGroups.length}개 그룹으로 나누어 처리합니다.`);
    
    // 3. 각 그룹별로 게시글 상세 정보 수집 및 저장 (배치 처리 사용)
    for (let i = 0; i < articleGroups.length; i++) {
      const group = articleGroups[i];
      const startIdx = i * articlesPerFile + 1;
      const endIdx = startIdx + group.length - 1;
      
      log(`그룹 ${i+1}/${articleGroups.length} (${startIdx}-${endIdx}) 게시글 상세 정보 수집 중...`);
      
      // 배치 처리 크롤러 사용 (5개씩 동시에 처리)
      const detailedArticles = await getBatchArticleDetails(page, group, {
        batchSize: 5, // 한 번에 5개씩 처리
        minBatchDelay: 1500, // 배치 간 최소 지연 시간 (ms)
        maxBatchDelay: 3000, // 배치 간 최대 지연 시간 (ms)
        includeComments: true,
        includeImages: true,
        safeModeEnabled: true, // 안전 모드 활성화 (순차적으로 처리하되 약간의 지연 사용)
        
        // 진행 상황 표시 콜백 함수
        progressCallback: (current, total, article) => {
          const globalCurrent = startIdx + current - 1;
          const globalTotal = allArticles.length;
          log(`게시글 ${globalCurrent}/${globalTotal} 처리 완료: ${article.title.substring(0, 30)}${article.title.length > 30 ? '...' : ''}`);
        }
      });
      
      // 그룹 처리 완료 후 파일 저장
      const fileName = `articles_${startIdx}_${endIdx}.json`;
      const filePath = path.join(config.output.dir, fileName);
      
      // JSON 파일로 저장
      await saveAsJson(filePath, { articles: detailedArticles });
      log(`${fileName} 저장 완료 (${detailedArticles.length}개 게시글)`);
      
      // 그룹 간 딜레이 (크롤링 감지 방지)
      if (i < articleGroups.length - 1) {
        const delayTime = getRandomDelay(config.crawler.delay.min * 2, config.crawler.delay.max * 2);
        log(`다음 그룹 처리 전 ${delayTime}ms 대기 중...`);
        await sleep(delayTime);
      }
    }
    
    log('모든 게시글 크롤링 완료', 'success');
    
    // 최신 게시글 ID 찾기
    const latestArticleId = findLatestArticleId(allArticles);
    if (latestArticleId) {
      log(`가장 최신 게시글 ID: ${latestArticleId}`);
      
      // .env 파일에 마지막 게시글 ID 업데이트
      await updateLastArticleId(latestArticleId);
      log(`다음 크롤링을 위해 마지막 게시글 ID를 ${latestArticleId}로 업데이트했습니다.`);
    }
    
    // 요약 정보 저장 (모든 게시글의 기본 정보만 담긴 파일)
    const summaryPath = path.join(config.output.dir, 'articles_summary.json');
    await saveAsJson(summaryPath, { 
      totalCount: allArticles.length,
      collectedAt: new Date().toISOString(),
      cafeId: config.crawler.cafeId,
      lastArticleId: latestArticleId || '',
      articles: allArticles.map(article => ({
        id: article.id,
        title: article.title,
        author: article.author,
        date: article.date,
        url: article.url,
        views: article.views,
        commentCount: article.commentCount
      }))
    });
    log('게시글 요약 정보 저장 완료: articles_summary.json');
    
  } catch (error) {
    log(`크롤링 중 오류 발생: ${error.message}`, 'error');
    
    // 디버깅용 스크린샷
    if (process.env.DEBUG === 'true' && page) {
      await page.screenshot({ path: `${config.output.errorDir}/error_final.png` });
      await fs.writeFile(`${config.output.errorDir}/error_final.html`, await page.content(), 'utf8');
    }
  } finally {
    // 브라우저 종료
    if (browser) {
      await browser.close();
      log('브라우저 종료');
    }
  }
}

// 프로그램 실행
main().catch(error => {
  log(`프로그램 실행 중 오류 발생: ${error.message}`, 'error');
  process.exit(1);
});