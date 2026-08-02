# 변경 기록

## 0.146.9

- 카메라 주변에서 바닥의 1×1 격자가 표시되는 반경을 128블록에서 160블록으로 확대
- 멀리 있는 격자는 기존처럼 4×4, 16×16 단계로 단순화해 렌더링 증가 제한

## 0.146.8

- 텍스트 블록 도구에서 사용자 TTF·OTF·WOFF·WOFF2 폰트 파일 불러오기 지원
- 불러온 폰트를 선택 목록, 글꼴 미리보기, 3D 블록 텍스트에 즉시 적용
- 사용자 폰트 파일 로딩 상태와 오류 표시 추가

## 0.146.7

- 폰트를 변경해도 특수 배치 원본 캐시가 이전 글꼴을 재사용하던 문제 수정
- 폰트 선택 즉시 3D 텍스트 구조와 배치 미리보기를 다시 생성

## 0.146.6

- 폰트 선택 목록의 각 이름을 해당 폰트 모양으로 표시하는 커스텀 선택기 추가
- 현재 선택된 폰트 이름도 실제 글꼴로 표시

## 0.146.5

- 텍스트 블록 도구에 6가지 기본 폰트 프리셋 추가
- 선택한 폰트와 입력 내용을 즉시 확인하는 미리보기 추가
- 폰트 변경 시 3D 블록 텍스트 미리보기도 즉시 다시 생성

## 0.146.4

- 붙여넣기와 선택 이동 중 `C`를 누르면 커서 위치 대신 복사·선택 원위치에 미리보기 표시
- `C`를 누른 상태로 적용하면 원위치에 배치하고, 놓으면 이전 커서 배치 위치로 복귀
- 내부 클립보드에 복사한 영역의 원래 기준 좌표 저장

## 0.146.3

- `C` 자동 축 고정을 조형 및 구·빈 구·원·원판·원기둥·산 연속 배치 도형에 안정적으로 적용
- 조형·배치 도형 미리보기 후 먼 바닥 좌표가 축 고정 경로의 마지막 좌표를 덮어쓰던 문제 수정

## 0.146.2

- 3D 편집기 조작법에 `C + 브러시 드래그` 자동 축 고정 안내 추가

## 0.146.1

- `C` 축 고정이 바닥 레이캐스트 좌표 대신 화면에 투영된 X/Y/Z 축과 마우스 방향을 비교하도록 변경
- 위쪽으로 드래그할 때 먼 바닥을 따라 전진하지 않고 Y축 공중 방향으로 브러시가 올라가도록 수정
- 카메라 거리와 축의 화면상 크기를 반영해 축 고정 이동량 계산

## 0.146.0

- 브러시 드래그 중 `C`를 누르면 처음 움직인 방향의 X/Y/Z 축을 자동 감지해 해당 축으로만 적용하는 기능 추가
- `C`를 놓으면 자유 이동으로 복귀하며 다시 누를 때 현재 위치를 기준으로 새 축 선택
- 한국어 입력 상태에서도 물리 키 위치를 기준으로 축 고정이 작동하도록 구현

## 0.145.9

- 환경설정 도크의 투명 영역이 왼쪽 브러시 패널과 `도구` 버튼 클릭을 가로채던 문제 수정
- 실제 유틸리티 버튼과 열린 팝오버만 포인터 입력을 받도록 변경

## 0.145.8

- 투명한 레이캐스트 지면이 깊이 버퍼를 기록해 큰 X/Z 좌표에서 격자와 Z-fighting을 일으키던 문제 수정
- 지면 클릭 판정은 유지하면서 색상·깊이 기록을 끄고 격자를 지면에서 조금 더 분리

## 0.145.7

- 굵은 격자의 중심 스냅 간격이 렌더 범위를 초과해 격자 전체가 사라지던 문제 수정
- 격자 중심을 항상 카메라의 생성 반경 안에 유지하고 잘못된 시야 절두체 제거 방지

## 0.145.6

- 수평·수직 방향 격자의 간격 단계를 모두 `1, 4, 16, 64...` 계열로 통일
- 카메라 높이에 따라 `2, 8, 32...` 격자가 섞이던 기본 단계 계산 제거

## 0.145.5

- 대형 작업공간의 +X/+Z 방향에서 격자가 깜빡이지 않도록 카메라 주변 로컬 좌표 기반 floating origin 렌더링 적용
- 작업공간 끝부분에서도 격자 정점의 Float32 정밀도가 유지되도록 개선

## 0.145.4

- 환경설정 팝오버가 편집 화면 아래로 넘치지 않도록 상하 경계 기반 레이아웃으로 변경
- 남은 화면 높이 안에서 미리보기 시간대 슬라이더와 값 표시까지 스크롤 가능하도록 수정

## 0.145.3

- Increased the environment utility popover height and added stable internal scrolling.
- Added bottom scroll padding so the preview-time label remains visible below its slider.

## 0.145.2

- Reordered placement shapes so Mountain is sixth, Line is seventh, and Curve is eighth.

## 0.145.1

- Added a 1-to-16 block thickness option to the standard A-to-B line tool.
- Applied identical thickness geometry to live line previews and final placement while preserving continuous endpoint chaining.

## 0.145.0

- Replaced independent A-to-B curve segments with a multi-point centripetal Catmull-Rom curve tool.
- Added left-click control-point placement, live full-path preview, right-click completion, and explicit Finish/Clear controls.
- Generated the complete smooth curve as one Undo transaction while retaining configurable thickness and placement filters.

## 0.144.0

- Added an A-to-B quadratic Bezier Curve placement shape with signed curvature height and configurable thickness.
- Added live curve preview and continuous chaining where the completed B endpoint becomes the next A endpoint.
- Applied selection limiting and air-only/solid-only placement rules to generated curve blocks.

## 0.143.3

- Moved Image Block into the empty tool cell beside Text Block after reducing the text tool width.
- Kept 3D Model in the following grid cell using the same standard tool sizing.

## 0.143.2

- Changed the Text Block tool from a full-width two-column button to the same single tool-cell size as the other tools.

## 0.143.1

- Moved Sculpt to tool slot and numeric shortcut 4.
- Shifted Box Select, Brush Select, Replace, Paste, and Move Selection to shortcuts 5 through 9.

## 0.143.0

- Allowed camera drag rotation while a time-sliced placement, deletion, or sculpt commit is still applying blocks.
- Continued blocking new block edits during commit so Undo transactions cannot overlap, while preserving WASD and vertical camera movement.

## 0.142.9

- Incrementally patched simplified selection-mesh source data from only the coordinates changed by each edit.
- Rebuilt updated simplified selection geometry in 5 ms background slices while retaining the previous mesh until replacement is ready.
- Updated selection meshes after placement, deletion, sculpting, Undo, and Redo without rescanning the complete structure on pointer release.

## 0.142.8

- Restored simplified occupied-block meshes for large selections while caching them across ordinary block edits.
- Rebuilt the display mesh only when selection bounds or mask identity changes, avoiding a full structure scan on every pointer release.
- Kept a separate mutation-aware source cache for selection-move previews so moved block contents remain current.

## 0.142.7

- Stopped rebuilding occupied-block surface previews after every edit while a large selection is active.
- Kept large box and brush selections visible as lightweight purple bounds without rescanning the structure on pointer release.
- Retained detailed source preview generation when the selection-move tool actually needs it.

## 0.142.6

- Corrected the final mirrored side-face pair to east/north based on in-editor orientation verification.
- Restored west/south to their original UV direction so all four horizontal faces have matching orientation.

## 0.142.5

- Corrected the side-face UV pair from east/south to west/south after comparing the two existing horizontal orientation groups.
- Kept east, north, top, and bottom faces unchanged.

## 0.142.4

- Corrected horizontal UV mirroring on the positive-X east face and positive-Z south face.
- Preserved the existing top, bottom, west, and north texture orientation and greedy-mesh texture tiling.

## 0.142.3

- Decoupled sculpt preview colors from the block selected in the placement palette.
- Made sculpt-created terrain inherit the existing column surface or the dominant neighboring terrain type.
- Removed `activeBlock` as the fallback material for empty-column sculpt raising and object smoothing fills.

## 0.142.2

- Guaranteed that the newest Undo transaction is retained regardless of how far it exceeds the normal changed-block memory budget.
- Evicted only older history when one exceptionally large accidental operation consumes the complete Undo budget.

## 0.142.1

- Time-sliced large Undo finalization so comparing before/after block values no longer freezes one pointer-up frame.
- Replaced per-block Undo objects with compact flat triples to reduce retained JavaScript object overhead.
- Limited Undo retention by both 50 transactions and 500,000 changed blocks, automatically evicting the oldest large records.
- Applied the asynchronous Undo path to single large brush clicks as well as continuous placement, deletion, and sculpt strokes.

## 0.142.0

- Time-sliced continuous placement, deletion, and sculpt commits across animation frames instead of applying every saved brush center in one pointer-up frame.
- Batched sculpt height-cache maintenance and Undo capture across the complete stroke.
- Deferred edit mesh rebuilding out of pointer events and limited rebuilding to one dirty chunk per frame with a tighter frame budget.
- Kept single-click edits on their direct path while scheduling their visual chunk rebuild for the following frame.

## 0.141.4

- Kept the `.bpstructure` save-progress overlay visible while Play mode is active.
- Used the same save preparation, encoding, file-writing, and completion progress flow in editor and Play modes.

## 0.141.3

- Simplified the fog readout to `안개 범위 50%` style text.
- Changed the default fog coverage to 50% for new structures and files without a saved fog setting.

## 0.141.2

- Changed fog from an absolute exponential density to a linear range derived from the current render distance.
- Made the fog slider control how much of the far end of the render distance is covered, while keeping zero as disabled.
- Preserved compatibility with `.bpstructure` files containing the former fog-density setting.

## 0.141.1

- Deferred installed-block inspection for box selections until pointer release.
- Kept drag feedback responsive by updating only the rectangular selection outline while the pointer is held.

## 0.141.0

- Stored per-structure environment and code settings in `.bpstructure`: camera speed, fog, render distance, jump coordinates, preview time, color/texture mode, Play FOV, Play sensitivity, function name, workspace/base coordinates, and viewpoint.
- Restored all saved settings when reopening each structure and marked project files dirty when persistent environment controls change.
- Kept external resource-pack files outside `.bpstructure` while persisting whether the structure uses color or texture rendering.

## 0.140.16

- Added horizontal-distance grid LOD rings so low-altitude views no longer draw one-block lines all the way to the horizon.
- Increased grid spacing by 4× in each farther ring while retaining exact block alignment near the camera.
- Reduced grid opacity and disabled depth writing to lessen distant line aliasing and shimmer.

## 0.140.15

- Added hysteresis to adaptive-grid level changes so camera movement near a distance threshold no longer toggles grid density every frame.
- Increased grid-patch recentering from 16 to 64 grid intervals to reduce geometry replacement during camera movement.

## 0.140.14

- Halved adaptive-grid distance thresholds so coarser 2, 4, 8, and larger block intervals activate closer to the ground.

## 0.140.13

- Replaced the fixed workspace grid interval with camera-distance adaptive grid levels of 1, 2, 4, 8, and larger block steps.
- Rendered only a bounded grid patch around the camera and expanded its covered world area as the interval increases.
- Snapped adaptive-grid recentering to 16 grid intervals to avoid rebuilding geometry on every small camera movement.

## 0.140.12

- Replaced the square Three.js grid helper with a rectangular workspace-aligned line grid.
- Used an integer block interval for large-workspace grid simplification so every visible line remains on an exact block boundary.
- Kept grid lines inside the actual X/Z workspace bounds when the two dimensions differ.

## 0.140.11

- Added visible save progress for toolbar Save, Save As, Ctrl+S, and Cmd+S operations.
- Reported structure preparation, destination selection, JSON encoding, byte size, file writing, completion, cancellation, and failure stages.
- Prevented concurrent duplicate saves while a save operation is active.

## 0.140.10

- Added block-coordinate interpolation between sampled sculpt centers for continuous sculpt paths.
- Removed the 90 ms planning throttle and two-center-per-event cap that could leave gaps during fast sculpt strokes.
- Kept sculpt-center spacing proportional to half the brush size and deferred all terrain modification until pointer release.

## 0.140.9

- Preserved the editor camera position and look target immediately before entering Play mode.
- Saved the pre-Play editor viewpoint instead of the temporary player camera when saving during Play mode.

## 0.140.8

- Stored the last camera position and look target in each `.bpstructure` file.
- Restored the saved camera position, direction, and orbit distance when reopening a structure.
- Converted a Play-mode camera view into a restorable editor viewpoint when saving during Play mode.

## 0.140.7

- Changed deferred placement, deletion, and generated-shape strokes to retain only sampled brush-center paths instead of every affected block coordinate.
- Recomputed affected blocks from the saved center path on pointer release while keeping bounded transient previews during dragging.

## 0.140.6

- Added a live Bedrock Overworld Y-range warning using the inclusive buildable block range -64 through 319.
- Highlighted base Y and workspace-height inputs in red when their combined range exceeds the limit without preventing editing, saving, or applying the size.

