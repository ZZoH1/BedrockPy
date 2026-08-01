# BedrockPy

BedrockPy는 파이썬처럼 들여쓰기하는 짧은 DSL을 Minecraft Bedrock Edition 행동 팩으로 변환하는 무의존성 컴파일러입니다. `tick` 명령을 최대 10,000줄씩 자동 분할하고, 생성된 모든 조각을 `functions/tick.json`에 순서대로 직접 등록합니다.

> 많은 명령을 매 틱 실행하면 월드가 심하게 느려질 수 있습니다. 파일 분할은 엔진의 호출 제한을 나누기 위한 기능이지 성능 제한을 없애는 기능은 아닙니다.

## 빠른 시작

Python 3.10 이상에서 실행합니다.

```sh
python3 bedrockpy.py examples/demo.bpy \
  -o build/DemoBP \
  --name "Demo Pack" \
  --namespace demo \
  --mcpack build/Demo.mcpack
```

출력 구조:

```text
build/DemoBP/
├── manifest.json
└── functions/
    ├── tick.json
    └── demo/
        ├── tick_0001.mcfunction
        └── hello.mcfunction
```

`Demo.mcpack`을 열어 Minecraft에 가져오거나 `DemoBP` 폴더를 개발 행동 팩 폴더에 복사한 뒤 월드에서 활성화합니다. 치트를 켜야 명령을 사용할 수 있습니다.

## 여러 소스 파일로 한 팩 만들기

소스 파일 대신 프로젝트 폴더를 넘기면 그 아래의 모든 `.bpy` 파일을 재귀적으로 찾아 한 번에 하나의 행동 팩으로 컴파일합니다.

```sh
python3 bedrockpy.py examples/multi_file \
  -o build/MultiFileBP \
  --name "Multi-file Pack" \
  --namespace multi \
  --mcpack build/MultiFile.mcpack
```

```text
multi_file/
├── variables.bpy
├── initialization.bpy
├── tick.bpy
└── features/
    └── rewards.bpy
```

파일은 프로젝트 폴더 기준 경로의 사전순으로 합쳐집니다. 여러 파일에 나뉜 `vars:`, `init:`, `tick:` 블록은 각각 하나로 병합되며, `function` 이름은 프로젝트 전체에서 중복될 수 없습니다. 빈 파일과 주석만 있는 파일은 무시합니다.

VS Code 확장의 컴파일 명령도 기본적으로 현재 `.bpy` 파일이 있는 폴더 전체를 컴파일합니다. 소스 루트가 다른 경우 설정의 `bedrockpy.projectRoot`에 작업 영역 기준 상대 경로나 절대 경로를 지정할 수 있습니다. 입력 중 문법 검사는 빠른 피드백을 위해 현재 파일만 검사합니다.

### 팩 컴파일 설정

프로젝트 전체에서 하나의 `.bpy` 파일에 최상위 `pack:` 블록을 작성하면 CLI와 VS Code가 해당 설정으로 자동 컴파일합니다.

```python
pack:
    name = "My Adventure Pack"
    description = "모험을 위한 행동 팩"
    icon = "assets/pack_icon.png"
    version = auto
    min_engine_version = [1, 21, 0]
    namespace = "adventure"
    output = "build/AdventureBP"
    mcpack = "build/Adventure.mcpack"
    mcaddon = "build/Adventure.mcaddon"
    max_lines = 10000
```

- `name`: Minecraft에 표시할 팩 이름
- `description`: Minecraft 팩 목록에 표시할 설명
- `icon`: 프로젝트 루트 기준 PNG 이미지 경로. 결과 팩에는 `pack_icon.png`로 복사
- `version`: 팩 버전 `[주, 부, 패치]` 또는 빌드마다 패치 버전을 올리는 `auto`
- `min_engine_version`: 필요한 최소 Minecraft 버전 `[주, 부, 패치]`
- `namespace`: 생성 함수의 네임스페이스
- `output`: 행동 팩 출력 폴더
- `mcpack`: `true`, `false` 또는 `.mcpack` 출력 경로
- `mcaddon`: `true`, `false` 또는 행동 팩과 리소스 팩을 함께 담을 `.mcaddon` 출력 경로
- `max_lines`: tick 함수 조각 하나의 최대 명령 수(1~10000)

