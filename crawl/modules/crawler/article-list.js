/**
 * 게시글 목록 크롤링 모듈
 */
const config = require('../../config/config');
const { log, logError } = require('../../lib/logger');
const { sleep, getRandomDelay, cleanText, resolveUrl, extractArticleId } = require('../../lib/utils');
const { saveHtmlForDebug } = require('../../lib/file-manager');

/**
 * 네이버 카페 게시글 목록 크롤링
 * @param {Object} page Playwright 페이지 객체
 * @param {Object} options 크롤링 옵션
 * @param {number} options.pageNum 페이지 번호 (기본값: 1)
 * @param {number} options.requiredCount 필요한 게시글 수 (기본값: 10)
 * @returns {Promise<Array>} 게시글 목록 배열
 */
async function getArticleList(page, options = {}) {
  const { pageNum = 1, requiredCount = 10 } = options;
  
  try {
    // 게시글 목록 페이지로 이동
    const url = `${config.crawler.cafeUrl}?page=${pageNum}`;
    log(`게시글 목록 페이지 로드 중: ${url} (페이지 ${pageNum})`);
    
    await page.goto(url, { timeout: config.browser.timeout });
    
    // 페이지 로딩 대기
    await waitForPageLoad(page);
    
    // 디버깅용 스크린샷 및 HTML 저장
    await saveDebugData(page, pageNum);
    
    // iframe 확인 및 처리
    const frameHandle = await page.$('iframe#cafe_main').catch(() => null);
    
    if (frameHandle) {
      const articles = await processFrameContent(frameHandle, page);
      return articles.slice(0, requiredCount);
    } else {
      const articles = await processPageContent(page);
      return articles.slice(0, requiredCount);
    }
  } catch (error) {
    await handleError(page, error, pageNum);
    return [];
  }
}

/**
 * 페이지 로딩 대기
 * @param {Object} page Playwright 페이지 객체
 */
async function waitForPageLoad(page) {
  await page.waitForLoadState('networkidle', { timeout: config.browser.timeout })
    .catch(() => log('네트워크 유휴 상태 대기 시간 초과, 계속 진행합니다.', 'warn'));
  
  // 랜덤 대기 (크롤링 감지 방지)
  await sleep(getRandomDelay(config.crawler.delay.min, config.crawler.delay.max));
}

/**
 * 디버깅용 데이터 저장
 * @param {Object} page Playwright 페이지 객체
 * @param {number} pageNum 페이지 번호
 */
async function saveDebugData(page, pageNum) {
  if (process.env.DEBUG === 'true') {
    await page.screenshot({ path: `${config.output.debugDir}/article_list_page${pageNum}.png` });
    await saveHtmlForDebug(`${config.output.debugDir}/article_list_page${pageNum}.html`, await page.content());
  }
}

/**
 * 에러 처리 및 디버깅 정보 저장
 * @param {Object} page Playwright 페이지 객체
 * @param {Error} error 발생한 에러
 * @param {number} pageNum 페이지 번호
 */
async function handleError(page, error, pageNum) {
  logError(error, `게시글 목록 크롤링 실패 (페이지 ${pageNum})`);
  
  // 에러 디버깅용 스크린샷
  if (process.env.DEBUG === 'true') {
    try {
      await page.screenshot({ path: `${config.output.errorDir}/article_list_error_page${pageNum}.png`, fullPage: true });
      await saveHtmlForDebug(`${config.output.errorDir}/article_list_error_page${pageNum}.html`, await page.content());
    } catch (e) {
      log('에러 디버그 정보 저장 실패', 'warn');
    }
  }
}

/**
 * iframe 내용 처리
 * @param {Object} frameHandle iframe 핸들 객체
 * @param {Object} page 메인 페이지 객체 (로깅 및 디버깅용)
 * @returns {Promise<Array>} 게시글 목록 배열
 */
async function processFrameContent(frameHandle, page) {
  try {
    log('iframe#cafe_main 발견, iframe으로 컨텍스트 전환');
    const frame = await frameHandle.contentFrame();
    
    // iframe 로딩 대기
    await frame.waitForLoadState('networkidle', { timeout: config.browser.timeout })
      .catch(() => log('iframe 네트워크 유휴 상태 대기 시간 초과, 계속 진행합니다.', 'warn'));
    
    // iframe에서 게시글 목록 추출
    return await extractArticlesFromFrame(frame, page);
  } catch (error) {
    logError(error, 'iframe 처리 실패');
    return [];
  }
}

/**
 * 페이지 내용 직접 처리
 * @param {Object} page Playwright 페이지 객체
 * @returns {Promise<Array>} 게시글 목록 배열
 */