## 0.140.5

- Increased the editor camera-speed maximum from 400 to 1,000 blocks per second.
- Increased each workspace axis maximum to 65,536 blocks and capped visual grid subdivisions to avoid huge guide geometry.
- Added environment X/Y/Z camera-coordinate inputs with an instant-move action for editor and Play modes.

## 0.140.4

- Removed the persistent relative/absolute `.bpy` coordinate setting from the code-information panel and `.bpstructure` files.
- Kept coordinate mode as a temporary export-only choice shown whenever `.bpy` export begins.

## 0.140.3

- Deferred continuous sphere, hollow-sphere, circle, disc, cylinder, and mountain placement until pointer release.
- Accumulated generated-shape cells as preview-only data and committed the complete stroke as one undoable operation.

## 0.140.2

- Updated placement, deletion, and sculpt brush outlines directly from the current deferred-stroke target while dragging.
- Prevented the brush outline from remaining at the continuous-stroke start until a camera-triggered hover refresh.

## 0.140.1

- Removed the `.bpstructure` format-version field and legacy `blocks`-array compatibility.
- Accepted only the chunk-indexed format for `.bpstructure` files while retaining `.mcstructure` importing as a separate external format.

## 0.140.0

- Added the chunk-only `.bpstructure` format with independently encoded 16×16×16 block payloads and lightweight chunk/type indexes.
- Loaded only chunk indexes when opening structures and decoded block data on first render, selection, collision, or editing access.
- Preserved untouched lazy chunk payloads when saving so saving no longer forces every block into the live map.
- Kept `.mcstructure` importing as a separate external format.

## 0.139.9

- Deferred continuous deletion until pointer release while showing only affected-block previews during dragging.
- Deferred continuous sculpting until pointer release by recording and replaying the sampled sculpt path as one undoable operation.

## 0.139.8

- Changed continuous placement strokes to accumulate preview-only cells while the pointer is held.
- Applied the complete placement stroke only on pointer release as a single undoable operation.
- Discarded deferred placement previews without modifying blocks when the pointer is cancelled.

## 0.139.7

- Increased stationary continuous-brush activation from 600 ms to 2 seconds.
- Kept single placement deferred until pointer release unless the target block changes or the intentional long-press threshold is reached.

## 0.139.6

- Replaced editor-mode block picking with the same voxel-grid 3D DDA traversal used by Play mode.
- Preserved adjacent-face placement and empty workspace-floor picking without mesh raycasts.

## 0.139.5

- Replaced Play-mode Three.js mesh raycasting with a voxel-grid 3D DDA traversal.
- Made the center-block outline cost depend on viewing distance instead of total rendered mesh and triangle count.

## 0.139.4

- Cancelled an in-progress project structure load as soon as another file is selected.
- Ignored stale extension-side file reads and webview block-conversion results so only the latest selection can replace the editor.

## 0.131.0

- 2,000칸을 넘는 큰 브러시 미리보기를 전체 셀 대신 표면 표본과 외곽선으로 단순화
- 큐브 브러시는 최대 약 6면 격자, 둥근 브러시는 위경도 표본으로 형태 표시
- 같은 대상 블록 위에서 포인터만 움직일 때 브러시 미리보기 메쉬 재생성 생략
- 일반 브러시 미리보기 인스턴스 상한을 4,000개로 제한
- 연속 배치·삭제 시 직전 브러시와 겹치는 내부 영역을 다시 순회하지 않고 새 껍질만 처리
- 크기 32 큐브를 한 칸 이동할 때 작업량을 약 32³에서 새로 들어오는 단면 수준으로 감소
- 큰 브러시 외곽선은 배치와 삭제 색상을 구분해 실제 범위 유지

## 0.130.0

- 큰 구조물 파일을 블록마다 일반 편집 경로로 삽입하지 않는 전용 일괄 로더 추가
- 블록 종류·청크 개수·열 높이 캐시를 한 번의 순회로 구축
- 초기 로딩 중 블록마다 dirty 청크와 실행 취소 기록을 생성하던 중복 작업 제거
- 12ms 작업 단위마다 다음 프레임에 제어를 넘겨 로딩 중 UI 멈춤 완화
- 5,000개 이상 구조물에서 블록 처리와 가까운 청크 생성 진행률 표시
- 전체 팔레트 아이콘을 프레임당 120개씩 점진 생성해 초기 DOM·이미지 디코딩 부하 분산
- 데이터 로딩 중 리소스팩이 도착해도 중간 전체 메쉬 재생성을 실행하지 않도록 지연
- 가까운 청크부터 화면에 표시하고 나머지는 기존 청크 스트리밍으로 순차 생성

## 0.129.0

- 큰 구조물의 연속 조형 중 화면 좌표 샘플링을 이벤트당 최대 16회로 제한
- 한 포인터 이벤트에서 실행하는 무거운 조형 연산을 균등 간격 최대 3회로 병합
- 조형 중 변경 미리보기 표본을 1,500개로 제한하고 갱신 간격을 120ms로 완화
- 조형 미리보기 누적 셀 상한을 6,000개로 제한해 장시간 드래그 메모리 사용 감소
- 변경된 청크를 점진 재생성하는 동안 대형 선택 영역 UI를 매 프레임 다시 만들지 않도록 지연
- 모든 청크 재생성이 끝난 뒤 선택 표시·통계·호버를 한 번만 최종 갱신

## 0.128.5

- 구·빈 구·원·원판 도구에서 사용되지 않는 높이 옵션 숨김
- 속이 빈 원기둥 옵션을 원기둥 도구에서만 표시
- 산 도구는 반지름과 높이 옵션을 계속 표시
- 옵션이 하나뿐일 때 반지름 입력칸이 남은 가로폭 전체 사용

## 0.128.4

- 스테인드글라스를 불투명 단색으로 렌더링하던 재질 분류 오류 수정
- 16색 스테인드글라스와 유리판의 텍스처 알파 및 반투명도 적용
- 강화 스테인드글라스·강화 유리판을 대응하는 일반 색상 텍스처에 연결
- 일반 유리와 틴티드 글라스도 동일한 투명 재질 경로로 통합
- 투명 유리의 깊이 쓰기와 거칠기를 조정해 겹친 면의 시인성 개선

## 0.128.3

- 블록 팔레트의 상위 240개 표시 제한 제거
- 선택한 분류와 검색에 일치하는 모든 블록 표시
- 결과 안내에서 상위 항목 제한 문구 제거

## 0.128.2

- 블록 검색창의 고정된 `1342개` 안내 제거
- 선택한 팔레트 분류의 실제 블록 수를 검색창 placeholder에 실시간 표시
- 분류 전환 시 `자연 000개 블록 검색…` 형식으로 이름과 개수 동시 갱신

## 0.128.1

- 블록 팔레트에 목록·아이콘 전용 보기 전환 버튼 추가
- 아이콘 보기에서 블록 이름을 숨기고 한 줄에 6개씩 표시
- 아이콘 크기를 키우고 마우스 툴팁으로 블록 ID 확인 가능
- 현재 보기 상태를 전환 버튼 아이콘과 강조로 표시

## 0.128.0

- 블록 팔레트에 베드락 크리에이티브 인벤토리형 분류 탭 추가
- 전체·건축·자연·기능·레드스톤·색상 분류 제공
- 블록 특성에 따라 여러 관련 분류에서 동시에 검색 가능
- 선택한 분류 안에서 기존 이름 검색과 결과 개수 표시 연동
- 좁은 팔레트에서도 사용할 수 있도록 3열 소형 탭 UI 적용

## 0.127.1

- 회색 원본 텍스처를 사용하는 잔디 윗면에 대표 바이옴 초록색 적용
- 참나무·정글·아카시아·짙은 참나무·맹그로브 잎에 foliage 색상 적용
- 자작나무와 가문비나무 잎은 게임의 고유 고정 색상으로 구분
- 짧은 풀·큰 풀·고사리·덩굴·수련·사탕수수 계열의 누락된 식생 틴트 보정
- 벚나무·철쭉·창백한 참나무 잎처럼 원본에 색이 있는 텍스처는 중복 틴트에서 제외
- 잎과 식물 텍스처의 투명 픽셀을 alpha test로 처리하고 팔레트 아이콘에도 같은 틴트 적용
- 잔디 옆면은 흙까지 초록색이 되지 않도록 색이 포함된 carried 텍스처 사용

## 0.127.0

- 이동·붙여넣기·특수 배치 변형 기즈모에 X/Y/Z 축별 늘이기 핸들 추가
- 기존 노란 핸들은 전체 비율 확대·축소로 유지하고 축 끝 사각형은 한 축만 0.1~8배 변형
- 축별 늘이기를 회전, 미리보기, 대형 외곽선, 실제 블록 배치에 동일하게 적용
- 늘이기로 확대된 블록 사이가 비지 않도록 역방향 샘플링으로 내부 블록 채움
- 새 복사본이나 새 변형 작업 진입 시 이전 축별 늘이기 값 초기화

## 0.126.3

- 새 창 분리 전에 BedrockPy 3D 패널을 명시적으로 활성화해 다른 파일이 이동하는 문제 수정
- 새 창 이동이 완료된 응답을 받은 뒤에만 분리 버튼 숨김
- 이동 실패 시 버튼을 다시 사용할 수 있도록 복구

## 0.126.2

- BedrockPy 3D를 새 창으로 분리한 뒤 `↗` 분리 버튼 자동 숨김

## 0.126.1

- 3D 편집기 상단 버튼을 영역 최대화 대신 독립 VS Code 창 분리 기능으로 변경
- `↗` 버튼을 누르면 현재 BedrockPy 3D 탭이 새로운 보조 창으로 이동

## 0.126.0

- 3D 편집기 상단에 전체 영역 확대 버튼 추가
- 버튼을 다시 누르면 기존 VS Code 분할 편집기 배치로 복원
- 확대 상태를 버튼 강조와 툴팁으로 표시

## 0.125.5

- Play 좌표 UI에서 `소수`·`정수` 모드 글씨 제거
- 좌표 클릭 전환 기능과 소수 둘째 자리 고정 표시는 그대로 유지

## 0.125.4

- Play 모드 우측 상단 좌표를 클릭해 정수·소수점 모드 전환 가능
- 정수 모드는 현재 위치를 블록 좌표 기준으로 내림하여 표시
- 소수점 모드는 `.00`을 생략하지 않고 항상 소수 둘째 자리까지 표시

## 0.125.3

- Play 모드의 UI 숨김 규칙에서 우측 상단 현재 위치 좌표를 제외해 항상 표시
- Play HUD보다 위에 좌표가 안정적으로 표시되도록 레이어 순서 조정

## 0.125.2

- Play 모드에서 화면 중앙으로 바라보는 블록의 단일 외곽선 표시 복원
- Play 모드 좌표 표시를 대상 블록 대신 플레이어의 실시간 현재 위치로 변경
- Play 중 선택 갱신이 발생해도 박스·브러시 선택 외곽선과 채움이 나타나지 않도록 차단

## 0.125.1

- Play 모드 진입 시 블록 호버 및 배치 미리보기 외곽선 완전히 숨김
- Play 중 마우스 이동으로 외곽선이 다시 생성되지 않도록 차단
- 변형 기즈모도 Play 동안 숨기고 편집 모드 복귀 시 현재 도구 기준으로 복원

## 0.125.0

- 조형 모드에 `객체 연결` 추가
- X/Y/Z축에서 한 칸 떨어진 블록 사이의 빈칸을 감지해 자동 연결
- 주변 블록 밀도가 높은 균열과 오목한 경계를 다수 재질 블록으로 메움
- 객체 다듬기보다 돌출 블록 삭제를 약하게 적용해 형태를 유지하며 결합
- 브러시 조형과 선택 영역 조형에서 강도별 반복 연결 지원

## 0.124.1

- 텍스트·이미지·3D 모델 배치 완료 후 같은 특수 도구에 머무르면 회전·배율 유지
- 다른 도구로 나갔다가 특수 도구에 다시 진입할 때만 변형값 초기화

## 0.124.0

- 텍스트 특수 기능에 새로 진입할 때 이전 배치의 회전·배율값 초기화
- 텍스트 배치를 확정한 뒤 다음 텍스트를 위해 X/Y/Z 회전과 배율을 기본값으로 복원
- 이미지·3D 모델 특수 기능에도 같은 독립 배치 초기화 적용
- 일반 붙여넣기의 회전·배율 유지 동작은 기존대로 보존

## 0.123.0

- 조형 모드에 중력·높이맵을 사용하지 않는 `객체 다듬기` 추가
- 3차원 26방향 이웃 밀도를 기준으로 돌출 블록을 줄이고 작은 홈을 주변 블록으로 메움
- 주변에서 가장 많이 사용된 블록 종류로 홈을 채워 혼합 블록 객체의 재질 보존
- 브러시 조형과 선택 영역 조형 양쪽에서 객체 다듬기 및 강도 반복 적용 지원
- 큰 선택 영역은 전체 빈 공간 대신 설치 블록 주변만 후보로 계산해 메모리 사용 제한

## 0.122.0