`icon`, `output`, 문자열 `mcpack`·`mcaddon` 경로는 프로젝트 루트 기준입니다. `mcpack = true` 또는 `mcaddon = true`이면 `output` 경로 뒤에 해당 확장자를 붙입니다. `.mcaddon`은 행동 팩과 생성된 리소스 팩을 서로 다른 루트 폴더로 묶으므로 Minecraft에서 파일 하나만 열어 함께 가져올 수 있습니다.

`version = auto`의 첫 성공 빌드는 `[1, 0, 0]`이고 이후 `[1, 0, 1]`, `[1, 0, 2]`처럼 증가합니다. 현재 버전은 프로젝트의 `.bedrockpy/versions.json`에 팩 UUID별로 저장됩니다. 이 파일을 삭제하면 자동 버전이 초기화되므로 Minecraft에 이미 설치된 팩을 계속 업데이트하려면 함께 보존하세요. 문법 검사와 `--print-config`는 버전을 올리지 않습니다.

VS Code의 `행동 팩 컴파일`과 `.mcpack 생성` 명령은 `pack.output` 또는 `pack.mcpack`이 있으면 저장 위치를 묻지 않고 바로 사용합니다. `pack:` 블록이 없을 때는 기존처럼 VS Code 설정값과 파일 선택 창을 사용합니다. CLI에서 `-o`, `--name`, `--namespace`, `--max-lines`, `--mcpack`을 직접 전달하면 문법 안의 값보다 우선합니다.

VS Code 확장에서 `vars:` 변수의 선언이나 사용처에 마우스를 올리면 컴파일 후 사용될 scoreboard objective와 score holder를 확인할 수 있습니다. `float`는 가수 holder와 지수 holder를 모두 표시합니다.

## 문법

### 주석

`#` 뒤의 내용은 한 줄 주석입니다. 코드만 있는 줄과 코드 뒤에서 모두 사용할 수 있습니다.

```python
# 별도 줄 주석
score += 1  # 코드 뒤 주석
/say "문자열 안의 #은 유지됩니다"  # 실제 주석
```

삼중 큰따옴표 또는 삼중 작은따옴표로 여러 줄 주석을 작성할 수 있습니다.

```python
"""
여러 줄에 걸친
설명입니다.
"""

'''
이 형식도
지원합니다.
'''
```

닫는 삼중 따옴표가 없으면 컴파일러가 주석이 시작된 줄에 오류를 표시합니다.

### 매 틱 실행

```python
tick:
    /say 매 틱 실행됩니다

tick every 20:
    /say 20틱마다 실행됩니다

vars:
    int update_rate = 20

tick every update_rate:
    /say 현재 update_rate 주기마다 실행됩니다
```

`tick:` 블록은 여러 파일에 나눌 수 있습니다. 생성된 명령은 기본 10,000개 단위로 나뉘며 `tick.json` 배열 순서대로 매 게임 틱에 실행됩니다.

`as`, `at`, `positioned`, `rotated` 등의 실행 문맥 안에서 `if`/`unless`가 내부 함수로 분리되면, 컴파일러가 분기 본문과 중첩 분기에 해당 문맥을 다시 적용합니다. 바깥 `as` selector는 다시 순회하지 않고 이미 선택된 `@s`를 사용합니다.

`if entity @a positioned ~-0.5 ~ ~:`처럼 조건 뒤에 이어 작성한 `positioned` 등의 execute 문맥도 분리된 함수 본문과 그 안의 중첩 분기에 다시 적용됩니다.

