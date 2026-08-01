const vscode = require('vscode');
const cp = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const JSZip = require('jszip');

const running = new Map();
let diagnostics;
let status;
let debounce;
let structurePanel;
let structureUri;
let latestProjectOpenRequestId = 0;
let structureProjectUri;
let structureProjectWatcher;
let structureContext;

function nbtName(value) {
  const data = Buffer.from(value, 'utf8');
  const size = Buffer.allocUnsafe(2);
  size.writeUInt16LE(data.length);
  return Buffer.concat([size, data]);
}

function nbtTag(type, name, payload) {
  return Buffer.concat([Buffer.from([type]), nbtName(name), payload]);
}

function nbtInt(name, value) {
  const payload = Buffer.allocUnsafe(4);
  payload.writeInt32LE(value);
  return nbtTag(3, name, payload);
}

function nbtLong(name, value) {
  const payload = Buffer.allocUnsafe(8);
  payload.writeBigInt64LE(BigInt(value));
  return nbtTag(4, name, payload);
}

function nbtByte(name, value) {
  return nbtTag(1, name, Buffer.from([value & 255]));
}

function nbtString(name, value) {
  return nbtTag(8, name, Buffer.concat([nbtName(String(value))]));
}

function createLevelDat(levelName, spawn = { x: 0, y: 2, z: 0 }) {
  const now = BigInt(Math.floor(Date.now() / 1000));
  const voidLayers = JSON.stringify({
    biome_id: 1,
    block_layers: [{ block_name: 'minecraft:air', count: 1 }],
    encoding_version: 6,
    structure_options: null,
    world_version: 'version.post_1_18'
  });
  const root = Buffer.concat([
    Buffer.from([10, 0, 0]),
    nbtString('LevelName', levelName),
    nbtInt('StorageVersion', 10),
    nbtInt('Generator', 5),
    nbtString('FlatWorldLayers', voidLayers),
    nbtInt('GameType', 1),
    nbtInt('Difficulty', 1),
    nbtInt('SpawnX', Math.trunc(Number(spawn.x) || 0)),
    nbtInt('SpawnY', Math.trunc(Number(spawn.y) || 0)),
    nbtInt('SpawnZ', Math.trunc(Number(spawn.z) || 0)),
    nbtByte('commandsEnabled', 1),
    nbtByte('ForceGameType', 0),
    nbtLong('LastPlayed', now),
    nbtLong('RandomSeed', BigInt(Date.now())),
    nbtLong('Time', 0n),
    nbtLong('CurrentTick', 0n),
    Buffer.from([0])
  ]);
  const header = Buffer.allocUnsafe(8);
  header.writeInt32LE(10, 0);
  header.writeInt32LE(root.length, 4);
  return Buffer.concat([header, root]);
}

function safeBlockId(value) {
  let id = String(value || 'air').trim().toLowerCase();
  id = id.replace(/^minecraft:/, '').replace(/[^a-z0-9_]/g, '_');
  return `minecraft:${id || 'air'}`;
}

function normalizedWorldFileName(value) {
  return String(value || 'bedrockpy_structure')
    .replace(/[^a-zA-Z0-9가-힣_-]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'bedrockpy_structure';
}

function blockPaletteEntry(id) {
  return {
    type: 'compound',
    value: {
      name: { type: 'string', value: safeBlockId(id) },
      states: { type: 'compound', value: {} },
      version: { type: 'int', value: 18168865 }
    }
  };
}

async function addDirectoryToZip(zip, directory, prefix = '') {
  for (const entry of await fs.promises.readdir(directory, { withFileTypes: true })) {
    const source = path.join(directory, entry.name);
    const destination = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) await addDirectoryToZip(zip, source, destination);
    else zip.file(destination, await fs.promises.readFile(source));
  }
}

async function createMcworld(data, target, onProgress = () => {}) {
  // 네이티브 LevelDB는 확장 활성화 시점이 아니라 이 기능을 실제 사용할 때만 로드한다.
  // 플랫폼 바이너리 문제가 생겨도 다른 BedrockPy 명령 등록에는 영향을 주지 않는다.
  const { LevelDB } = require('@8crafter/leveldb-zlib');
  const {
    entryContentTypeToFormatMap,
    generateChunkKeyFromIndices,
    offsetToChunkBlockIndex
  } = require('mcbe-leveldb');
  const tempRoot = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'bedrockpy-mcworld-'));
  const dbPath = path.join(tempRoot, 'db');
  await fs.promises.mkdir(dbPath, { recursive: true });
  const db = new LevelDB(dbPath, { createIfMissing: true });
  const blocks = Array.isArray(data?.blocks) ? data.blocks : [];
  const baseCoordinate = {
    x: Math.trunc(Number(data?.baseCoordinate?.x) || 0),
    y: Math.trunc(Number(data?.baseCoordinate?.y) || 0),
    z: Math.trunc(Number(data?.baseCoordinate?.z) || 0)
  };
  const subchunks = new Map();
  try {
    await db.open();
    for (let index = 0; index < blocks.length; index++) {
      const block = blocks[index];
      const worldX = baseCoordinate.x + Math.trunc(Number(block.x) || 0);
      const worldY = baseCoordinate.y + Math.trunc(Number(block.y) || 0);
      const worldZ = baseCoordinate.z + Math.trunc(Number(block.z) || 0);
      const chunkX = Math.floor(worldX / 16);
      const chunkZ = Math.floor(worldZ / 16);
      const subChunkIndex = Math.floor(worldY / 16);
      const id = safeBlockId(block.type);
      const mapKey = `${chunkX},${chunkZ},${subChunkIndex}`;
      let subchunk = subchunks.get(mapKey);
      if (!subchunk) {
        subchunk = { chunkX, chunkZ, subChunkIndex, palette: ['minecraft:air'], indices: new Array(4096).fill(0) };
        subchunks.set(mapKey, subchunk);
      }
      let paletteIndex = subchunk.palette.indexOf(id);
      if (paletteIndex < 0) {
        paletteIndex = subchunk.palette.length;
        subchunk.palette.push(id);
      }
      const localX = ((worldX % 16) + 16) % 16;
      const localY = ((worldY % 16) + 16) % 16;
      const localZ = ((worldZ % 16) + 16) % 16;
      subchunk.indices[offsetToChunkBlockIndex({ x: localX, y: localY, z: localZ })] = paletteIndex;
      if (index % 5000 === 0) onProgress(5 + Math.floor(index / Math.max(1, blocks.length) * 40), '블록 청크 구성 중…');
    }

    const chunks = new Set();
    let written = 0;
    for (const subchunk of subchunks.values()) {
      const palette = {};
      subchunk.palette.forEach((id, index) => { palette[index] = blockPaletteEntry(id); });
      const value = entryContentTypeToFormatMap.SubChunkPrefix.serialize({
        type: 'compound',
        value: {
          version: { type: 'byte', value: 9 },
          layerCount: { type: 'byte', value: 1 },
          subChunkIndex: { type: 'byte', value: subchunk.subChunkIndex },
          layers: {
            type: 'list',
            value: {
              type: 'compound',
              value: [{
                palette: { type: 'compound', value: palette },
                block_indices: { type: 'list', value: { type: 'int', value: subchunk.indices } }
              }]
            }
          }
        }
      });
      const indices = { x: subchunk.chunkX, z: subchunk.chunkZ, dimension: 0, subChunkIndex: subchunk.subChunkIndex };
      await db.put(generateChunkKeyFromIndices(indices, 'SubChunkPrefix'), value);
      chunks.add(`${subchunk.chunkX},${subchunk.chunkZ}`);
      written++;
      onProgress(45 + Math.floor(written / Math.max(1, subchunks.size) * 35), 'Bedrock 청크 기록 중…');
    }
    for (const chunk of chunks) {
      const [x, z] = chunk.split(',').map(Number);
      const indices = { x, z, dimension: 0 };
      await db.put(generateChunkKeyFromIndices(indices, 'Version'), entryContentTypeToFormatMap.Version.defaultValue);
      const finalized = Buffer.alloc(4);
      finalized.writeUInt32LE(2);
      await db.put(generateChunkKeyFromIndices(indices, 'FinalizedState'), finalized);
    }
    await db.close();

    const levelName = `${String(data?.functionName || 'BedrockPy Structure').replace(/[_/]+/g, ' ')} - BedrockPy`;
    const spawn = {
      x: baseCoordinate.x,
      y: baseCoordinate.y,
      z: baseCoordinate.z
    };
    await fs.promises.writeFile(path.join(tempRoot, 'level.dat'), createLevelDat(levelName, spawn));
    await fs.promises.writeFile(path.join(tempRoot, 'levelname.txt'), `${levelName}\n`, 'utf8');
    onProgress(85, 'mcworld 압축 중…');
    const zip = new JSZip();
    await addDirectoryToZip(zip, tempRoot);
    const archive = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE', compressionOptions: { level: 6 } });
    await fs.promises.writeFile(target, archive);
    onProgress(100, '완료');
  } finally {
    if (db.isOpen()) await db.close().catch(() => {});
    await fs.promises.rm(tempRoot, { recursive: true, force: true });
  }
}

function config() {
  const settings = vscode.workspace.getConfiguration('bedrockpy');
  return {
    python: settings.get('pythonPath', 'python3'),
    namespace: settings.get('namespace', 'bedrockpy'),
    name: settings.get('packName', 'BedrockPy Pack'),
    maxLines: settings.get('maxLines', 10000),
    projectRoot: settings.get('projectRoot', ''),
    validateOnType: settings.get('validateOnType', true)
  };
}

function compilerPath(context) {
  return context.asAbsolutePath(path.join('compiler', 'bedrockpy.py'));
}

function nonce() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let value = '';
  for (let index = 0; index < 32; index++) value += chars.charAt(Math.floor(Math.random() * chars.length));
  return value;
}

