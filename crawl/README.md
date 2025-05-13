# 네이버 카페 크롤러 (API 기반 개선 버전)

네이버 카페 게시글을 효율적으로 수집하는 크롤링 도구입니다.

## 주요 개선 사항

기존의 HTML 파싱 기반 크롤러에서 네이버 카페 API를 활용하는 방식으로 개선했습니다.

1. **네이버 카페 API 활용**
   - **게시글 목록 API**: `https://apis.naver.com/cafe-web/cafe-boardlist-api/v1/cafes/{cafeId}/menus/{menuId}/articles`
   - **게시글 상세 내용 API**: `https://apis.naver.com/cafe-web/cafe-articleapi/v3/cafes/{cafeId}/articles/{articleId}`
   - 구조화된 JSON 데이터로 더 안정적이고 빠른 크롤링이 가능합니다.

2. **페이지당 최대 50개 게시글 수집**
   - API 사용시 페이지당 최대 50개 게시글까지 가져올 수 있어 효율성이 크게 향상됩니다.
   - 기존 HTML 파싱 방식은 페이지당 15-20개 게시글 정도만 가져올 수 있었습니다.

3. **폴백 메커니즘 구현**
   - API 호출이 실패할 경우 기존 HTML 파싱 방식으로 폴백하여 안정성을 높였습니다.
   - 옵션을 통해 API 방식 또는 HTML 파싱 방식을 강제로 선택할 수도 있습니다.

4. **댓글 정확한 수집**
   - 댓글 정보를 API를 통해 정확하게 수집하고, 대댓글 구조까지 올바르게 처리합니다.
   - 댓글의 작성자, 내용, 작성일 등 풍부한 정보를 제공합니다.

5. **효율적인 데이터 처리**
   - contentHtml과 같은 불필요한 데이터는 수집하지 않도록 최적화했습니다.
   - 대량 게시글을 그룹으로 나누어 효율적으로 처리하고 파일로 저장합니다.

6. **배치 처리 기능**
   - 게시글을 배치(5개씩)로 묶어 병렬 처리하여 크롤링 속도를 크게 향상시킵니다.
   - 안전 모드 옵션을 통해 네이버 차단 위험을 줄이면서 성능을 개선합니다.
   - 배치 간 랜덤한 지연 시간을 적용하여 봇 탐지를 방지합니다.

7. **이어서 크롤링 기능 (자동 업데이트)**
   - 마지막으로 크롤링한 게시글 ID와 계속 진행 여부를 `.env` 파일에서 설정할 수 있습니다.
   - 이전에 수집한 게시글 이후의 새 게시글만 선택적으로 크롤링합니다.
   - 수집한 게시글 중 가장 최신 ID를 자동으로 `.env` 파일에 업데이트합니다.
   - 크롤링을 중단했다가 나중에 이어서 할 때 유용합니다.

## 설치

```bash
# 의존성 설치
npm install

# axios 라이브러리가 추가되었습니다. 개별 설치 필요 시:
npm install axios
```

## 사용 방법

### 기본 실행

```bash
npm start
```

### 디버그 모드 실행

```bash
npm run debug
```

### 개발 모드 (자동 재시작)

```bash
npm run dev
```

## 새로운 모듈 설명

### article-list-api.js

API를 활용하여 게시글 목록을 가져오는 모듈입니다.

```javascript
const { getArticleListFromApi } = require('./modules/api/article-list-api');

// 게시글 목록 가져오기
const articles = await getArticleListFromApi(page, {
  pageNum: 1,           // 페이지 번호
  pageSize: 50,         // 페이지당 게시글 수 (최대 50)
  sortBy: 'TIME',       // 정렬 기준 (TIME, RANKING 등)
  viewType: 'L',        // 목록 형태 (L: 리스트형)
  menuId: '0'           // 메뉴 ID (0: 전체글)
});
```

### batch-article-detail-crawler.js

게시글을 배치로 처리하여 크롤링 속도를 향상시키는 모듈입니다.