`tick every N:`은 N틱마다 블록을 한 번 실행합니다. N에는 1~2,000,000,000 범위의 정수 상수 또는 `vars:`에 선언한 `int` 변수를 사용할 수 있습니다. 변수값은 매 틱 반영되므로 실행 중에도 주기를 바꿀 수 있습니다. 변수값이 0 이하이면 해당 블록은 일시 정지되고 카운터가 초기화됩니다. 첫 실행은 활성화된 주기의 N틱째에 일어나며, 여러 주기 블록은 서로 독립적으로 시간을 셉니다. `tick every 1:`은 `tick:`과 같습니다.

아직 내용을 작성하지 않은 블록에는 `pass`를 넣을 수 있습니다. `pass`는 아무 Minecraft 명령도 생성하지 않습니다.

```python
function coming_soon:
    pass

tick:
    if enabled:
        pass
    else:
        /say disabled
```

### 팩 초기화와 업데이트 초기화

`init:` 블록은 월드에 팩을 처음 적용했을 때 한 번 실행되며, 새로 컴파일한 팩으로 업데이트했을 때 변수 초기화와 함께 다시 실행됩니다.

```python
init:
    /say 팩이 처음 적용되었거나 업데이트되었습니다
    /give @a diamond 1
```

컴파일할 때마다 1~2,000,000,000 범위의 새 빌드 ID가 생성됩니다. 월드 scoreboard의 내부 값 `bpi_build`와 새 ID가 다르면 통합 `__init.mcfunction`이 모든 `vars:` 변수를 선언 초기값으로 재설정하고 사용자 `init:` 명령을 실행한 뒤 새 ID를 기록합니다. 같은 빌드의 팩으로 월드를 다시 열거나 `/reload`하는 것만으로는 다시 실행되지 않습니다.

`init:`은 여러 파일에 나눌 수 있으며 하나의 초기화 함수로 병합됩니다. 새로 컴파일한 팩으로 업데이트하면 기존 scoreboard 변수 값은 유지되지 않고 `vars:`에 작성한 초기값으로 돌아갑니다.

원할 때 초기화를 다시 실행하려면 BedrockPy 코드에서 `call init`을 사용하거나 Minecraft에서 `/function 네임스페이스/init`을 실행합니다. 두 방법 모두 `vars:` 변수를 선언 초기값으로 되돌린 뒤 모든 `init:` 본문을 실행합니다. `init`은 이 기능을 위한 예약 함수 이름이므로 `function init:`으로 직접 선언할 수 없습니다.

```python
function reset_pack:
    call init
```

### 컴파일 시간 변수와 반복문

```python
tick:
    let height = 5
    for y in range(0, 5):
        /setblock ~ ~{y} ~ stone
```

`range(stop)`, `range(start, stop)`, `range(start, stop, step)`을 지원합니다. 반복문은 게임 안에서 도는 것이 아니라 컴파일할 때 여러 명령으로 펼쳐집니다. `{변수}`는 문자열 안에서도 치환됩니다.

### 조건문과 실행 문맥

```python
tick:
    if entity @a[tag=ready]:
        as @a[tag=ready]:
            at @s:
                /particle minecraft:basic_flame_particle ~ ~1 ~
    else:
        /say 준비된 플레이어가 없습니다
    unless block ~ ~-1 ~ air:
        /say 발밑에 블록이 있습니다
```

`if`와 `unless` 뒤에는 Bedrock `execute` 명령에서 허용하는 조건을 그대로 씁니다. `else:`는 같은 들여쓰기의 `if` 바로 다음에 쓸 수 있습니다. 각 조건 블록은 `__internal` 아래의 별도 함수로 추출되므로 조건은 블록 전체에 대해 한 번만 검사됩니다.

```mcfunction
execute if entity @a[tag=ready] run function demo/__internal/if_0001
```