function structureEditorHtml(webview, context) {
  const scriptUri = webview.asWebviewUri(vscode.Uri.file(context.asAbsolutePath(path.join('media', 'voxel-editor.bundle.js'))));
  const styleUri = webview.asWebviewUri(vscode.Uri.file(context.asAbsolutePath(path.join('media', 'voxel-editor.css'))));
  const token = nonce();
  const blocks = [
    ['stone', 'Stone', '#7d8586'], ['dirt', 'Dirt', '#866043'],
    ['grass', 'Grass', '#5eaa43'], ['oak_planks', 'Oak Planks', '#b58b55'],
    ['glass', 'Glass', '#9fd9df'], ['white_concrete', 'White', '#dde2e2'],
    ['black_concrete', 'Black', '#202326'], ['red_concrete', 'Red', '#c74343'],
    ['blue_concrete', 'Blue', '#3b64c8'], ['lime_concrete', 'Lime', '#75c83d'],
    ['gold_block', 'Gold', '#f5cc38'], ['sea_lantern', 'Sea Lantern', '#b9e7db']
  ].map(([id, label, color]) =>
    `<button type="button" class="block" data-block="${id}" title="${id}" aria-pressed="false"><span class="swatch" style="background:${color}"></span><span>${label}</span></button>`
  ).join('');
  return `<!doctype html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource} data:; style-src ${webview.cspSource} 'unsafe-inline'; script-src ${webview.cspSource} 'nonce-${token}';">
  <link rel="stylesheet" href="${styleUri}">
  <title>BedrockPy 구조물 편집기</title>
</head>
<body>
  <div class="app">
    <header class="topbar">
      <div class="brand"><span class="brand-mark">B</span><span>BedrockPy 3D</span></div>
      <button id="open-project">프로젝트 폴더 열기</button>
      <button id="open">열기</button>
      <button id="save">저장</button>
      <button id="save-as">다른 이름으로</button>
      <div class="spacer"></div>
      <button class="icon-button" id="undo" title="실행 취소">↶</button>
      <button class="icon-button" id="redo" title="다시 실행">↷</button>
      <button id="export">.bpy로 내보내기</button>
      <button id="export-mcworld">.mcworld로 내보내기</button>
    </header>
    <div class="workspace">
      <aside class="sidebar">
        <section class="section project-section">
          <h2 class="section-title">프로젝트</h2>
          <div class="project-root">
            <strong id="project-name">폴더를 열어주세요</strong>
            <button id="refresh-project" class="mini-button" title="프로젝트 파일 목록 새로고침">↻</button>
          </div>
          <div class="project-actions">
            <button id="new-structure">＋ 구조물</button>
            <button id="new-project-folder">＋ 폴더</button>
          </div>
          <div id="project-tree" class="project-tree">
            <p class="project-empty">프로젝트 폴더를 열면 여러 구조물을 한곳에서 관리할 수 있습니다.</p>
          </div>
          <div id="project-file-actions" class="project-file-actions">
            <button id="rename-project-entry">이름 변경</button>
            <button id="delete-project-entry" class="danger">휴지통</button>
          </div>
        </section>
        <section class="section">
          <h2 class="section-title">도구</h2>
          <div class="tool-grid">
            <button data-tool="move">✥ 이동 <small>1</small></button>
            <button data-tool="place">＋ 배치 <small>2</small></button>
            <button data-tool="erase">－ 삭제 <small>3</small></button>
            <button data-tool="sculpt">◒ 조형 <small>4</small></button>
            <button data-tool="selectBox">▣ 박스 선택 <small>5</small></button>
            <button data-tool="lasso">⌁ 브러시 선택 <small>6</small></button>
            <button data-tool="replace">⇄ 교체 <small>7</small></button>
            <button data-tool="paste">▧ 붙여넣기 <small>8</small></button>
            <button data-tool="moveSelection">✥ 선택 이동 <small>9</small></button>
            <div class="point-tool-row">
              <button data-tool="selectA">A 지점 <small>[</small></button>
              <button data-tool="selectB">B 지점 <small>]</small></button>
            </div>
            <div class="special-tool-divider"><span>특수</span></div>
            <button class="special-text-tool" data-generator="text" title="입력한 글자를 블록으로 배치">T 텍스트 블록</button>
            <div class="special-import-row">
              <button id="image-block-tool" class="special-image-tool" data-generator="image" title="PNG/JPG/WebP 이미지를 색상 블록으로 변환">▧ 이미지 블록</button>
              <button id="model-block-tool" class="special-model-tool" data-generator="model" title="OBJ/STL 3D 모델을 블록으로 변환">◇ 3D 모델</button>
            </div>
          </div>
          <div class="tool-detail text-tool-options" data-tool-detail="generate:text">
            <div class="brush-divider">텍스트 특수 기능</div>
            <div class="field">
              <label for="block-text">내용</label>
              <input id="block-text" value="BEDROCK" maxlength="64" spellcheck="false">
            </div>
            <div class="row" style="margin-top:7px">
              <div class="field">
                <label for="block-text-size">글자 크기</label>
                <input id="block-text-size" type="number" min="5" max="64" value="12">
              </div>
              <div class="field">
                <label for="block-text-depth">두께</label>
                <input id="block-text-depth" type="number" min="1" max="16" value="1">
              </div>
            </div>
          </div>
          <div class="tool-detail import-tool-options" data-tool-detail="generate:image">
            <div class="brush-divider">이미지 특수 기능</div>
            <button id="choose-voxel-image">이미지 파일 선택</button>
            <div id="voxel-image-status" class="import-status">PNG, JPG, WebP · 투명 영역 제외</div>
            <div class="row" style="margin-top:7px">
              <div class="field">
                <label for="image-block-width">가로 블록 수</label>
                <input id="image-block-width" type="number" min="1" max="256" value="64">
              </div>
              <div class="field">
                <label for="image-block-depth">두께</label>
                <input id="image-block-depth" type="number" min="1" max="16" value="1">
              </div>
            </div>
          </div>
          <div class="tool-detail import-tool-options" data-tool-detail="generate:model">
            <div class="brush-divider">3D 모델 특수 기능</div>
            <button id="choose-voxel-model">OBJ / STL 파일 선택</button>
            <div id="voxel-model-status" class="import-status">모델의 가장 긴 축을 기준으로 복셀화</div>
            <div class="field" style="margin-top:7px">
              <label for="model-block-size">최대 크기</label>
              <input id="model-block-size" type="number" min="4" max="128" value="32">
            </div>
            <label class="check-field">
              <input id="model-solid" type="checkbox"> 내부도 블록으로 채우기
            </label>
          </div>
          <label class="check-field tool-detail" data-tool-detail="replace">
            <input id="connected-replace" type="checkbox"> 연결된 블록만 교체
          </label>
          <div class="tool-detail" data-tool-detail="sculpt">
            <div class="brush-divider">조형 모드</div>
            <select id="sculpt-mode" aria-label="조형 모드">
              <option value="smooth">부드럽게</option>
              <option value="object_smooth">객체 다듬기</option>
              <option value="object_connect">객체 연결</option>
              <option value="flatten">평탄화</option>
              <option value="natural_flatten">자연 평탄화</option>
              <option value="settle">침하</option>
              <option value="raise">융기</option>
              <option value="lower">깎기</option>
            </select>
            <div class="field" style="margin-top:7px">
              <label for="sculpt-strength">강도 <span id="sculpt-strength-value">1</span></label>
              <input id="sculpt-strength" type="range" min="1" max="8" step="1" value="1">
            </div>
          </div>
          <div class="tool-detail" data-tool-detail="place generate:sphere generate:hollow-sphere generate:circle generate:disc generate:cylinder generate:line generate:curve generate:mountain">
          <div class="brush-divider">배치 도형</div>
          <div class="shape-grid">
            <button id="make-sphere" data-generator="sphere">● 구</button>
            <button id="make-hollow-sphere" data-generator="hollow-sphere">○ 빈 구</button>
            <button id="make-circle" data-generator="circle">◯ 원</button>
            <button id="make-disc" data-generator="disc">⬤ 원판</button>
            <button id="make-cylinder" data-generator="cylinder">▥ 원기둥</button>
            <button id="make-mountain" data-generator="mountain">▲ 산</button>
            <button id="make-line" data-generator="line">╱ A→B 선</button>
            <button id="make-curve" data-generator="curve">⌢ A→B 곡선</button>
          </div>
          </div>
        </section>
        <section class="section" data-utility="workspace" data-utility-group="environment" data-utility-icon="◉" data-utility-label="환경 설정">
          <h2 class="section-title">작업공간 크기</h2>
          <div class="size-grid">
            <label>X<input id="size-x" type="number" min="1" max="65536" value="32"></label>
            <label>Y<input id="size-y" type="number" min="1" max="65536" value="32"></label>
            <label>Z<input id="size-z" type="number" min="1" max="65536" value="32"></label>
          </div>
          <button id="apply-size" style="width:100%;margin-top:6px">크기 적용</button>
          <div class="brush-divider">기준 좌표</div>
          <div class="size-grid">
            <label>X<input id="base-x" type="number" step="1" value="0"></label>
            <label>Y<input id="base-y" type="number" step="1" value="0"></label>
            <label>Z<input id="base-z" type="number" step="1" value="0"></label>
          </div>
          <p class="help">월드 내보내기와 절대 좌표 코드의 시작 위치입니다.</p>
          <p id="bedrock-y-limit-warning" class="help y-limit-warning" hidden></p>
        </section>
        <section class="section" data-utility="camera" data-utility-group="environment" data-utility-icon="◉" data-utility-label="환경 설정">
          <h2 class="section-title">시점 조작</h2>
          <div class="field">
            <label for="camera-speed">이동 속도 <span id="speed-value">64.0 blocks/s</span></label>
            <input id="camera-speed" type="range" min="1" max="1000" step="1" value="64">
          </div>
          <div class="field">
            <label for="fog-density">안개 범위 <span id="fog-value">50%</span></label>
            <input id="fog-density" type="range" min="0" max="100" step="1" value="50">
          </div>
          <div class="field">
            <label for="render-distance">렌더링 거리 <span id="render-distance-value">256 blocks</span></label>
            <input id="render-distance" type="range" min="16" max="1024" step="16" value="256">
          </div>
          <div class="brush-divider">시점 월드 좌표로 이동</div>
          <div class="size-grid">
            <label>X<input id="camera-jump-x" type="number" step="0.01" value="0"></label>
            <label>Y<input id="camera-jump-y" type="number" step="0.01" value="0"></label>
            <label>Z<input id="camera-jump-z" type="number" step="0.01" value="0"></label>
          </div>
          <button id="jump-camera" style="width:100%;margin-top:6px">즉시 이동</button>
          <p class="help"><kbd>WASD</kbd> 이동 · <kbd>Space</kbd> 위 · <kbd>Shift</kbd> 아래</p>
        </section>
        <section class="section" data-utility="textures" data-utility-group="environment" data-utility-icon="◉" data-utility-label="환경 설정">
          <h2 class="section-title">블록 렌더링</h2>
          <div class="row">
            <button id="use-color-rendering">단색</button>
            <button id="use-texture-rendering">마크 텍스처</button>
          </div>
          <button id="install-vanilla-textures" style="width:100%;margin-top:7px">기본 리소스팩 설치·갱신</button>
          <button id="choose-resource-pack" style="width:100%;margin-top:7px">다른 리소스팩 선택</button>
          <p id="texture-pack-status" class="help">기본 리소스팩 확인 중…</p>
        </section>
        <section id="brush-panel" class="section brush-panel" data-tool-panel="place erase lasso sculpt generate:*">
          <h2 class="section-title">브러시</h2>
          <div class="field tool-detail" data-tool-detail="place erase lasso sculpt">
            <label for="brush-size">크기 <span id="brush-size-value">1</span></label>
            <input id="brush-size" type="range" min="1" max="32" step="1" value="1">
          </div>
          <div class="field tool-detail" data-tool-detail="place erase lasso sculpt">
            <label for="brush-shape">기본 모양</label>
            <select id="brush-shape" aria-label="브러시 모양">
              <option value="cube">큐브</option>
              <option value="sphere">둥근형</option>
            </select>
          </div>
          <label class="check-field clipboard-option tool-detail" data-tool-detail="place erase sculpt generate:*">
            <input id="limit-to-selection" type="checkbox"> 선택 안에서만
          </label>
          <label class="check-field tool-detail" data-tool-detail="place generate:*">
            <input id="place-air-only" type="checkbox"> 공기에만 설치
          </label>
          <label class="check-field tool-detail" data-tool-detail="place generate:*">
            <input id="place-solid-only" type="checkbox"> 블록에만 설치
          </label>
          <label class="check-field tool-detail" data-tool-detail="lasso">
            <input id="connected-selection" type="checkbox"> 연결된 같은 블록 선택
          </label>
          <label class="check-field tool-detail" data-tool-detail="lasso">
            <input id="connected-any-selection" type="checkbox"> 연결된 모든 블록 선택
          </label>
          <div class="tool-detail" data-tool-detail="generate:sphere generate:hollow-sphere generate:circle generate:disc generate:cylinder generate:mountain">
          <div class="brush-divider">도형 브러시 옵션</div>
          <div class="row">
            <div class="field">
              <label for="shape-radius">반지름</label>
              <input id="shape-radius" type="number" min="1" max="64" value="5">
            </div>
            <div class="field tool-detail" data-tool-detail="generate:cylinder generate:mountain">
              <label for="shape-height">높이</label>
              <input id="shape-height" type="number" min="1" max="128" value="10">
            </div>
          </div>
          <label class="check-field tool-detail" data-tool-detail="generate:cylinder"><input id="shape-hollow" type="checkbox"> 속이 빈 원기둥</label>
          </div>
          <div class="terrain-options tool-detail" data-tool-detail="generate:mountain">
            <div class="field">
              <label for="mountain-roughness">산 거칠기</label>
              <input id="mountain-roughness" type="range" min="0" max="0.8" step="0.05" value="0.3">
            </div>
            <div class="field">
              <label for="mountain-seed">시드</label>
              <input id="mountain-seed" type="number" value="1">
            </div>
          </div>
          <div class="tool-detail" data-tool-detail="generate:curve">
            <div class="brush-divider">곡선 옵션</div>
            <div class="field">
              <label for="curve-thickness">두께</label>
              <input id="curve-thickness" type="number" min="1" max="16" value="1">
            </div>
            <div class="row" style="margin-top:7px">
              <button id="finish-curve">곡선 완료</button>
              <button id="clear-curve-points">점 초기화</button>
            </div>
            <p id="curve-point-count" class="help">0개 점 · 좌클릭 추가 · 우클릭 완료</p>
          </div>
          <div class="tool-detail" data-tool-detail="generate:line">
            <div class="brush-divider">선 옵션</div>
            <div class="field">
              <label for="line-thickness">두께</label>
              <input id="line-thickness" type="number" min="1" max="16" value="1">
            </div>
          </div>
        </section>
        <section id="block-palette-section" class="section" data-tool-panel="place replace eyedropper generate:* selectBox lasso selectA selectB moveSelection">
          <h2 class="section-title">블록 팔레트</h2>
          <div class="active-block-label">선택: <strong id="active-block">Stone · stone</strong></div>
          <button id="palette-eyedropper" style="width:100%;margin-bottom:7px">◉ 스포이드</button>
          <input id="block-search" class="block-search" placeholder="블록 검색…" spellcheck="false">
          <div id="block-category-tabs" class="block-category-tabs" aria-label="블록 분류">
            <button class="active" data-block-category="all" title="모든 블록">전체</button>
            <button data-block-category="building" title="건축 블록">▦ 건축</button>
            <button data-block-category="nature" title="자연 블록">♣ 자연</button>
            <button data-block-category="functional" title="기능 블록">⚒ 기능</button>
            <button data-block-category="redstone" title="레드스톤 블록">◆ 레드스톤</button>
            <button data-block-category="colored" title="색상별 블록">▨ 색상</button>
          </div>
          <div class="palette-view-row">
            <div id="block-result-count" class="result-count"></div>
            <button id="palette-view-toggle" class="palette-view-toggle" title="아이콘만 크게 모아보기" aria-pressed="false">▦</button>
          </div>
          <div class="palette" id="block-palette">${blocks}</div>
        </section>
      </aside>
      <button id="toggle-project-sidebar" class="project-sidebar-toggle" title="프로젝트 창 접기" aria-label="프로젝트 창 접기" aria-expanded="true">‹</button>
      <section class="viewport">
        <canvas id="scene" tabindex="0"></canvas>
        <div id="bpy-progress" class="bpy-progress" hidden role="status" aria-live="polite">
          <div class="bpy-progress-card">
            <strong id="bpy-progress-title">BedrockPy 코드 생성 중</strong>
            <span id="bpy-progress-detail">준비 중…</span>
            <div class="bpy-progress-track"><i id="bpy-progress-bar"></i></div>
            <b id="bpy-progress-percent">0%</b>
          </div>
        </div>
        <button id="play-mode" class="play-mode-button" title="구조물 안을 1인칭으로 테스트">▶ Play</button>
        <div id="play-hud" class="play-hud">
          <i></i>
          <div class="play-settings">
            <label>시야각 <b id="play-fov-value">70°</b>
              <input id="play-fov" type="range" min="30" max="110" step="1" value="70">
            </label>
            <label>감도 <b id="play-sensitivity-value">100%</b>
              <input id="play-sensitivity" type="range" min="10" max="200" step="1" value="100">
            </label>
          </div>
          <span>좌클릭 드래그 시야 · WASD 이동 · Shift 달리기 · Space 점프 · Esc 종료</span>
        </div>
        <div id="brush-options-dock" class="brush-options-dock"></div>
        <div id="cursor-coordinate" class="cursor-coordinate">X — · Y — · Z —</div>
        <div id="scale-drag-badge" class="scale-drag-badge">1×</div>
        <div id="transform-gizmo" class="transform-gizmo" aria-label="구조물 변형 기즈모">
          <span class="transform-help">화살표 이동 · 링 회전 · 노란 점 전체 크기 · 축 끝 사각형 늘이기</span>
          <button id="cancel-transform" title="변형 취소">×</button>
        </div>
        <div class="viewport-actions">
          <button id="toggle-workspace-ui" class="overlay-toggle" title="편집 도구 패널 표시 전환">도구</button>
          <div id="recent-blocks" class="recent-blocks" aria-label="최근 사용 블록"></div>
        </div>
        <div id="viewport-panels" class="viewport-panels"></div>
        <div id="utility-dock" class="utility-dock">
          <div id="utility-buttons" class="utility-buttons"></div>
          <div id="utility-popover" class="utility-popover"></div>
        </div>
        <div class="axis" id="axis-gizmo">
          <i class="axis-line x"></i><i class="axis-line y"></i><i class="axis-line z"></i>
          <span class="x">X</span><span class="y">Y</span><span class="z">Z</span>
          <b class="axis-origin"></b>
        </div>
      </section>
      <aside class="sidebar right">
        <section class="section" data-tool-panel="selectBox lasso selectA selectB moveSelection">
          <h2 class="section-title">선택 영역</h2>
          <div class="selection-info">
            방식: <span id="selection-mode-label">선택 없음</span><br>
            A: <span id="selection-a">미지정</span><br>
            B: <span id="selection-b">미지정</span>
          </div>
          <label class="check-field clipboard-option">
            <input id="select-solid-only" type="checkbox"> 드래그 영역에서 설치된 블록 칸만 선택
          </label>
          <div class="selection-resize">
            <span>A 좌표</span>
            <div class="size-grid">
              <label>X<input id="selection-a-x" type="number" value="0"></label>
              <label>Y<input id="selection-a-y" type="number" value="0"></label>
              <label>Z<input id="selection-a-z" type="number" value="0"></label>
            </div>
            <span>B 좌표</span>
            <div class="size-grid">
              <label>X<input id="selection-b-x" type="number" value="0"></label>
              <label>Y<input id="selection-b-y" type="number" value="0"></label>
              <label>Z<input id="selection-b-z" type="number" value="0"></label>
            </div>
            <button id="apply-selection-points">A/B 좌표 적용</button>
            <button id="clear-selection-shape">선택 해제</button>
          </div>
          <div class="row" style="margin-top:7px">
            <button id="fill-selection">선택 채우기</button>
            <button id="clear-selection">선택 비우기</button>
          </div>
          <div class="row" style="margin-top:7px">
            <button id="copy-selection">복사</button>
            <button id="cut-selection">잘라내기</button>
            <button id="paste-selection">붙여넣기</button>
          </div>
        </section>
        <section class="section" data-tool-panel="paste">
          <h2 class="section-title">클립보드</h2>
          <label class="check-field clipboard-option">
            <input id="paste-air" type="checkbox"> 붙여넣을 때 공기도 적용하여 기존 블록 삭제
          </label>
          <span id="clipboard-count" class="clipboard-count">0 blocks</span>
        </section>
        <section class="section" data-tool-panel="selectBox lasso selectA selectB moveSelection">
          <h2 class="section-title">선택 영역 변형</h2>
          <div class="tool-grid">
            <button id="rotate-y">Y축 90°</button>
            <button id="mirror-x">X 대칭</button>
            <button id="mirror-z">Z 대칭</button>
            <button class="danger" id="clear-all">선택 삭제</button>
          </div>
          <div class="row" style="margin-top:7px">
            <input id="extrude-amount" type="number" min="-64" max="64" value="1" aria-label="돌출 높이">
            <button id="extrude-selection">선택 돌출</button>
          </div>
        </section>
        <section class="section" data-tool-panel="selectBox lasso selectA selectB moveSelection">
          <h2 class="section-title">선택 지형 조작</h2>
          <div class="field">
            <label for="selection-sculpt-mode">조형 모드</label>
            <select id="selection-sculpt-mode" aria-label="선택 지형 조형 모드">
              <option value="smooth">부드럽게</option>
              <option value="object_smooth">객체 다듬기</option>
              <option value="object_connect">객체 연결</option>
              <option value="flatten">평탄화</option>
              <option value="natural_flatten">자연 평탄화</option>
              <option value="settle">침하</option>
              <option value="raise">융기</option>
              <option value="lower">깎기</option>
            </select>
          </div>
          <div class="field">
            <label for="selection-sculpt-strength">강도 <span id="selection-sculpt-strength-value">1</span></label>
            <input id="selection-sculpt-strength" type="range" min="1" max="8" step="1" value="1">
          </div>
          <button id="apply-selection-sculpt" style="width:100%;margin-top:7px">선택 영역에 적용</button>
          <p class="help">조형 도구와 같은 방식으로 선택 영역 전체에 적용합니다.</p>
        </section>
        <section class="section" data-utility="time" data-utility-group="environment" data-utility-icon="◉" data-utility-label="환경 설정">
          <h2 class="section-title">미리보기 시간대</h2>
          <input id="time-of-day" type="range" min="0" max="23999" step="100" value="6000">
          <div id="time-value" class="time-value">12:00 · 6000 ticks</div>
        </section>
        <section class="section" data-utility="code" data-utility-group="information" data-utility-icon="ⓘ" data-utility-label="코드·정보">
          <h2 class="section-title">코드 생성</h2>
          <div class="field">
            <label for="function-name">함수 이름</label>
            <input id="function-name" value="build_structure" spellcheck="false">
          </div>
          <p class="help">연속된 블록은 자동으로 <kbd>/fill</kbd>로 합치고 나머지는 <kbd>/setblock</kbd>으로 생성합니다.</p>
        </section>
        <section class="section" data-utility="stats" data-utility-group="information" data-utility-icon="ⓘ" data-utility-label="코드·정보">
          <h2 class="section-title">통계</h2>
          <div class="stat-list">
            <div class="stat"><span>블록</span><b id="block-count">0</b></div>
            <div class="stat"><span>종류</span><b id="type-count">0</b></div>
          </div>
        </section>
        <section class="section" data-utility="help" data-utility-group="information" data-utility-icon="ⓘ" data-utility-label="코드·정보">
          <h2 class="section-title">조작법</h2>
          <p class="help">
            <kbd>클릭</kbd> 블록 배치<br>
            <kbd>우클릭</kbd> 블록 삭제<br>
            <kbd>Alt+드래그</kbd> 카메라 회전<br>
            <kbd>휠</kbd> 확대·축소<br>
            <kbd>WASD</kbd> 시점 이동<br>
            <kbd>Space/Shift</kbd> 위/아래<br>
            <kbd>⌘/Ctrl Z</kbd> 실행 취소
          </p>
        </section>
      </aside>
    </div>
    <footer class="statusbar">
      <span><strong id="dirty-state">저장됨</strong> · WebGL voxel workspace</span>
      <span id="status-count">0 blocks</span>
    </footer>
  </div>
  <script nonce="${token}" src="${scriptUri}"></script>
</body>
</html>`;
}