```javascript
const { getBatchArticleDetails } = require('./modules/crawler/batch-article-detail-crawler');

// 여러 게시글 배치 처리 (5개씩 동시에 처리)
const detailedArticles = await getBatchArticleDetails(page, articles, {
  batchSize: 5,            // 한 번에 처리할 게시글 수
  minBatchDelay: 1500,     // 배치 간 최소 지연 시간(ms)
  maxBatchDelay: 3000,     // 배치 간 최대 지연 시간(ms)
  includeComments: true,   // 댓글 포함 여부
  includeImages: true,     // 이미지 포함 여부
  safeModeEnabled: true,   // 안전 모드 (봇 탐지 방지)
  progressCallback: (current, total, article) => {
    console.log(`처리 중: ${current}/${total}`);
  }
});
```

### article-detail-api.js

API를 활용하여 게시글 상세 내용을 가져오는 모듈입니다.

```javascript
const { getArticleDetailFromApi } = require('./modules/api/article-detail-api');

// 게시글 상세 내용 가져오기
const detailedArticle = await getArticleDetailFromApi(page, {
  id: '123456',         // 게시글 ID
  url: 'https://cafe.naver.com/...'  // 게시글 URL
});
```

### enhanced-article-list-crawler.js

API와 HTML 파싱을 통합한 개선된 게시글 목록 크롤러 모듈입니다.

```javascript
const { getArticleList, getMultiPageArticles } = require('./modules/crawler/enhanced-article-list-crawler');

// 단일 페이지 게시글 목록 가져오기
const articles = await getArticleList(page, {
  pageNum: 1,           // 페이지 번호
  pageSize: 50,         // 페이지당 게시글 수
  sortBy: 'TIME',       // 정렬 기준
  menuId: '0',          // 메뉴 ID
  forceHtml: false,     // HTML 파싱 강제 사용 여부
  forceApi: false,      // API 강제 사용 여부
  requiredCount: 10     // 필요한 게시글 수
});

// 여러 페이지 게시글 목록 가져오기
const allArticles = await getMultiPageArticles(page, {
  startPage: 1,         // 시작 페이지
  endPage: 5,           // 종료 페이지
  pageSize: 50,         // 페이지당 게시글 수
  sortBy: 'TIME',       // 정렬 기준
  menuId: '0',          // 메뉴 ID
  forceHtml: false,     // HTML 파싱 강제 사용 여부
  forceApi: false,      // API 강제 사용 여부
  totalRequired: 100,   // 필요한 총 게시글 수
  lastArticleId: '136800', // 마지막으로 크롤링한 게시글 ID
  continueFromLast: true   // 마지막 ID 이후부터 계속 진행 여부
});
```

### enhanced-article-detail-crawler.js

API와 HTML 파싱을 통합한 개선된 게시글 상세 크롤러 모듈입니다.

```javascript
const { getArticleDetail, getMultipleArticleDetails } = require('./modules/crawler/enhanced-article-detail-crawler');

// 단일 게시글 상세 정보 가져오기
const detailedArticle = await getArticleDetail(page, article, {
  forceHtml: false,      // HTML 파싱 강제 사용 여부
  forceApi: false,       // API 강제 사용 여부
  includeComments: true, // 댓글 포함 여부
  includeImages: true    // 이미지 포함 여부
});

// 여러 게시글 상세 정보 가져오기
const detailedArticles = await getMultipleArticleDetails(page, articles, {
  forceHtml: false,      // HTML 파싱 강제 사용 여부
  forceApi: false,       // API 강제 사용 여부
  includeComments: true, // 댓글 포함 여부
  includeImages: true,   // 이미지 포함 여부
  progressCallback: (current, total, article) => {
    console.log(`처리 중: ${current}/${total}`);
  }
});
```

## 환경 설정

`.env` 파일을 통해 설정을 변경할 수 있습니다:

