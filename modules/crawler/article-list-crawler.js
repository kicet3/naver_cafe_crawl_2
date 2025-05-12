/**
 * 네이버 카페 게시글 목록 크롤링
 */
const config = require('../../config/config');
const { log, sleep, getRandomDelay, cleanText } = require('../../lib/utils');

/**
 * 네이버 카페 게시글 목록 크롤링
 * @param {Object} page Playwright 페이지 객체
 * @param {number} pageNum 페이지 번호
 * @returns {Promise<Array>} 게시글 목록 배열
 */
async function getArticleList(page, pageNum = 1) {
  try {
    // 게시글 목록 페이지로 이동
    const url = `${config.CAFE_URL}?page=${pageNum}`;
    log(`게시글 목록 페이지 로드 중: ${url}`);
    await page.goto(url, { timeout: config.TIMEOUT });
    
    // 페이지 로딩 대기
    await sleep(getRandomDelay(2000, 3000));
    
    // iframe 확인 및 처리
    const frameHandle = await page.$('iframe#cafe_main').catch(() => null);
    
    if (frameHandle) {
      return await processFrameContent(frameHandle);
    } else {
      return await processPageContent(page);
    }
  } catch (error) {
    log(`게시글 목록 크롤링 실패: ${error.message}`, 'error');
    return [];
  }
}

/**
 * iframe 내용 처리
 * @param {Object} frameHandle iframe 핸들 객체
 * @returns {Promise<Array>} 게시글 목록 배열
 */
async function processFrameContent(frameHandle) {
  try {
    log('iframe#cafe_main 찾음, iframe으로 컨텍스트 전환');
    const frame = await frameHandle.contentFrame();
    
    // 게시글 목록 페이지가 완전히 로드될 때까지 대기
    await frame.waitForSelector(config.SELECTORS.ARTICLE_LIST.ARTICLE_ROWS, { timeout: config.TIMEOUT })
      .catch(() => log('게시글 행 선택자를 찾을 수 없음', 'warn'));
    
    // iframe에서 게시글 목록 추출
    return await extractArticlesFromFrame(frame);
  } catch (error) {
    log(`iframe 처리 실패: ${error.message}`, 'error');
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
    // 다른 형태의 iframe이 있는지 확인
    const otherFrames = await page.$$('iframe').catch(() => []);
    
    if (otherFrames.length > 0) {
      log(`다른 iframe ${otherFrames.length}개 발견, 검사 중`);
      
      for (let i = 0; i < otherFrames.length; i++) {
        const frame = await otherFrames[i].contentFrame();
        
        // 게시글 행이 있는지 확인
        const hasArticleRows = await frame.$(config.SELECTORS.ARTICLE_LIST.ARTICLE_ROWS)
          .then(el => !!el)
          .catch(() => false);
        
        if (hasArticleRows) {
          log(`iframe ${i+1}에서 게시글 행 발견`);
          return await extractArticlesFromFrame(frame);
        }
      }
    }
    
    // iframe이 없거나 iframe에서 게시글을 찾지 못한 경우 페이지에서 직접 추출
    log('적절한 iframe을 찾을 수 없음, 페이지에서 직접 추출 시도');
    return await extractArticlesFromPage(page);
  } catch (error) {
    log(`페이지 처리 실패: ${error.message}`, 'error');
    return [];
  }
}

/**
 * iframe에서 게시글 목록 추출
 * @param {Object} frame iframe 객체
 * @returns {Promise<Array>} 게시글 목록 배열
 */
async function extractArticlesFromFrame(frame) {
  try {
    // 게시글 행 요소 선택
    const rows = await frame.$$(config.SELECTORS.ARTICLE_LIST.ARTICLE_ROWS);
    log(`게시글 행 ${rows.length}개 찾음`);
    
    // 게시글이 없으면 다른 선택자 시도
    if (rows.length === 0) {
      return await tryAlternativeSelectors(frame);
    }
    
    return await extractArticlesFromRows(frame, rows);
  } catch (error) {
    log(`iframe에서 게시글 추출 실패: ${error.message}`, 'error');
    return [];
  }
}

/**
 * 대체 선택자로 게시글 찾기 시도
 * @param {Object} context 페이지 또는 프레임 객체
 * @returns {Promise<Array>} 게시글 목록 배열
 */
async function tryAlternativeSelectors(context) {
  log('기본 선택자로 게시글을 찾을 수 없음, 대체 선택자 시도');
  
  // 다른 형태의 게시글 목록 선택자 시도
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
  const links = await context.$$(config.SELECTORS.ARTICLE_LIST.ARTICLE_LINKS);
  
  if (links.length > 0) {
    log(`게시글 링크 ${links.length}개 찾음, 링크에서 정보 추출 시도`);
    return await extractArticlesFromLinks(context, links);
  }
  
  log('대체 선택자에서도 게시글을 찾을 수 없음', 'warn');
  return [];
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
      config.SELECTORS.ARTICLE_LIST.ARTICLE_ROWS,
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
    log(`페이지에서 게시글 추출 실패: ${error.message}`, 'error');
    return [];
  }
}

/**
 * 게시글 행에서 정보 추출
 * @param {Object} frame iframe 또는 페이지 객체
 * @param {Array} rows 게시글 행 요소 배열
 * @returns {Promise<Array>} 게시글 목록 배열
 */