- macOS VS Code WebView에서 WebGL 위 Play 및 오버레이 UI가 간헐적으로 깜빡이는 문제 수정
- 매 프레임 렌더되는 캔버스를 다시 샘플링하던 오버레이 `backdrop-filter` 제거
- 3D 캔버스와 HTML UI를 별도 합성 영역으로 분리하고 오버레이 배경 불투명도 보강

## 0.121.0

- `블록에만 설치` 사용 시 바라보는 블록의 바깥 공기가 아닌 블록 칸 자체를 대상으로 변경
- 단일 클릭, 연속 배치, 커서 미리보기에서 동일한 대상 판정 사용
- 도형·텍스트·이미지·3D 모델도 해당 옵션 사용 시 바라보는 블록을 기준 위치로 사용

## 0.120.1

- VS Code 하단 상태 표시줄의 `BedrockPy 3D` 버튼 제거
- 편집기 제목 영역의 BedrockPy 컴파일 버튼을 텍스트 대신 빌드 아이콘으로 변경
- 편집기 제목 영역의 3D 구조물 편집기 빠른 실행 아이콘은 유지

## 0.120.0

- VS Code 하단 상태 표시줄에 `BedrockPy 3D` 빠른 실행 버튼 추가
- `.bpy`, `.bpstructure`, `.mcstructure` 편집기 제목 영역에 3D 구조물 편집기 아이콘 추가
- 버튼 또는 아이콘 클릭 한 번으로 명령 팔레트 없이 3D 편집기 실행

## 0.119.0

- 배치 옵션에 `블록에만 설치` 추가
- 이미 블록이 존재하는 칸만 현재 선택 블록으로 교체하고 공기에는 설치하지 않도록 지원
- `공기에만 설치`와 `블록에만 설치` 옵션을 상호 배타적으로 처리
- 일반 배치뿐 아니라 도형·텍스트·이미지·3D 모델 생성에도 동일한 배치 조건 적용

## 0.118.1

- 브러시 선택에서는 효과가 없는 `선택 안에서만` 옵션을 숨김
- 해당 옵션은 실제로 범위를 제한하는 배치·삭제·조형·도형 생성 도구에서만 표시

## 0.118.0

- 브러시 선택에 `연결된 모든 블록 선택` 옵션 추가
- 시작 블록에서 6방향 면으로 연결된 모든 비공기 블록을 종류와 관계없이 선택
- 기존 `연결된 같은 블록 선택`과 새 옵션이 동시에 켜지지 않도록 상호 배타 처리
- 연결된 모든 블록 선택에서도 Shift를 이용한 기존 선택 영역 확장 지원

## 0.117.0

- 선택 이동 도구 진입 및 배치 완료 시 이전 배율과 X/Y/Z 회전값 초기화
- 큰 붙여넣기·선택 이동·특수 기능 미리보기에 단순화 표면과 전체 경계 상자를 동시에 표시
- 1,000칸을 넘는 박스·브러시 선택 영역에도 실제 설치 블록 기반 저해상도 외부 표면 표시
- 선택 표면과 변형 미리보기 표면 캐시를 분리해 서로 교체될 때 발생하던 재계산 방지
- 큰 직육면체 선택의 모든 빈 칸을 배열로 만들지 않고 설치된 블록만 표면 계산에 사용

## 0.116.0

- 큰 일반 붙여넣기·특수 기능·선택 이동 미리보기에 실제 구조 형태의 저해상도 외부 표면 표시
- 구조물 크기에 따라 최대 약 32칸 해상도로 자동 단순화하고 내부 면 제거
- 표면 데이터 생성을 6ms 단위 작업으로 나눠 편집 화면 멈춤 방지
- 캐시된 표면 메쉬를 위치 이동 시 재사용해 전체 블록 재계산 제거
- 회전·배율·축 이동 핸들을 드래그하는 동안에는 가벼운 경계 상자로 전환하고 조작 종료 후 표면 복원

## 0.115.0

- 1,000블록을 넘는 붙여넣기 미리보기에서 전체 블록 좌표 변환 제거
- 큰 텍스트·이미지·3D 모델 특수 구조물에도 동일한 외곽선 전용 계산 적용
- 원본 경계를 한 번만 캐시하고 이동·회전·배율 조작 중에는 8개 모서리만 변환
- 실제 전체 블록 변환은 우클릭으로 배치를 확정할 때만 수행

## 0.114.0

- 렌더 거리 안의 모든 청크 메쉬를 한 프레임에 생성하던 방식을 점진적 로딩 큐로 변경
- 카메라에서 가까운 청크부터 프레임당 한 개씩 생성해 파일 로드·대규모 편집 직후 멈춤 감소
- 렌더 거리 밖으로 나간 대기 청크를 큐에서 자동 제거
- 상태 표시줄의 로드된 청크 수가 점진적으로 증가하도록 반영

## 0.113.0

- 프로젝트 창 경계에 사이드바 접기·펼치기 버튼 추가
- 프로젝트 창을 접으면 해당 너비까지 3D 화면이 즉시 확장되도록 레이아웃 변경
- 프로젝트 창 표시 상태를 저장해 편집기를 다시 열어도 유지

## 0.112.1

- A/B 지점 아래 구분선 문구를 `특수 기능`에서 `특수`로 간결하게 변경

## 0.112.0

- 텍스트·이미지·3D 모델 특수 기능 버튼을 하나의 청록색 디자인으로 통일
- A/B 지점 도구와 특수 기능 사이에 구분선 추가
- 특수 기능 결과를 즉시 설치하지 않고 붙여넣기 방식의 임시 구조물로 배치
- 텍스트·이미지·3D 모델에 이동, X/Y/Z 자유 회전, 0.1~8배 크기 조절 기즈모 지원
- 좌클릭으로 위치 고정 후 화살표·회전 링·배율 핸들을 조작하고 우클릭으로 확정

## 0.111.0

- PNG, JPG, WebP 이미지를 16색 콘크리트 팔레트의 블록 벽화로 변환하는 `이미지 블록` 도구 추가
- 이미지 비율 유지, 투명 픽셀 제외, 가로 블록 수와 두께 설정 및 배치 미리보기 지원
- OBJ 및 ASCII/바이너리 STL 파일을 불러오는 `3D 모델` 도구 추가
- 모델 최대 크기 정규화, 삼각형 표면 복셀화, 선택적 내부 채우기 및 배치 미리보기 지원
- 가져오기 결과를 최대 250,000블록으로 제한해 과도한 파일로 인한 편집기 정지 방지

## 0.110.0

- A/B 지점 버튼 아래에 별도 색상의 `텍스트 블록` 특수 도구 추가
- 입력한 텍스트를 시스템 글꼴로 렌더링한 뒤 픽셀을 블록 격자로 변환
- 영문·숫자·기호 및 시스템 글꼴에서 지원하는 한글 텍스트 배치 지원
- 텍스트 글자 크기 5~64블록, 두께 1~16블록 설정 추가
- 클릭 전 블록 텍스트 전체 미리보기 표시
- 현재 블록 팔레트에서 선택한 블록으로 텍스트 생성

## 0.109.1

- 3D 편집기의 기본 카메라 거리를 최소값 5로 변경
- 새 편집기 시작, 구조물 불러오기, 작업공간 크기 변경 시 가장 확대된 시야 적용

## 0.109.0

- 모든 X·Z 기둥의 최고 블록 Y를 증분 캐시하는 높이맵 추가
- 조형의 `columnTop()` 조회를 작업공간 전체 Y 스캔에서 O(1) 캐시 조회로 변경
- 최고 블록 추가·삭제 시 해당 기둥 높이 캐시 자동 갱신
- 큰 브러시 연속 조형에서 겹치는 중심점을 브러시 크기 기반 간격으로 통합
- 조형 미리보기 지오메트리 갱신을 최대 약 14FPS로 제한
- 내리기 조형이 빈 작업공간 높이 전체가 아닌 실제 기둥 최고점까지만 순회

## 0.108.0

- Undo 기록을 구조물 전체 JSON 스냅샷에서 변경 좌표만 저장하는 차등 방식으로 교체
- 블록 하나 설치·삭제 시 전체 구조물 크기와 무관하게 해당 좌표 한 개만 기록
- 연속 브러시는 드래그 시작부터 종료까지를 하나의 차등 Undo 묶음으로 저장
- 같은 작업에서 한 좌표가 여러 번 변경되어도 최초 값과 최종 값만 기록
- 선택 채우기·비우기·삭제도 변경된 좌표만 Undo 기록에 포함
- Undo·Redo 적용 시 변경된 렌더 청크만 다시 생성

## 0.107.0

- 선택 채우기·선택 비우기·선택 삭제에 작업 진행 화면 추가
- 처리 블록 수, 전체 블록 수, 퍼센트, 경과 시간, 예상 남은 시간 표시
- 대량 선택영역을 작은 배치로 처리해 작업 중에도 진행 화면과 VS Code UI 갱신
- 작업 완료 후 변경된 렌더 청크를 한 번만 재생성해 반복 렌더링 비용 제거
- 대형 직육면체 선택을 전체 셀 배열로 미리 복사하지 않고 좌표를 순차 처리

## 0.106.0

- 각 작업 영역의 대기 시간을 `sleep(1)`에서 `sleep(20)`으로 변경
- 구조물 설치 시작 시 기준점 엔더 크리스탈 청크에 앵커 전용 ticking area 추가
- 앵커용 영역 하나와 현재 작업 영역 하나, 최대 2개의 ticking area를 동시에 사용
- 먼 작업 영역을 처리하는 동안 기준점 엔티티가 언로드되어 위치 문맥을 잃는 문제 방지
- 모든 영역 설치 후 앵커 엔티티를 제거하고 앵커용 ticking area도 자동 제거

## 0.105.4

- 자동 구조물의 ticking area 및 명령 분할 크기를 32×32에서 128×128블록으로 변경
- 영역별 고유 이름, 동시 최대 1개, `sleep(1)` 대기 방식은 그대로 유지
- 128×128 영역에서도 `/fill` 최대 부피를 넘지 않도록 Y축 분할 유지

## 0.105.3

- 자동 구조물 설치에서 `await_tickingarea` 사용 제거
- 영역별 고유 ticking area 이름은 유지
- 자동 설치 순서를 다시 `영역 등록 → sleep(1) → 설치 → 제거`로 단순화
- `await_tickingarea()` 문법 자체는 직접 작성할 수 있도록 컴파일러에 유지

## 0.105.2

- 모든 32×32 영역이 같은 ticking area 이름 `_0`을 재사용하던 문제 수정
- 각 영역에 `_0000`, `_0001`, `_0002`처럼 설치 작업 내 고유 이름 할당
- 이전 영역의 `on_area_loaded` 예약과 다음 영역 재등록이 충돌해 격자무늬로 누락되던 현상 해결
- ticking area는 고유 이름을 사용하더라도 기존처럼 동시에 하나만 유지

## 0.105.1

- ticking area 로딩 이벤트를 `sleep(1)`보다 먼저 등록하도록 실행 순서 수정
- 영역이 sleep 도중 먼저 로드되어 `on_area_loaded` 이벤트를 놓치던 문제 해결
- 구조물 설치 순서를 `영역 등록 → 로딩 완료 대기 → sleep(1) → 설치`로 변경
- 함수 재실행 시 이전 continuation이 뒤늦게 이어지는 것처럼 보이던 원인 제거

## 0.105.0

- ticking area가 실제 로드된 뒤 continuation을 실행하는 `await_tickingarea("이름")` 문법 추가
- `.bpy` 구조물 설치를 `tickingarea 등록 → sleep(1) → 로딩 완료 대기 → 설치` 순서로 변경
- `schedule on_area_loaded add tickingarea` 명령을 내부 continuation 함수와 자동 연결
- 32×32 영역 안에서도 `/fill` 부피가 32,768블록을 넘지 않도록 Y축 자동 분할
- sleep과 로딩 완료 대기가 중첩된 continuation도 `max_lines`에 맞춰 자동 분할

## 0.104.3

- `.bpy` 구조물의 ticking area 및 명령 분할 크기를 64×64에서 32×32블록으로 변경
- 각 32×32 영역을 하나씩 등록하고 최소 1틱 대기한 뒤 설치·제거

## 0.104.2

- `.bpy` 구조물의 ticking area 및 명령 분할 크기를 128×128에서 64×64블록으로 변경
- 각 64×64 영역을 하나씩 등록하고 최소 1틱 대기한 뒤 설치·제거

## 0.104.1

- 코드 생성 패널의 함수 이름 입력칸 유지
- 각 `.bpstructure` 파일에 `functionName`을 함께 저장하고 다시 열 때 복원
- 프로젝트에서 구조물을 전환하면 해당 구조물에 지정한 함수 이름으로 자동 변경
- 함수 이름이 없는 기존 파일은 구조물 파일명을 안전한 함수 이름으로 자동 변환
- 함수 이름 수정도 프로젝트의 저장되지 않은 변경사항으로 표시

## 0.104.0

