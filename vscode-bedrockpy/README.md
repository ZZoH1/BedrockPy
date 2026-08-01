# BedrockPy Language Tools

Minecraft Bedrock 함수 팩용 BedrockPy 언어의 공식 VS Code 확장입니다.

## 기능

- `.bpy` 파일 인식과 문법 색상
- `:` 다음 줄 자동 들여쓰기
- 입력 중 실시간 문법 오류 검사와 빨간 밑줄
- 변수 Hover에서 실제 scoreboard objective·holder 이름과 선언 위치 표시
- 3D voxel 구조물 편집기와 `.bpstructure` 프로젝트 저장
- 선택 영역 채우기·변형·실행 취소 및 `/fill` 최적화 BedrockPy 코드 내보내기
- 상태 표시줄에 생성될 tick 명령 수와 파일 수 표시
- 명령 팔레트에서 행동 팩 컴파일
- `.mcpack` 파일 생성
- 10,000개 단위 tick 함수 자동 분할
- `tick every 20:` 또는 `tick every int변수:` 형식의 동적 주기 실행
- 조건 블록을 내부 함수로 분리해 조건을 한 번만 검사
- 분기 내부 함수에 바깥 `as`·`at`·`positioned`·`rotated` 문맥 재적용
- `if entity ... positioned ...:`처럼 조건 뒤에 붙인 execute 문맥도 중첩 분기에 유지
- `tell @a, "점수: ", score` 형식의 간편 rawtext 출력
- `abs`, `pow`, `sqrt`, `root`, `sin`, `cos`, `tan`, `log`, `max`, `min` 수학 함수
- 변수 초기화와 함께 최초 적용·업데이트 때 실행되는 `init:` 블록
- `call init` 또는 `/function namespace/init`으로 초기화를 원하는 때 다시 실행
- 연속 호출의 시작·종료를 감지하는 `function name when first/last:` 조건
- 함수의 나머지를 지정한 게임틱 뒤에 재개하는 `sleep(tick)` (`sleep()`은 `0t`)
- 지정한 ticking area가 실제 로드된 뒤 나머지 함수를 재개하는 `await_tickingarea("이름")`
- 코드 뒤 `#` 주석과 삼중 따옴표 여러 줄 주석
- 빈 블록을 작성하기 위한 명령을 생성하지 않는 `pass`
- 폴더 아래 여러 `.bpy` 파일을 한 번에 하나의 팩으로 컴파일
- `sounds` 폴더의 `.ogg`를 등록하고 `play ui/click to @a`로 재생
- `sound 이름:` 블록에서 `category`와 `is3D` 설정
- `title`, `subtitle`, `actionbar`에서 문자열과 scoreboard 변수 출력
- `pack:` 블록의 이름·네임스페이스·출력·mcpack 설정으로 자동 컴파일
- `rotation @s -> pitch, yaw`로 pitch와 yaw를 scoreboard 변수에 저장
- `location @s -> x, y, z`로 엔티티 좌표를 scoreboard 변수에 저장
- `tp @s -> 10.5, y, -3, 90, rx`처럼 변수와 숫자 상수를 섞어 텔레포트
- 좌표·회전이 모두 상수인 `tp`는 Minecraft 원본 명령 한 줄로 최적화
- 변수와 상수가 섞인 `tp`에서도 scoreboard는 변수 축만 계산
- 10,000줄을 넘는 일반 함수를 작업 플래그 기반 tick 함수로 자동 전환

## 사용법

1. Python 3.10 이상을 설치합니다.
2. `.bpy` 파일을 엽니다.
3. 명령 팔레트에서 `BedrockPy: 행동 팩 컴파일` 또는 `BedrockPy: .mcpack 생성`을 실행합니다.

### 3D 구조물 편집기

명령 팔레트에서 `BedrockPy: 3D 구조물 편집기 열기`를 실행합니다.

- 공식 Bedrock 블록 ID 전체 검색
- 단색/실제 마인크래프트 텍스처 전환과 기본·사용자 리소스팩 적용
- 드래그 영역 선택과 선택 영역 채우기/비우기
- 크기와 모양을 바꿀 수 있는 배치·삭제 브러시
- 선, 원, 원판, 구, 빈 구, 원기둥 생성
- 반지름, 높이, 거칠기, 시드를 조절하는 산 생성
- X/Y/Z별 1~512 가변 작업공간
- `.bpstructure`와 Minecraft `.mcstructure` 가져오기
- 시간대 미리보기
- 클릭 전 반투명 도형·산·브러시·붙여넣기 미리보기
- 선택 복사/잘라내기/붙여넣기
- 연결 채우기와 블록 교체
- 지형 평탄화·부드럽게·거칠게와 선택 돌출