async function processPageContent(page) {
  try {
    log('iframe#cafe_main을 찾을 수 없음, 페이지에서 직접 추출 시도');
    
    // 다른 프레임 확인
    const frames = await page.frames();
    log(`페이지에 총 ${frames.length}개의 프레임이 있음`);
    
    for (const frame of frames) {
      if (frame === page.mainFrame()) continue; // 메인 프레임 제외
      
      // 프레임에 게시글 목록이 있는지 확인
      const hasArticleRows = await frame.$(config.selectors.articleList.rows)
        .then(el => !!el)
        .catch(() => false);
      
      if (hasArticleRows) {
        log(`다른 프레임에서 게시글 목록 발견, 해당 프레임에서 추출 시도`);
        return await extractArticlesFromFrame(frame, page);
      }
    }
    
    // 모든 프레임에서 찾지 못한 경우 페이지에서 직접 추출
    return await extractArticlesFromPage(page);
  } catch (error) {
    logError(error, '페이지 처리 실패');
    return [];
  }
}

/**
 * iframe에서 게시글 목록 추출
 * @param {Object} frame iframe 객체
 * @param {Object} page 메인 페이지 객체 (로깅 및 디버깅용)
 * @returns {Promise<Array>} 게시글 목록 배열
 */
async function extractArticlesFromFrame(frame, page) {
  try {
    // 게시글 행 선택자
    const rowSelector = config.selectors.articleList.rows;
    
    // 게시글 행이 있는지 확인
    const hasRows = await frame.$(rowSelector)
      .then(el => !!el)
      .catch(() => false);
    
    if (!hasRows) {
      return await tryAlternativeSelectors(frame);
    }
    
    // 게시글 행들 선택
    const rows = await frame.$$(rowSelector);
    log(`${rows.length}개의 게시글 행 발견`);
    
    return await extractArticlesFromRows(frame, rows);
  } catch (error) {
    logError(error, 'iframe에서 게시글 목록 추출 실패');
    
    // 디버깅용 iframe HTML 저장
    if (process.env.DEBUG === 'true') {
      try {
        const frameHtml = await frame.content().catch(() => '');
        await saveHtmlForDebug(`${config.output.debugDir}/article_list_frame_error.html`, frameHtml);
      } catch (e) {
        log('iframe 디버그 정보 저장 실패', 'warn');
      }
    }
    
    return [];
  }
}

/**
 * 대체 선택자로 게시글 찾기 시도
 * @param {Object} context 페이지 또는 프레임 객체
 * @returns {Promise<Array>} 게시글 목록 배열
 */
async function tryAlternativeSelectors(context) {
  log(`선택자 '${config.selectors.articleList.rows}'로 게시글 행을 찾을 수 없음, 대체 선택자 시도`, 'warn');
  
  // 대체 선택자 시도
  const alternativeSelectors = [
    '.board-list tr',
    '.article_wrap',
    'li.article-list',
    'tr[data-article-id]',
    '.article-item'
  ];
  
  for (const selector of alternativeSelectors) {
    const elements = await context.$$(selector).catch(() => []);
    
    if (elements.length > 0) {
      log(`대체 선택자 '${selector}'에서 ${elements.length}개 요소 발견`);
      return await extractArticlesFromElements(context, elements, selector);
    }
  }
  
  // 게시글 링크만으로 시도
  log('게시글 행을 찾을 수 없음, 게시글 링크로 시도', 'warn');
  const linkSelector = config.selectors.articleList.links;
  const links = await context.$$(linkSelector).catch(() => []);
  
  if (links.length > 0) {
    log(`${links.length}개의 게시글 링크 발견`);
    return await extractArticlesFromLinks(context, links);
  }
  
  log('게시글 요소를 찾을 수 없음', 'error');
  return [];
}

/**
 * 게시글 행에서 정보 추출
 * @param {Object} context 페이지 또는 프레임 객체
 * @param {Array} rows 게시글 행 요소 배열
 * @returns {Promise<Array>} 게시글 목록 배열
 */
async function extractArticlesFromRows(context, rows) {
  const articles = [];
  
  // 각 행에서 게시글 정보 추출
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    
    try {
      // 게시글 제목과 링크
      const titleElement = await row.$(config.selectors.articleList.title);
      
      if (!titleElement) {
        log(`${i+1}번째 행에서 제목 요소를 찾을 수 없음`, 'warn');
        continue;
      }
      
      const articleData = await extractArticleDataFromRow(row, titleElement);
      if (articleData) {
        articles.push(articleData);
      }
    } catch (error) {
      log(`${i+1}번째 게시글 추출 중 오류: ${error.message}`, 'warn');
    }
  }
  
  log(`총 ${articles.length}개의 게시글 정보 추출 완료`);
  return articles;
}

/**
 * 게시글 행에서 데이터 추출
 * @param {Object} row 게시글 행 요소
 * @param {Object} titleElement 제목 요소
 * @returns {Promise<Object|null>} 게시글 정보
 */