- `.bpy` 구조물 함수 실행 위치를 sleep 전에 임시 엔더 크리스탈 앵커로 저장
- 앵커를 원래 위치보다 1000블록 위에 생성해 구조물 작업 중 보이지 않도록 처리
- sleep 이후 ticking area 추가와 모든 setblock·fill을 앵커 기준 원래 위치에서 실행
- 여러 영역을 순차 처리하는 동안 최초 함수 호출 위치 유지
- 마지막 영역 설치와 ticking area 제거가 끝나면 임시 앵커 자동 제거

## 0.103.0

- 카메라 렌더 거리 안의 16×16×16 청크 메시만 GPU·메모리에 유지하는 스트리밍 렌더링 추가
- 렌더 거리 밖으로 나간 청크의 지오메트리와 재질을 즉시 dispose
- 카메라가 청크 경계를 넘거나 렌더 거리 설정이 바뀔 때 필요한 청크만 생성
- 청크별 블록 개수 인덱스를 증분 관리해 상주 청크 계산 시 전체 블록 순회 제거
- 편집된 청크가 렌더 거리 밖에 있으면 메시 생성을 미루고 가까워졌을 때 최신 상태로 생성
- 상태 표시에 현재 상주 청크 수와 전체 데이터 청크 수 추가

## 0.102.0

- `sleep()` 이후 continuation 내부 함수에도 `max_lines` 자동 분할 적용
- 제한을 넘는 내부 함수를 여러 part 파일로 나누고 작은 래퍼 함수에서 순서대로 호출
- part 호출 수가 다시 제한을 넘는 극대형 함수는 다단계 호출 래퍼로 재귀 분할
- 자동 ticking area 설치에서 한 영역의 명령이 10,000줄을 넘어도 컴파일 가능
- 실제 `max_lines = 3` 환경에서 sleep 이후 5개 명령이 분할되는 회귀 테스트 추가

## 0.101.1

- `.bpy` 구조물 설치 중 동시에 유지하는 ticking area를 최대 1개로 제한
- 큰 구조물은 영역 하나를 등록하고 1틱 대기한 뒤 설치·제거하는 과정을 순차 반복

## 0.101.0

- `.bpy` 구조물 함수에 필요한 범위의 `/tickingarea add` 명령 자동 생성
- ticking area 등록 직후 `sleep(1)`을 넣어 최소 1게임틱이 지난 뒤 블록 설치
- 구조물 명령 실행 완료 후 생성한 ticking area 자동 제거
- 큰 구조물은 128×128블록 영역으로 나누고 베드락 제한에 맞춰 최대 10개씩 순차 처리
- 영역 경계를 가로지르는 fill 명령을 자동 분할해 각 명령이 로드된 영역 안에서만 실행

## 0.100.0

- `.bpy로 내보내기`와 `현재 .bpy에 삽입` 작업에 전체 화면 진행도 표시 추가
- 블록 분석·압축·명령 생성·파일 쓰기·편집기 삽입 단계를 퍼센트와 함께 표시
- 대형 구조물 변환 중 일정 간격으로 UI를 갱신해 멈춘 화면처럼 보이는 문제 완화
- 명령 압축 과정에서 남은 블록을 매번 재정렬하던 로직을 한 번만 정렬하도록 최적화
- 파일 선택 취소·삽입 대상 없음·쓰기 오류·완료 시 진행 화면 자동 종료

## 0.99.1

- Play 모드에서는 선택영역 외곽선·채움·브러시 선택 표시 숨김
- Esc로 Play 모드를 종료하면 이전 선택영역 표시 상태 복원
- 선택영역 데이터는 Play 도중에도 그대로 유지

## 0.99.0

- 모든 편집 도구에서 상호작용 대상이 없는 빈 공간을 좌클릭 드래그하면 시점 회전
- 선택·브러시·도형·붙여넣기·선택 이동 중에도 하늘에서 카메라 조작 가능
- 빈 공간 드래그를 마치면 사용 중이던 도구와 커서 상태로 자동 복귀

## 0.98.0

- 블록 렌더링 메시를 16×16×16 청크 단위로 분할
- 블록 추가·삭제·교체 시 수정된 청크만 그리디 메시 재생성
- 청크 경계 블록 변경 시 맞닿은 이웃 청크만 함께 갱신
- 변경되지 않은 청크의 지오메트리·재질·텍스처 메시 재사용
- 블록 저장 맵에서 변경 좌표를 자동 추적해 모든 편집 기능에 청크 갱신 적용
- 작업공간 크기·텍스처 모드 변경처럼 필요한 경우에만 전체 청크 재생성
- 블록 종류 개수를 전체 순회하지 않고 증분 카운터로 관리
- Play 버튼을 누르면 자동으로 이동 도구로 전환
- 배치 옵션에 `공기에만 설치` 추가
- 일반 배치와 배치 도형에서 기존 블록을 덮어쓰지 않고 빈 칸에만 설치 가능

## 0.97.0

- 브러시 조형과 선택 영역 조형에 `자연 평탄화` 모드 추가
- 높은 기둥의 최상단 블록이 낮은 상하좌우 이웃으로 이동하는 열적 침식 구현
- 높이 차이가 두 칸 이상인 경사만 조금씩 무너지도록 처리
- 강도가 높을수록 침식 반복 횟수가 증가하며 안정된 경사에 도달하면 조기 종료
- 이동하는 블록의 원래 종류를 유지해 흙·돌 등 지형 재질 보존
- 선택 영역 자연 평탄화는 선택된 높이 범위 밖으로 블록이 나가지 않도록 제한

## 0.96.1

- 1,000칸을 넘는 보라색 선택 영역의 개별 블록 표본 렌더링 완전 제거
- 1,000블록을 넘는 노란색 붙여넣기·선택 이동 내부 표본 렌더링 완전 제거
- 대형 영역에서는 전체 크기와 위치를 나타내는 외곽선만 표시
- 대형 영역용 인스턴스 메시와 재질 생성을 건너뛰어 렌더링 비용 최소화

## 0.96.0

- 대형 브러시 선택에 전체 외곽선과 카메라에 가까운 실제 선택 블록 표본 표시
- 보라색 선택 표본을 중형 최대 160개, 대형 최대 80개로 제한
- 대형 붙여넣기·선택 이동 외곽선 내부에 가까운 노란 표본을 최대 80개 표시
- 선택 이동은 전체 블록 변환 없이 변형 외곽 표면 후보만 계산해 기존 성능 유지
- 시각화 생성 시 현재 카메라에 가까운 보라색·노란색 표본 우선 표시

## 0.95.1

- 대형 선택 이동에서 커서 이동마다 모든 선택 블록을 변환하던 병목 제거
- 1,000칸 초과 선택은 8개 모서리 수학 계산만으로 변형 외곽선 생성
- 실제 전체 블록 이동·회전·확대 계산은 우클릭 적용 시 한 번만 수행
- 선택 범위를 캐시해 브러시 선택의 전체 좌표 재탐색 반복 방지
- 대형 선택 이동 미리보기 비용을 선택 블록 수와 거의 무관하게 개선

## 0.95.0

- 붙여넣기·선택 이동 미리보기가 1,000블록을 넘으면 내부 노란 블록 렌더링 생략
- 대형 미리보기는 전체 크기와 위치를 나타내는 밝은 외곽 상자만 표시
- 외곽선 전용 모드에서도 변형 기즈모와 우클릭 적용 기능은 동일하게 유지
- 불필요한 인스턴스 메시와 재질 생성을 건너뛰어 대형 복사·붙여넣기 비용 절감

## 0.94.2

- 선택 영역과 붙여넣기 미리보기의 자동 표본 렌더링 한도를 추가 축소
- 1,000칸 초과 시 최대 600개, 10,000칸 초과 시 최대 200개만 렌더링
- 중대형 영역의 불투명도와 색 중첩을 한 단계 더 낮춤
- 가까운 블록 우선 표시와 전체 범위 외곽선은 유지

## 0.94.1

- 대형 붙여넣기·선택 이동 미리보기 표본을 카메라에 가까운 블록부터 선택
- 전체 정렬 대신 제한 크기 최대 힙을 사용해 대형 구조물의 표본 계산 비용 절감
- 카메라가 일정 거리 이동하면 가까운 미리보기 표본을 자동 갱신
- 전체 구조물 크기를 나타내는 외곽 상자는 기존대로 유지

## 0.94.0

- 붙여넣기·선택 이동 미리보기 블록 수에 따라 자동 표본 렌더링
- 2,000블록 초과 시 최대 1,500개, 20,000블록 초과 시 최대 500개만 표시
- 대형 미리보기의 전체 크기와 위치는 밝은 외곽 상자로 유지
- 미리보기 개수에 따라 노란 영역의 불투명도와 깊이 검사를 자동 조절
- 점멸 효과가 대형 미리보기를 다시 진하게 만들지 않도록 기본 투명도 기준으로 조정
- 변형 기즈모 중심은 표본이 아닌 전체 붙여넣기 범위를 기준으로 계산

## 0.93.0

- 선택 셀 개수에 따라 시각화 불투명도를 자동 조절
- 2,000칸을 넘는 선택은 표본 셀만 렌더링해 GPU 인스턴스 수 제한
- 20,000칸을 넘는 대형 선택은 최대 400개 표본만 표시
- 대형 선택에서는 전체 선택 범위를 밝은 외곽 상자로 표시
- 선택 선이 겹쳐 지나치게 진해지는 현상을 깊이 검사와 투명도 조절로 완화

## 0.92.2

- 팔레트 검색 시 최근·기본 블록도 전체 블록 목록과 함께 검색
- `grass`처럼 편집기 기본 목록에만 있던 블록이 검색에서 누락되던 문제 수정
- 정확히 일치하는 이름, 해당 단어로 시작하는 이름, 포함하는 이름 순으로 검색 결과 정렬

## 0.92.1

- 긴 블록 팔레트를 오른쪽 도구 패널 목록의 가장 아래로 이동
- 선택 영역 설정과 변형 기능을 팔레트보다 먼저 확인할 수 있도록 순서 개선
- 최근 블록 바의 기존 화면 위치는 유지

## 0.92.0

- 선택 영역 도구에서도 배치 도구와 동일한 최근 블록 10개 표시
- 박스 선택, 브러시 선택, A/B 지정, 선택 이동 도구에서 블록 팔레트 표시
- 선택 채우기 전에 현재 블록을 바로 검색하고 변경할 수 있도록 개선

## 0.91.3

- 편집 모드 카메라의 기본 이동 속도를 8에서 64 blocks/s로 변경

## 0.91.2

- 선택 영역 외곽선을 더 밝은 보라색으로 조정
- 블록과 텍스처 뒤에서도 선택 외곽선이 가려지지 않도록 표시 우선순위 개선
- 직육면체 선택 영역에 약한 반투명 내부 색상 추가
- 브러시 선택 셀의 와이어프레임 크기와 불투명도 소폭 증가

## 0.91.1

- Play 설정 슬라이더 조작 후 WASD 이동이 먹지 않던 포커스 문제 수정
- Play 중에는 슬라이더에 포커스가 있어도 이동·달리기·점프 키 처리
- 슬라이더 조작 완료 후 포커스를 자동으로 3D 화면에 반환

## 0.91.0

- Play 화면 왼쪽 아래에 시야각과 마우스 감도 설정 패널 추가
- 시야각을 30°~110° 범위에서 실시간 조절
- 드래그 시야 감도를 10%~200% 범위에서 실시간 조절
- Play 종료 시 편집 카메라의 기존 시야각 자동 복원

## 0.90.1

- Play 시야 조작을 좌클릭 드래그 방식으로 변경
- VS Code 웹뷰에서 불안정한 포인터 잠금 요청 완전 제거
- 마우스를 놓으면 시야 회전을 멈추고 이동 키 입력은 계속 유지
- Play 화면에서 잡기·드래그 상태에 맞는 마우스 커서 표시

## 0.90.0

- Play 중 드래그 없이 마우스 이동만으로 시야를 회전하도록 변경
- 포인터 잠금 지원 환경에서는 마인크래프트처럼 커서를 고정해 무제한 시야 회전
- VS Code 웹뷰가 포인터 잠금을 거부해도 마우스 이동 기반 시야 조작 제공
- Play 중 마우스 커서를 숨겨 게임 화면처럼 표시
- 상하 시야 각도를 마인크래프트 방식으로 제한

## 0.89.1

- Play 버튼을 3D 화면 왼쪽 위로 이동
- Play 시작 위치를 현재 편집 카메라 위치로 변경
- Play 시작 방향도 현재 편집 카메라가 바라보는 방향으로 유지
- VS Code 웹뷰에서 포인터 잠금이 지원되지 않을 때 마우스 드래그 시점 조작 지원
- Play 버튼과 겹치지 않도록 환경·정보 아이콘 위치 조정

## 0.89.0

- 3D 화면 상단에 1인칭 테스트용 Play 버튼 추가
- 마우스 포인터 잠금으로 자유 시점 조작 지원
- WASD 이동, Shift 달리기, Space 점프와 중력 구현
- 플레이어 크기에 맞춘 블록 충돌과 바닥 판정 구현
- 구조물 중앙의 안전한 높이에서 자동 시작
- Esc 또는 포인터 잠금 해제로 편집 모드 복귀
- 플레이 중 편집 UI를 숨기고 전용 조준점과 조작 안내 표시

