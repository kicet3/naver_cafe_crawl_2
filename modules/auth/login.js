/**
 * 네이버 로그인 모듈
 */
const { chromium } = require('playwright');
const config = require('../../config/config');
const { log, logError } = require('../../lib/logger');
const { sleep } = require('../../lib/utils');
const { saveHtmlForDebug } = require('../../lib/file-manager');

/**
 * 네이버 로그인 수행
 * @returns {Promise<{browser: Browser, context: BrowserContext, page: Page}>} 브라우저, 컨텍스트, 페이지 객체
 * @throws {Error} 로그인 실패 시 에러
 */
async function login() {
  log('네이버 로그인 프로세스 시작');
  
  // 브라우저 시작
  const browser = await chromium.launch({
    headless: config.browser.headless,
    slowMo: config.browser.slowMo
  });
  
  // 브라우저 컨텍스트 생성 (쿠키와 세션 유지)
  const context = await browser.newContext({
    viewport: config.browser.viewport,
    userAgent: config.browser.userAgent
  });
  
  // 페이지 생성
  const page = await context.newPage();
  
  try {
    // 로그인 페이지로 이동
    await page.goto(config.auth.loginUrl, { timeout: config.browser.timeout });
    log('로그인 페이지 로드 완료');
    
    // 디버깅을 위한 로그인 페이지 스크린샷 저장
    if (process.env.DEBUG === 'true') {
      await page.screenshot({ path: `${config.output.debugDir}/login_page.png` });
      await saveHtmlForDebug(`${config.output.debugDir}/login_page.html`, await page.content());
    }
    
    // 로그인 ID 및 패스워드 입력
    await page.fill(config.selectors.login.idInput, config.auth.id);
    await page.fill(config.selectors.login.pwInput, config.auth.password);
    
    log('로그인 정보 입력 완료, 로그인 시도');
    
    // 로그인 버튼 클릭
    await page.click(config.selectors.login.loginButton);
    
    // 로그인 완료 대기 (페이지 이동)
    await page.waitForNavigation({ url: 'https://www.naver.com', timeout: config.browser.timeout })
      .catch(async () => {
        // 네이버는 보안 인증 페이지로 이동할 수 있음
        log('페이지 이동이 감지되지 않음, 보안 인증 페이지 확인');
        
        // 보안 인증 페이지 확인
        const isSecurityPage = await page.url().then(url => url.includes('sec.naver'));
        if (isSecurityPage) {
          log('보안 인증 페이지 감지됨, 사용자 개입 필요');
          
          if (config.browser.headless) {
            throw new Error('헤드리스 모드에서는 보안 인증을 자동으로 처리할 수 없습니다. HEADLESS=false로 설정하여 다시 시도하세요.');
          }
          
          // 사용자가 보안 인증을 완료할 때까지 대기
          log('사용자가 보안 인증을 완료할 때까지 대기 (최대 3분)');
          
          // 3분 동안 5초마다 URL 확인
          for (let i = 0; i < 36; i++) {
            await sleep(5000);
            const currentUrl = await page.url();
            
            // 네이버 메인 페이지로 이동했는지 확인
            if (currentUrl.includes('naver.com') && !currentUrl.includes('nid.naver') && !currentUrl.includes('sec.naver')) {
              log('사용자가 보안 인증을 완료하여 네이버 메인 페이지로 이동함');
              return;
            }
          }
          
          throw new Error('보안 인증 타임아웃: 3분 내에 보안 인증이 완료되지 않았습니다.');
        } else {
          throw new Error('로그인 후 페이지 이동 감지 실패');
        }
      });
    return {browser, context, page}
    
  } catch (error) {
    // 에러 발생 시 스크린샷 저장
    try {
      await page.screenshot({ path: `${config.output.errorDir}/login_error.png`, fullPage: true });
      await saveHtmlForDebug(`${config.output.errorDir}/login_error.html`, await page.content());
    } catch (e) {
      // 스크린샷 저장 실패는 무시
    }
    
    // 브라우저 닫기
    await browser.close().catch(() => {});
    
    // 에러 로깅 및 예외 던지기
    logError(error, '로그인 실패');
    throw error;
  }
}

module.exports = { login };