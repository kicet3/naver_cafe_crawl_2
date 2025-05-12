/**
 * HTML 파싱 모듈
 */
const { log, logError } = require('../../lib/logger');
const { cleanText } = require('../../lib/utils');

/**
 * HTML 파싱 및 데이터 추출 클래스
 */
class HtmlParser {
  /**
   * HTML 텍스트 내용에서 특정 패턴 추출
   * @param {string} html HTML 문자열
   * @param {RegExp} pattern 정규식 패턴
   * @param {number} groupIndex 추출할 캡처 그룹 인덱스 (기본값: 1)
   * @returns {string|null} 추출된 문자열 또는 매치 실패 시 null
   */
  static extractPattern(html, pattern, groupIndex = 1) {
    try {
      const matches = html.match(pattern);
      if (matches && matches[groupIndex]) {
        return cleanText(matches[groupIndex]);
      }
      return null;
    } catch (error) {
      logError(error, '패턴 추출 실패');
      return null;
    }
  }

  /**
   * HTML에서 모든 패턴 매치 추출
   * @param {string} html HTML 문자열
   * @param {RegExp} pattern 정규식 패턴
   * @param {number} groupIndex 추출할 캡처 그룹 인덱스 (기본값: 1)
   * @returns {string[]} 추출된 문자열 배열
   */
  static extractAllPatterns(html, pattern, groupIndex = 1) {
    try {
      const results = [];
      let matches;
      
      // 정규식에 global 플래그가 없으면 추가
      const globalPattern = new RegExp(pattern.source, 
        pattern.flags.includes('g') ? pattern.flags : pattern.flags + 'g');
      
      while ((matches = globalPattern.exec(html)) !== null) {
        if (matches[groupIndex]) {
          results.push(cleanText(matches[groupIndex]));
        }
      }
      
      return results;
    } catch (error) {
      logError(error, '모든 패턴 추출 실패');
      return [];
    }
  }

  /**
   * meta 태그의 속성 추출
   * @param {string} html HTML 문자열
   * @param {string} name meta 태그의 name 또는 property 속성 값
   * @returns {string|null} 추출된 content 속성 값 또는 null
   */
  static extractMetaContent(html, name) {
    try {
      // name 또는 property 속성이 일치하는 meta 태그 찾기
      const pattern = new RegExp(`<meta\\s+(?:name|property)=["']${name}["']\\s+content=["']([^"']+)["']|<meta\\s+content=["']([^"']+)["']\\s+(?:name|property)=["']${name}["']`, 'i');
      
      const matches = html.match(pattern);
      if (matches) {
        return cleanText(matches[1] || matches[2]);
      }
      
      return null;
    } catch (error) {
      logError(error, `meta 태그 ${name} 추출 실패`);
      return null;
    }
  }

  /**
   * HTML에서 특정 요소 추출
   * @param {string} html HTML 문자열
   * @param {string} tagName 태그 이름
   * @param {Object} attributes 속성 조건 객체 (예: {class: 'content', id: 'main'})
   * @returns {string|null} 추출된 요소 내용 또는 null
   */
  static extractElement(html, tagName, attributes = {}) {
    try {
      // 속성 조건 문자열 생성
      let attrStr = '';
      for (const [key, value] of Object.entries(attributes)) {
        attrStr += `(?:[^>]*\\s+${key}=["'](?:[^"']*\\s+)?${value}(?:\\s+[^"']*)?["'])?`;
      }
      
      // 태그와 속성 조건에 맞는 요소 찾기
      const pattern = new RegExp(`<${tagName}${attrStr}[^>]*>(.*?)</${tagName}>`, 's');
      const matches = html.match(pattern);
      
      if (matches && matches[1]) {
        return cleanText(matches[1]);
      }
      
      return null;
    } catch (error) {
      logError(error, `요소 ${tagName} 추출 실패`);
      return null;
    }
  }
  