내부 함수에는 블록의 실제 명령만 들어갑니다. `as`, `at`, `positioned`, `rotated`, `facing`, `anchored`, `in`, `align` 실행 문맥도 함수 호출에 전달됩니다. 중첩 조건은 중첩된 내부 함수로 생성됩니다.

실행 문맥 블록도 내부 함수 하나로 추출됩니다. 따라서 float 연산처럼 여러 scoreboard 명령으로 이루어진 문장이 여러 대상에게 실행될 때, 대상 하나의 계산이 끝난 뒤 다음 대상으로 넘어가므로 중간값이 서로 섞이지 않습니다.

### 호출 가능한 일반 함수

```python
function reward:
    /give @s diamond 1
    /say 보상을 받았습니다

function start:
    call reward
```

게임에서는 `/function demo/start`처럼 호출합니다. `call reward`는 `function demo/reward`로 변환됩니다. 생성 명령이 `max_lines`(기본 10,000)를 넘지 않는 함수는 기존처럼 즉시 실행됩니다. 제한을 넘는 함수는 호출 파일이 작업 플래그만 켜고, 본문은 최대 `max_lines`개씩 나뉘어 `tick.json`의 독립 함수로 자동 등록됩니다.

자동 tick 함수는 호출한 tick의 등록 순서가 아직 지나지 않았다면 같은 tick 후반에, 이미 지났다면 다음 tick에 실행됩니다. 또한 원래 호출자의 `@s`, 위치와 회전 실행 문맥은 보존되지 않으므로, 10,000줄을 넘는 함수에서는 전역 변수와 명시적인 선택자를 사용하는 것이 안전합니다. 같은 함수를 여러 번 호출해도 전역 작업 플래그 하나를 공유합니다.

### 함수의 연속 실행 시작과 종료

함수 선언에 `when first` 또는 `when last` 조건을 붙일 수 있습니다.

```python
function attack_started when first:
    /say 연속 호출이 시작된 첫 틱

function attack_stopped when last:
    /say 연속 호출이 끝난 다음 틱
```

- `when first`: 이전 틱에 호출되지 않았고 현재 틱에 호출됐을 때만 본문 실행
- `when last`: 이전 틱에는 호출됐지만 현재 틱에는 호출되지 않았을 때 본문 실행
- 같은 틱에 `when first` 함수를 여러 번 호출해도 본문은 한 번만 실행
- 한 틱만 쉬었다가 다시 호출하면 새로운 연속 실행으로 판단

```python
tick:
    if attacking:
        call attack_started
        call attack_stopped
```

두 함수는 별도의 호출 상태를 가집니다. `attack_started`는 연속 호출의 시작을 처리하고, `attack_stopped`는 호출이 끊긴 다음 틱에 종료를 처리합니다. 종료 여부는 미래의 호출 부재를 확인해야 하므로 `when last` 본문은 마지막으로 호출된 틱이 아니라 그 다음 틱에 실행됩니다.

컴파일러는 `bpi_tick`, `bpi_prev`와 함수별 마지막 호출 tick을 scoreboard에 저장합니다. 판정은 `tick.json`의 사용자 tick 함수 뒤에서 수행되므로 BedrockPy `tick:`에서 이루어진 호출을 기준으로 가장 정확하게 동작합니다. 내부 점수 이름은 Bedrock 명령 파서와 호환되는 영문·숫자·밑줄만 사용합니다.

### 함수 실행 일시정지

`sleep(tick)`은 현재 함수의 실행을 멈추고 지정한 게임틱 뒤에 나머지 코드를 실행합니다. 인자를 생략한 `sleep()`은 `sleep(0)`과 같습니다. 정상 게임 속도에서는 20틱이 약 1초입니다.

```python
function countdown:
    /say 3
    sleep(20)
    /say 2
    sleep(20)
    /say 1
    sleep(20)
    /say 시작!
```

