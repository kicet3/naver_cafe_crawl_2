/**
 * 개별 게시글 및 댓글 크롤링
 */
const config = require('../../config/config');
const { log, sleep, getRandomDelay, cleanText } = require('../../lib/utils');

/**
 * 개별 게시글 및 댓글 크롤링
 * @param {Object} page Playwright 페이지 객체
 * @param {Object} articleInfo 게시글 기본 정보 (목록에서 가져온 정보)
 * @returns {Promise<Object>} 상세 게시글 정보
 */
async function getArticleDetail(page, articleInfo) {
  try {
    // URL 검증 및 정규화
    const url = normalizeUrl(articleInfo.url);
    
    // 게시글로 이동
    log(`게시글 상세 페이지 로드 중: ${url}`);
    await page.goto(url, { timeout: config.browser.timeout });
    
    // 랜덤 대기
    await sleep(getRandomDelay(2000, 4000));
    
    // iframe 확인 및 처리
    const frameHandle = await page.$('iframe#cafe_main').catch(() => null);
    
    if (frameHandle) {
      return await processFrameContent(frameHandle, articleInfo);
    } else {
      return await processPageContent(page, articleInfo);
    }
  } catch (error) {
    log(`게시글 상세 크롤링 실패 (ID: ${articleInfo.id}): ${error.message}`, 'error');
    // 기본 정보만 반환
    return {
      ...articleInfo,
      content: '크롤링 실패',
      comments: []
    };
  }
}

/**
 * URL 정규화 (상대 경로를 절대 경로로 변환)
 * @param {string} url 게시글 URL
 * @returns {string} 정규화된 URL
 */
function normalizeUrl(url) {
  return url.startsWith('http') 
    ? url 
    : `https://cafe.naver.com${url.startsWith('/') ? '' : '/'}${url}`;
}

/**
 * iframe 내용 처리
 * @param {Object} frameHandle iframe 핸들 객체
 * @param {Object} articleInfo 게시글 기본 정보
 * @returns {Promise<Object>} 상세 게시글 정보
 */
async function processFrameContent(frameHandle, articleInfo) {
  try {
    log('iframe 찾음, iframe으로 컨텍스트 전환');
    const frame = await frameHandle.contentFrame();
    
    // iframe에서 게시글 상세 정보 추출
    return await extractArticleDetailFromFrame(frame, articleInfo);
  } catch (error) {
    log(`iframe 처리 실패: ${error.message}`, 'error');
    return {
      ...articleInfo,
      content: '추출 실패',
      comments: []
    };
  }
}

/**
 * 페이지 내용 직접 처리
 * @param {Object} page Playwright 페이지 객체
 * @param {Object} articleInfo 게시글 기본 정보
 * @returns {Promise<Object>} 상세 게시글 정보
 */
async function processPageContent(page, articleInfo) {
  try {
    log('iframe 없음, 페이지에서 직접 추출');
    return await extractArticleDetailFromPage(page, articleInfo);
  } catch (error) {
    log(`페이지 처리 실패: ${error.message}`, 'error');
    return {
      ...articleInfo,
      content: '추출 실패',
      comments: []
    };
  }
}

/**
 * iframe에서 게시글 상세 정보 추출
 * @param {Object} frame iframe 객체
 * @param {Object} articleInfo 게시글 기본 정보
 * @returns {Promise<Object>} 상세 게시글 정보
 */
async function extractArticleDetailFromFrame(frame, articleInfo) {
  try {
    // 게시글 본문 추출
    const content = await extractContent(frame, config.selectors.articleDetail.content);
    
    // 댓글 추출
    const comments = await extractCommentsFromFrame(frame);
    
    // 게시글 상세 정보 반환
    return {
      ...articleInfo,
      content,
      comments
    };
  } catch (error) {
    log(`iframe에서 게시글 상세 추출 실패: ${error.message}`, 'error');
    return {
      ...articleInfo,
      content: '추출 실패',
      comments: []
    };
  }
}

/**
 * 페이지에서 직접 게시글 상세 정보 추출
 * @param {Object} page Playwright 페이지 객체
 * @param {Object} articleInfo 게시글 기본 정보
 * @returns {Promise<Object>} 상세 게시글 정보
 */