  /**
   * HTML에서 모든 링크(a 태그) 추출
   * @param {string} html HTML 문자열
   * @param {Object} options 옵션 객체
   * @param {boolean} options.includeText a 태그 텍스트 포함 여부 (기본값: true)
   * @param {string} options.baseUrl 상대 URL을 절대 URL로 변환하기 위한 기준 URL (기본값: '')
   * @returns {Array<{href: string, text: string}>} 링크 정보 객체 배열
   */
  static extractLinks(html, options = {}) {
    const { includeText = true, baseUrl = '' } = options;
    
    try {
      const results = [];
      const linkPattern = /<a\s+[^>]*href=["']([^"']+)["'][^>]*>(.*?)<\/a>/gi;
      let matches;
      
      while ((matches = linkPattern.exec(html)) !== null) {
        const href = matches[1];
        const text = includeText ? cleanText(matches[2]) : '';
        
        // 상대 URL을 절대 URL로 변환
        const absoluteUrl = href.startsWith('http') 
          ? href 
          : baseUrl + (href.startsWith('/') ? '' : '/') + href;
        
        results.push({
          href: absoluteUrl,
          text
        });
      }
      
      return results;
    } catch (error) {
      logError(error, '링크 추출 실패');
      return [];
    }
  }
  
  /**
   * HTML에서 모든 이미지(img 태그) 추출
   * @param {string} html HTML 문자열
   * @param {Object} options 옵션 객체
   * @param {boolean} options.includeAlt alt 속성 포함 여부 (기본값: true)
   * @param {string} options.baseUrl 상대 URL을 절대 URL로 변환하기 위한 기준 URL (기본값: '')
   * @returns {Array<{src: string, alt: string}>} 이미지 정보 객체 배열
   */
  static extractImages(html, options = {}) {
    const { includeAlt = true, baseUrl = '' } = options;
    
    try {
      const results = [];
      const imgPattern = /<img\s+[^>]*src=["']([^"']+)["'][^>]*(?:alt=["']([^"']*)["'])?[^>]*>/gi;
      let matches;
      
      while ((matches = imgPattern.exec(html)) !== null) {
        const src = matches[1];
        const alt = includeAlt && matches[2] ? cleanText(matches[2]) : '';
        
        // 상대 URL을 절대 URL로 변환
        const absoluteSrc = src.startsWith('http') 
          ? src 
          : baseUrl + (src.startsWith('/') ? '' : '/') + src;
        
        results.push({
          src: absoluteSrc,
          alt
        });
      }
      
      return results;
    } catch (error) {
      logError(error, '이미지 추출 실패');
      return [];
    }
  }
  
  /**
   * HTML에서 테이블 데이터 추출
   * @param {string} html HTML 문자열
   * @param {Object} options 옵션 객체
   * @param {boolean} options.hasHeader 헤더 행 사용 여부 (기본값: true)
   * @param {number} options.tableIndex 여러 테이블이 있을 경우 선택할 인덱스 (기본값: 0)
   * @returns {Array<Array<string>>|{headers: string[], rows: Array<Array<string>>}} 테이블 데이터
   */
  static extractTableData(html, options = {}) {
    const { hasHeader = true, tableIndex = 0 } = options;
    
    try {
      // 모든 테이블 태그 추출
      const tablePattern = /<table[^>]*>(.*?)<\/table>/gsi;
      const tables = [];
      let tableMatches;
      
      while ((tableMatches = tablePattern.exec(html)) !== null) {
        tables.push(tableMatches[1]);
      }
      
      if (tables.length === 0 || tableIndex >= tables.length) {
        log('테이블을 찾을 수 없거나 지정된 인덱스가 범위를 벗어남', 'warn');
        return hasHeader ? { headers: [], rows: [] } : [];
      }
      
      const tableHtml = tables[tableIndex];
      
      // 행 추출
      const rowPattern = /<tr[^>]*>(.*?)<\/tr>/gsi;
      const rows = [];
      let rowMatches;
      
      while ((rowMatches = rowPattern.exec(tableHtml)) !== null) {
        rows.push(rowMatches[1]);
      }
      
      if (rows.length === 0) {
        log('테이블에 행이 없음', 'warn');
        return hasHeader ? { headers: [], rows: [] } : [];
      }
      
      // 셀 데이터 추출
      const cellData = rows.map(row => {
        const cellPattern = /<t[dh][^>]*>(.*?)<\/t[dh]>/gsi;
        const cells = [];
        let cellMatches;
        
        while ((cellMatches = cellPattern.exec(row)) !== null) {
          cells.push(cleanText(cellMatches[1]));
        }
        
        return cells;
      });
      
      // 헤더가 있는 경우와 없는 경우 처리
      if (hasHeader && cellData.length > 0) {
        const headers = cellData[0];
        const dataRows = cellData.slice(1);
        return { headers, rows: dataRows };
      } else {
        return cellData;
      }
    } catch (error) {
      logError(error, '테이블 데이터 추출 실패');
      return hasHeader ? { headers: [], rows: [] } : [];
    }
  }
}

module.exports = HtmlParser;