## 0.88.2

- 동·서쪽 두 옆면의 텍스처가 90도 돌아가던 UV 축 오류 수정
- X축 면에서 Z축을 텍스처 가로 방향, Y축을 세로 방향으로 매핑
- 북·남·위·아래 면의 기존 방향은 유지

## 0.88.1

- 마크 텍스처 모드에도 단색 모드와 동일한 입체 조명과 면 음영 적용
- 텍스처 블록이 광원 방향과 시간대 설정에 반응하도록 개선
- 텍스처 블록의 투영·수신 그림자 활성화
- 물의 파란 틴트와 반투명 표현은 유지하면서 표면 반사 질감 조정

## 0.88.0

- 블록의 위·아래·옆·방향별 텍스처를 각 정육면체 면에 올바르게 적용
- 잔디 블록의 윗면·옆면·아랫면 텍스처 분리
- 잔디 텍스처에 기본 오버월드 초록색 틴트 적용
- 물의 회색 원본 텍스처에 파란색 틴트와 반투명 효과 적용
- 팔레트 아이콘에서는 블록 윗면 텍스처를 대표 이미지로 사용

## 0.87.2

- VS Code 웹뷰 로컬 파일 URI 실패로 3D 블록과 아이콘이 검게 표시되던 문제 수정
- 블록 PNG를 안전한 data URI로 직접 전달하도록 리소스팩 로더 변경
- 동일한 PNG를 여러 블록이 공유할 때 인코딩 결과를 재사용하도록 캐시 적용

## 0.87.1

- 마크 텍스처가 조명 계산 때문에 검게 표시되는 문제 수정
- 텍스처 모드에서 PNG 원색을 그대로 출력하는 비조명 재질 적용
- 단색 모드의 입체 조명 재질은 기존대로 유지

## 0.87.0

- 블록 팔레트 아이콘을 현재 단색/마크 텍스처 렌더링 모드와 연동
- 마크 텍스처 모드에서 현재 리소스팩의 실제 PNG를 블록 아이콘으로 표시
- 최근 사용 블록 10개의 아이콘도 실제 텍스처와 함께 갱신
- 리소스팩이나 렌더링 모드를 변경하면 모든 블록 아이콘을 즉시 갱신
- 텍스처 아이콘에 픽셀 보존 렌더링 적용

## 0.86.2

- 3D 화면에서 마우스 휠 버튼을 누르면 가리키는 블록을 즉시 선택하는 스포이드 추가
- 휠 스포이드 사용 후에도 현재 편집 도구를 그대로 유지
- 휠 클릭 시 브라우저 자동 스크롤 동작 차단

## 0.86.1

- 실제 블록 텍스처가 거리에 따라 어두운 단색으로 뭉개지던 밉맵 문제 수정
- 16×16 원본 픽셀을 유지하는 Nearest 필터 적용
- 텍스처 블록에 밝고 선명한 Lambert 조명 재질 적용

## 0.86.0

- 프로젝트 트리에 저장되지 않은 구조물 파일을 주황색 점으로 표시
- 파일을 전환해도 파일별 미저장 변경사항을 메모리에 유지
- 파일 전환 시 발생하던 암묵적 자동 저장 제거
- 저장이 완료된 파일만 미저장 표시 제거
- 미저장 파일이나 폴더의 이름 변경·삭제 시 임시 변경 상태도 함께 추적

## 0.85.0

- 기존 단색과 실제 마인크래프트 블록 텍스처 렌더링 모드 추가
- 첫 실행 시 Mojang 공식 bedrock-samples Vanilla Resource Pack을 희소 다운로드해 기본 적용
- 기본 리소스팩 설치·갱신 버튼 추가
- 사용자 리소스팩 폴더와 .mcpack/.zip 파일 선택·적용 기능 추가
- 사용자 팩에 없는 텍스처는 기본 Vanilla 팩에서 자동 보완
- 마지막으로 선택한 기본/사용자 리소스팩을 다음 실행에도 유지
- terrain_texture.json과 blocks.json을 분석해 블록 ID를 실제 PNG 텍스처에 연결
- 주석과 후행 쉼표가 포함된 공식 JSONC 텍스처 정의 지원
- 직접 파일명이 일치하는 텍스처는 자동 폴백 매핑
- 그리디 메시 UV 반복을 지원해 큰 벽에서도 텍스처가 블록 단위로 반복
- 텍스처가 없는 블록은 기존 단색으로 자동 표시
- Nearest 필터로 마인크래프트 픽셀 질감 유지

## 0.84.0

- 붙여넣기·선택 이동 미리보기를 밝은 연두색으로 통일해 식별성 개선
- 미리보기 기본 불투명도를 높여 기존 블록과 쉽게 구분
- 기존 구조물과 겹치거나 뒤에 있어도 보이도록 미리보기 깊이 검사 비활성화
- 미리보기에 약한 점멸 효과를 적용해 실제 설치된 블록과 구분
- 배치·삭제·조형 브러시의 기존 미리보기 색상과 깊이 동작은 유지

## 0.83.0

- 연결된 블록만 교체가 실행되지 않던 탐색·변경 순서 문제 수정
- 연결 좌표를 먼저 모두 수집한 뒤 한 번에 대상 블록으로 교체
- 탐색 중 원본 블록 종류가 변경되어 연결 검사가 끊기는 상황 제거
- 선택 영역이 있으면 시작점과 연결 탐색을 선택 영역 내부로 제한
- 선택 영역이 없으면 전체 작업공간에서 6방향으로 연결된 같은 블록 교체
- 전체 연결 교체를 한 번의 Undo 작업으로 기록

## 0.82.0

- 박스 선택에서 Shift를 누른 채 새 영역을 그려 기존 선택에 누적
- 브러시 선택에서 기존 박스 선택도 Shift로 보존하고 계속 확장
- 박스와 브러시 선택을 번갈아 사용해도 Shift 누적 선택 유지
- 브러시 선택에 연결된 같은 블록 선택 옵션 추가
- 연결 선택은 상하좌우앞뒤 면으로 이어진 같은 종류 블록을 한 번에 선택
- 연결 선택에서도 Shift를 누르면 기존 선택에 결과 추가

## 0.81.0

- 환경·시점 설정에 렌더링 거리 슬라이더 추가
- 카메라에서 설정 거리보다 먼 블록을 원거리 클리핑으로 렌더링하지 않음
- 16~1024블록 범위를 16블록 단위로 조절
- 기본 렌더링 거리를 256블록으로 설정
- 거리 어두워짐과 렌더링 거리 옵션을 서로 독립적으로 적용

## 0.80.0

- 붙여넣기 도구의 우클릭을 기즈모 없는 빠른 설치 모드로 분리
- 우클릭으로 반복 설치할 때 이동 화살표·회전 링·크기 핸들을 표시하지 않음
- 빠른 설치 후에도 커서 추적 미리보기와 시점 조작 유지
- 좌클릭으로 위치를 고정한 경우에만 3D 변형 기즈모 표시
- 미리보기 캐시에 기즈모 표시 상태를 포함해 좌클릭 직후 즉시 표시

## 0.79.0

- 대형 구조물 렌더러에 그리디 메시 최적화 적용
- 같은 블록으로 이어진 벽·바닥·천장의 개별 면을 하나의 큰 사각형으로 병합
- 넓은 직육면체 구조물의 삼각형 수와 GPU 처리량 대폭 감소
- 병합된 큰 면에서도 충돌 지점과 면 방향으로 정확한 블록 좌표 계산
- 스포이드·배치·삭제·선택 도구의 블록 클릭 판정을 그리디 메시와 호환
- 통계의 보이는 면 수를 병합 후 실제 렌더링 면 수로 표시

## 0.78.0

- 붙여넣기·선택 이동 위치 고정 중 기즈모 밖 드래그를 명시적인 카메라 회전 모드로 처리
- 블록 위에서 시점을 드래그해도 배치 위치가 다시 지정되지 않도록 수정
- 기즈모 밖 단순 클릭으로 붙여넣기가 실행되지 않도록 카메라 조작과 배치 처리 분리
- 시점 회전 중 grabbing 커서를 표시하고 종료 후 grab 커서로 복구
- 화살표·회전 링·크기 핸들은 기존처럼 구조물 변형에만 사용

## 0.77.0

- 블록 팔레트에 스포이드 버튼 추가
- 화면 위 최근 사용 블록 10개 영역에 스포이드 바로가기 추가
- 스포이드로 3D 화면의 설치된 블록을 클릭해 현재 블록 종류 선택
- 선택한 블록을 최근 사용 목록 맨 앞으로 자동 등록
- 블록을 추출한 뒤 스포이드 사용 전 도구로 자동 복귀

## 0.76.0

- 다른 선택 영역을 새로 복사할 때 이전 클립보드의 회전각이 유지되던 문제 수정
- 새 복사·잘라내기 시 배율을 1×로 초기화
- 새 복사·잘라내기 시 X/Y/Z 회전을 모두 0°로 초기화
- 변형 중 새 복사를 실행하면 기존 미확정 붙여넣기를 취소
- 같은 클립보드를 반복 붙여넣을 때는 기존처럼 마지막 변형값 유지

## 0.75.0

- 이동 화살표·회전 링·크기 핸들에 마우스 호버 강조 표시 추가
- 누르기 전에 선택될 축과 변형 종류를 밝은 색으로 미리 확인 가능
- 선택 가능한 핸들 위에서는 포인터 커서 표시
- 드래그 중에는 잡은 축 또는 핸들을 더 밝게 강조하고 grabbing 커서 유지
- 핸들 밖으로 이동하면 원래 축 색상과 카메라 이동 커서로 복구

## 0.74.0

- X/Y/Z 이동 화살표의 축 두께를 확대해 선택 편의 개선
- 화살촉 크기와 전체 축 길이 확대
- X/Y/Z 회전 링의 반지름과 두께 확대
- 노란 확대·축소 핸들 크기 확대
- 보이는 메시 자체가 커져 레이캐스트 클릭 판정 영역도 함께 확장

## 0.73.0

- 이동 화살표로 위치를 조정한 뒤 우클릭하면 커서 위치에 붙여넣어지던 문제 수정
- 잠긴 배치가 있으면 우클릭 좌표를 다시 계산하지 않고 현재 기즈모 원점으로 확정
- 붙여넣기와 선택 이동 모두 화살표로 조정한 최종 위치 보존
- 아직 위치를 고정하지 않은 경우에만 우클릭한 블록 위치를 초기 배치점으로 사용

## 0.72.0

- Cmd+A 사용 시 상단 BedrockPy 헤더와 저장·열기 버튼 글씨가 선택되던 문제 수정
- 편집기 문서 전체의 일반 UI 텍스트를 브라우저 선택 대상에서 제외
- 입력창·텍스트 영역·편집 가능한 요소는 텍스트 선택 기능 유지
- Cmd/Ctrl+A를 캡처 단계에서 처리해 브라우저 기본 전체 선택보다 먼저 차단
- 기존에 생성된 웹뷰 텍스트 선택 범위도 전체 블록 선택 시 즉시 해제

## 0.71.0

- 이동·회전·확대축소 3D 기즈모 크기를 카메라 거리 변화에 맞춰 실시간 갱신
- 기즈모를 표시한 뒤 멀리 이동하면 화살표가 지나치게 작아지던 문제 수정
- 확대·축소, 시점 회전, WASD 이동 후에도 기즈모의 화면상 크기 유지
- 미리보기 생성 시점과 카메라 갱신 시점의 기즈모 크기 계산을 공통 함수로 통합

## 0.70.0

- Cmd+A 실행 시 이동 키 처리기가 A를 왼쪽 이동으로 먼저 등록하던 문제 수정
- Meta·Ctrl·Option 조합 단축키는 WASD 카메라 이동 처리에서 제외
- 전체 선택 단축키 사용 중 시점이 왼쪽으로 밀리지 않도록 수정

## 0.69.0

- 연속 설치 미리보기 포인트를 화면 기준 7px 크기로 확대
- 카메라 거리와 관계없이 미리보기 크기가 유지되도록 변경
- 설치·삭제 미리보기 불투명도를 높여 식별성 개선
- 붙여넣기 위치를 한 번 지정한 뒤 일반 화면 클릭으로 위치가 재지정되지 않도록 변경
- 위치 고정 후 이동은 3D 축 화살표로만 수행
- 위치 고정 상태에서 기즈모가 아닌 화면을 드래그하면 카메라 시점 회전

## 0.68.0

- 붙여넣기·선택 이동 위치를 클릭하면 미리보기 원점을 해당 위치에 고정
- 고정 후 일반 마우스 이동으로 구조물이 다시 커서를 따라가던 문제 수정
- 확대·축소와 회전 핸들에 접근할 때 기즈모가 도망가던 문제 수정
- 고정된 구조물은 3D 이동 화살표를 드래그할 때만 위치 변경
- 변형을 마친 뒤에도 위치 잠금 상태 유지

## 0.67.0