컴파일러는 `sleep` 뒤의 코드를 `__internal/sleep_XXXX` 함수로 분리하고 다음과 같은 예약 명령을 생성합니다.

```mcfunction
schedule delay add demo/__internal/sleep_0001 20t append
```

tick 값은 0~2,000,000,000이어야 하며 `sleep` 뒤에는 재개할 문장이 있어야 합니다. `append` 모드를 사용하므로 같은 함수를 여러 번 실행하면 각 실행의 재개 예약이 별도로 추가됩니다. `sleep(0)`은 현재 함수가 끝난 뒤 가능한 빠르게 continuation을 예약하지만 다음 틱 실행이나 부하 분산을 보장하지 않습니다. 명령 부하를 확실히 다음 틱으로 넘기려면 `sleep(1)` 이상을 사용하세요.

예약된 함수는 원래 실행자의 `@s`, 위치, 회전 같은 실행 문맥을 안전하게 보존한다고 가정할 수 없습니다. 실행자를 유지해야 하는 로직에서는 `@s` 대신 태그나 고유 scoreboard 값을 사용해 대상을 다시 선택하세요. 이 이유로 `sleep`은 직접적인 `as`, `at` 실행 문맥 블록 안에서는 컴파일 오류가 발생합니다.

### scoreboard 변수와 연산

`vars:` 블록에서 월드에 계속 저장되는 전역 변수를 선언할 수 있습니다.

```python
vars:
    let prefix = "[Adventure]"
    let target = "@a"
    int count = 0
    float speed = 1.5
    bool enabled = true

tick:
    tell target, prefix, " 시작합니다"
    /say {prefix} tick 실행
    count += 1
    speed = speed * 1.1
    enabled = count >= 20

    if enabled:
        /say 활성화됨
    else:
        /say 대기 중
```

`vars:`의 `let`은 팩 전체에서 공유하는 컴파일 시간 상수입니다. 문자열, 숫자, bool을 저장할 수 있고 scoreboard를 만들지 않습니다. `tp`, `location`, `rotation`, `tell`, `title`, 조건식 같은 BedrockPy 문법에서는 `target`처럼 상수 이름을 바로 사용합니다. `/`로 시작하는 Minecraft 원본 명령에서만 `/say {prefix}`처럼 중괄호로 치환합니다. 선언 후 대입으로 변경할 수 없습니다.

지원 런타임 자료형은 scoreboard 정수인 `int`, 1 또는 0으로 저장되는 `bool`, 8자리 10진 소프트웨어 부동소수점인 `float`입니다. 지원 연산은 `+`, `-`, `*`, `/`, `%`, 복합 대입, 비교 연산과 `and`, `or`, `not`입니다.

`float` 하나는 8자리 가수와 별도의 10진 지수로 저장되며 실제 값은 `가수 × 10^지수`입니다. 가수 자릿수는 값의 최대 크기가 아니라 유효숫자의 수를 뜻하므로 매우 크거나 작은 값도 지수를 통해 표현할 수 있습니다. 곱셈은 가수를 상·하위 4자리로 나눠 중간값의 scoreboard 오버플로를 방지하고, 나눗셈은 10진 긴 나눗셈으로 8자리 몫을 생성합니다. 이 방식은 53비트 이진 구현보다 정밀도는 낮지만 생성 명령 수와 틱 부하가 크게 줄어듭니다.

### 간편 메시지 출력

`tell`을 사용하면 raw JSON을 직접 작성하지 않고 문자열과 scoreboard 변수를 함께 출력할 수 있습니다.

```python
tell @a, "현재 점수: ", count
tell @s, "속도: ", speed, " / 활성화: ", enabled
tell @a, "속도 한 자리: ", speed:1
tell @a, "속도 여섯 자리: ", speed:6
```

쉼표 앞의 첫 항목은 메시지를 받을 대상이고, 이후 항목은 문자열·숫자·`int`·`float`·`bool` 변수를 사용할 수 있습니다. 문자열의 `§a`, `§c` 같은 Bedrock 서식 코드도 그대로 사용할 수 있습니다.

