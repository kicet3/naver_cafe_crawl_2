/**
 * 네이버 카페 크롤러 설정 파일
 */
require('dotenv').config();

module.exports = {
  // 네이버 로그인 정보
  auth: {
    id: process.env.NAVER_ID,
    password: process.env.NAVER_PASSWORD,
    loginUrl: 'https://nid.naver.com/nidlogin.login'
  },
  
  // 크롤링 설정
  crawler: {
    cafeId: process.env.CAFE_ID || '23529966',
    cafeUrl: process.env.CAFE_URL || 'https://cafe.naver.com/f-e/cafes/23529966/menus/0',
    articlesPerFile: parseInt(process.env.ARTICLES_PER_FILE || '10'),
    totalArticles: parseInt(process.env.TOTAL_ARTICLES || '30'),
    pageLimit: parseInt(process.env.PAGE_LIMIT || '10'),
    lastArticleId: process.env.LAST_ARTICLE_ID || '',
    continueFromLast: process.env.CONTINUE_FROM_LAST === 'true',
    delay: {
      min: parseInt(process.env.DELAY_MIN || '2000'),
      max: parseInt(process.env.DELAY_MAX || '5000')
    }
  },
  
  // 브라우저 설정
  browser: {
    headless: process.env.HEADLESS !== 'false', // 기본적으로 true (headless 모드)
    slowMo: parseInt(process.env.SLOW_MO || '50'), // 액션 사이의 지연 시간 (ms)
    timeout: parseInt(process.env.TIMEOUT || '30000'),
    viewport: {
      width: 1280,
      height: 800
    },
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.110 Safari/537.36'
  },
  
  // 출력 경로
  output: {
    dir: process.env.OUTPUT_DIR || './output',
    debugDir: './debug',
    errorDir: './error'
  },
  
  // 셀렉터 - 네이버 카페 UI 요소
  selectors: {
    login: {
      idInput: '#id',
      pwInput: '#pw',
      loginButton: '.btn_login'
    },
    articleList: {
      // 현재 페이지의 게시글 목록을 담고 있는 영역
      container: '.article-board',
      // 게시글 행
      rows: '.article-board-list tr:not(.notice)', 
      // 게시글 링크
      links: 'a.article', 
      // 게시글 제목
      title: '.article', 
      // 작성자
      author: '.td_name .p-nick', 
      // 작성일
      date: '.td_date', 
      // 조회수
      views: '.td_view',
      // 댓글 수
      comments: '.CommentItem'
    },
    articleDetail: {
      // 게시글 제목
      title: '.tit-box h3',
      // 게시글 정보 (작성자, 작성일 등)
      info: '.article_info',
      // 게시글 본문
      content: '.se-main-container',
      // 댓글 컨테이너
      commentsContainer: '.comment_list',
      // 개별 댓글
      comments: '.CommentItem',
      // 댓글 작성자
      commentAuthor: '.comment_nick_info',
      // 댓글 작성일
      commentDate: '.comment_info_date',
      // 댓글 내용
      commentContent: '.comment_text_box'
    },
    pagination: {
      // 다음 페이지 버튼
      nextPage: '.pgR, .pagination_next'
    }
  },
  
  // 대체 선택자 목록 (다양한 네이버 카페 UI 지원)
  alternativeSelectors: {
    // 게시글 제목 선택자
    titles: [
      '.tit-box h3',
      '.article_header h3',
      '.title_text',
      '.article_subject',
      'h3.title'
    ],
    
    // 게시글 본문 선택자
    contents: [
      '.content',
      '.article_body',
      '.se-module-text',
      '.se-main-container',
      '.ContentRenderer',
      '.content_view',
      '#tbody',
      '.se-content',
      '.article_text',
      '.article-content',
      '.se-viewer',
      '.ArticleContentBox',
      '.ArticleContent',
      '.article_container',
      '.CommentBox__text_area',
      '.ArticleContentBox .content',
      '.ArticleContentBox div[class*="content"]',
      'div[class*="ArticleContent"]'
    ],
    
    // 댓글 컨테이너 선택자
    commentContainers: [
      '.CommentItem',
      '.comment_list',
      '#cmt_list',
      '.CommentList',
      '.comment_box',
      '#cmtList'
    ],
    
    // 댓글 작성자 선택자
    commentAuthors: [
      '.comment_nickname',
      '.comment_inbox_name',
      '.nick',
      '.author',
      '.user_name'
    ],
    
    // 댓글 작성일 선택자
    commentDates: [
      '.comment_info_date',
      '.date',
      '.time',
      '.timestamp',
      '.comment_date'
    ],
    
    // 댓글 내용 선택자
    commentContents: [
      '.comment_text_view',
      '.comment_inbox_text',
      '.text',
      '.content',
      '.comment_text'
    ]
  }
};