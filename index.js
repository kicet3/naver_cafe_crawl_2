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
    const result = allArticles.reduce((acc, item) => {
      acc[item.id] = item.menuName;
      return acc;
    }, {});
    result_json = JSON.stringify(result, null, 2)
    
    await ensureDirectoryExists('./fixed')
    let files = fs.readdirSync(config.output.dir);
    files.sort();

    const fullPaths = files.map(file => path.join(config.output.dir, file));
    for (const file of fullPaths) {
      const content = fs.readFileSync(file, 'utf-8');
      const a = JSON.parse(content);
      let new_json = a.articles.map(item =>{
        item.menuName = result[item.id];
        if (config.exclude.includes(item.menuName)) {
          return null
        }
        if (item.comment.length == 0) {
          return null
        }
        return item
      }).filter(item => item !== null)
      fs.writeFileSync(`./fixed/${file}`, JSON.stringify(new_json, null, 2), 'utf-8');
    }
    

    
    
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