- Cmd+A가 일부 VS Code 웹뷰에서 브라우저 전체 선택으로 처리되던 문제 수정
- 플랫폼 문자열 대신 실제 Meta/Ctrl 키 상태로 단축키 판별
- macOS에서는 Cmd+A, Windows/Linux에서는 Ctrl+A로 전체 블록 선택
- 구조물 편집기 UI 글씨가 드래그·전체 선택되지 않도록 방지
- 입력창과 텍스트 영역에서는 기존 텍스트 선택 동작 유지

## 0.66.0

- 연속 설치 중 변경 위치를 반투명 포인트 미리보기로 실시간 표시
- 설치는 현재 블록 색상, 삭제는 빨간색으로 표시
- 최대 3만 변경 위치를 기록하고 화면에는 최대 5천 포인트로 자동 축약
- 매 프레임 전체 블록 메시를 만들지 않아 0.65의 대량 설치 최적화 유지
- 드래그 종료 시 포인트 미리보기를 제거하고 정확한 블록 메시로 교체
- 연속 조형의 높이 변경과 침하 위치도 미리보기에 포함

## 0.65.0

- 연속 블록 설치 중 매 포인터 이동마다 전체 구조물 메시를 재생성하던 병목 제거
- 드래그 중 블록 변경을 메모리에 누적하고 드래그 종료 시 한 번만 렌더 메시 재생성
- 연속 편집 중에는 전체 블록 종류 재집계를 생략한 경량 통계 갱신 사용
- 5만 블록을 넘는 구조물은 실시간 그림자를 자동 비활성화
- 10만 블록을 넘는 구조물은 렌더 픽셀 비율을 자동 조절
- 포인터 취소 시에도 누적된 편집 결과를 안전하게 화면에 반영

## 0.64.0

- 선택 지형 조작을 조형 도구와 동일한 모드 구성으로 통일
- 선택 영역에서 부드럽게·평탄화·침하·융기·깎기 지원
- 선택 지형 조작에 조형 도구와 같은 1~8 강도 설정 적용
- 기존의 별도 거칠게 버튼과 개별 실행 버튼을 모드 선택·적용 방식으로 정리
- 선택 지형 변경 전체를 한 번의 Undo 작업으로 기록

## 0.63.0

- 붙여넣기·선택 이동 미리보기 중심에 3D 변형 기즈모 표시
- 빨강·초록·파랑 화살표를 드래그해 X/Y/Z축 이동
- X/Y/Z 회전 링을 직접 드래그해 자유 회전
- 노란 크기 핸들을 드래그해 균일 확대·축소
- 화면 아무 곳이나 드래그하던 변형 방식을 중심점 핸들 조작 방식으로 교체
- 드래그 미리보기는 확대된 전체 공간 역샘플링 대신 원본 블록 전방 변환 사용
- 정확한 복셀 재계산은 우클릭으로 배치를 확정할 때 한 번만 실행

## 0.62.0

- A 지점과 B 지점 도구를 한 줄의 좌·우 버튼으로 정렬
- A 지점 도구를 `[` 물리 키에 연결
- B 지점 도구를 `]` 물리 키에 연결
- 한글 입력 상태에서도 키보드 위치 기준으로 단축키 작동

## 0.61.0

- A→B 선을 확정하면 B 지점을 다음 선의 A 지점으로 자동 전환해 연속 선 그리기 지원
- 프로젝트에서 선택한 폴더 안에 새 구조물과 하위 폴더 생성
- 파일을 선택한 경우 해당 파일의 부모 폴더를 새 항목 생성 위치로 사용
- 이름 변경 입력을 웹뷰 prompt 대신 VS Code 입력창으로 변경
- 휴지통 확인을 웹뷰 confirm 대신 VS Code 모달 확인창으로 변경
- 이름 변경·삭제 실패 시 실제 오류 원인을 VS Code 메시지로 표시

## 0.60.0

- 구조물 작업공간의 X/Y/Z 최대 크기를 각각 128에서 512블록으로 확장
- 대형 구조물 전체를 볼 수 있도록 카메라 최대 줌 거리를 900블록으로 확장
- 카메라 원거리 렌더링 범위를 2000블록으로 확장
- 가져온 구조물 크기 정규화에도 새로운 512블록 제한 적용

## 0.59.0

- 붙여넣기 확정 후 배율과 X/Y/Z 회전값을 1×·0°로 즉시 초기화하지 않도록 변경
- 다음 붙여넣기 미리보기에 마지막 변형 상태를 그대로 재사용
- 새 크기·회전 드래그도 마지막 변형값에서 이어서 조정
- 원본 클립보드 데이터와 Undo 기록은 변형된 배치 결과와 별도로 유지
- 선택 이동은 반복 누적 확대를 막기 위해 확정 후 기존처럼 초기화

## 0.58.0

- 새 구조물·프로젝트 폴더 이름 입력을 웹뷰 prompt에서 VS Code 기본 입력창으로 교체
- 파일이 하나도 없는 빈 프로젝트에서도 프로젝트 루트를 기준으로 생성 가능
- 빈 프로젝트 생성 실패 시 원인을 VS Code 오류 메시지로 표시
- 프로젝트를 전환하면 이전 프로젝트의 선택 경로 상태를 자동 초기화

## 0.57.0

- Ctrl+A/Cmd+A 동작을 전체 구조물 범위 선택만 수행하도록 변경
- 실제 복사는 선택 후 Ctrl+C/Cmd+C를 별도로 눌렀을 때만 실행
- 일반 코드 편집기와 동일한 전체 선택·복사 단축키 흐름 적용
- 복사·잘라내기·붙여넣기·Undo·저장도 물리 키 코드로 변경해 한글 입력 상태 지원

## 0.56.0

- Ctrl+A 또는 Cmd+A로 전체 구조물 범위를 자동 선택하고 내부 클립보드에 복사
- 입력 언어와 무관하도록 물리 키 코드 KeyA 사용
- 설치된 블록의 최소·최대 X/Y/Z 외곽을 계산해 불필요한 작업공간 공백 제외
- 계산된 외곽 내부의 공기는 기존 복사 규칙에 따라 함께 저장
- 변형 미리보기 대기 중 단축키를 누르면 변형을 취소한 뒤 원본 전체 복사

## 0.55.0

- 변형 기즈모 회전을 Y축 하나에서 X/Y/Z 세 축으로 확장
- 빨강 X·초록 Y·파랑 Z 축 선택 버튼 추가
- 선택한 축을 0.1° 단위로 자유 회전하고 다른 축 각도는 유지
- 3축 오일러 회전 행렬과 역행렬을 사용해 복셀 구조를 재표본화
- 배율 배지에 X/Y/Z 세 회전 각도를 동시에 표시

## 0.54.0

- 이동·붙여넣기 변형 기즈모에서 별도 이동 모드 제거
- 미리보기가 캔버스 커서를 실시간으로 따라가도록 변경
- 기즈모의 적용 버튼을 제거하고 우클릭한 현재 위치에서 최종 적용
- 크기·회전 조정 후에도 우클릭 전까지 자유롭게 위치 변경 가능
- 우클릭만 하면 1×·0° 상태로 즉시 이동 또는 붙여넣기

## 0.53.0

- 블록별 완전한 6면 큐브 인스턴스를 노출면 전용 복셀 메시로 교체
- 인접 블록에 가려진 내부 면은 지오메트리 생성 단계에서 완전히 제외
- 같은 블록 재질의 노출면을 하나의 BufferGeometry와 드로우콜로 통합
- 삼각형별 원본 블록 좌표를 보존해 최적화 후에도 배치·삭제·좌표 레이캐스트 유지
- 블록 변경 시 새로 드러나거나 가려지는 면을 자동 재생성
- 상태바에 실제 렌더링 중인 visible faces 수 표시

## 0.52.0

- 지형을 브러시로 다듬는 조형 도구와 숫자 9 단축키 추가
- 부드럽게·평탄화·침하·융기·깎기 조형 모드 제공
- 침하 모드는 기둥의 블록 순서를 보존하며 중력처럼 아래로 이동하고 바닥에서 쌓이도록 처리
- 브러시 크기·모양·강도·연속 드래그와 선택 영역 제한 지원
- 조형 브러시 적용 범위를 반투명 미리보기로 표시

## 0.51.0

- WASD 이동을 문자값이 아닌 물리 키 코드로 변경해 한글 입력 상태에서도 이동 지원
- Space와 좌우 Shift도 물리 키 코드로 통일
- 우측 하단 XYZ 표시를 카메라 방향에 맞춰 회전하는 실시간 축 기즈모로 교체
- 커서 광선이 처음 가리키는 블록의 X/Y/Z 좌표를 우측 상단에 실시간 표시
- 커서가 작업공간 밖으로 나가면 좌표 HUD를 빈 값으로 초기화

## 0.50.0

- 카메라 이동 속도 슬라이더 최대값을 40에서 400 blocks/s로 확장
- 빠른 연속 배치를 월드 좌표 직선 보간에서 화면 포인터 경로 레이캐스트로 교체
- 포인터 경로를 4px 간격으로 재표본화해 빠른 움직임에서 블록 누락 방지
- 각 경로 지점의 가장 앞쪽 면만 사용해 내부 블록을 관통하는 배치 방지
- 한 포인터 이벤트의 연속 배치를 한 번의 메시 재생성으로 묶어 성능 개선

## 0.49.0

- 이동·붙여넣기 변형을 모델링 방식의 이동·크기·회전 모드 기즈모로 교체
- 각 변형 모드를 독립적으로 선택하고 여러 차례 조정한 뒤 적용·취소 가능
- Y축 회전을 90° 단계가 아닌 0.1° 단위 임의 각도로 변경
- 임의 각도 회전 외곽을 역변환 리샘플링하여 복셀 구조로 재구성
- 기즈모에 적용·취소 버튼과 X/Y/Z 방향 표시 추가

## 0.48.0

- 좌측 브러시 패널의 긴 조작 설명 제거
- 선택 영역 제한 문구를 짧게 축약
- 브러시 패널 폭과 내부 여백·글자 크기를 줄여 얇은 세로 도구 막대로 정리

## 0.47.0

- 선택 영역 지정 후 Delete 키로 영역 내부 블록 일괄 삭제
- macOS 키보드를 위해 입력칸 밖에서는 Backspace도 선택 삭제로 지원
- 단축키 선택 삭제 전체를 하나의 Undo 단계로 기록

## 0.46.0

- 이동·붙여넣기 변형을 마우스를 놓을 때 즉시 적용하지 않고 대기 상태로 유지
- 대기 중 캔버스를 다시 드래그해 위치·배율·회전을 반복 조정 가능
- UI/다른 화면 클릭, 도구 전환, 창 포커스 이동 또는 Enter 입력 시 일괄 확정
- Esc 입력으로 대기 중인 변형을 원본 변경 없이 취소
- 대기 상태를 배율·회전 배지에 표시

## 0.45.0

- 선택 이동·붙여넣기 드래그 변형에 Y축 회전 추가
- 좌우 드래그는 연속 확대·축소, 위아래 드래그는 90° 단위 회전으로 분리
- 배율과 현재 회전 각도를 미리보기 배지에 함께 표시
- 회전 후 X/Z 외곽 크기를 다시 계산한 뒤 리샘플링해 직사각형 구조물 회전 지원

## 0.44.0

- 박스·브러시 선택 영역에서 실제 설치된 블록 칸만 남기는 선택 옵션 추가
- 이동·붙여넣기 드래그 배율을 고정 단계에서 0.10×~8.00× 연속값으로 변경
- 확대 시 역샘플링으로 모든 새 복셀을 채워 빈틈이 생기지 않도록 개선
- 축소 시 목적 복셀 기준으로 원본을 재표본화하여 자연스러운 블록 손실 적용

## 0.43.0

- 선택 이동과 붙여넣기에서 좌우 드래그로 실시간 확대·축소하는 기능 추가
- 0.25×부터 8×까지 단계별 배율과 화면 배율 배지 제공
- 확대·축소된 결과를 놓기 전에 반투명 블록으로 미리 표시
- 클릭만 하면 기존과 동일하게 1× 크기로 이동하거나 붙여넣기

## 0.42.0

- 좌측 중앙 브러시 패널 폭 축소
- 박스 선택의 시작 좌표·크기 입력 기능 제거
- 복사·잘라내기를 선택 영역 패널로 옮기고 클립보드 패널은 붙여넣기 도구에서만 표시
- 교체와 연결 채우기를 `연결된 블록만 교체` 체크박스가 있는 단일 교체 도구로 통합
- 선택 영역과 내부 블록을 미리보기 위치로 함께 옮기는 선택 이동 도구 추가

## 0.41.0

- 거리 어두워짐 기본값을 꺼짐으로 변경
- 작업공간·시점·시간대를 하나의 환경 설정 아이콘으로 통합
- 코드 생성·통계·조작법을 하나의 코드·정보 아이콘으로 통합
- 최근 사용 블록 표시와 기록 한도를 10개로 확장

## 0.40.0

- 보조 설정 아이콘 도크를 3D 화면 우측 상단에서 좌측 상단으로 이동
- 좌측 상단의 작업공간 크기·파일명·미리보기 안내 메시지 제거
- 브러시 옵션을 별도의 좌측 중앙 세로 패널로 이동
- 브러시 크기 슬라이더를 세로 방향으로 변경

