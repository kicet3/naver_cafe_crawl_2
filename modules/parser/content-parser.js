/**
 * 컨텐츠 파싱 모듈
 */
const { log, logError } = require('../../lib/logger');
const { cleanText } = require('../../lib/utils');
const HtmlParser = require('./html-parser');

/**
 * 네이버 카페 컨텐츠 파싱 클래스
 */
class ContentParser {
  /**
   * 게시글 본문 파싱 및 정제
   * @param {string} content 게시글 본문 HTML 또는 텍스트
   * @returns {Object} 파싱된 컨텐츠 정보 (본문, 이미지, 링크 등)
   */
  static parseArticleContent(content) {
    try {
      // HTML 태그가 있는지 확인
      const hasHtmlTags = /<[^>]+>/i.test(content);
      
      // 텍스트만 추출
      const plainText = hasHtmlTags 
        ? this.extractTextFromHtml(content)
        : cleanText(content);
      
      // 이미지 추출
      const images = hasHtmlTags
        ? HtmlParser.extractImages(content, { baseUrl: 'https://cafe.naver.com' })
        : [];
      
      // 링크 추출
      const links = hasHtmlTags
        ? HtmlParser.extractLinks(content, { baseUrl: 'https://cafe.naver.com' })
        : [];
      
      // 해시태그 추출
      const hashtags = this.extractHashtags(plainText);
      
      return {
        text: plainText,
        images,
        links,
        hashtags
      };
    } catch (error) {
      logError(error, '게시글 본문 파싱 실패');
      return {
        text: cleanText(content),
        images: [],
        links: [],
        hashtags: []
      };
    }
  }
  
  /**
   * HTML에서 텍스트만 추출
   * @param {string} html HTML 문자열
   * @returns {string} 추출된 텍스트
   */
  static extractTextFromHtml(html) {
    try {
      // 모든 HTML 태그 제거
      const withoutTags = html.replace(/<[^>]+>/g, ' ');
      
      // HTML 엔티티 디코딩
      const decoded = this.decodeHtmlEntities(withoutTags);
      
      // 텍스트 정제
      return cleanText(decoded);
    } catch (error) {
      logError(error, 'HTML에서 텍스트 추출 실패');
      return cleanText(html);
    }
  }
  
  /**
   * HTML 엔티티 디코딩
   * @param {string} text HTML 엔티티가 포함된 문자열
   * @returns {string} 디코딩된 문자열
   */
  static decodeHtmlEntities(text) {
    return text
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&nbsp;/g, ' ')
      .replace(/&#(\d+);/g, (match, dec) => String.fromCharCode(dec));
  }
  
  /**
   * 텍스트에서 해시태그 추출
   * @param {string} text 텍스트
   * @returns {string[]} 추출된 해시태그 배열
   */
  static extractHashtags(text) {
    try {
      const hashtags = [];
      const hashtagPattern = /#([가-힣a-zA-Z0-9_]+)/g;
      let match;
      
      while ((match = hashtagPattern.exec(text)) !== null) {
        if (match[1] && !hashtags.includes(match[1])) {
          hashtags.push(match[1]);
        }
      }
      
      return hashtags;
    } catch (error) {
      logError(error, '해시태그 추출 실패');
      return [];
    }
  }
  
  /**
   * 댓글 내용 파싱 및 정제
   * @param {Array} comments 댓글 객체 배열
   * @returns {Array} 파싱된 댓글 객체 배열
   */
  static parseComments(comments) {
    try {
      return comments.map(comment => {
        // 댓글 객체 구조 확인
        if (!comment || typeof comment !== 'object') {
          return null;
        }
        
        // 내용이 HTML인 경우 텍스트만 추출
        const content = comment.content 
          ? (/<[^>]+>/i.test(comment.content) 
              ? this.extractTextFromHtml(comment.content) 
              : cleanText(comment.content))
          : '';
        
        // 댓글 작성자 정보 정제
        const author = comment.author 
          ? cleanText(comment.author) 
          : '알 수 없음';
        
        // 댓글 작성일 정제
        const date = comment.date
          ? cleanText(comment.date)
          : '';
        
        return {
          author,
          date,
          content
        };
      }).filter(comment => comment !== null);
    } catch (error) {
      logError(error, '댓글 파싱 실패');
      return comments;
    }
  }
  
  /**
   * 게시글 목록 데이터 정제
   * @param {Array} articles 게시글 객체 배열
   * @returns {Array} 정제된 게시글 객체 배열
   */
  static refineArticles(articles) {
    try {
      return articles.map(article => {
        // 게시글 객체 구조 확인
        if (!article || typeof article !== 'object') {
          return null;
        }
        
        // 기본값으로 초기화된 객체 생성
        const refined = {
          id: article.id || `unknown-${Date.now()}`,
          title: article.title ? cleanText(article.title) : '제목 없음',
          author: article.author ? cleanText(article.author) : '알 수 없음',
          date: article.date ? cleanText(article.date) : '',
          views: typeof article.views === 'number' ? article.views : 0,
          commentCount: typeof article.commentCount === 'number' ? article.commentCount : 0,
          url: article.url || ''
        };
        
        // 중복 속성 제거 및 속성명 정규화
        if (article.view && !article.views) {
          refined.views = typeof article.view === 'number' ? article.view : 0;
        }
        
        if (article.comments && !article.commentCount) {
          refined.commentCount = typeof article.comments === 'number' ? article.comments : 0;
        }
        
        return refined;
      }).filter(article => article !== null);
    } catch (error) {
      logError(error, '게시글 목록 정제 실패');
      return articles;
    }
  }
}

module.exports = ContentParser;