async function extractArticleDataFromRow(row, titleElement) {
  try {
    // 게시글 제목
    const title = await titleElement.textContent()
      .then(text => cleanText(text))
      .catch(() => '제목 없음');
    
    // 게시글 링크
    const href = await titleElement.getAttribute('href')
      .catch(() => '');
    
    if (!href) {
      log(`게시글 링크를 찾을 수 없음`, 'warn');
      return null;
    }
    
    // 절대 URL 생성
    const url = resolveUrl(href);
    
    // 게시글 ID 추출
    const articleId = extractArticleId(url);
    
    // 추가 정보 추출
    const additionalData = await extractAdditionalData(row);
    
    return {
      id: articleId,
      title,
      url,
      ...additionalData
    };
  } catch (error) {
    log(`게시글 데이터 추출 실패: ${error.message}`, 'warn');
    return null;
  }
}

/**
 * 게시글 행에서 추가 데이터 추출
 * @param {Object} row 게시글 행 요소
 * @returns {Promise<Object>} 추가 데이터
 */
async function extractAdditionalData(row) {
  try {
    // 작성자
    const author = await row.$(config.selectors.articleList.author)
      .then(el => el ? el.textContent() : '알 수 없음')
      .then(text => cleanText(text))
      .catch(() => '알 수 없음');
    
    // 작성일
    const date = await row.$(config.selectors.articleList.date)
      .then(el => el ? el.textContent() : '')
      .then(text => cleanText(text))
      .catch(() => '');
    
    // 조회수
    const views = await row.$(config.selectors.articleList.views)
      .then(el => el ? el.textContent() : '0')
      .then(text => parseInt(cleanText(text).replace(/,/g, '')) || 0)
      .catch(() => 0);
    
    // 댓글 수
    const commentCount = await row.$(config.selectors.articleList.comments)
      .then(el => el ? el.textContent() : '0')
      .then(text => {
        const match = text.match(/\d+/);
        return match ? parseInt(match[0]) : 0;
      })
      .catch(() => 0);
    
    return {
      author,
      date,
      views,
      commentCount
    };
  } catch (error) {
    log(`추가 데이터 추출 실패: ${error.message}`, 'warn');
    return {
      author: '알 수 없음',
      date: '',
      views: 0,
      commentCount: 0
    };
  }
}

/**
 * 요소 배열에서 게시글 정보 추출
 * @param {Object} context 페이지 또는 프레임 객체
 * @param {Array} elements 요소 배열
 * @param {string} selector 사용된 선택자
 * @returns {Promise<Array>} 게시글 목록 배열
 */
async function extractArticlesFromElements(context, elements, selector) {
  const articles = [];
  
  for (let i = 0; i < elements.length; i++) {
    const element = elements[i];
    
    try {
      let titleElement, title, href;
      
      // 선택자에 따라 다른 방식으로 제목과 링크 추출
      titleElement = await getTitleElement(element, selector);
      
      if (!titleElement) {
        continue;
      }
      
      // 제목 추출
      title = await titleElement.textContent()
        .then(text => cleanText(text))
        .catch(() => '제목 없음');
      
      // 링크 추출
      href = await titleElement.getAttribute('href')
        .catch(() => '');
      
      if (!href) {
        continue;
      }
      
      // 절대 URL 생성
      const url = resolveUrl(href);
      
      // 게시글 ID 추출
      const articleId = extractArticleId(url);
      
      // 추가 정보 추출
      const additionalData = await extractAdditionalDataBySelector(element, selector);
      
      articles.push({
        id: articleId,
        title,
        url,
        ...additionalData
      });
    } catch (error) {
      log(`${i+1}번째 요소 처리 중 오류: ${error.message}`, 'warn');
    }
  }
  
  log(`요소 배열에서 ${articles.length}개의 게시글 정보 추출 완료`);
  return articles;
}

/**
 * 요소에서 제목 요소 가져오기
 * @param {Object} element 요소
 * @param {string} selector 사용된 선택자
 * @returns {Promise<Object|null>} 제목 요소
 */
async function getTitleElement(element, selector) {
  if (selector.includes('tr')) {
    // 테이블 행 형태
    return await element.$(config.selectors.articleList.title)
      .catch(() => element.$('a[href*="articles"]'));
  } else if (selector.includes('article')) {
    // 아티클 형태
    return await element.$('a.article_title, a.tit, h3 a')
      .catch(() => element.$('a[href*="articles"]'));
  } else {
    // 기타 형태
    return await element.$('a')
      .catch(() => null);
  }
}

/**
 * 선택자에 따른 추가 데이터 추출
 * @param {Object} element 요소
 * @param {string} selector 사용된 선택자
 * @returns {Promise<Object>} 추가 데이터
 */