class LittleEndianNbtReader {
  constructor(bytes) {
    this.buffer = Buffer.from(bytes);
    this.offset = 0;
  }
  ensure(length) {
    if (this.offset + length > this.buffer.length) throw new Error('NBT 데이터가 중간에서 끝났습니다');
  }
  byte() { this.ensure(1); return this.buffer.readInt8(this.offset++); }
  uint8() { this.ensure(1); return this.buffer.readUInt8(this.offset++); }
  int16() { this.ensure(2); const value = this.buffer.readInt16LE(this.offset); this.offset += 2; return value; }
  uint16() { this.ensure(2); const value = this.buffer.readUInt16LE(this.offset); this.offset += 2; return value; }
  int32() { this.ensure(4); const value = this.buffer.readInt32LE(this.offset); this.offset += 4; return value; }
  int64() { this.ensure(8); const value = this.buffer.readBigInt64LE(this.offset); this.offset += 8; return Number(value); }
  float() { this.ensure(4); const value = this.buffer.readFloatLE(this.offset); this.offset += 4; return value; }
  double() { this.ensure(8); const value = this.buffer.readDoubleLE(this.offset); this.offset += 8; return value; }
  string() {
    const length = this.uint16();
    this.ensure(length);
    const value = this.buffer.toString('utf8', this.offset, this.offset + length);
    this.offset += length;
    return value;
  }
  payload(type) {
    if (type === 1) return this.byte();
    if (type === 2) return this.int16();
    if (type === 3) return this.int32();
    if (type === 4) return this.int64();
    if (type === 5) return this.float();
    if (type === 6) return this.double();
    if (type === 7) {
      const length = this.int32();
      this.ensure(length);
      const value = [...this.buffer.subarray(this.offset, this.offset + length)];
      this.offset += length;
      return value;
    }
    if (type === 8) return this.string();
    if (type === 9) {
      const childType = this.uint8();
      const length = this.int32();
      if (length < 0 || length > 100000000) throw new Error('잘못된 NBT 목록 길이입니다');
      return Array.from({ length }, () => this.payload(childType));
    }
    if (type === 10) {
      const value = {};
      while (true) {
        const childType = this.uint8();
        if (childType === 0) break;
        value[this.string()] = this.payload(childType);
      }
      return value;
    }
    if (type === 11) {
      const length = this.int32();
      if (length < 0 || length > 100000000) throw new Error('잘못된 NBT int 배열 길이입니다');
      return Array.from({ length }, () => this.int32());
    }
    if (type === 12) {
      const length = this.int32();
      if (length < 0 || length > 10000000) throw new Error('잘못된 NBT long 배열 길이입니다');
      return Array.from({ length }, () => this.int64());
    }
    throw new Error(`지원하지 않는 NBT 태그입니다: ${type}`);
  }
  root() {
    const type = this.uint8();
    if (type !== 10) throw new Error('mcstructure 루트가 Compound 태그가 아닙니다');
    this.string();
    return this.payload(type);
  }
}