```
# 네이버 로그인 정보
NAVER_ID=your_naver_id
NAVER_PASSWORD=your_naver_password

# 크롤링 설정
CAFE_ID=23529966
CAFE_URL=https://cafe.naver.com/f-e/cafes/23529966/menus/0
ARTICLES_PER_FILE=10
TOTAL_ARTICLES=30
PAGE_LIMIT=10

# 크롤링 범위 설정
LAST_ARTICLE_ID=136800     # 마지막으로 크롤링한 게시글 ID (이 ID 이후부터 크롤링)
CONTINUE_FROM_LAST=true    # 마지막 게시글 ID부터 계속 진행할지 여부

# 크롤링 속도 조절 (밀리초)
DELAY_MIN=2000
DELAY_MAX=5000

# 브라우저 설정
HEADLESS=true
SLOW_MO=50
TIMEOUT=30000

# 출력 경로
OUTPUT_DIR=./output

# 디버그 모드
DEBUG=false
```

## 이어서 크롤링 기능 사용법

1. `.env` 파일에 마지막으로 크롤링한 게시글 ID와 계속 진행 여부를 설정합니다:

```
# 크롤링 범위 설정
LAST_ARTICLE_ID=136800     # 마지막으로 크롤링한 게시글 ID (이 ID 이후부터 크롤링)
CONTINUE_FROM_LAST=true    # 마지막 게시글 ID부터 계속 진행할지 여부
```

2. 설정 후 크롤러를 실행하면 지정한 ID 이후의 새 게시글만 수집합니다:

```bash
npm start
```

3. 크롤링이 완료된 후 가장 최근에 수집한 게시글 ID가 **자동으로** `.env` 파일의 `LAST_ARTICLE_ID`에 업데이트됩니다. 다음번 크롤링 실행 시 최신 게시글부터 자동으로 이어서 수집합니다.

4. 새 게시글이 없는 경우에는 "마지막으로 수집한 ID [번호] 이후의 새 게시글이 없습니다"라는 메시지가 표시됩니다.

> **사용 예시**: 매일 일정 시간에 크롤러를 실행하여 새 게시글만 자동으로 수집하는 경우 유용합니다.

## 출력 데이터 형식

크롤링된 게시글 데이터는 다음과 같은 형식으로 저장됩니다:

```json
{
  "articles": [
    {
      "id": "123456",
      "title": "게시글 제목",
      "author": {
        "nickname": "작성자닉네임",
        "id": "작성자ID",
        "level": 1,
        "levelName": "레벨명",
        "isStaff": false,
        "isManager": false
      },
      "content": "게시글 내용 텍스트",
      "contentText": "게시글 내용 텍스트",
      "date": "2023-12-01 12:34",
      "views": 123,
      "commentCount": 5,
      "url": "https://cafe.naver.com/...",
      "comments": [
        {
          "id": "comment-123",
          "author": {
            "nickname": "댓글작성자",
            "id": "댓글작성자ID",
            "level": 1,
            "levelName": "레벨명",
            "isStaff": false,
            "isManager": false
          },
          "content": "댓글 내용",
          "date": "2023-12-01 12:35",
          "isReply": false,
          "refCommentId": null,
          "depth": 0
        },
        {
          "id": "comment-124",
          "author": {
            "nickname": "대댓글작성자",
            "id": "대댓글작성자ID",
            "level": 1,
            "levelName": "레벨명",
            "isStaff": false,
            "isManager": false
          },
          "content": "대댓글 내용",
          "date": "2023-12-01 12:36",
          "isReply": true,
          "refCommentId": "comment-123",
          "depth": 1
        }
      ],
      "images": [
        {
          "url": "https://cafeptthumb-phinf.pstatic.net/...",
          "thumbnailUrl": "https://cafeptthumb-phinf.pstatic.net/...",
          "width": 800,
          "height": 600,
          "fileSize": 123456,
          "fileName": "image.jpg"
        }
      ],
      "category": "게시판명",
      "tags": ["태그1", "태그2"],
      "hasAttachments": false,
      "attachments": []
    }
  ]
}
```

## 주의사항

1. 네이버 카페의 로그인 상태가 필요합니다.
2. 과도한 크롤링은 네이버의 차단을 초래할 수 있으니 `DELAY_MIN`, `DELAY_MAX` 설정을 적절히 조정해주세요.
3. 크롤링은 네이버 이용약관 및 해당 카페의 규칙에 맞게 진행해주세요.
4. API 내용이 변경될 수 있으므로, 오류 발생 시 해당 API의 응답 구조를 확인해주세요.