async function extractArticleDetailFromPage(page, articleInfo) {
  try {
    // 게시글 본문 추출
    const content = await extractContent(page, config.selectors.articleDetail.content);
    
    // 댓글 추출
    const comments = await extractCommentsFromPage(page);
    
    // 게시글 상세 정보 반환
    return {
      ...articleInfo,
      content,
      comments
    };
  } catch (error) {
    log(`페이지에서 게시글 상세 추출 실패: ${error.message}`, 'error');
    return {
      ...articleInfo,
      content: '추출 실패',
      comments: []
    };
  }
}

/**
 * 본문 내용 추출
 * @param {Object} context iframe 또는 페이지 객체
 * @param {string} selector 본문 선택자
 * @returns {Promise<string>} 추출된 본문 내용
 */
async function extractContent(context, selector) {
  const contentElement = await context.$(selector);
  
  if (contentElement) {
    const content = await contentElement.textContent().then(text => cleanText(text));
    log('게시글 본문 추출 완료');
    return content;
  } else {
    log('게시글 본문 요소를 찾을 수 없음, 대체 선택자 시도', 'warn');
    
    // 대체 선택자 시도
    const alternativeSelectors = config.alternativeSelectors.contents || [
      '.article_body',
      '.se-module-text',
      '.se-main-container',
      '.ContentRenderer',
      '.content_view'
    ];
    
    for (const altSelector of alternativeSelectors) {
      const element = await context.$(altSelector);
      if (element) {
        const content = await element.textContent().then(text => cleanText(text));
        log(`대체 선택자 '${altSelector}'로 본문 추출 완료`);
        return content;
      }
    }
    
    log('모든 선택자로 본문을 찾을 수 없음', 'warn');
    return '';
  }
}

/**
 * iframe에서 댓글 추출
 * @param {Object} frame iframe 객체
 * @returns {Promise<Array>} 댓글 목록
 */
async function extractCommentsFromFrame(frame) {
  try {
    return await extractComments(frame);
  } catch (error) {
    log(`iframe에서 댓글 추출 실패: ${error.message}`, 'error');
    return [];
  }
}

/**
 * 페이지에서 직접 댓글 추출
 * @param {Object} page Playwright 페이지 객체
 * @returns {Promise<Array>} 댓글 목록
 */
async function extractCommentsFromPage(page) {
  try {
    return await extractComments(page);
  } catch (error) {
    log(`페이지에서 댓글 추출 실패: ${error.message}`, 'error');
    return [];
  }
}

/**
 * 댓글 추출 공통 로직
 * @param {Object} context iframe 또는 페이지 객체
 * @returns {Promise<Array>} 댓글 목록
 */
async function extractComments(context) {
  // 댓글 컨테이너 확인
  const commentsContainerSelector = config.selectors.articleDetail.commentsContainer;
  const commentsContainer = await context.$(commentsContainerSelector);
  if (!commentsContainer) {
    log('댓글 컨테이너가 없음, 대체 선택자 시도', 'warn');
    
    // 대체 선택자 시도
    const alternativeSelectors = config.alternativeSelectors.commentContainers || [
      '.comment_list',
    ];
    
    for (const altSelector of alternativeSelectors) {
      const container = await context.$(altSelector);
      if (container) {
        log(`대체 선택자 '${altSelector}'로 댓글 컨테이너 발견`);
        return await extractCommentsFromContainer(context, altSelector);
      }
    }
    
    log('댓글 컨테이너를 찾을 수 없음', 'warn');
    return [];
  }
  
  // 댓글 요소들 추출
  const commentElements = await context.$$(`${commentsContainerSelector} ${config.selectors.articleDetail.comments}`);
  
  log(`댓글 ${commentElements.length}개 발견`);
  
  const comments = [];
  
  // 각 댓글 정보 추출
  for (let i = 0; i < commentElements.length; i++) {
    const comment = await extractCommentData(commentElements[i], context);
    if (comment) {
      comments.push(comment);
    }
  }
  
  log(`댓글 ${comments.length}개 추출 완료`);
  return comments;
}