## 0.39.0

- 사용자용 노이즈 배치 도구와 밀도 설정 제거
- 선택 영역 복사 시 공기를 항상 내부 클립보드에 포함
- 공기 적용 여부를 복사 옵션이 아닌 붙여넣기 옵션으로 변경
- 작업공간·시점·시간대·코드 생성·통계·조작법을 우측 상단 아이콘 도크로 축소
- 도크 아이콘을 누른 보조 설정만 팝오버로 확장

## 0.38.0

- 3D 화면 중앙의 십자선을 제거
- 카메라를 위아래 전체 범위로 회전할 수 있도록 고도 제한 수정
- 연속 배치 중 새 블록 때문에 커서 대상이 바뀌는 경우를 추가 입력에서 제외
- 한 번의 연속 브러시 동작을 하나의 Undo 단계로 통합
- 도형 생성기를 배치 도구의 세부 기능으로 재구성
- 프로젝트 관리만 왼쪽에 남기고 편집 설정을 3D 화면 오버레이로 이동
- 최근 사용한 블록 8개를 3D 화면의 빠른 선택 바로 제공

## 0.37.0

- 마우스 드래그 시 카메라 위·아래 회전 방향 반전 문제 수정
- Y 회전과 X/Z 반전을 전체 구조물이 아닌 현재 선택 영역에만 적용
- 전체 삭제를 선택 영역 삭제로 변경
- 변형과 지형 조작을 선택 도구 전용 기능으로 재분류
- 브러시·노이즈·도형·산·선택·클립보드 세부 UI를 해당 도구 선택 시에만 표시
- 공통 도구 목록에 도형 도구를 모으고 세부 설정 패널과 분리

## 0.36.0

- VS Code에서 연 폴더를 구조물 프로젝트로 자동 인식
- 별도 구조물 프로젝트 폴더 열기와 최근 프로젝트 기억 기능 추가
- 폴더 계층을 표시하는 프로젝트 파일 트리 추가
- 프로젝트 안에서 새 `.bpstructure`와 폴더 생성 지원
- 파일·폴더 상대 경로 이름 변경과 시스템 휴지통 삭제 지원
- 프로젝트 구조물 전환 시 현재 `.bpstructure` 자동 저장
- 구조물 파일 전환 후에도 내부 클립보드를 유지해 빠른 구조물 간 복사·붙여넣기 지원
- 외부 구조물 파일 변경 자동 감지와 수동 새로고침 추가

## 0.35.0

- 선택 영역 A와 B의 X/Y/Z 좌표를 각각 직접 수정하는 기능 추가
- 연속 브러시의 다음 실행 조건을 화면 픽셀 이동이 아닌 대상 블록 좌표 변경으로 명확화
- 숫자 1~9 도구 전환 단축키 추가
- 블록을 수정하지 않고 화면을 회전하는 이동 도구를 기본 도구와 숫자 1에 배정
- 모든 기능 박스에 상세 내용 접기/펼치기 버튼 추가
- 접은 기능 박스 상태를 Webview 상태로 저장

## 0.34.0

- 선택 영역 시작 좌표와 X/Y/Z 크기를 숫자로 조절하는 기능 추가
- 브러시·올가미 방식의 자유 선택과 Shift 누적 선택 추가
- 배치·삭제·노이즈·도형·붙여넣기를 선택 영역 안으로 제한하는 공통 옵션 추가
- 브러시 크기를 1~32 연속 슬라이더로 변경
- 별도 연속 페인트 도구를 제거하고 모든 브러시에 자동 연속 동작 적용
- 다른 셀로 이동하거나 0.6초 이상 누를 때만 연속 동작이 활성화되도록 변경
- 구·원·원기둥·산 생성기를 브러시 패널에 통합

## 0.33.0

- 거리 어두워짐(안개 강도)을 끄거나 조절하는 슬라이더 추가
- 클립보드 복사 시 공기 포함 여부 옵션 추가
- Q/E와 빠른 이동 키를 제거하고 1~40 blocks/s 이동 속도 슬라이더 추가
- 모든 기능 버튼에 650ms 지연 설명 툴팁 추가
- 좌우 도구 패널을 카드형 그룹으로 재정리하고 활성 도구 표시 개선

## 0.32.1

- Space 위 이동과 Shift 아래 이동 추가
- 기존 Q/E 수직 이동 유지
- 고속 이동 키를 Shift에서 Ctrl로 변경

## 0.32.0

- 도형·산·브러시·붙여넣기 결과를 클릭 전에 보여주는 반투명 고스트 미리보기 추가
- 선택 영역 복사, 잘라내기, 붙여넣기와 Cmd/Ctrl+C/X/V 단축키 추가
- 연결된 동일 블록을 한 번에 바꾸는 Flood Fill 도구 추가
- 클릭한 블록 종류를 선택 영역 또는 전체에서 교체하는 Replace 도구 추가
- 밀도 조절이 가능한 Noise Painter 추가
- 선택 지형 평탄화, 부드럽게, 거칠게 조작 추가
- 선택 영역 수직 돌출 추가

## 0.31.0

- WASD 시점 이동, Q/E 수직 이동, Shift 고속 이동 추가
- 도형·산 생성기를 캔버스에서 위치를 찍는 토글형 도구로 변경
- X/Y/Z 각각 1~128 범위의 가변 작업공간 지원
- `.bpstructure`와 Bedrock little-endian NBT `.mcstructure` 가져오기 지원
- 연속 드래그 설치용 페인트 도구 추가
- 블록 메시의 레이캐스팅 틈 제거 및 편집 직후 커서 아웃라인 강제 갱신
- 파일에는 저장되지 않는 미리보기 시간대 조절 기능 추가

## 0.30.0

- 공식 `@minecraft/vanilla-data` 기반 Bedrock 블록 ID 1,342개 내장
- 전체 블록 검색, 최근 블록, 선택 블록 표시를 갖춘 팔레트 추가
- 1×1부터 7×7까지 큐브·구형 배치/삭제 브러시 추가
- 캔버스에서 A~B 영역을 드래그해 바로 선택하는 도구 추가
- 선, 원, 원판, 구, 빈 구, 원기둥 자동 생성 도구 추가
- 반지름·높이·거칠기·시드를 조절하는 산 지형 생성기 추가

## 0.29.2

- 누락된 Three.js core 모듈 때문에 3D 편집기 전체가 실행되지 않던 문제 수정
- Three.js와 편집기 코드를 단일 Webview 번들로 패키징해 모듈 로딩 의존성 제거

## 0.29.1

- 3D 구조물 편집기의 블록 팔레트 이벤트를 그래픽 초기화와 분리
- 선택한 블록 ID를 팔레트 상단에 표시하고 선택 상태를 명확하게 개선
- Webview CSP에서 팔레트 색상 스타일과 모듈 스크립트를 명시적으로 허용
- 짧은 클릭이 카메라 드래그로 오인되지 않도록 이동 임계값 조정

## 0.29.0

- Three.js 기반 32×32×32 3D voxel 구조물 편집기 추가
- 블록 배치·삭제, 팔레트, 자유 카메라, 선택 영역 채우기·비우기 지원
- 실행 취소·다시 실행, Y축 회전, X/Z 대칭, 전체 삭제 지원
- `.bpstructure` 프로젝트 저장·열기와 BedrockPy 함수 코드 내보내기 지원
- 연속된 동일 블록을 `/fill`로 자동 압축하고 나머지를 `/setblock`으로 생성

## 0.28.35

- Hover의 `set` 명령을 `int`, `bool`, `float` 자료형별 템플릿으로 구분
- `float` Hover에 가수와 지수를 설정하는 `set` 명령 두 줄 표시

## 0.28.34

- 변수 Hover의 scoreboard 예시를 조회용 `get`에서 수정용 `set ... <값>` 템플릿으로 변경

## 0.28.33

- 변수 선언과 사용처 Hover에 자료형, 실제 scoreboard objective·holder, 선언 위치 표시
- float Hover에 가수 holder와 지수 holder를 함께 표시

## 0.28.32

- 행동 팩과 리소스 팩을 한 파일로 묶는 `pack.mcaddon` 및 `--mcaddon` 지원

## 0.28.31

- `if`/`unless` 조건 뒤에 이어 쓴 `positioned` 등 execute 문맥을 내부 함수와 중첩 분기에 재적용

## 0.28.30

- `if`/`unless` 내부 함수와 중첩 분기에 바깥 execute 위치·회전 문맥 재적용
- 바깥 `as` selector의 중복 순회를 막기 위해 분기 본문에서는 기존 실행자 `@s` 사용

## 0.28.29

- 빈 블록을 허용하면서 Minecraft 명령은 생성하지 않는 `pass` 문 추가

## 0.28.28

- `tick every int변수:` 동적 반복 주기 지원
- 주기 변수가 0 이하이면 반복을 일시 정지하고 내부 카운터 초기화

## 0.28.27

- 두 개 이상의 `int`·`float` 값에서 최댓값과 최솟값을 구하는 `max`, `min` 함수 추가

## 0.28.26

- `init:` 변수 초기화와 본문을 `call init` 또는 `/function namespace/init`으로 수동 실행 가능

## 0.28.25

- 혼합 `tp`에서 상수 위치·회전을 원본 명령에 직접 넣고 변수 축만 scoreboard로 계산

## 0.28.24

- 모든 위치·회전 인자가 상수인 `tp`를 원본 Minecraft `tp` 한 줄로 최적화

## 0.28.23

- `tp` 위치·회전 인자에 숫자 상수를 직접 사용하고 변수와 혼합하는 기능 추가

## 0.28.22

- `tick every N:` 주기 실행 블록 지원
- 여러 주기 블록을 독립적인 scoreboard 카운터로 컴파일

## 0.28.21

- 인자 없는 `sleep()`을 `sleep(0)`의 축약형으로 지원

## 0.28.20

- `sleep(0)`을 허용하고 `schedule ... 0t append` continuation으로 컴파일
- `sleep` 허용 범위를 0~2,000,000,000틱으로 확장

## 0.28.19

- `if` 분기 function 호출에 바깥 `as`, `at`, `positioned`, `rotated` 등 execute 문맥을 직접 결합
- 좌표 문맥만 감싸던 불필요한 중간 function 제거

## 0.28.18

- BedrockPy 전용 문법에서 `let` 상수를 중괄호 없이 직접 사용하는 기능 추가
- `/` Minecraft 원본 명령은 기존 `{상수}` 치환 방식 유지

## 0.28.17

- `pack.version = auto` 자동 패치 버전 증가 기능 추가
- 성공한 실제 빌드에서만 `.bedrockpy/versions.json`의 버전을 갱신

## 0.28.16

- `vars:`에 팩 전체에서 공유되는 문자열·숫자·bool `let` 컴파일 상수 추가
- 메시지에서는 상수 이름을 직접 사용하고 명령에서는 `{상수}` 문법으로 치환 가능

## 0.28.15

- `pack:`에 `description`, `icon`, `version`, `min_engine_version` 옵션 추가
- 팩 아이콘을 행동 팩과 커스텀 사운드 리소스 팩 및 mcpack에 자동 포함

## 0.28.14

- `location`의 int X/Z 탐색 경계를 플레이어 히트박스 반폭만큼 이동해 값이 소수부 `0.0`에서 바뀌도록 수정
- 이전 버전의 결과 `-1` 보정은 경계를 옮기지 못하므로 제거

## 0.28.13

- 갑옷 거치대 판정 때문에 `location`의 int X/Z 기본 탐색값이 1 크게 저장되던 문제를 보정
- 예: `x=0.69, z=4.69`와 `x=0.71, z=4.71` 모두 `x=0, z=4`로 저장

## 0.28.12

- `location`의 int X/Z에서 소수부 약 `0.7`에 발생하던 불필요한 `+1` 보정을 제거
- int X/Z 좌표는 추가 반올림 없이 탐색된 정수 부분을 저장

## 0.28.11

- `location`의 int X/Z 저장 보정 probe를 `0`으로 재조정

## 0.28.10

- `location`의 int X/Z 저장 보정 probe를 `-1.4`로 재조정

## 0.28.9

- `location`의 int X/Z 저장 보정 probe를 `-1.2`로 재조정

## 0.28.8

- `location`의 int X/Z 저장 보정 probe를 실제 측정값에 맞춰 `-0.7`로 재조정

## 0.28.7

- `location`의 int X/Z 저장값을 소수부 `0.2` 이상이면 1 올리도록 재조정

## 0.28.6

- `location`의 int X/Z 저장값을 소수부 `0.7` 이상이면 1 올리도록 재조정

## 0.28.5

- `location`의 int X/Z 저장값 보정 추가
- float X/Z 저장 로직은 기존 소수 첫째 자리 보정을 유지

## 0.28.4

- 실제 측정값에 맞춰 `location` Y 저장값을 1칸 위로 보정

## 0.28.3

- `location` Y 탐색을 히트박스 높이 대신 발 위치 기준 박스 탐색으로 변경
- 웅크리기처럼 플레이어 높이가 바뀌는 상태에서도 Y 저장값이 흔들리지 않도록 개선

## 0.28.2

