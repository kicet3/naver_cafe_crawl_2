/**
 * 네이버 카페 게시글 상세 내용 API 활용 모듈
 * 네이버 카페 웹 API를 직접 호출하여 게시글 상세 데이터를 가져옵니다.
 */
const config = require('../../config/config');
const { log, logError } = require('../../lib/logger');
const { sleep, getRandomDelay, cleanText } = require('../../lib/utils');
const axios = require('axios');

/**
 * 네이버 카페 게시글 상세 내용 API 호출
 * @param {Object} page Playwright 페이지 객체 (쿠키 활용)
 * @param {Object} article 게시글 기본 정보 객체
 * @param {string} article.id 게시글 ID
 * @param {string} article.url 게시글 URL
 * @returns {Promise<Object>} 게시글 상세 정보
 */
async function getArticleDetailFromApi(page, article) {
  const cafeId = config.crawler.cafeId;
  const articleId = article.id;
  
  try {
    // 네이버 쿠키 가져오기 (로그인 상태 유지를 위해)
    const cookies = await page.context().cookies();
    const cookieString = cookies
      .map(cookie => `${cookie.name}=${cookie.value}`)
      .join('; ');
    
    // API URL 구성
    const apiUrl = `https://apis.naver.com/cafe-web/cafe-articleapi/v3/cafes/${cafeId}/articles/${articleId}?query=&useCafeId=true&requestFrom=A`;
    
    log(`게시글 상세 API 호출: ${apiUrl}`);
    
    // API 호출
    const response = await axios.get(apiUrl, {
      headers: {
        'User-Agent': config.browser.userAgent,
        'Referer': article.url || `https://cafe.naver.com/ca-fe/cafes/${cafeId}/articles/${articleId}`,
        'Cookie': cookieString
      }
    });
    
    // 요청 간 딜레이 (봇 감지 방지)
    await sleep(getRandomDelay(config.crawler.delay.min, config.crawler.delay.max));
    
    // API 응답 검증
    if (!response.data) {
      log('API 응답에 게시글 내용이 없습니다.', 'warn');
      return null;
    }
    
    // 게시글 상세 정보 추출 및 변환
    const detailedArticle = processArticleDetailResponse(response.data, article);
    log(`API에서 게시글 ID ${articleId} 상세 정보 가져옴`);
    
    return detailedArticle;
  } catch (error) {
    logError(error, `게시글 상세 API 호출 실패 (ID: ${articleId})`);
    
    // 네트워크 오류 등의 경우 재시도 로직
    if (error.response && error.response.status >= 500) {
      log(`서버 오류 발생 (${error.response.status}), 5초 후 재시도...`, 'warn');
      await sleep(5000);
      
      // 재귀적 재시도 (최대 1번)
      if (!article.retried) {
        return getArticleDetailFromApi(page, { ...article, retried: true });
      }
    }
    
    return null;
  }
}

/**
 * API 응답에서 게시글 상세 정보 추출
 * @param {Object} response API 응답 데이터
 * @param {Object} baseArticle 기본 게시글 정보
 * @returns {Object} 처리된 게시글 상세 정보
 */
function processArticleDetailResponse(response, baseArticle) {
  try {
    // 필요한 정보 확인 및 추출
    const result = response.result || {};
    const article = result.article || {};
    const content = extractContent(article);
    const comments = extractComments(result);
    
    // 기존 정보와 API에서 가져온 정보 결합
    return {
      id: baseArticle.id,
      title: article.subject || baseArticle.title || '제목 없음',
      author: getAuthorInfo(article),
      content: content,
      // contentHtml 필드는 요청에 따라 제외
      contentText: article.contentText || content,
      date: formatDate(article.writeDateTimestamp) || baseArticle.date || '',
      views: article.readCount || baseArticle.views || 0,
      commentCount: comments.length || baseArticle.commentCount || 0,
      url: baseArticle.url || makeArticleUrl(article.cafeId, article.articleId),
      comments: comments,
      images: extractImages(article),
      category: article.menuName || '',
      tags: extractTags(article),
      hasAttachments: article.hasFile || false,
      attachments: extractAttachments(article)
    };
  } catch (error) {
    logError(error, '게시글 상세 정보 처리 실패');
    // 기본 게시글 정보만 반환
    return {
      ...baseArticle,
      content: '',
      contentText: '',
      comments: [],
      images: [],
      tags: [],
      hasAttachments: false,
      attachments: []
    };
  }
}

/**
 * 게시글 내용 추출
 * @param {Object} article 게시글 객체
 * @returns {string} 게시글 내용 텍스트
 */
function extractContent(article) {
  try {
    // 텍스트 기반 내용
    if (article.contentText) {
      return cleanText(article.contentText);
    }
    
    // HTML 기반 내용이 있는 경우 (텍스트만 추출)
    if (article.contentHtml) {
      // HTML에서 텍스트만 추출하는 로직
      return cleanText(article.contentHtml.replace(/<[^>]*>/g, ' '));
    }
    
    return '';
  } catch (error) {
    log('게시글 내용 추출 실패', 'warn');
    return '';
  }
}

