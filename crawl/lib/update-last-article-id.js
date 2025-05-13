/**
 * 마지막으로 수집한 게시글 ID를 .env 파일에 자동으로 업데이트하는 모듈
 */
const fs = require('fs-extra');
const path = require('path');
const dotenv = require('dotenv');
const { log } = require('./utils');

/**
 * .env 파일에서 마지막 게시글 ID 업데이트
 * @param {string} lastArticleId 마지막으로 수집한 게시글 ID
 * @returns {Promise<boolean>} 성공 여부
 */
async function updateLastArticleId(lastArticleId) {
  try {
    if (!lastArticleId) {
      log('유효한 마지막 게시글 ID가 제공되지 않았습니다.', 'warn');
      return false;
    }

    const envPath = path.resolve(process.cwd(), '.env');
    
    // .env 파일이 없는 경우 생성
    if (!await fs.pathExists(envPath)) {
      log('.env 파일이 없습니다. 새로 생성합니다.', 'warn');
      await fs.writeFile(envPath, `LAST_ARTICLE_ID=${lastArticleId}\nCONTINUE_FROM_LAST=true\n`);
      return true;
    }
    
    // .env 파일 읽기
    const envContent = await fs.readFile(envPath, 'utf8');
    
    // LAST_ARTICLE_ID가 이미 있는지 확인
    const hasLastArticleId = envContent.includes('LAST_ARTICLE_ID=');
    const hasContinueFromLast = envContent.includes('CONTINUE_FROM_LAST=');
    
    let newContent;
    
    if (hasLastArticleId) {
      // LAST_ARTICLE_ID 값 업데이트
      newContent = envContent.replace(
        /LAST_ARTICLE_ID=.*/,
        `LAST_ARTICLE_ID=${lastArticleId}`
      );
    } else {
      // LAST_ARTICLE_ID 추가
      newContent = `${envContent}\nLAST_ARTICLE_ID=${lastArticleId}`;
    }
    
    // CONTINUE_FROM_LAST가 없는 경우 추가
    if (!hasContinueFromLast) {
      newContent = `${newContent}\nCONTINUE_FROM_LAST=true`;
    }
    
    // .env 파일 업데이트
    await fs.writeFile(envPath, newContent);
    
    log(`마지막 게시글 ID를 ${lastArticleId}로 업데이트했습니다.`, 'success');
    return true;
  } catch (error) {
    log(`마지막 게시글 ID 업데이트 실패: ${error.message}`, 'error');
    return false;
  }
}

/**
 * 가장 최근 게시글 ID 찾기
 * @param {Array} articles 게시글 목록
 * @returns {string|null} 가장 큰 게시글 ID 또는 null
 */
function findLatestArticleId(articles) {
  if (!Array.isArray(articles) || articles.length === 0) {
    return null;
  }
  
  try {
    // ID가 숫자인 게시글만 필터링 및 정렬
    const validArticles = articles
      .filter(article => article.id && !isNaN(parseInt(article.id)))
      .sort((a, b) => parseInt(b.id) - parseInt(a.id)); // 내림차순 정렬 (최신 게시글 = 큰 ID가 먼저)
    
    // 가장 최신 게시글 ID 반환
    return validArticles.length > 0 ? validArticles[0].id : null;
  } catch (error) {
    log(`최신 게시글 ID 찾기 실패: ${error.message}`, 'error');
    return null;
  }
}

module.exports = {
  updateLastArticleId,
  findLatestArticleId
};