async function extractAdditionalDataBySelector(element, selector) {
  try {
    let author = '알 수 없음';
    let date = '';
    let views = 0;
    let commentCount = 0;
    
    // 선택자에 따라 다른 방식으로 정보 추출
    if (selector.includes('tr')) {
      // 테이블 행 형태
      author = await element.$('.p-nick, .td_name, .author')
        .then(el => el ? el.textContent() : '알 수 없음')
        .then(text => cleanText(text))
        .catch(() => '알 수 없음');
      
      date = await element.$('.td_date, .date')
        .then(el => el ? el.textContent() : '')
        .then(text => cleanText(text))
        .catch(() => '');
      
      views = await element.$('.td_view, .view')
        .then(el => el ? el.textContent() : '0')
        .then(text => parseInt(cleanText(text).replace(/,/g, '')) || 0)
        .catch(() => 0);
      
      commentCount = await element.$('.comment_area')
        .then(el => el ? el.textContent() : '0')
        .then(text => {
          const match = text.match(/\d+/);
          return match ? parseInt(match[0]) : 0;
        })
        .catch(() => 0);
    } else {
      // 다른 형태
      author = await element.$('.nickname, .writer, .user')
        .then(el => el ? el.textContent() : '알 수 없음')
        .then(text => cleanText(text))
        .catch(() => '알 수 없음');
      
      date = await element.$('.date, .time, .timestamp')
        .then(el => el ? el.textContent() : '')
        .then(text => cleanText(text))
        .catch(() => '');
      
      views = await element.$('.view, .hit, .count')
        .then(el => el ? el.textContent() : '0')
        .then(text => parseInt(cleanText(text).replace(/,/g, '')) || 0)
        .catch(() => 0);
    }
    
    return {
      author,
      date,
      views,
      commentCount
    };
  } catch (error) {
    log(`선택자 기반 추가 데이터 추출 실패: ${error.message}`, 'warn');
    return {
      author: '알 수 없음',
      date: '',
      views: 0,
      commentCount: 0
    };
  }
}

/**
 * 링크 요소에서 게시글 정보 추출
 * @param {Object} context 페이지 또는 프레임 객체
 * @param {Array} links 링크 요소 배열
 * @returns {Promise<Array>} 게시글 목록 배열
 */
async function extractArticlesFromLinks(context, links) {
  const articles = [];
  
  for (let i = 0; i < links.length; i++) {
    const link = links[i];
    
    try {
      // 제목 추출
      const title = await link.textContent()
        .then(text => cleanText(text))
        .catch(() => '제목 없음');
      
      // 링크 추출
      const href = await link.getAttribute('href')
        .catch(() => '');
      
      if (!href) {
        continue;
      }
      
      // 절대 URL 생성
      const url = resolveUrl(href);
      
      // 게시글 ID 추출
      const articleId = extractArticleId(url);
      
      // 게시글 정보 (최소한의 정보만)
      articles.push({
        id: articleId,
        title,
        author: '알 수 없음', // 링크만으로는 작성자 알 수 없음
        date: '',            // 링크만으로는 작성일 알 수 없음
        views: 0,            // 링크만으로는 조회수 알 수 없음
        commentCount: 0,     // 링크만으로는 댓글 수 알 수 없음
        url
      });
    } catch (error) {
      log(`${i+1}번째 링크 처리 중 오류: ${error.message}`, 'warn');
    }
  }
  
  log(`링크에서 ${articles.length}개의 게시글 정보 추출 완료`);
  return articles;
}

/**
 * 페이지에서 직접 게시글 목록 추출
 * @param {Object} page Playwright 페이지 객체
 * @returns {Promise<Array>} 게시글 목록 배열
 */
async function extractArticlesFromPage(page) {
  try {
    // 다양한 선택자 시도
    const selectors = [
      config.selectors.articleList.rows,
      '.board-list tr',
      '.article_wrap',
      'li.article-list',
      'tr[data-article-id]',
      '.article-item',
      '.article-board-list tr'
    ];
    
    let elements = [];
    let usedSelector = '';
    
    // 각 선택자에 대해 요소 찾기
    for (const selector of selectors) {
      elements = await page.$$(selector).catch(() => []);
      if (elements.length > 0) {
        usedSelector = selector;
        log(`선택자 '${selector}'에서 ${elements.length}개 요소 발견`);
        break;
      }
    }
    
    if (elements.length === 0) {
      return await tryAlternativeSelectors(page);
    }
    
    return await extractArticlesFromElements(page, elements, usedSelector);
  } catch (error) {
    logError(error, '페이지에서 게시글 목록 추출 실패');
    return [];
  }
}

module.exports = {
  getArticleList,
  extractArticlesFromFrame,
  extractArticlesFromPage,
  extractArticlesFromElements,
  extractArticlesFromLinks
};