function decodeMcstructure(bytes) {
  const root = new LittleEndianNbtReader(bytes).root();
  const size = root.size;
  const structure = root.structure;
  const palette = structure?.palette?.default?.block_palette;
  const layers = structure?.block_indices;
  if (!Array.isArray(size) || size.length < 3 || !Array.isArray(palette) || !Array.isArray(layers?.[0])) {
    throw new Error('Bedrock mcstructure의 size, palette 또는 block_indices를 찾지 못했습니다');
  }
  const [sizeX, sizeY, sizeZ] = size.map(Number);
  const blocks = [];
  const primaryLayer = layers[0];
  for (let x = 0; x < sizeX; x++) {
    for (let y = 0; y < sizeY; y++) {
      for (let z = 0; z < sizeZ; z++) {
        const flatIndex = x * sizeY * sizeZ + y * sizeZ + z;
        const paletteIndex = primaryLayer[flatIndex];
        if (paletteIndex == null || paletteIndex < 0) continue;
        const name = palette[paletteIndex]?.name;
        if (!name || name === 'minecraft:air') continue;
        blocks.push({ x, y, z, type: name.replace(/^minecraft:/, '') });
      }
    }
  }
  return { version: 1, size: { x: sizeX, y: sizeY, z: sizeZ }, blocks };
}

async function readStructure(uri) {
  try {
    const bytes = await vscode.workspace.fs.readFile(uri);
    const isMcstructure = path.extname(uri.fsPath).toLowerCase() === '.mcstructure';
    const data = isMcstructure
      ? decodeMcstructure(bytes)
      : JSON.parse(Buffer.from(bytes).toString('utf8'));
    if (!data || (isMcstructure ? !Array.isArray(data.blocks) : !Array.isArray(data.chunks)))
      throw new Error(isMcstructure ? 'blocks 데이터가 없습니다' : '새 chunks 형식이 아닌 .bpstructure 파일입니다');
    return data;
  } catch (error) {
    vscode.window.showErrorMessage(`구조물 파일을 열 수 없습니다: ${error.message}`);
    return undefined;
  }
}

async function sendStructure(panel, uri) {
  if (!uri) {
    panel.webview.postMessage({ type: 'load', data: { size: { x: 32, y: 32, z: 32 }, blockTypes: {}, chunks: [] }, fileName: '새 구조물' });
    return;
  }
  const data = await readStructure(uri);
  if (data) panel.webview.postMessage({ type: 'load', data, fileName: path.basename(uri.fsPath) });
}

function safeProjectTarget(relativePath) {
  if (!structureProjectUri) throw new Error('먼저 프로젝트 폴더를 열어주세요');
  const root = path.resolve(structureProjectUri.fsPath);
  const target = path.resolve(root, String(relativePath || ''));
  if (target !== root && !target.startsWith(root + path.sep)) throw new Error('프로젝트 폴더 밖의 경로는 사용할 수 없습니다');
  return vscode.Uri.file(target);
}

async function listStructureProject() {
  if (!structureProjectUri) return;
  const entries = [];
  const ignored = new Set(['.git', 'node_modules', 'build', 'dist', '.bedrockpy']);
  const visit = async (folderUri, relative = '') => {
    const children = await vscode.workspace.fs.readDirectory(folderUri);
    children.sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0]));
    for (const [name, type] of children) {
      if (name.startsWith('.') || ignored.has(name)) continue;
      const childRelative = relative ? `${relative}/${name}` : name;
      const isDirectory = type === vscode.FileType.Directory;
      entries.push({
        path: childRelative,
        name,
        directory: isDirectory,
        structure: !isDirectory && /\.(?:bpstructure|mcstructure)$/i.test(name)
      });
      if (isDirectory && entries.length < 2000) await visit(vscode.Uri.joinPath(folderUri, name), childRelative);
      if (entries.length >= 2000) break;
    }
  };
  await visit(structureProjectUri);
  structurePanel?.webview.postMessage({
    type: 'project',
    rootName: path.basename(structureProjectUri.fsPath),
    rootPath: structureProjectUri.fsPath,
    currentPath: structureUri && structureUri.fsPath.startsWith(structureProjectUri.fsPath + path.sep)
      ? path.relative(structureProjectUri.fsPath, structureUri.fsPath).replace(/\\/g, '/')
      : null,
    entries
  });
}

function watchStructureProject(context) {
  structureProjectWatcher?.dispose();
  structureProjectWatcher = undefined;
  if (!structureProjectUri) return;
  const watcher = vscode.workspace.createFileSystemWatcher(
    new vscode.RelativePattern(structureProjectUri, '**/*.{bpstructure,mcstructure}')
  );
  let refreshTimer;
  const refresh = () => {
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(() => listStructureProject().catch(() => {}), 120);
  };
  watcher.onDidCreate(refresh);
  watcher.onDidChange(refresh);
  watcher.onDidDelete(refresh);
  structureProjectWatcher = watcher;
  context.subscriptions.push(watcher);
}

function runFile(command, args) {
  return new Promise((resolve, reject) => {
    cp.execFile(command, args, { maxBuffer: 8 * 1024 * 1024 }, (error, stdout, stderr) => {
      if (error) reject(new Error(String(stderr || error.message).trim()));
      else resolve(stdout);
    });
  });
}

function textureCachePath(context, name) {
  return path.join(context.globalStorageUri.fsPath, 'texture-packs', name);
}

function findResourcePackRoot(root) {
  const direct = [
    root,
    path.join(root, 'resource_pack')
  ];
  for (const candidate of direct) {
    if (fs.existsSync(path.join(candidate, 'textures', 'blocks'))) return candidate;
  }
  if (!fs.existsSync(root)) return null;
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const candidate = path.join(root, entry.name);
    if (fs.existsSync(path.join(candidate, 'textures', 'blocks'))) return candidate;
  }
  return null;
}