/**
 * 댓글 컨테이너에서 댓글 추출
 * @param {Object} context iframe 또는 페이지 객체
 * @param {string} containerSelector 컨테이너 선택자
 * @returns {Promise<Array>} 댓글 목록
 */
async function extractCommentsFromContainer(context, containerSelector) {
  const commentsSelector = config.selectors.articleDetail.comments;
  const commentElements = await context.$$(`${containerSelector} ${commentsSelector}`);
  
  log(`댓글 ${commentElements.length}개 발견`);
  
  const comments = [];
  
  // 각 댓글 정보 추출
  for (let i = 0; i < commentElements.length; i++) {
    const comment = await extractCommentData(commentElements[i], context);
    if (comment) {
      comments.push(comment);
    }
  }
  
  log(`댓글 ${comments.length}개 추출 완료`);
  return comments;
}

/**
 * 개별 댓글 데이터 추출
 * @param {Object} element 댓글 요소
 * @param {Object} context iframe 또는 페이지 객체 (대체 선택자 사용 시)
 * @returns {Promise<Object|null>} 댓글 정보
 */
async function extractCommentData(element, context) {
  try {
    // 작성자
    const authorSelector = config.selectors.articleDetail.commentAuthor;
    const author = await element.$(authorSelector)
      .then(el => el ? el.textContent() : null)
      .catch(() => null);
    
    if (author === null) {
      // 대체 선택자 시도
      const alternativeSelectors = config.alternativeSelectors.commentAuthors || [
        '.comment_nickname',
        '.comment_inbox_name',
        '.nick',
        '.author'
      ];
      
      for (const altSelector of alternativeSelectors) {
        const foundAuthor = await element.$(altSelector)
          .then(el => el ? el.textContent() : null)
          .catch(() => null);
        
        if (foundAuthor) {
          const authorText = cleanText(foundAuthor);
          
          // 작성일
          const dateSelector = config.selectors.articleDetail.commentDate;
          let date = await element.$(dateSelector)
            .then(el => el ? el.textContent() : null)
            .catch(() => null);
          
          if (date === null) {
            // 대체 선택자 시도
            const dateSelectors = config.alternativeSelectors.commentDates || [
              '.comment_info_date',
              '.date',
              '.time',
              '.timestamp'
            ];
            
            for (const dateSelector of dateSelectors) {
              date = await element.$(dateSelector)
                .then(el => el ? el.textContent() : null)
                .catch(() => null);
              
              if (date) {
                date = cleanText(date);
                break;
              }
            }
          } else {
            date = cleanText(date);
          }
          
          // 내용
          const contentSelector = config.selectors.articleDetail.commentContent;
          let content = await element.$(contentSelector)
            .then(el => el ? el.textContent() : null)
            .catch(() => null);
          
          if (content === null) {
            // 대체 선택자 시도
            const contentSelectors = config.alternativeSelectors.commentContents || [
              '.comment_text_view',
              '.comment_inbox_text',
              '.text',
              '.content'
            ];
            
            for (const contentSelector of contentSelectors) {
              content = await element.$(contentSelector)
                .then(el => el ? el.textContent() : null)
                .catch(() => null);
              
              if (content) {
                content = cleanText(content);
                break;
              }
            }
          } else {
            content = cleanText(content);
          }
          
          return {
            author: authorText,
            date: date || '',
            content: content || ''
          };
        }
      }
    } else {
      const authorText = cleanText(author);
      
      // 작성일
      const dateSelector = config.selectors.articleDetail.commentDate;
      const date = await element.$(dateSelector)
        .then(el => el ? el.textContent() : '')
        .then(text => cleanText(text));
      
      // 내용
      const contentSelector = config.selectors.articleDetail.commentContent;
      const content = await element.$(contentSelector)
        .then(el => el ? el.textContent() : '')
        .then(text => cleanText(text));
      
      return {
        author: authorText,
        date,
        content
      };
    }
    
    return null;
  } catch (error) {
    log(`댓글 데이터 추출 실패: ${error.message}`, 'warn');
    return null;
  }
}

module.exports = { getArticleDetail };