- 실제 월드 측정값에 맞춰 `tp` 변수 좌표 이동 보정값 재조정

## 0.28.1

- `location` 좌표 저장값의 armor stand 기준점 오차 보정
- `tp` 변수 좌표 이동의 최종 위치 오차 보정

## 0.28.0

- `tp @대상 -> x, y, z` 변수 좌표 텔레포트 문법 추가
- `tp @대상 -> x, y, z, ry, rx`로 yaw/pitch 회전값 적용 지원
- int와 float 좌표·회전 변수를 scoreboard에서 소수 첫째 자리 단위로 변환
- 내부 투명 armor stand marker로 scoreboard 좌표를 실제 위치로 변환

## 0.27.0

- `location @대상 -> x, y, z` 좌표 저장 문법 추가
- Y=1000의 즉시 투명 armor stand로 X/Z 좌표 탐색
- armor stand를 내리지 않는 `y/dy` 분기로 Y 좌표 탐색
- int 블록 좌표와 float 소수 첫째 자리 지원
- 탐색 종료 후 임시 태그와 armor stand 자동 제거

## 0.26.0

- 10,000줄을 넘는 일반 함수를 별도 문법 없이 자동 tick 작업으로 전환
- 원래 함수 파일은 실행 플래그를 켜는 호출 wrapper로 유지
- 함수 본문을 `max_lines` 단위로 나누어 `tick.json`에 순서대로 등록
- 마지막 reset 작업에서 실행 플래그 자동 해제
- 변수가 없는 팩에도 작업 플래그용 scoreboard objective 자동 생성

## 0.25.0

- `rotation @대상 -> pitch, yaw` 문법 추가
- `rx/rxm`과 `ry/rym` 분기 탐색으로 회전값을 scoreboard에 저장
- int 회전값은 1도, float 회전값은 0.1도 단위 지원
- yaw의 -180~179 경계와 pitch의 -90~90 범위 적용

## 0.24.0

- 무거운 53비트 이진 float를 8자리 가수와 10진 지수 방식으로 교체
- 4자리 상·하위 조각 곱셈으로 32비트 scoreboard 오버플로 방지
- 10진 긴 나눗셈으로 8자리 유효숫자 유지
- 로그의 가수·10진 지수 범위 축소 알고리즘 개선
- 대형 tick 작업 조각 없이 수학 함수를 10,000명령 이내로 생성
- 실제 `sqrt` 사용 예제의 생성 명령을 약 12만 5천 개에서 약 6천 개 수준으로 축소

## 0.23.1

- 대형 float·수학 연산 조각의 중첩 `function` 호출 제거
- 각 연산 조각을 `tick.json`의 독립 최상위 함수로 직접 등록
- 작업 플래그로 필요한 연산만 실행하고 마지막 조각에서 결과 대입
- 생성되는 tick 작업 파일을 최대 7,499줄로 제한

## 0.23.0

- 기존 10진 네 자리 float를 53비트 이진 다중 정밀도 float로 교체
- 부호, 2진 지수, 다섯 개의 13비트 scoreboard limb 저장 구조 적용
- 이진 float 사칙연산, 나머지, 비교 및 복합 대입 구현
- `tell`, `title`, `subtitle`, `actionbar`의 고정 소수점 출력 변환 갱신
- `sqrt`, `root`, `pow`, `abs`, `sin`, `cos`, `tan`, `log`를 새 float 표현으로 교체
- 큰 수학 연산을 7,500줄 이하 내부 함수로 자동 분리
- scoreboard 명령 시뮬레이터 기반 수치 회귀 테스트 추가

## 0.22.0

- `as`, `at`, `positioned` 등 실행 문맥 블록을 내부 함수로 원자적으로 실행
- 실행 대상이 여러 명일 때 float 중간 명령이 서로 섞이는 문제 수정
- 문맥 블록의 여러 scoreboard 명령이 대상별로 순서대로 완료되도록 변경

## 0.21.0

- Bedrock 환경에서 문법 오류가 날 수 있는 내부 scoreboard `#` 접두사 제거
- 변수는 `bpv_`, 임시값은 `bpt_`, lifecycle은 `bpl_`, 내부 상태는 `bpi_` 접두사 사용
- `when first/last`, init, float 연산에서 안전한 점수 보유자 이름 생성

## 0.20.0

- 소스 안에서 빌드를 제어하는 최상위 `pack:` 설정 블록 추가
- `name`, `namespace`, `output`, `mcpack`, `max_lines` 옵션 지원
- VS Code에서 설정된 출력 및 mcpack 경로를 자동 사용
- 프로젝트 설정 조회와 CLI 옵션 우선 적용 지원

## 0.19.0

- 간편 `title`, `subtitle`, `actionbar` rawtext 문법 추가
- 타이틀 계열에서 문자열, int, bool, float scoreboard 변수 출력
- float 출력 자릿수 `speed:0`~`speed:6` 지원

## 0.18.0

- `sound 이름:` 설정 블록 추가
- 사운드별 `category`와 `is3D` 옵션 지원
- 사운드 설정의 파일 누락, 잘못된 값, 프로젝트 전체 중복 검사

## 0.17.0

- 프로젝트 `sounds` 폴더의 `.ogg` 커스텀 사운드 자동 탐색
- `play 이름 [to 대상] [at 위치] [volume/pitch/minimum 값]` 문법 추가
- 연결된 리소스 팩과 `sound_definitions.json` 자동 생성
- 행동 팩 manifest 리소스 팩 의존성과 동반 리소스 `.mcpack` 생성

## 0.16.0

- 프로젝트 폴더 아래의 모든 `.bpy` 파일을 한 팩으로 컴파일
- 파일별 `vars`, `init`, `tick` 블록 자동 병합
- 프로젝트 전체 함수 이름 중복 검사와 해당 파일 오류 표시
- VS Code `bedrockpy.projectRoot` 설정 추가

## 0.15.0

- 코드 뒤에 붙이는 `#` 인라인 주석 지원
- `""" ... """` 및 `''' ... '''` 여러 줄 주석 지원
- 문자열 내부 `#` 보호와 닫히지 않은 주석 오류 검사

## 0.14.0

- 최상위 `first:` 블록을 `init:`으로 변경
- 변수 초기화와 사용자 init 본문을 `__init.mcfunction` 하나로 통합
- 새 팩 빌드가 감지될 때 모든 scoreboard 변수를 선언 초기값으로 재설정

## 0.13.0

- 지정한 게임틱 뒤에 함수를 재개하는 `sleep(tick)` 추가
- sleep 이후 코드를 내부 continuation 함수로 자동 분리
- 여러 예약을 유지하는 schedule `append` 모드 적용

## 0.12.0

- `function 이름 when first:` 연속 호출 시작 조건 추가
- `function 이름 when last:` 연속 호출 종료 조건 추가
- 함수별 마지막 호출 tick과 lifecycle 시작·종료 관리자 생성

## 0.11.0

- 최초 적용 및 새 빌드 업데이트 때 한 번 실행되는 `first:` 블록 추가
- 컴파일마다 무작위 scoreboard 빌드 ID 생성
- 저장된 빌드 ID 비교 후 `__first` 내부 함수 호출

## 0.10.0

- `abs`, `pow`, `sqrt`, `root` 수학 함수 추가
- 라디안 기반 `sin`, `cos`, `tan` 근사 함수 추가
- 자연로그와 밑 지정 `log` 근사 함수 추가
- 삼각함수 입력 범위 축소와 중간값 재사용 최적화

## 0.9.0

- float 출력 자릿수 문법을 `speed:0`~`speed:6` 형식으로 단순화
- 문자열 안의 콜론과 출력 자릿수 콜론을 토큰 단위로 구분

## 0.7.0

- `fixed(float변수, 자릿수)` 출력 형식 추가
- float 출력 자릿수 0~6 지원
- 자릿수를 생략한 float는 기존처럼 소수 셋째 자리까지 출력

## 0.7.0

- `tell`의 float 출력을 과학적 표기에서 `x.xxx` 고정 표시로 변경
- 정수부와 소수 세 자릿수 자동 분리 및 0 채우기
- `-0.xxx` 값의 음수 부호 출력 지원

## 0.6.0

- raw JSON 없이 메시지를 만드는 `tell` 문법 추가
- 메시지 안의 `int`, `float`, `bool` scoreboard 변수 출력 지원
- float 가수·지수를 실시간 과학적 표기 형태로 출력

## 0.5.0

- `if`, `else`, `unless` 블록을 내부 함수로 자동 추출
- 조건을 블록의 각 명령마다 반복 검사하지 않고 함수 호출 시 한 번만 검사
- 중첩 조건 함수 및 예약된 `__internal` 함수 경로 추가

## 0.4.0

- `float`를 고정소수점에서 가수·10진 지수 기반 소프트웨어 부동소수점으로 교체
- float 덧셈의 지수 정렬과 사칙연산 결과 정규화 추가

## 0.3.0

- `cmd` 키워드 제거
- scoreboard 기반 `int`, `float`, `bool` 변수 추가
- 산술, 비교, 논리 연산 및 복합 대입 추가

## 0.2.0

- Minecraft 원시 명령의 `/` 접두사 필수화
- `if`에 연결되는 `else` 블록 추가

## 0.1.0

- 최초 공개 버전
- 문법 강조, 자동 들여쓰기, 실시간 진단, 행동 팩 및 `.mcpack` 빌드 지원
# 0.132.0

- Added the BedrockPy Marketplace extension icon.
# 0.133.0

- Added an automatic minification and obfuscation pipeline for Marketplace builds.
- Excluded JavaScript source files from release VSIX packages.
# 0.134.0

- Added `.mcworld` export with the edited blocks written directly into Bedrock LevelDB chunks.
- Exported worlds open with the structure already present and do not require an installation behavior pack.
# 0.135.0

- Paused expensive block raycasting while the camera is moving and refreshes hover once movement stops.
- Limited picking to nearby resident chunks on very large structures.
- Shared block materials between chunk meshes to reduce GPU resources and draw preparation overhead.
# 0.136.0

- Removed the 3D editor detach-to-new-window button and its command handling.
# 0.136.1

- Fixed extension activation by loading the native Bedrock LevelDB module only when `.mcworld` export is requested.
# 0.136.2

- Fixed extension activation by excluding JSZip and its dependencies from code obfuscation.
# 0.137.0

- Removed the `현재 .bpy에 삽입` action from the 3D structure editor.
# 0.137.1

- Removed the Git requirement from Mojang vanilla texture installation.
- Vanilla textures now download the required files directly from the latest official `bedrock-samples` release.
# 0.137.2

- Fixed `.mcworld` export failing with `Cannot find module 'debug'` in Marketplace installations.
- Included the complete runtime dependency chain required by the native Bedrock LevelDB module.
- Restored block picking across the full configured render distance for structures larger than 100,000 blocks.
- Hid placement-shape controls while using the text, image, and 3D model special tools.
- Included `lodash.reduce` and the remaining ProtoDef runtime dependency chain required by `.mcworld` export.

# 0.138.0

- Added configurable X/Y/Z base coordinates, defaulting to `0, 0, 0`.
- Applied base coordinates to `.mcworld` block placement and world spawn positioning.
- Added relative and absolute coordinate modes for `.bpy` export.
- Opened the 3D structure editor automatically in a separate VS Code window.
- Applied the configured base coordinates to the top-right cursor and Play-mode position display.
- Changed exported `.mcworld` files to the Bedrock void generator so every newly explored chunk remains empty.
- Set the exported world spawn to the configured base coordinates instead of placing it above the workspace height.
- Closed the blocking load overlay as soon as structure data is ready while nearby chunks continue rendering in the background.
- Displayed the project-file loading overlay immediately on click, before extension-side file reading begins.

# 0.138.1

- Hid generic brush size and shape controls while using placement-shape tools.
- Unified placement-shape preview and placement cell generation so `선택 안에서만` clips both identically.

# 0.138.2

- Added mipmapped minification for Minecraft block textures to reduce distant aliasing and shimmer.
- Added up to 8× anisotropic filtering for clearer textures on oblique block faces.

# 0.139.0

- Batched mutation revisions and deferred column-height recomputation during large placement, deletion, undo, and sculpt operations.
- Added per-chunk occupied-position indexes so mesh rebuilding skips empty cells instead of scanning every 16³ coordinate.
- Replaced the fixed one-chunk-per-frame rebuild rate with an adaptive 6 ms budget based on measured chunk build time.

# 0.139.1

- Added a visible relative/absolute coordinate picker whenever `.bpy로 내보내기` is pressed.

# 0.139.2

- Changed continuous brush previews to a bounded recent-cell window instead of retaining the entire stroke.
- Reduced pointer raycasts to at most 8 per event and interpolated block centers to preserve continuous placement and deletion.
- Coalesced continuous sculpt applications to 90 ms intervals with at most two samples per update.
- Throttled lightweight statistics updates during active strokes.

# 0.139.3

- Separated native text/number-input undo from structure block undo.
- Prevented range, checkbox, and select controls from being reverted together with `Cmd/Ctrl+Z` block operations.
- Added isolated `Ctrl+Y` structure redo handling on Windows.