function firstTexturePath(value) {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = firstTexturePath(item);
      if (found) return found;
    }
  }
  if (value && typeof value === 'object') {
    if (typeof value.path === 'string') return value.path;
    for (const key of ['side', 'up', 'north', 'west', 'down']) {
      const found = firstTexturePath(value[key]);
      if (found) return found;
    }
    if (value.textures) return firstTexturePath(value.textures);
  }
  return null;
}

function parseJsonWithComments(filePath) {
  const source = fs.readFileSync(filePath, 'utf8');
  let output = '';
  let inString = false;
  let escaped = false;
  for (let index = 0; index < source.length; index++) {
    const char = source[index];
    const next = source[index + 1];
    if (inString) {
      output += char;
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') {
      inString = true;
      output += char;
      continue;
    }
    if (char === '/' && next === '/') {
      while (index < source.length && source[index] !== '\n') index++;
      output += '\n';
      continue;
    }
    if (char === '/' && next === '*') {
      index += 2;
      while (index < source.length - 1 && !(source[index] === '*' && source[index + 1] === '/')) index++;
      index++;
      continue;
    }
    output += char;
  }
  return JSON.parse(output.replace(/,\s*([}\]])/g, '$1'));
}

function buildBlockTextureMap(webview, packRoot) {
  const blocksFolder = path.join(packRoot, 'textures', 'blocks');
  const terrainFile = path.join(packRoot, 'textures', 'terrain_texture.json');
  const blocksFile = path.join(packRoot, 'blocks.json');
  const terrain = fs.existsSync(terrainFile) ? parseJsonWithComments(terrainFile) : {};
  const blockDefinitions = fs.existsSync(blocksFile) ? parseJsonWithComments(blocksFile) : {};
  const terrainPaths = new Map();
  for (const [name, definition] of Object.entries(terrain.texture_data || {})) {
    const texturePath = firstTexturePath(definition);
    if (texturePath) terrainPaths.set(name, texturePath);
  }
  const mapping = {};
  const encodedTextures = new Map();
  const encodePath = texturePath => {
    if (!texturePath) return null;
    let resolved = path.resolve(packRoot, texturePath.replace(/\//g, path.sep));
    if (!path.extname(resolved)) {
      if (fs.existsSync(resolved + '.png')) resolved += '.png';
      else if (fs.existsSync(resolved + '.tga')) resolved += '.tga';
      else resolved += '.png';
    }
    if (path.extname(resolved).toLowerCase() === '.tga' && fs.existsSync(resolved) && process.platform === 'darwin') {
      const relative = path.relative(packRoot, resolved).replace(/\.tga$/i, '.png');
      const converted = path.join(packRoot, '.bedrockpy_png', relative);
      if (!fs.existsSync(converted)) {
        fs.mkdirSync(path.dirname(converted), { recursive: true });
        const conversion = cp.spawnSync('/usr/bin/sips', ['-s', 'format', 'png', resolved, '--out', converted],
          { encoding: 'utf8' });
        if (conversion.status === 0) resolved = converted;
      } else {
        resolved = converted;
      }
    }
    if (!fs.existsSync(resolved) || path.extname(resolved).toLowerCase() !== '.png') return null;
    // globalStorage의 vscode-webview URI는 일부 VS Code/WebKit 조합에서 검은
    // 이미지로 실패한다. Vanilla PNG는 매우 작으므로 data URI로 직접 전달한다.
    let dataUri = encodedTextures.get(resolved);
    if (!dataUri) {
      dataUri = `data:image/png;base64,${fs.readFileSync(resolved).toString('base64')}`;
      encodedTextures.set(resolved, dataUri);
    }
    return dataUri;
  };
  const resolveTexture = textureName => encodePath(terrainPaths.get(textureName) || textureName);
  const addPath = (blockId, texturePath) => {
    const dataUri = encodePath(texturePath);
    if (dataUri) mapping[blockId.replace(/^minecraft:/, '').toLowerCase()] = dataUri;
  };
  for (const [blockId, definition] of Object.entries(blockDefinitions)) {
    const textureDefinition = definition?.textures;
    if (textureDefinition && typeof textureDefinition === 'object' && !Array.isArray(textureDefinition)) {
      const faces = {};
      for (const face of ['up', 'down', 'side', 'north', 'south', 'east', 'west']) {
        const dataUri = resolveTexture(firstTexturePath(textureDefinition[face]));
        if (dataUri) faces[face] = dataUri;
      }
      const fallbackUri = resolveTexture(firstTexturePath(textureDefinition));
      if (fallbackUri) faces.all = fallbackUri;
      if (Object.keys(faces).length) mapping[blockId.replace(/^minecraft:/, '').toLowerCase()] = faces;
    } else {
      const dataUri = resolveTexture(firstTexturePath(textureDefinition));
      if (dataUri) mapping[blockId.replace(/^minecraft:/, '').toLowerCase()] = dataUri;
    }
  }
  const grassUp = resolveTexture('grass_top');
  const grassSide = encodePath('textures/blocks/grass_side_carried') || resolveTexture('grass_side');
  const dirt = resolveTexture('dirt');
  if (grassUp || grassSide || dirt) {
    const grassFaces = { up: grassUp, side: grassSide, down: dirt };
    Object.keys(grassFaces).forEach(face => { if (!grassFaces[face]) delete grassFaces[face]; });
    mapping.grass_block = grassFaces;
    mapping.grass = grassFaces;
  }
  const glassColors = [
    'white', 'orange', 'magenta', 'light_blue', 'yellow', 'lime', 'pink', 'gray',
    'light_gray', 'cyan', 'purple', 'blue', 'brown', 'green', 'red', 'black'
  ];
  for (const color of glassColors) {
    const glassId = `${color}_stained_glass`;
    const paneId = `${glassId}_pane`;
    if (mapping[glassId]) mapping[`hard_${glassId}`] = mapping[glassId];
    if (mapping[paneId]) mapping[`hard_${paneId}`] = mapping[paneId];
  }
  if (fs.existsSync(blocksFolder)) {
    for (const name of fs.readdirSync(blocksFolder)) {
      if (path.extname(name).toLowerCase() !== '.png') continue;
      const id = path.basename(name, '.png').toLowerCase();
      if (!mapping[id]) addPath(id, `textures/blocks/${name}`);
    }
  }
  return mapping;
}

async function sendTexturePack(panel, context, cacheName, label) {
  const root = findResourcePackRoot(textureCachePath(context, cacheName));
  if (!root) {
    panel.webview.postMessage({ type: 'texturePackStatus', status: 'missing', label });
    return false;
  }
  let mapping = {};
  if (cacheName === 'custom') {
    const vanillaRoot = findResourcePackRoot(textureCachePath(context, 'vanilla'));
    if (vanillaRoot) mapping = buildBlockTextureMap(panel.webview, vanillaRoot);
  }
  mapping = { ...mapping, ...buildBlockTextureMap(panel.webview, root) };
  panel.webview.postMessage({ type: 'texturePack', label, mapping });
  return true;
}

async function getVanillaTextureManifest() {
  const headers = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'BedrockPy-VSCode'
  };
  const releaseResponse = await fetch('https://api.github.com/repos/Mojang/bedrock-samples/releases/latest', { headers });
  if (!releaseResponse.ok) throw new Error(`Mojang 릴리스 조회 실패: HTTP ${releaseResponse.status}`);
  const release = await releaseResponse.json();
  const ref = String(release.tag_name || '').trim();
  if (!ref) throw new Error('Mojang 최신 릴리스 태그를 찾지 못했습니다.');
  const treeResponse = await fetch(
    `https://api.github.com/repos/Mojang/bedrock-samples/git/trees/${encodeURIComponent(ref)}?recursive=1`,
    { headers }
  );
  if (!treeResponse.ok) throw new Error(`Mojang 파일 목록 조회 실패: HTTP ${treeResponse.status}`);
  const tree = await treeResponse.json();
  if (tree.truncated) throw new Error('Mojang 리소스팩 파일 목록이 잘렸습니다. 잠시 후 다시 시도해 주세요.');
  const files = (tree.tree || []).filter(entry => entry.type === 'blob' && (
    entry.path === 'resource_pack/blocks.json' ||
    entry.path === 'resource_pack/textures/terrain_texture.json' ||
    /^resource_pack\/textures\/blocks\/.*\.(?:png|tga)$/i.test(entry.path)
  ));
  if (!files.some(entry => entry.path === 'resource_pack/blocks.json') ||
      !files.some(entry => entry.path === 'resource_pack/textures/terrain_texture.json') ||
      !files.some(entry => /\.png$/i.test(entry.path))) {
    throw new Error('Mojang 릴리스에서 필요한 블록 텍스처 파일을 찾지 못했습니다.');
  }
  return { ref, files };
}

async function downloadVanillaTextures(manifest, destination, onProgress = () => {}) {
  const files = manifest.files;
  let nextIndex = 0;
  let completed = 0;
  const worker = async () => {
    while (true) {
      const index = nextIndex++;
      if (index >= files.length) return;
      const entry = files[index];
      const encodedPath = entry.path.split('/').map(encodeURIComponent).join('/');
      const url = `https://raw.githubusercontent.com/Mojang/bedrock-samples/${encodeURIComponent(manifest.ref)}/${encodedPath}`;
      const response = await fetch(url, { headers: { 'User-Agent': 'BedrockPy-VSCode' } });
      if (!response.ok) throw new Error(`텍스처 다운로드 실패 (${entry.path}): HTTP ${response.status}`);
      const target = path.join(destination, ...entry.path.split('/'));
      await fs.promises.mkdir(path.dirname(target), { recursive: true });
      await fs.promises.writeFile(target, Buffer.from(await response.arrayBuffer()));
      completed++;
      if (completed % 100 === 0 || completed === files.length) onProgress(completed, files.length);
    }
  };
  await Promise.all(Array.from({ length: 12 }, () => worker()));
}

async function installVanillaTextures(panel, context, force = false) {
  const cache = textureCachePath(context, 'vanilla');
  if (force || !findResourcePackRoot(cache)) {
    panel.webview.postMessage({ type: 'texturePackStatus', status: 'loading', label: 'Mojang Vanilla' });
    const staging = `${cache}.download-${Date.now()}`;
    await fs.promises.mkdir(path.dirname(cache), { recursive: true });
    try {
      const manifest = await getVanillaTextureManifest();
      await downloadVanillaTextures(manifest, staging, (completed, total) => {
        panel.webview.postMessage({
          type: 'texturePackStatus',
          status: 'loading',
          label: `Mojang Vanilla ${completed.toLocaleString()} / ${total.toLocaleString()}`
        });
      });
      await fs.promises.rm(cache, { recursive: true, force: true });
      await fs.promises.rename(staging, cache);
    } catch (error) {
      await fs.promises.rm(staging, { recursive: true, force: true });
      throw error;
    }
  }
  await sendTexturePack(panel, context, 'vanilla', 'Mojang Vanilla');
}

async function openStructureEditor(context, initialUri) {
  if (structurePanel) {
    structurePanel.reveal(vscode.ViewColumn.Beside);
    if (initialUri) {
      structureUri = initialUri;
      await sendStructure(structurePanel, structureUri);
    }
    return;
  }
  const rememberedProject = context.workspaceState.get('bedrockpy.structureProject');
  if (!structureProjectUri && rememberedProject && fs.existsSync(rememberedProject)) {
    structureProjectUri = vscode.Uri.file(rememberedProject);
  }
  if (!structureProjectUri && vscode.workspace.workspaceFolders?.[0]) {
    structureProjectUri = vscode.workspace.workspaceFolders[0].uri;
  }
  watchStructureProject(context);
  structureContext = context;
  structureUri = initialUri;
  structurePanel = vscode.window.createWebviewPanel(
    'bedrockpyStructureEditor',
    'BedrockPy 3D 구조물 편집기',
    vscode.ViewColumn.Beside,
    {
      enableScripts: true,
      retainContextWhenHidden: true,
      localResourceRoots: [
        vscode.Uri.file(context.asAbsolutePath('media')),
        context.globalStorageUri
      ]
    }
  );
  structurePanel.webview.html = structureEditorHtml(structurePanel.webview, context);
  // 생성 직후 웹뷰를 명시적으로 포커스한 다음 별도 VS Code 창으로 이동한다.
  structurePanel.reveal(vscode.ViewColumn.Beside, false);
  await vscode.commands.executeCommand('workbench.action.moveEditorToNewWindow');
  structurePanel.onDidDispose(() => {
    structurePanel = undefined;
    structureUri = undefined;
    structureProjectUri = undefined;
    structureProjectWatcher?.dispose();
    structureProjectWatcher = undefined;
  });
  structurePanel.webview.onDidReceiveMessage(async message => {
    if (message.type === 'ready') {
      await sendStructure(structurePanel, structureUri);
      await listStructureProject();
      const preferredTextures = context.workspaceState.get('bedrockpy.texturePack', 'vanilla');
      const loadPreferredTextures = async () => {
        if (preferredTextures === 'custom' &&
            await sendTexturePack(structurePanel, context, 'custom', '사용자 리소스팩')) return;
        await installVanillaTextures(structurePanel, context);
      };
      loadPreferredTextures().catch(error => {
        structurePanel?.webview.postMessage({
          type: 'texturePackStatus',
          status: 'error',
          label: `기본 리소스팩 오류: ${error.message}`
        });
      });
      return;
    }
    if (message.type === 'chooseVoxelImage') {
      const selected = await vscode.window.showOpenDialog({
        canSelectFiles: true,
        canSelectFolders: false,
        canSelectMany: false,
        filters: { '이미지': ['png', 'jpg', 'jpeg', 'webp'] },
        openLabel: '이미지를 블록으로 불러오기'
      });
      if (!selected?.[0]) return;
      const bytes = await vscode.workspace.fs.readFile(selected[0]);
      const extension = path.extname(selected[0].fsPath).toLowerCase();
      const mime = extension === '.png' ? 'image/png'
        : extension === '.webp' ? 'image/webp' : 'image/jpeg';
      structurePanel.webview.postMessage({
        type: 'voxelImageLoaded',
        fileName: path.basename(selected[0].fsPath),
        mime,
        data: Buffer.from(bytes).toString('base64')
      });
      return;
    }
    if (message.type === 'chooseVoxelModel') {
      const selected = await vscode.window.showOpenDialog({
        canSelectFiles: true,
        canSelectFolders: false,
        canSelectMany: false,
        filters: { '3D 모델': ['obj', 'stl'] },
        openLabel: '3D 모델을 블록으로 불러오기'
      });
      if (!selected?.[0]) return;
      const bytes = await vscode.workspace.fs.readFile(selected[0]);
      structurePanel.webview.postMessage({
        type: 'voxelModelLoaded',
        fileName: path.basename(selected[0].fsPath),
        extension: path.extname(selected[0].fsPath).toLowerCase(),
        data: Buffer.from(bytes).toString('base64')
      });
      return;
    }
    if (message.type === 'installVanillaTextures') {
      try {
        await installVanillaTextures(structurePanel, context, Boolean(message.force));
        await context.workspaceState.update('bedrockpy.texturePack', 'vanilla');
      } catch (error) {
        structurePanel.webview.postMessage({
          type: 'texturePackStatus', status: 'error', label: error.message
        });
      }
      return;
    }
    if (message.type === 'chooseResourcePack') {
      const selected = await vscode.window.showOpenDialog({
        canSelectFiles: true,
        canSelectFolders: true,
        canSelectMany: false,
        filters: { 'Bedrock 리소스팩': ['mcpack', 'zip'] },
        openLabel: '리소스팩 적용'
      });
      if (!selected?.[0]) return;
      const destination = textureCachePath(context, 'custom');
      try {
        structurePanel.webview.postMessage({
          type: 'texturePackStatus', status: 'loading', label: '사용자 리소스팩'
        });
        if (fs.existsSync(destination)) fs.rmSync(destination, { recursive: true, force: true });
        fs.mkdirSync(destination, { recursive: true });
        const source = selected[0].fsPath;
        const stat = fs.statSync(source);
        if (stat.isDirectory()) fs.cpSync(source, destination, { recursive: true });
        else await runFile('unzip', ['-oq', source, '-d', destination]);
        if (!await sendTexturePack(structurePanel, context, 'custom', path.basename(source))) {
          throw new Error('textures/blocks 폴더를 찾을 수 없습니다.');
        }
        await context.workspaceState.update('bedrockpy.texturePack', 'custom');
      } catch (error) {
        structurePanel.webview.postMessage({
          type: 'texturePackStatus', status: 'error', label: error.message
        });
      }
      return;
    }
    if (message.type === 'openProject') {
      const selected = await vscode.window.showOpenDialog({
        canSelectFiles: false,
        canSelectFolders: true,
        canSelectMany: false,
        openLabel: '구조물 프로젝트 열기'
      });
      if (!selected?.[0]) return;
      structureProjectUri = selected[0];
      await context.workspaceState.update('bedrockpy.structureProject', structureProjectUri.fsPath);
      watchStructureProject(context);
      structureUri = undefined;
      await listStructureProject();
      structurePanel.webview.postMessage({ type: 'projectReady' });
      return;
    }
    if (message.type === 'refreshProject') {
      await listStructureProject();
      return;
    }
    if (message.type === 'projectOpenFile') {
      const requestId = Number(message.requestId) || 0;
      latestProjectOpenRequestId = requestId;
      const target = safeProjectTarget(message.path);
      if (!/\.(?:bpstructure|mcstructure)$/i.test(target.fsPath)) return;
      const targetIsMcstructure = path.extname(target.fsPath).toLowerCase() === '.mcstructure';
      if (message.draftData && (targetIsMcstructure
        ? Array.isArray(message.draftData.blocks)
        : Array.isArray(message.draftData.chunks))) {
        if (requestId !== latestProjectOpenRequestId) return;
        structureUri = target;
        structurePanel.webview.postMessage({
          type: 'load',
          data: message.draftData,
          fileName: path.basename(target.fsPath),
          projectPath: String(message.path),
          requestId,
          draft: true
        });
      } else {
        const data = await readStructure(target);
        if (requestId !== latestProjectOpenRequestId) return;
        if (data) {
          structureUri = target;
          structurePanel.webview.postMessage({
            type: 'load',
            data,
            fileName: path.basename(target.fsPath),
            projectPath: String(message.path),
            requestId
          });
        } else {
          structurePanel.webview.postMessage({
            type: 'projectOpenFailed',
            projectPath: String(message.path),
            requestId
          });
        }
      }
      await listStructureProject();
      return;
    }
    if (message.type === 'requestProjectNew') {
      const parent = String(message.parentPath || '').replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
      const defaultPath = parent ? `${parent}/structure.bpstructure` : 'structure.bpstructure';
      const value = await vscode.window.showInputBox({
        title: '새 구조물 만들기',
        prompt: parent ? `'${parent}' 폴더 안에 만들 구조물 이름을 입력하세요.` : '프로젝트에 만들 구조물 경로를 입력하세요.',
        value: defaultPath,
        valueSelection: [parent ? parent.length + 1 : 0, defaultPath.length - '.bpstructure'.length],
        ignoreFocusOut: true,
        validateInput: input => input.trim() ? undefined : '구조물 이름을 입력하세요.'
      });
      if (!value?.trim()) return;
      message = { type: 'projectNew', path: value.trim() };
    }
    if (message.type === 'requestProjectNewFolder') {
      const parent = String(message.parentPath || '').replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
      const defaultPath = parent ? `${parent}/folder` : 'folder';
      const value = await vscode.window.showInputBox({
        title: '새 프로젝트 폴더 만들기',
        prompt: parent ? `'${parent}' 안에 만들 하위 폴더 이름을 입력하세요.` : '프로젝트에 만들 폴더 경로를 입력하세요.',
        value: defaultPath,
        valueSelection: [parent ? parent.length + 1 : 0, defaultPath.length],
        ignoreFocusOut: true,
        validateInput: input => input.trim() ? undefined : '폴더 이름을 입력하세요.'
      });
      if (!value?.trim()) return;
      message = { type: 'projectNewFolder', path: value.trim() };
    }
    if (message.type === 'requestProjectRename') {
      const oldPath = String(message.path || '').trim();
      if (!oldPath) return;
      const value = await vscode.window.showInputBox({
        title: '프로젝트 항목 이름 변경',
        prompt: '프로젝트 상대 경로나 이름을 변경하세요.',
        value: oldPath,
        valueSelection: [oldPath.lastIndexOf('/') + 1, oldPath.length],
        ignoreFocusOut: true,
        validateInput: input => input.trim() ? undefined : '새 이름을 입력하세요.'
      });
      if (!value?.trim() || value.trim() === oldPath) return;
      message = { type: 'projectRename', path: oldPath, newPath: value.trim() };
    }
    if (message.type === 'requestProjectDelete') {
      const relative = String(message.path || '').trim();
      if (!relative) return;
      const answer = await vscode.window.showWarningMessage(
        `'${relative}'을 시스템 휴지통으로 보낼까요?`,
        { modal: true },
        '휴지통으로 이동'
      );
      if (answer !== '휴지통으로 이동') return;
      message = { type: 'projectDelete', path: relative };
    }
    if (message.type === 'projectNew') {
      let relative = String(message.path || 'structure.bpstructure').trim().replace(/\\/g, '/');
      if (!relative.toLowerCase().endsWith('.bpstructure')) relative += '.bpstructure';
      const target = safeProjectTarget(relative);
      try {
        await vscode.workspace.fs.stat(target);
        vscode.window.showErrorMessage(`이미 존재하는 파일입니다: ${relative}`);
        return;
      } catch {}
      try {
        await vscode.workspace.fs.createDirectory(vscode.Uri.file(path.dirname(target.fsPath)));
        const empty = { size: { x: 32, y: 32, z: 32 }, blockTypes: {}, chunks: [] };
        await vscode.workspace.fs.writeFile(target, Buffer.from(JSON.stringify(empty, null, 2) + '\n', 'utf8'));
        structureUri = target;
        await sendStructure(structurePanel, target);
        await listStructureProject();
      } catch (error) {
        vscode.window.showErrorMessage(`구조물을 만들 수 없습니다: ${error.message}`);
      }
      return;
    }
    if (message.type === 'projectNewFolder') {
      try {
        await vscode.workspace.fs.createDirectory(safeProjectTarget(message.path));
        await listStructureProject();
      } catch (error) {
        vscode.window.showErrorMessage(`프로젝트 폴더를 만들 수 없습니다: ${error.message}`);
      }
      return;
    }
    if (message.type === 'projectRename') {
      try {
        const source = safeProjectTarget(message.path);
        const destination = safeProjectTarget(message.newPath);
        await vscode.workspace.fs.createDirectory(vscode.Uri.file(path.dirname(destination.fsPath)));
        await vscode.workspace.fs.rename(source, destination, { overwrite: false });
        if (structureUri?.fsPath === source.fsPath) structureUri = destination;
        else if (structureUri?.fsPath.startsWith(source.fsPath + path.sep)) {
          structureUri = vscode.Uri.file(destination.fsPath + structureUri.fsPath.slice(source.fsPath.length));
        }
        structurePanel.webview.postMessage({
          type: 'projectEntryRenamed',
          oldPath: String(message.path),
          newPath: String(message.newPath)
        });
        await listStructureProject();
      } catch (error) {
        vscode.window.showErrorMessage(`이름을 변경할 수 없습니다: ${error.message}`);
      }
      return;
    }
    if (message.type === 'projectDelete') {
      try {
        const target = safeProjectTarget(message.path);
        await vscode.workspace.fs.delete(target, { recursive: true, useTrash: true });
        if (structureUri && (structureUri.fsPath === target.fsPath || structureUri.fsPath.startsWith(target.fsPath + path.sep))) {
          structureUri = undefined;
          await sendStructure(structurePanel, undefined);
        }
        structurePanel.webview.postMessage({ type: 'projectEntryDeleted', path: String(message.path) });
        await listStructureProject();
      } catch (error) {
        vscode.window.showErrorMessage(`휴지통으로 이동할 수 없습니다: ${error.message}`);
      }
      return;
    }
    if (message.type === 'open') {
      const selected = await vscode.window.showOpenDialog({
        canSelectMany: false,
        filters: {
          '구조물 파일': ['bpstructure', 'mcstructure'],
          'BedrockPy Structure': ['bpstructure'],
          'Minecraft Bedrock Structure': ['mcstructure']
        },
        openLabel: '3D 구조물 열기'
      });
      if (selected?.[0]) {
        structureUri = selected[0];
        await sendStructure(structurePanel, structureUri);
      }
      return;
    }
    if (message.type === 'save') {
      const operationId = message.operationId;
      let target = !message.saveAs && structureUri && path.extname(structureUri.fsPath).toLowerCase() === '.bpstructure'
        ? structureUri
        : undefined;
      if (!target) {
        structurePanel.webview.postMessage({
          type: 'structureSaveProgress', operationId, percent: 38, detail: '저장 위치 선택 중…'
        });
        const sourceName = structureUri ? path.basename(structureUri.fsPath, path.extname(structureUri.fsPath)) : 'structure';
        target = await vscode.window.showSaveDialog({
          defaultUri: vscode.Uri.file(path.join(
            structureUri ? path.dirname(structureUri.fsPath) : (vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || os.homedir()),
            `${sourceName}.bpstructure`
          )),
          filters: { 'BedrockPy Structure': ['bpstructure'] },
          saveLabel: '구조물 저장'
        });
      }
      if (!target) {
        structurePanel.webview.postMessage({ type: 'structureSaveComplete', operationId, cancelled: true });
        return;
      }
      try {
        structurePanel.webview.postMessage({
          type: 'structureSaveProgress', operationId, percent: 52, detail: '청크를 파일 형식으로 변환 중…'
        });
        const encoded = Buffer.from(JSON.stringify(message.data, null, 2) + '\n', 'utf8');
        structurePanel.webview.postMessage({
          type: 'structureSaveProgress', operationId, percent: 76,
          detail: `${(encoded.byteLength / 1024 / 1024).toFixed(2)} MB 파일 기록 중…`
        });
        await vscode.workspace.fs.writeFile(target, encoded);
        structureUri = target;
        const projectPath = structureProjectUri &&
          (target.fsPath === structureProjectUri.fsPath || target.fsPath.startsWith(structureProjectUri.fsPath + path.sep))
          ? path.relative(structureProjectUri.fsPath, target.fsPath).replace(/\\/g, '/')
          : null;
        structurePanel.webview.postMessage({
          type: 'saved',
          operationId,
          fileName: path.basename(target.fsPath),
          projectPath
        });
        await listStructureProject();
        vscode.window.showInformationMessage(`구조물을 저장했습니다: ${target.fsPath}`);
      } catch (error) {
        structurePanel.webview.postMessage({
          type: 'structureSaveComplete', operationId, error: error.message
        });
        vscode.window.showErrorMessage(`구조물을 저장할 수 없습니다: ${error.message}`);
      }
      return;
    }
    if (message.type === 'requestBpyCoordinateMode') {
      const selected = await vscode.window.showQuickPick([
        { label: '상대 좌표', description: '함수를 실행한 위치를 기준으로 배치', mode: 'relative' },
        { label: '절대 좌표', description: '환경 설정의 기준 좌표에 직접 배치', mode: 'absolute' }
      ], {
        title: '.bpy 좌표 방식 선택',
        placeHolder: '내보낼 코드의 좌표 방식을 선택하세요'
      });
      structurePanel.webview.postMessage({ type: 'bpyCoordinateModeSelected', mode: selected?.mode || null });
      return;
    }
    if (message.type === 'export') {
      try {
        const target = await vscode.window.showSaveDialog({
          defaultUri: vscode.Uri.file(path.join(vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || os.homedir(), `${message.functionName}.bpy`)),
          filters: { 'BedrockPy Source': ['bpy'] },
          saveLabel: 'BedrockPy 코드 저장'
        });
        if (!target) {
          structurePanel.webview.postMessage({ type: 'bpyOperationComplete', operationId: message.operationId, cancelled: true });
          return;
        }
        await vscode.workspace.fs.writeFile(target, Buffer.from(message.code, 'utf8'));
        structurePanel.webview.postMessage({ type: 'bpyOperationProgress', operationId: message.operationId, percent: 98, detail: '파일 여는 중…' });
        const document = await vscode.workspace.openTextDocument(target);
        await vscode.window.showTextDocument(document, vscode.ViewColumn.One);
        structurePanel.webview.postMessage({ type: 'bpyOperationComplete', operationId: message.operationId });
      } catch (error) {
        structurePanel.webview.postMessage({ type: 'bpyOperationComplete', operationId: message.operationId, error: error.message });
        vscode.window.showErrorMessage(`.bpy 파일을 내보낼 수 없습니다: ${error.message}`);
      }
      return;
    }
    if (message.type === 'exportMcworld') {
      const operationId = message.operationId;
      try {
        const sourceName = normalizedWorldFileName(message.data?.functionName || 'bedrockpy_structure');
        const target = await vscode.window.showSaveDialog({
          defaultUri: vscode.Uri.file(path.join(
            vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || os.homedir(),
            `${sourceName}.mcworld`
          )),
          filters: { 'Minecraft Bedrock World': ['mcworld'] },
          saveLabel: 'Minecraft 월드 저장'
        });
        if (!target) {
          structurePanel.webview.postMessage({ type: 'bpyOperationComplete', operationId, cancelled: true });
          return;
        }
        await createMcworld(message.data, target.fsPath, (percent, detail) => {
          structurePanel.webview.postMessage({ type: 'bpyOperationProgress', operationId, percent, detail });
        });
        structurePanel.webview.postMessage({ type: 'bpyOperationComplete', operationId });
        vscode.window.showInformationMessage(`Minecraft 월드를 내보냈습니다: ${target.fsPath}`);
      } catch (error) {
        structurePanel.webview.postMessage({ type: 'bpyOperationComplete', operationId, error: error.message });
        vscode.window.showErrorMessage(`.mcworld 파일을 내보낼 수 없습니다: ${error.message}`);
      }
      return;
    }
  });
}

function compilerArgs(context, source, output, mcpack, mcaddon, usePackConfig = false, noArchives = false) {
  const options = config();
  const args = [compilerPath(context), source];
  if (output) args.push('-o', output);
  if (!usePackConfig) {
    args.push('--name', options.name, '--namespace', options.namespace,
      '--max-lines', String(options.maxLines));
  }
  if (mcpack) args.push('--mcpack', mcpack);
  if (mcaddon) args.push('--mcaddon', mcaddon);
  if (noArchives) args.push('--no-mcpack', '--no-mcaddon');
  return args;
}

function resolveProjectConfig(context, source) {
  return new Promise((resolve, reject) => {
    cp.execFile(config().python, [compilerPath(context), source, '--print-config'],
      { maxBuffer: 4 * 1024 * 1024 }, (error, stdout, stderr) => {
        if (error) return reject(new Error((stderr || error.message).trim()));
        try {
          resolve(JSON.parse(stdout.trim()));
        } catch (parseError) {
          reject(new Error(`pack 설정을 읽을 수 없습니다: ${parseError.message}`));
        }
      });
  });
}

function parseDiagnostic(document, stderr) {
  const match = stderr.match(/오류:\s+.*?:(\d+):\s*(.+)/s);
  if (!match) {
    const message = stderr.replace(/^오류:\s*/, '').trim() || '알 수 없는 컴파일 오류';
    return new vscode.Diagnostic(new vscode.Range(0, 0, 0, 1), message, vscode.DiagnosticSeverity.Error);
  }
  const line = Math.max(0, Math.min(document.lineCount - 1, Number(match[1]) - 1));
  const range = document.lineAt(line).range;
  return new vscode.Diagnostic(range, match[2].trim(), vscode.DiagnosticSeverity.Error);
}

function validateDocument(context, document) {
  if (document.languageId !== 'bedrockpy') return Promise.resolve(false);
  const key = document.uri.toString();
  const previous = running.get(key);
  if (previous) previous.kill();

  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'bedrockpy-check-'));
  const source = path.join(tempRoot, 'check.bpy');
  const output = path.join(tempRoot, 'pack');
  fs.writeFileSync(source, document.getText(), 'utf8');
  const projectSounds = path.join(projectSource(document), 'sounds');
  if (fs.existsSync(projectSounds)) {
    fs.cpSync(projectSounds, path.join(tempRoot, 'sounds'), { recursive: true });
  }
  const child = cp.execFile(config().python,
    compilerArgs(context, source, output, undefined, undefined, true, true),
    { maxBuffer: 4 * 1024 * 1024 },
    (error, stdout, stderr) => {
      const isCurrent = running.get(key) === child;
      fs.rm(tempRoot, { recursive: true, force: true }, () => {});
      if (!isCurrent) return;
      running.delete(key);
      if (error) {
        diagnostics.set(document.uri, [parseDiagnostic(document, stderr || error.message)]);
        status.text = '$(error) BedrockPy 오류';
        status.tooltip = (stderr || error.message).trim();
      } else {
        diagnostics.delete(document.uri);
        const summary = stdout.trim().replace(/^완료:\s*/, '');
        status.text = `$(check) ${summary || 'BedrockPy 정상'}`;
        status.tooltip = '현재 파일의 문법 검사가 통과했습니다.';
      }
    });
  running.set(key, child);
  return Promise.resolve(true);
}