async function extractArticlesFromRows(frame, rows) {
  const articles = [];
  
  // 각 행에서 게시글 정보 추출
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    
    try {
      // 게시글 링크 및 제목
      const titleElement = await row.$(config.SELECTORS.ARTICLE_LIST.ARTICLE_TITLE)
        .catch(() => null);
      
      if (!titleElement) {
        log(`${i+1}번째 행에서 제목 요소를 찾을 수 없음`, 'warn');
        continue;
      }
      
      const articleData = await extractArticleDataFromRow(row, titleElement);
      if (articleData) {
        articles.push(articleData);
      }
    } catch (error) {
      log(`${i+1}번째 행 처리 중 오류: ${error.message}`, 'warn');
    }
  }
  
  log(`게시글 ${articles.length}개 추출 완료`);
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
    // 게시글 제목 추출
    const title = await titleElement.textContent()
      .then(text => cleanText(text))
      .catch(() => '제목 없음');
    
    // 게시글 링크 추출
    const href = await titleElement.getAttribute('href')
      .catch(() => '');
    
    // 링크가 없으면 null 반환
    if (!href) {
      return null;
    }
    
    // 게시글 ID 추출
    const articleId = extractArticleId(href);
    
    // 작성자 추출
    const author = await row.$(config.SELECTORS.ARTICLE_LIST.ARTICLE_AUTHOR)
      .then(el => el ? el.textContent() : '알 수 없음')
      .then(text => cleanText(text))
      .catch(() => '알 수 없음');
    
    // 작성일 추출
    const date = await row.$(config.SELECTORS.ARTICLE_LIST.ARTICLE_DATE)
      .then(el => el ? el.textContent() : '')
      .then(text => cleanText(text))
      .catch(() => '');
    
    // 조회수 추출
    const views = await row.$(config.SELECTORS.ARTICLE_LIST.ARTICLE_VIEWS)
      .then(el => el ? el.textContent() : '0')
      .then(text => parseInt(cleanText(text).replace(/,/g, '')) || 0)
      .catch(() => 0);
    
    // 댓글 수 추출
    const comments = await row.$(config.SELECTORS.ARTICLE_LIST.ARTICLE_COMMENTS)
      .then(el => el ? el.textContent() : '0')
      .then(text => {
        const match = text.match(/\d+/);
        return match ? parseInt(match[0]) : 0;
      })
      .catch(() => 0);
    
    // 절대 URL 생성
    const absoluteUrl = href.startsWith('http') 
      ? href 
      : `https://cafe.naver.com${href.startsWith('/') ? '' : '/'}${href}`;
    
    return {
      id: articleId,
      title,
      author,
      date,
      views,
      commentCount: comments,
      url: absoluteUrl
    };
  } catch (error) {
    log(`게시글 데이터 추출 실패: ${error.message}`, 'warn');
    return null;
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
      
      // 게시글 ID 추출
      const articleId = extractArticleId(href);
      
      // 나머지 정보 추출 시도
      const articleData = await extractAdditionalData(element, selector, href, title, articleId);
      
      if (articleData) {
        articles.push(articleData);
      }
    } catch (error) {
      log(`${i+1}번째 요소 처리 중 오류: ${error.message}`, 'warn');
    }
  }
  
  log(`게시글 ${articles.length}개 추출 완료`);
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
    return await element.$(config.SELECTORS.ARTICLE_LIST.ARTICLE_TITLE)
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
 * 추가 데이터 추출
 * @param {Object} element 요소
 * @param {string} selector 사용된 선택자
 * @param {string} href 링크
 * @param {string} title 제목
 * @param {string} articleId 게시글 ID
 * @returns {Promise<Object|null>} 게시글 정보
 */
async function extractAdditionalData(element, selector, href, title, articleId) {
  try {
    let author = '알 수 없음';
    let date = '';
    let views = 0;
    let comments = 0;
    
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
        
      comments = await element.$('.comment_area')
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
    
    // 절대 URL 생성
    const absoluteUrl = href.startsWith('http') 
      ? href 
      : `https://cafe.naver.com${href.startsWith('/') ? '' : '/'}${href}`;
    
    return {
      id: articleId,
      title,
      author,
      date,
      views,
      commentCount: comments,
      url: absoluteUrl
    };
  } catch (error) {
    log(`추가 데이터 추출 실패: ${error.message}`, 'warn');
    return null;
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
      
      // 게시글 ID 추출
      const articleId = extractArticleId(href);
      
      // 절대 URL 생성
      const absoluteUrl = href.startsWith('http') 
        ? href 
        : `https://cafe.naver.com${href.startsWith('/') ? '' : '/'}${href}`;
      
      articles.push({
        id: articleId,
        title,
        author: '알 수 없음', // 링크만으로는 작성자 알 수 없음
        date: '',            // 링크만으로는 작성일 알 수 없음
        views: 0,            // 링크만으로는 조회수 알 수 없음
        commentCount: 0,     // 링크만으로는 댓글 수 알 수 없음
        url: absoluteUrl
      });
    } catch (error) {
      log(`${i+1}번째 링크 처리 중 오류: ${error.message}`, 'warn');
    }
  }
  
  log(`게시글 ${articles.length}개 추출 완료 (링크만 사용)`);
  return articles;
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
    log(`URL에서 게시글 ID 추출 실패: ${url}`, 'warn');
    return `unknown-${Date.now()}`;
  }
}

module.exports = { getArticleList };