/**
 * 댓글 정보 추출 (정확한 수집에 중점)
 * @param {Object} result API 응답의 result 객체
 * @returns {Array} 댓글 목록
 */
function extractComments(result) {
  try {
    const comments = [];
    
    // 댓글 정보가 없는 경우 빈 배열 반환
    if (!result.comments || !result.comments.items || !Array.isArray(result.comments.items)) {
      log('댓글 정보가 없습니다.', 'info');
      return comments;
    }
    
    // 댓글 총 개수 로깅
    log(`총 댓글 수: ${result.comments.items.length}개`);
    
    // 댓글 목록 처리
    for (const item of result.comments.items) {
      try {
        
        const comment = item;
        
        // 필수 정보 확인
        if (!comment.id) {
          log('댓글 ID가 없는 댓글 발견', 'warn');
          continue;
        }
        
        // 댓글 정보 추출
        const commentData = {
          id: comment.id.toString(),
          content: comment.content || '',
          date: formatDate(comment.updateDate) || '',
          isReply: !!comment.isRef, // 대댓글 여부
          refCommentId: comment.refId ? comment.refId.toString() : null, // 원 댓글 ID (대댓글인 경우)
          author: comment.writer.nick
        };
        
        comments.push(commentData);
      } catch (error) {
        log(`개별 댓글 처리 중 오류: ${error.message}`, 'warn');
        // 오류가 발생한 댓글은 건너뛰고 계속 진행
        continue;
      }
    }
    
    // 댓글 정렬 (일반 댓글 먼저, 그 다음 대댓글 순서로)
    comments.sort((a, b) => {
      // 1차: 일반 댓글 vs 대댓글
      if (a.isReply !== b.isReply) {
        return a.isReply ? 1 : -1;
      }
      
      // 2차: 대댓글인 경우 참조하는 원 댓글 ID 기준
      if (a.isReply && b.isReply && a.refCommentId !== b.refCommentId) {
        return a.refCommentId.localeCompare(b.refCommentId);
      }
      
      // 3차: 작성일 기준
      return a.date.localeCompare(b.date);
    });
    
    log(`총 ${comments.length}개의 댓글 정보 추출 완료`);
    return comments;
  } catch (error) {
    log(`댓글 정보 추출 실패: ${error.message}`, 'warn');
    return [];
  }
}

/**
 * 이미지 정보 추출
 * @param {Object} article 게시글 객체
 * @returns {Array} 이미지 목록
 */
function extractImages(article) {
  try {
    const images = [];
    
    // 이미지가 없으면 빈 배열 반환
    if (!article.attachImageList || !Array.isArray(article.attachImageList)) {
      return images;
    }
    
    for (const image of article.attachImageList) {
      if (!image.url) continue;
      
      images.push({
        url: image.url,
        thumbnailUrl: image.thumbnailUrl || image.url,
        width: image.width || 0,
        height: image.height || 0,
        fileSize: image.fileSize || 0,
        fileName: image.fileName || `image-${images.length + 1}.jpg`
      });
    }
    
    return images;
  } catch (error) {
    log('이미지 정보 추출 실패', 'warn');
    return [];
  }
}

/**
 * 작성자 정보 추출
 * @param {Object} item 게시글 또는 댓글 아이템
 * @returns {Object} 작성자 정보
 */
function getAuthorInfo(item) {
  try {
    const writerInfo = item.writerInfo || {};
    
    return {
      nickname: writerInfo.nickName || '알 수 없음',
      id: writerInfo.memberKey || '',
      level: writerInfo.memberLevel || 0,
      levelName: writerInfo.memberLevelName || '',
      isStaff: writerInfo.staff || false,
      isManager: writerInfo.manager || false
    };
  } catch (error) {
    log('작성자 정보 추출 실패', 'warn');
    return {
      nickname: '알 수 없음',
      id: '',
      level: 0,
      levelName: '',
      isStaff: false,
      isManager: false
    };
  }
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
 * 태그 정보 추출
 * @param {Object} article 게시글 객체
 * @returns {Array} 태그 목록
 */
function extractTags(article) {
  try {
    if (!article.tagList || !Array.isArray(article.tagList)) {
      return [];
    }
    
    return article.tagList.map(tag => tag.name || tag).filter(Boolean);
  } catch (error) {
    log('태그 정보 추출 실패', 'warn');
    return [];
  }
}

/**
 * 첨부파일 정보 추출
 * @param {Object} article 게시글 객체
 * @returns {Array} 첨부파일 목록
 */
function extractAttachments(article) {
  try {
    if (!article.attachFileList || !Array.isArray(article.attachFileList)) {
      return [];
    }
    
    return article.attachFileList.map(file => ({
      name: file.fileName || '알 수 없는 파일',
      url: file.url || '',
      size: file.fileSize || 0,
      type: file.fileType || ''
    })).filter(file => file.url);
  } catch (error) {
    log('첨부파일 정보 추출 실패', 'warn');
    return [];
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

module.exports = {
  getArticleDetailFromApi
};