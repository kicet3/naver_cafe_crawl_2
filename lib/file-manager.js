/**
 * 파일 관리 유틸리티 모듈
 */
const fs = require('fs-extra');
const path = require('path');
const { log, logError } = require('./logger');

/**
 * 디렉토리 생성 (없으면)
 * @param {string} dir 디렉토리 경로
 * @returns {Promise<boolean>} 성공 여부
 */
async function ensureDirectoryExists(dir) {
  try {
    await fs.ensureDir(dir);
    log(`디렉토리 생성 완료: ${dir}`, 'success');
    return true;
  } catch (error) {
    logError(error, `디렉토리 생성 실패: ${dir}`);
    return false;
  }
}

/**
 * JSON 파일로 저장
 * @param {string} filePath 파일 경로
 * @param {object} data 저장할 데이터
 * @returns {Promise<boolean>} 성공 여부
 */
async function saveAsJson(filePath, data) {
  try {
    await fs.writeJson(filePath, data, { spaces: 2 });
    log(`파일 저장 완료: ${filePath}`, 'success');
    return true;
  } catch (error) {
    logError(error, `파일 저장 실패: ${filePath}`);
    return false;
  }
}

/**
 * 텍스트 파일로 저장
 * @param {string} filePath 파일 경로
 * @param {string} content 저장할 내용
 * @returns {Promise<boolean>} 성공 여부
 */
async function saveAsText(filePath, content) {
  try {
    await fs.writeFile(filePath, content, 'utf8');
    log(`파일 저장 완료: ${filePath}`, 'success');
    return true;
  } catch (error) {
    logError(error, `파일 저장 실패: ${filePath}`);
    return false;
  }
}

/**
 * 파일 읽기
 * @param {string} filePath 파일 경로
 * @param {string} encoding 인코딩 (기본값: utf8)
 * @returns {Promise<string|null>} 파일 내용
 */
async function readFile(filePath, encoding = 'utf8') {
  try {
    const content = await fs.readFile(filePath, encoding);
    return content;
  } catch (error) {
    logError(error, `파일 읽기 실패: ${filePath}`);
    return null;
  }
}

/**
 * HTML 파일로 저장 (디버깅용)
 * @param {string} filePath 파일 경로
 * @param {string} html HTML 내용
 * @returns {Promise<boolean>} 성공 여부
 */
async function saveHtmlForDebug(filePath, html) {
  try {
    await fs.writeFile(filePath, html, 'utf8');
    log(`HTML 디버그 파일 저장 완료: ${filePath}`, 'debug');
    return true;
  } catch (error) {
    logError(error, `HTML 디버그 파일 저장 실패: ${filePath}`);
    return false;
  }
}

/**
 * 파일 이름에서 유효하지 않은 문자 제거
 * @param {string} filename 파일 이름
 * @returns {string} 유효한 파일 이름
 */
function sanitizeFilename(filename) {
  return filename
    .replace(/[\\/:*?"<>|]/g, '_') // 유효하지 않은 문자 제거
    .replace(/\s+/g, '_')          // 공백을 밑줄로 대체
    .replace(/__+/g, '_')          // 중복 밑줄 제거
    .substring(0, 200);            // 파일 이름 길이 제한
}

/**
 * 현재 날짜와 시간을 포함한 파일 이름 생성
 * @param {string} prefix 파일 이름 접두사
 * @param {string} extension 파일 확장자 (기본값: json)
 * @returns {string} 생성된 파일 이름
 */
function generateFilenameWithTimestamp(prefix, extension = 'json') {
  const now = new Date();
  const timestamp = now.toISOString().replace(/[-:\.]/g, '').replace('T', '_').slice(0, 15);
  return `${prefix}_${timestamp}.${extension}`;
}

module.exports = {
  ensureDirectoryExists,
  saveAsJson,
  saveAsText,
  readFile,
  saveHtmlForDebug,
  sanitizeFilename,
  generateFilenameWithTimestamp
};