- 클릭: 블록 배치
- 연속 페인트 도구 + 드래그: 블록을 끊김 없이 배치
- 우클릭: 블록 삭제
- Alt+드래그: 카메라 회전
- 휠: 확대·축소
- WASD: 시점 이동, Space/Shift: 위/아래
- 이동 속도와 거리 어두워짐 슬라이더
- 공기를 포함하거나 제외하는 선택 영역 복사
- 버튼 위에 잠시 머물면 표시되는 기능 설명
- 숫자로 조절하는 직육면체 선택 크기
- 브러시/올가미 자유 선택과 선택 영역 제한 브러시
- 1~32 브러시 크기와 통합 도형·산 브러시
- 짧은 클릭은 1회, 셀 이동 또는 0.6초 이상 누르면 자동 연속 적용
- A/B X/Y/Z 좌표 직접 수정
- 숫자 1~9 도구 전환과 숫자 1 기본 이동 도구
- 각 기능 박스 상세 내용 접기/펼치기
- 폴더 기반 구조물 프로젝트와 계층형 파일 트리
- 프로젝트 내부 구조물/폴더 생성, 이름 변경, 휴지통 삭제
- 구조물 간 클립보드를 유지하는 빠른 복사·붙여넣기
- 선택 영역 내부 회전·반전·삭제
- 활성 도구에 필요한 세부 옵션만 표시하는 컨텍스트 UI
- 프로젝트 트리 외 편집 설정을 접을 수 있는 3D 화면 오버레이로 제공
- 최근 사용한 블록을 뷰포트 아래 빠른 선택 바에서 재선택
- 공기를 항상 포함해 복사하고 붙여넣을 때 공기 적용 여부 선택
- 자주 쓰지 않는 작업공간·시점·시간대·코드·통계·도움말을 아이콘 도크에서 확장
- 보조 아이콘은 좌측 상단, 브러시 크기와 옵션은 좌측 중앙 세로 패널에 배치
- 환경 설정과 코드·정보의 두 아이콘으로 보조 패널을 그룹화하고 최근 블록 10개 제공
- 교체 도구의 연결 여부 전환과 선택 영역 미리보기 이동 지원
- 선택 이동·붙여넣기 상태에서 커서 추적 이동과 크기·회전 기즈모로 변형
- 박스·브러시 범위와 실제 블록의 교집합 선택 및 0.10×~8.00× 연속 리샘플링
- 회전 모드에서 Y축 임의 각도 회전과 복셀 리샘플링 미리보기
- 변형은 여러 번 미리 조정한 뒤 원하는 위치에서 우클릭해 확정하고 Esc로 취소
- 선택 영역 지정 후 Delete 또는 Backspace로 영역 내부 블록 삭제
- 좌측 브러시 옵션을 설명문 없는 얇은 세로 도구 막대로 표시
- 카메라 이동 속도 최대 400 blocks/s와 화면 경로 기반 관통 방지 연속 배치
- 한글 입력 상태에서도 WASD 이동, 카메라 연동 XYZ 축 기즈모와 커서 블록 좌표 HUD
- 부드럽게·평탄화·침하·융기·깎기를 지원하는 연속 조형 브러시
- 인접 블록 내부 면을 생성하지 않고 재질별 노출면만 묶어 그리는 복셀 메시 최적화
- 변형 기즈모에서 X/Y/Z 각 축을 0.1° 단위로 독립 회전
- Ctrl+A/Cmd+A로 전체 구조물 외곽 선택 후 Ctrl+C/Cmd+C로 내부 공기까지 복사
- 빈 프로젝트에서도 VS Code 입력창으로 새 구조물과 폴더 생성
- 붙여넣기 후 마지막 배율과 X/Y/Z 회전을 유지해 연속 재사용
- A/B 선택 도구: 직육면체 영역 지정
- 선택 채우기·비우기, Y축 회전, X/Z 대칭
- `.bpstructure`로 저장 후 다시 편집
- `현재 .bpy에 삽입` 또는 `.bpy로 내보내기`

