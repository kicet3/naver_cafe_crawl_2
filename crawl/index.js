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
    // 페이지당 게시글 수 (환경변수로 설정 가능, 기본값: 5)
    const pageSize = config.crawler.pageSize;
    // 시작 페이지 (환경변수로 설정 가능, 기본값: 1)
    const startPage = config.crawler.startPage;
    // 종료 페이지 (환경변수로 설정 가능, 기본값: 10)
    const endPage = config.crawler.endPage;
    // 영역 수에 따른 필요한 페이지 수 계산 (중복 사용을 위한 참조용)
    const requiredPages = Math.ceil(totalArticles / pageSize);
    
    log(`총 ${totalArticles}개의 게시글 수집 시작 (페이지당 ${pageSize}개, ${startPage} - ${endPage} 페이지)`);
    log(`예상 필요 페이지 수: ${requiredPages}`);
    
    // 1. 개선된 게시글 목록 수집기 사용 (API 우선, 실패 시 HTML 파싱)
    log('게시글 목록 수집 중...');
    
    // 마지막으로 수집한 게시글 ID 가져오기
    const lastArticleId = config.crawler.lastArticleId;
    const continueFromLast = config.crawler.continueFromLast;
    
    if (continueFromLast && lastArticleId) {
      log(`마지막으로 수집한 게시글 ID ${lastArticleId} 이후부터 크롤링을 진행합니다.`);
    }
    
    // 배치 처리 설정 가져오기
    const batchSize = config.crawler.batchSize;
    log(`게시글 목록을 ${batchSize}페이지 단위로 배치 처리합니다.`);
    
    const allArticles = await getMultiPageArticles(page, {
      startPage: startPage,
      endPage: endPage,
      pageSize: pageSize,
      sortBy: 'TIME',
      menuId: '0', // 전체글
      totalRequired: totalArticles,
      lastArticleId: lastArticleId,
      continueFromLast: continueFromLast,
      batchSize: batchSize
    });
    
    // 목록이 없으면 종료
    if (allArticles.length === 0) {
      log('수집된 게시글이 없어 종료합니다.', 'warn');
      
      if (browser) await browser.close();
      return;
    }
    
    log(`최종 ${allArticles.length}개의 게시글 목록 수집 완료`);
    
    // ID와 menuName 매핑 생성 - 유효한 데이터만 추출
    const result = allArticles.reduce((acc, item) => {
      if (item && item.id && item.menuName) {
        acc[item.id] = item.menuName;
      }
      return acc;
    }, {});
    
    log(`ID와 메뉴명 매핑: ${Object.keys(result).length}개 생성 완료`);
    const result_json = JSON.stringify(result, null, 2);
    
    // fixed 디렉토리 생성
    await ensureDirectoryExists('./fixed');
    
    // 출력 디렉토리에서 파일 목록 가져오기
    const files = fs.readdirSync(config.output.dir);
    files.sort();
    log(`출력 디렉토리에서 ${files.length}개의 파일 발견`);
    
    // 각 파일의 전체 경로 생성
    const fullPaths = files.map(file => path.resolve(config.output.dir, file));
    let fileCounter = 1;
    
    // 각 파일 처리
    for (const file of fullPaths) {
      try {
        // 파일 읽기
        const content = fs.readFileSync(file, 'utf-8');
        let jsonData;
        
        try {
          jsonData = JSON.parse(content);
        } catch (parseError) {
          log(`파일 ${file} 파싱 중 오류: ${parseError.message}`, 'error');
          continue; // 다음 파일로 이동
        }
        
        // articles 프로퍼티 확인 및 처리
        if (jsonData && jsonData.articles && Array.isArray(jsonData.articles)) {
          processArticleData(jsonData.articles);
        } else if (Array.isArray(jsonData)) {
          // 직접 배열인 경우
          processArticleData(jsonData);
        } else {
          log(`파일 ${file} 형식 처리 불가: 배열 또는 articles 프로퍼티 없음`, 'warn');
          continue;
        }
        
        // 내부 함수: 아티클 데이터 처리
        function processArticleData(articlesData) {
          // 각 항목에 menuName 추가하고 필터링
          const processedArticles = articlesData.map(item => {
            // 기본 유효성 검사
            if (!item || typeof item !== 'object') return null;
            
            // menuName 추가
            if (item.id && result[item.id]) {
              item.menuName = result[item.id];
            } else {
              item.menuName = '알 수 없음';
            }
            
            // 제외 카테고리 확인
            if (config.exclude && Array.isArray(config.exclude) && 
                config.exclude.includes(item.menuName)) {
              return null;
            }
            
            // 댓글 검사 - comments 또는 comment 프로퍼티 안전하게 처리
            const comments = item.comments || item.comment || [];
            if (!Array.isArray(comments) || comments.length === 0) {
              return null;
            }
            
            return item;
          }).filter(item => item !== null);
          
          // 새 파일 저장 - 일련번호로 저장
          const outputPath = `./fixed/${fileCounter}.json`;
          fs.writeFileSync(outputPath, JSON.stringify(processedArticles, null, 2), 'utf-8');
          log(`파일 ${fileCounter}.json 저장 완료 (${processedArticles.length}개 항목)`);
          fileCounter++;
        }
        
      } catch (error) {
        log(`파일 ${file} 처리 중 오류: ${error.message}`, 'error');
      }
    }
    
    log(`총 ${fileCounter-1}개의 파일에 menuName 추가 및 필터링 완료`)
    

    
    
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