```python
tell @a, "§a점수: §f", count
```

`int`와 `bool`은 scoreboard 값으로 출력됩니다. `float` 변수를 그대로 쓰면 기본적으로 소수 셋째 자리까지 표시됩니다. 변수 뒤에 `:자릿수`를 붙이면 0~6자리 중 원하는 자릿수를 지정할 수 있습니다.

```python
tell @a, speed
tell @a, speed:0
tell @a, speed:1
tell @a, speed:4
```

위 코드는 각각 `1.500`, `1`, `1.5`, `1.5000` 형태로 출력됩니다.

필요한 자릿수만큼 0이 자동으로 채워지며 마지막 표시 자리 아래는 버립니다.

출력 과정에서는 임시 scoreboard에 실제 값의 `10^자릿수`배를 담습니다. 따라서 자릿수를 늘릴수록 일반 소수 표기로 안전하게 출력할 수 있는 값의 범위가 줄어듭니다. 기본 3자리의 범위는 약 `-2147483.647`~`2147483.647`입니다.

컴파일 결과는 공식 rawtext의 `text`와 `score` 노드로 구성된 한 줄의 `tellraw` 명령입니다.

### 플레이어 회전값 가져오기

`rotation`은 선택한 엔티티의 위아래 시선 각도(pitch)와 좌우 회전각(yaw)을 scoreboard 변수에 저장합니다.

```python
vars:
    float pitch = 0.0
    float yaw = 0.0

tick:
    rotation @a[tag=tracked] -> pitch, yaw
```

첫 번째 변수에는 `rx` 기반 pitch(-90~90), 두 번째 변수에는 `ry` 기반 yaw(-180~179)가 저장됩니다. `int` 변수는 1도 단위, `float` 변수는 0.1도 단위입니다. 컴파일러는 정수 각도를 이진 탐색하고 마지막 1도 구간에서 소수 첫째 자리를 검사하므로, 모든 각도를 매 틱 순서대로 검사하지 않습니다. 대상 선택자가 여러 엔티티를 반환하면 전역 변수에는 마지막으로 처리된 엔티티의 회전값이 남습니다.

### 엔티티 좌표 가져오기

```python
vars:
    float x = 0.0
    float y = 0.0
    float z = 0.0

tick:
    location @s -> x, y, z
```

`location`은 임시 armor stand를 항상 `Y=1000`에 소환하고 즉시 투명 효과를 적용한 뒤, X와 Z를 이진 lifting 방식으로 탐색합니다. Y는 armor stand를 내리지 않고 `y/dy` 범위 분기로 구합니다. `int` 목적지는 블록 좌표, `float` 목적지는 소수 첫째 자리까지 저장합니다. 탐색이 끝나면 임시 태그와 armor stand를 같은 실행 안에서 제거합니다.

X/Z 지원 범위는 Bedrock 월드 경계인 `-29,999,984~29,999,983`입니다. 마커 이동 지점의 청크가 로드되지 않은 경우 베드락의 엔티티 텔레포트 처리에 따라 탐색이 실패할 수 있으므로, 매우 먼 좌표에서 사용할 때는 해당 지역의 청크 로딩 상태를 확인하세요. 여러 대상을 선택하면 순서대로 계산되며 전역 변수에는 마지막 대상의 좌표가 남습니다.

### 변수 좌표로 텔레포트하기

`location`과 `rotation`으로 얻은 `x y z ry rx` 값을 다시 `tp`에 사용할 수 있습니다.

```python
vars:
    float x = 0.0
    float y = 0.0
    float z = 0.0
    float ry = 0.0
    float rx = 0.0

tick:
    location @s -> x, y, z
    rotation @s -> rx, ry
    tp @a[tag=ghost] -> x, y, z, ry, rx
```

