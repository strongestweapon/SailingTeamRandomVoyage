# 개발 가이드

## 이슈와 변경 이력

1. [기존 이슈](https://github.com/strongestweapon/SailingTeamRandomVoyage/issues?q=is%3Aissue)를 확인하고 같은 문제의 이슈를 사용합니다.
2. 버그는 재현 방법·현재 동작·원하는 동작·지도 설정을 기록합니다. 기능은 사용 목적과 완료 조건을 기록합니다.
3. 작업 범위를 정하고 원본 코드를 수정합니다. 중요한 결정과 남은 제한을 이슈에 남깁니다.
4. 관련 검증을 실행하고 단일 HTML을 다시 빌드합니다.
5. 커밋/PR에 이슈 번호와 검증 결과를 연결하고 실제 완료된 이슈만 닫습니다.

처음 등록하는 과거 작업은 **이미 완료된 작업의 소급 기록**임을 표시하고 당시 커밋을
연결합니다. 해결된 오류와 향후 제안을 구분합니다. 문서만 바꾸면 링크·설명을 확인하고,
실행 코드를 바꾸면 관련 회귀 검증을 수행합니다.

## 설치·빌드·검증

Node.js 22.13+, pnpm 11.25.0, Python 3.10+를 사용합니다. pnpm이 없다면 Node.js 설치 후
`npm install --global pnpm@11.25.0`으로 설치할 수 있습니다.

```sh
pnpm install --frozen-lockfile
pnpm build
pnpm test
```

빌드는 다운로드 없이 `work/route-studio/dist/`의 일곱 소스를 묶습니다.
`outputs/Random-Voyage-Map-Studio.html`도 커밋하여 빌드 없이 사용할 수 있게 합니다.

| 명령 | 확인하는 내용 |
| --- | --- |
| `pnpm test:bundle` | 배포 HTML과 다섯 JS 원본의 일치, 구문, 중복 컨트롤 |
| `pnpm test:labels` | 홍콩 지명 배치, 실제 경로와 겹침, 다중 선택, 확대와 글씨 크기 |
| `pnpm test:backgrounds` | 배경 전환, 원본 좌표 정합, 4K 크기, 투명도, 좌표 목록 |
| `pnpm test:highres` | 타일 범위·캐시·취소·실패, 오래된 요청 무시, 저장 시점 상태 유지 |

검증은 브라우저를 구동하지 않습니다. 고해상도 로더 검증은 네트워크를 대체한 테스트와
실제 JPEG fixture를 사용하므로 공개 타일 서비스에 대량 요청하지 않습니다.

## 선택적 데이터 재생성

생성된 `data.js`와 `backgrounds.js`가 Git에 있으므로 일반 개발에는 원본 다운로드가 필요하지 않습니다.

```sh
python3 work/prepare_data.py --gpx-dir /path/to/gpx-folder
python3 work/build-studio.py
```

현재 생성기는 코드에 명시된 열 개 파일을 읽습니다. 새 데이터 묶음을 정식 배포본에 넣으려면
파일 목록과 테스트 fixture, README의 구간 수를 함께 갱신합니다. 원본 GPX는 수정하지 않습니다.

내장 래스터를 다시 만들려면 `python3 -m pip install -r requirements-assets.txt`로 Pillow를 설치합니다.
`work/map-backgrounds/nasa-june-2004.jpg`와 `work/map-backgrounds/NE2_HR_LC_SR_W.tif`를
[자료 출처](NOTICE.md)에서 준비한 뒤 `python3 work/build-background-assets.py`를 실행합니다.
큰 원본 이미지와 내려받은 타일은 `.gitignore`로 제외합니다.

## 수동 브라우저 점검

브라우저 검증이 허용된 환경에서 Chrome/Safari로 단일 HTML을 열어 다음을 확인합니다.
이 저장소의 자동화 세션에서는 기존 브라우저 접근 제한을 우회하지 않습니다.

- 여러 구간 선택·해제, 전체 항적 유지.
- 지도 확대·이동 중 글씨 크기 유지, 홍콩처럼 항적이 모이는 곳의 지명 가독성.
- 네 배경 전환, 위성 로딩 실패 시 메시지와 재시도.
- 불투명/투명 4K PNG의 크기·알파·구도.
- 저장 중 화면을 바꿔도 저장 시작 시점의 구도로 출력되는지 확인.
- 추가 GPX가 새로고침 후 사라지는 현재 동작과 좌표 복사.

## 저장소 범위

공개 대상은 `strongestweapon/SailingTeamRandomVoyage`입니다. 기존 커밋과 `v1.0.0` 태그를
보존하고 변경마다 새 커밋을 만듭니다. 원본 GPX, 자격 증명, 임시 타일 캐시는 추가하지 않습니다.
직접 작성한 코드는 MIT이며 지도 출처 표기는 유지합니다.