function activeBedrockDocument() {
  const editor = vscode.window.activeTextEditor;
  if (!editor || editor.document.languageId !== 'bedrockpy') {
    vscode.window.showErrorMessage('먼저 .bpy 파일을 열어 주세요.');
    return undefined;
  }
  return editor.document;
}

function projectSource(document) {
  const configured = config().projectRoot.trim();
  if (configured) {
    if (path.isAbsolute(configured)) return configured;
    const folder = vscode.workspace.getWorkspaceFolder(document.uri);
    return path.resolve(folder ? folder.uri.fsPath : path.dirname(document.uri.fsPath), configured);
  }
  return path.dirname(document.uri.fsPath);
}

function walkBedrockPyFiles(root) {
  if (!fs.existsSync(root)) return [];
  const result = [];
  const visit = current => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const target = path.join(current, entry.name);
      if (entry.isDirectory()) visit(target);
      else if (entry.isFile() && entry.name.endsWith('.bpy')) result.push(target);
    }
  };
  visit(root);
  return result.sort();
}

function hoverSymbols(document) {
  const root = projectSource(document);
  const files = walkBedrockPyFiles(root);
  if (!files.includes(document.uri.fsPath)) files.push(document.uri.fsPath);
  const sources = files.map(file => ({
    file,
    text: file === document.uri.fsPath ? document.getText() : fs.readFileSync(file, 'utf8')
  }));
  let namespace = config().namespace;
  for (const source of sources) {
    const match = source.text.match(/^\s*namespace\s*=\s*["']([^"']+)["']\s*(?:#.*)?$/m);
    if (match) { namespace = match[1]; break; }
  }
  namespace = namespace.toLowerCase().replace(/[^a-z0-9_-]+/g, '_').replace(/^_+|_+$/g, '') || 'bedrockpy';
  const objective = `bp_${namespace}`.slice(0, 16);
  const symbols = new Map();
  for (const source of sources) {
    const lines = source.text.split(/\r?\n/);
    let varsIndent = -1;
    lines.forEach((line, index) => {
      const trimmed = line.trim();
      const indent = (line.match(/^\s*/) || [''])[0].length;
      if (/^vars\s*:\s*(?:#.*)?$/.test(trimmed)) {
        varsIndent = indent;
        return;
      }
      if (varsIndent < 0 || !trimmed || trimmed.startsWith('#')) return;
      if (indent <= varsIndent) { varsIndent = -1; return; }
      const variable = trimmed.match(/^(int|float|bool)\s+([A-Za-z_]\w*)\s*=/);
      if (variable) {
        const [, kind, name] = variable;
        const holder = `bpv_${name}`.slice(0, 37);
        symbols.set(name, {
          kind, name, holder, objective,
          exponentHolder: kind === 'float' ? `${holder}_e` : undefined,
          file: source.file, line: index + 1
        });
      }
    });
  }
  return symbols;
}

function provideVariableHover(document, position) {
  const range = document.getWordRangeAtPosition(position, /[A-Za-z_]\w*/);
  if (!range) return undefined;
  const name = document.getText(range);
  const symbol = hoverSymbols(document).get(name);
  if (!symbol) return undefined;
  const markdown = new vscode.MarkdownString();
  markdown.appendMarkdown(`**BedrockPy ${symbol.kind} \`${symbol.name}\`**\n\n`);
  markdown.appendMarkdown(`- Objective: \`${symbol.objective}\`\n`);
  markdown.appendMarkdown(`- Score holder: \`${symbol.holder}\`\n`);
  if (symbol.exponentHolder) markdown.appendMarkdown(`- Float exponent holder: \`${symbol.exponentHolder}\`\n`);
  markdown.appendMarkdown(`- 선언: \`${path.basename(symbol.file)}:${symbol.line}\`\n\n`);
  if (symbol.kind === 'float') {
    markdown.appendCodeblock(
      `scoreboard players set ${symbol.holder} ${symbol.objective} <가수>\n` +
      `scoreboard players set ${symbol.exponentHolder} ${symbol.objective} <지수>`,
      'mcfunction'
    );
  } else if (symbol.kind === 'bool') {
    markdown.appendCodeblock(
      `scoreboard players set ${symbol.holder} ${symbol.objective} <0 또는 1>`,
      'mcfunction'
    );
  } else {
    markdown.appendCodeblock(
      `scoreboard players set ${symbol.holder} ${symbol.objective} <정수>`,
      'mcfunction'
    );
  }
  return new vscode.Hover(markdown, range);
}

async function selectOutput(document, source) {
  const defaultUri = vscode.Uri.file(path.dirname(document.uri.fsPath));
  const selected = await vscode.window.showOpenDialog({
    canSelectFiles: false,
    canSelectFolders: true,
    canSelectMany: false,
    defaultUri,
    openLabel: '출력 위치 선택',
    title: '행동 팩을 생성할 상위 폴더를 선택하세요'
  });
  if (!selected) return undefined;
  const base = path.basename(source)
    .replace(/[^A-Za-z0-9_-]+/g, '_') || 'BedrockPy';
  return vscode.Uri.file(path.join(selected[0].fsPath, `${base}BP`));
}

function runBuild(context, document, source, output, mcpack, mcaddon, projectConfig) {
  return new Promise((resolve) => {
    const options = config();
    vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, title: 'BedrockPy 컴파일 중…' }, () =>
      new Promise((done) => {
        cp.execFile(options.python, compilerArgs(context, source, output.fsPath,
          mcpack && mcpack.fsPath, mcaddon && mcaddon.fsPath, projectConfig.has_pack_block),
          { maxBuffer: 16 * 1024 * 1024 }, (error, stdout, stderr) => {
            if (error) {
              diagnostics.set(document.uri, [parseDiagnostic(document, stderr || error.message)]);
              vscode.window.showErrorMessage((stderr || error.message).trim());
              resolve(false);
            } else {
              diagnostics.delete(document.uri);
              const target = mcaddon || mcpack || output;
              vscode.window.showInformationMessage(`${stdout.trim()} — ${target.fsPath}`, 'Finder에서 보기').then(choice => {
                if (choice) vscode.commands.executeCommand('revealFileInOS', target);
              });
              resolve(true);
            }
            done();
          });
      }));
  });
}

async function compilePack(context, archiveType) {
  const document = activeBedrockDocument();
  if (!document) return;
  if (document.isDirty) await document.save();
  const source = projectSource(document);
  let projectConfig;
  try {
    projectConfig = await resolveProjectConfig(context, source);
  } catch (error) {
    vscode.window.showErrorMessage(error.message);
    return;
  }
  const output = projectConfig.output
    ? vscode.Uri.file(projectConfig.output)
    : await selectOutput(document, source);
  if (!output) return;
  let mcpack = projectConfig.mcpack ? vscode.Uri.file(projectConfig.mcpack) : undefined;
  let mcaddon = projectConfig.mcaddon ? vscode.Uri.file(projectConfig.mcaddon) : undefined;
  if (archiveType === 'mcpack' && !mcpack) {
    const selected = await vscode.window.showSaveDialog({
      defaultUri: vscode.Uri.file(`${output.fsPath}.mcpack`),
      filters: { 'Minecraft Pack': ['mcpack'] },
      saveLabel: '.mcpack 생성'
    });
    if (!selected) return;
    mcpack = selected.fsPath.endsWith('.mcpack') ? selected : vscode.Uri.file(`${selected.fsPath}.mcpack`);
  }
  if (archiveType === 'mcaddon' && !mcaddon) {
    const selected = await vscode.window.showSaveDialog({
      defaultUri: vscode.Uri.file(`${output.fsPath}.mcaddon`),
      filters: { 'Minecraft Add-On': ['mcaddon'] },
      saveLabel: '.mcaddon 생성'
    });
    if (!selected) return;
    mcaddon = selected.fsPath.endsWith('.mcaddon') ? selected : vscode.Uri.file(`${selected.fsPath}.mcaddon`);
  }
  await runBuild(context, document, source, output, mcpack, mcaddon, projectConfig);
}

function activate(context) {
  diagnostics = vscode.languages.createDiagnosticCollection('bedrockpy');
  status = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 50);
  status.name = 'BedrockPy 상태';
  status.command = 'bedrockpy.validate';
  status.text = '$(checklist) BedrockPy';
  status.show();
  context.subscriptions.push(
    diagnostics,
    status,
    vscode.commands.registerCommand('bedrockpy.compilePack', () => compilePack(context, undefined)),
    vscode.commands.registerCommand('bedrockpy.buildMcpack', () => compilePack(context, 'mcpack')),
    vscode.commands.registerCommand('bedrockpy.buildMcaddon', () => compilePack(context, 'mcaddon')),
    vscode.commands.registerCommand('bedrockpy.openStructureEditor', async uri => {
      let source = uri instanceof vscode.Uri ? uri : undefined;
      if (!source && /\.(?:bpstructure|mcstructure)$/i.test(vscode.window.activeTextEditor?.document.fileName || '')) {
        source = vscode.window.activeTextEditor.document.uri;
      }
      await openStructureEditor(context, source);
    }),
    vscode.languages.registerHoverProvider('bedrockpy', { provideHover: provideVariableHover }),
    vscode.commands.registerCommand('bedrockpy.validate', () => {
      const document = activeBedrockDocument();
      if (document) validateDocument(context, document);
    }),
    vscode.workspace.onDidOpenTextDocument(document => validateDocument(context, document)),
    vscode.workspace.onDidSaveTextDocument(document => validateDocument(context, document)),
    vscode.workspace.onDidChangeTextDocument(event => {
      if (!config().validateOnType || event.document.languageId !== 'bedrockpy') return;
      clearTimeout(debounce);
      debounce = setTimeout(() => validateDocument(context, event.document), 350);
    }),
    vscode.workspace.onDidCloseTextDocument(document => {
      diagnostics.delete(document.uri);
      const child = running.get(document.uri.toString());
      if (child) child.kill();
      running.delete(document.uri.toString());
    })
  );
  if (vscode.window.activeTextEditor) validateDocument(context, vscode.window.activeTextEditor.document);
}

function deactivate() {
  for (const child of running.values()) child.kill();
}

module.exports = {
  activate,
  deactivate,
  decodeMcstructure,
  createMcworld,
  getVanillaTextureManifest,
  downloadVanillaTextures
};