형식은 `tp @대상 -> x, y, z` 또는 `tp @대상 -> x, y, z, ry, rx`입니다. 마지막 두 값은 Bedrock의 `ry`, `rx` 순서에 맞춰 yaw, pitch로 적용됩니다. 각 자리에는 `int`·`float` 변수 또는 `10.5`, `-3`, `90` 같은 숫자 상수를 넣고 서로 섞어 쓸 수 있습니다. float 좌표와 회전 및 숫자 상수는 소수 첫째 자리 단위로 적용됩니다. 내부적으로는 투명 armor stand를 `Y=1000`에서 시작해 scoreboard 값만큼 이동시킨 뒤, Bedrock의 armor stand 기준점 오차를 보정해 대상자를 보냅니다. 매우 먼 좌표는 청크 로딩 상태의 영향을 받을 수 있습니다.

```python
tp cursor -> 10.5, y, -3, 90, rx
```

모든 값이 숫자 상수이면 armor stand나 scoreboard 계산을 생성하지 않고 Minecraft 원본 `tp` 명령 한 줄로 컴파일합니다. 변수와 상수가 섞인 경우에도 armor stand와 scoreboard는 변수 축만 계산하고, 상수 좌표와 회전은 마지막 원본 `tp` 명령에 직접 넣습니다.

### 타이틀·서브타이틀·액션바 출력

`tell`과 동일한 형식으로 화면 중앙의 타이틀, 서브타이틀, 액션바에 문자열과 scoreboard 변수를 출력할 수 있습니다.

```python
title @a, "게임 시작!"
subtitle @a, "점수: ", score
actionbar @a, "속도: ", speed:2, " / 활성: ", enabled
```

`int`, `bool`, `float` 변수를 지원하며 float는 `speed:0`~`speed:6` 형식으로 출력 자릿수를 지정합니다. 컴파일 결과는 각각 `titleraw @a title`, `titleraw @a subtitle`, `titleraw @a actionbar` 명령이 됩니다.

### 커스텀 사운드

프로젝트 루트의 `sounds` 폴더에 `.ogg` 파일을 넣으면 컴파일러가 커스텀 사운드로 자동 등록합니다. 하위 폴더도 사용할 수 있습니다.

```text
my_project/
├── main.bpy
└── sounds/
    ├── alert.ogg
    └── ui/
        └── click.ogg
```

확장자를 제외한 `sounds` 기준 상대 경로를 `play`에 사용합니다.

사운드별 카테고리와 공간감을 설정하려면 최상위 `sound` 블록을 사용합니다.

```python
sound ui/click:
    category = ui
    is3D = false

sound voice/announcement:
    category = neutral
    is3D = false

sound world/explosion:
    category = block
    is3D = true
```

`category`를 생략하면 `neutral`, `is3D`를 생략하면 `true`가 기본값입니다. `category = ui`나 `category = music`은 Minecraft에서 본래 비공간 사운드로 처리됩니다. `is3D = false`를 사용하면 다른 카테고리를 유지하면서 위치·거리 방향감만 끌 수 있습니다. 같은 사운드의 설정 블록은 프로젝트 전체에서 한 번만 선언할 수 있습니다.

```python
function notify:
    play alert
    play ui/click to @s
    play ui/click to @a at ~ ~1 ~ volume 0.8 pitch 1.2 minimum 0.1
```

전체 형식은 다음과 같으며 선택 항목은 이 순서로 작성합니다.

```text
play 이름 [to 대상] [at x y z] [volume 값] [pitch 값] [minimum 값]
```

- 기본 대상: `@a`
- 기본 위치: `~ ~ ~`
- 기본 volume 및 pitch: `1`
- 기본 minimum volume: `0`
- 파일과 폴더 이름: 영문 소문자, 숫자, `_`, `-`만 지원
- 오디오 형식: `.ogg`