내보낼 때 연속된 동일 블록은 가능한 범위에서 `/fill` 명령으로 합쳐지고 단일 블록만 `/setblock`으로 생성됩니다.

컴파일 명령은 현재 파일이 있는 폴더 아래의 모든 `.bpy` 파일을 한 팩으로 합칩니다. 다른 폴더를 소스 루트로 쓰려면 `bedrockpy.projectRoot`를 설정하세요. 상대 경로는 VS Code 작업 영역을 기준으로 합니다.

```python
pack:
    name = "My Pack"
    description = "내 BedrockPy 팩"
    icon = "assets/pack_icon.png"
    version = auto
    min_engine_version = [1, 21, 0]
    namespace = "mypack"
    output = "build/MyPackBP"
    mcpack = "build/MyPack.mcpack"
    mcaddon = "build/MyPack.mcaddon"
    max_lines = 10000
```

`pack.icon`, `pack.output`, `pack.mcpack`, `pack.mcaddon` 경로는 BedrockPy 프로젝트 루트를 기준으로 합니다. `.mcaddon`은 행동 팩과 리소스 팩을 한 파일로 묶습니다. `icon`의 PNG는 행동 팩과 연결된 사운드 리소스 팩에 `pack_icon.png`로 복사됩니다.

`version = auto`를 사용하면 성공적으로 컴파일할 때마다 `[1, 0, 0]`부터 패치 버전이 자동 증가합니다. 기록 파일인 `.bedrockpy/versions.json`은 삭제하지 마세요.

Python 실행 파일이 `python3`이 아니라면 VS Code 설정의 `bedrockpy.pythonPath`를 변경하세요. 팩 이름, 함수 네임스페이스, 조각당 최대 명령 수도 설정에서 바꿀 수 있습니다.

```python
vars:
    let prefix = "[MyPack]"
    let target = "@a"
    int count = 0
    float speed = 1.5
    bool enabled = true

tick:
    tell target, prefix, " 시작"
    /say {prefix} tick
    count += 1
    speed = speed * 1.1
    enabled = count >= 20
    tell @a, "횟수: ", count, " / 속도: ", speed

    for y in range(5):
        /setblock ~ ~{y} ~ stone

    if entity @a[tag=ready]:
        as @a[tag=ready]:
            /say 준비 완료
    else:
        /say 대기 중

function reward:
    /give @s diamond 1

tick every 20:
    /say 1초마다 실행
```

많은 명령을 매 틱 실행하면 Minecraft 성능이 크게 저하될 수 있습니다.

`float`는 8자리 가수와 10진 지수로 저장되는 소프트웨어 부동소수점입니다. 값의 크기는 지수가 담당하고 가수는 약 8자리 유효숫자를 유지합니다. 곱셈은 안전한 4자리 조각 연산을 사용합니다. `tell`과 타이틀에서는 기본 3자리로 출력되며 `speed:0`~`speed:6` 형식으로 표시 자릿수를 지정할 수 있습니다.

```python
vars:
    float pitch = 0.0
    float yaw = 0.0
tick:
    rotation @s -> pitch, yaw
```

`int` 목적지는 1도, `float` 목적지는 0.1도 단위로 저장됩니다.

```python
vars:
    float x = 0.0
    float y = 0.0
    float z = 0.0
tick:
    location @s -> x, y, z
```

좌표 탐색용 armor stand는 Y=1000에서 투명 상태로 사용되고 계산 직후 제거됩니다. int는 블록 좌표, float는 소수 첫째 자리까지 저장합니다.

```python
vars:
    float x = 0.0
    float y = 0.0
    float z = 0.0
    float ry = 0.0
    float rx = 0.0
tick:
    tp @a[tag=ghost] -> x, y, z, ry, rx
```

마지막 두 값은 `ry`, `rx` 순서이며 생략하면 좌표만 이동합니다.

프로젝트 루트의 `sounds/**/*.ogg`는 자동으로 연결된 리소스 팩에 복사됩니다. `.mcpack` 생성 시 행동 팩 파일과 이름 끝에 `_resources.mcpack`이 붙은 리소스 팩 파일을 모두 Minecraft에 가져오세요.

```python
sound ui/click:
    category = ui
    is3D = false

function click:
    play ui/click to @s
```

```python
title @a, "게임 시작!"
subtitle @a, "점수: ", score
actionbar @a, "속도: ", speed:2
```