커스텀 사운드가 있으면 행동 팩 `출력폴더`와 리소스 팩 `출력폴더_RP`가 함께 생성됩니다. 행동 팩 manifest에는 리소스 팩 의존성이 자동 등록됩니다. `--mcpack MyPack.mcpack`을 사용하면 `MyPack.mcpack`과 `MyPack_resources.mcpack`이 함께 생성되므로 두 파일을 모두 Minecraft로 가져오면 됩니다.

### 수학 함수

scoreboard 변수와 연산식에서 다음 수학 함수를 사용할 수 있습니다.

```python
result = abs(value)
result = pow(value, 3)
result = sqrt(value)
result = root(value, 3)
result = sin(angle)
result = cos(angle)
result = tan(angle)
result = log(value)
result = log(value, 10.0)
result = max(value, minimum, 10.0)
result = min(value, maximum)
```

- `abs(x)`: 절댓값. `int`와 `float` 지원
- `pow(x, n)`: 정수 지수 거듭제곱. 지수 범위 -8~8
- `sqrt(x)`: 제곱근. 7회 뉴턴 근사
- `root(x, n)`: n제곱근. 차수 범위 2~8
- `sin(x)`, `cos(x)`, `tan(x)`: 라디안 삼각함수 근사
- `log(x)`: 자연로그 근사
- `log(x, base)`: 지정한 밑의 로그 근사
- `max(a, b, ...)`: 두 개 이상 값 중 최댓값. `int`·`float` 혼합 지원
- `min(a, b, ...)`: 두 개 이상 값 중 최솟값. `int`·`float` 혼합 지원

`sqrt`, `root`, `log`의 입력은 양수여야 하며 `tan`은 `π/2 + kπ` 부근에서 오차와 0 나눗셈 가능성이 커집니다. scoreboard로 구현한 근사 계산이므로 Python 표준 수학 라이브러리와 같은 정밀도를 보장하지 않습니다.

루트·삼각·로그 함수는 수천 개의 명령을 생성할 수 있습니다. 여러 고비용 계산 때문에 일반 함수가 10,000줄을 넘으면 컴파일러가 자동으로 독립 tick 작업 함수로 전환합니다.

### 원시 명령

Minecraft 자체 명령은 게임 채팅과 마찬가지로 반드시 `/`로 시작합니다. 컴파일러가 `.mcfunction`을 만들 때 맨 앞의 `/`를 자동으로 제거합니다.

```python
tick:
    /say hello
    /scoreboard players add timer system 1
```

`call`, `let`, `if`, `else`, `for`, 변수 선언과 대입 같은 BedrockPy 문법에는 `/`를 붙이지 않습니다. `cmd` 키워드는 더 이상 존재하지 않습니다. 컴파일러는 Minecraft 명령 자체의 유효성까지 검사하지 않으므로 사용하는 게임 버전에 맞는 명령을 작성해야 합니다.

## 한계와 설계상 주의점

- `for`는 정적인 코드 생성 반복문입니다. 플레이 중 상태에 따라 반복 횟수가 바뀌는 런타임 반복은 스코어보드와 여러 틱에 걸친 상태 머신이 필요합니다.
- 여러 tick 조각은 각각 별도 최상위 함수 호출이지만 모두 같은 틱에 실행됩니다. 수만 개 명령은 기기 성능과 watchdog에 큰 부담을 줄 수 있습니다.
- 조건 내부 함수가 실제로 호출되면 그 명령들도 호출당 10,000개 제한에 합산됩니다. 컴파일러는 내부 함수 파일 자체가 제한을 넘지 않게 검사합니다.
- `tick.json` 함수는 월드가 완전히 로드되기 전부터 실행될 수 있습니다. 초기화가 필요한 로직은 엔티티 태그나 스코어보드 존재 여부로 보호하세요.
- 다른 팩과 충돌하지 않도록 `--namespace`를 고유하게 지정하세요.

## 테스트

```sh
python3 -m unittest discover -s tests -v
```
