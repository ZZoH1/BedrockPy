import * as THREE from "./three.module.min.js";
import allBedrockBlocks from "./bedrock-blocks.json";

const vscode = acquireVsCodeApi();
let workspaceSize = { x: 32, y: 32, z: 32 };
const blockTypes = {
  stone: { label: "Stone", color: 0x7d8586 },
  dirt: { label: "Dirt", color: 0x866043 },
  grass: { label: "Grass", color: 0x5eaa43 },
  oak_planks: { label: "Oak Planks", color: 0xb58b55 },
  glass: { label: "Glass", color: 0x9fd9df, opacity: 0.55 },
  white_concrete: { label: "White", color: 0xdde2e2 },
  black_concrete: { label: "Black", color: 0x202326 },
  red_concrete: { label: "Red", color: 0xc74343 },
  blue_concrete: { label: "Blue", color: 0x3b64c8 },
  lime_concrete: { label: "Lime", color: 0x75c83d },
  gold_block: { label: "Gold", color: 0xf5cc38 },
  sea_lantern: { label: "Sea Lantern", color: 0xb9e7db },
};

let activeBlock = "stone";
let eyedropperReturnTool = "place";
let blockRenderMode = "texture";
let blockTextureUris = {};
let activeTexturePackLabel = "기본 리소스팩 준비 중";
const blockTextureCache = new Map();
const blockTextureLoader = new THREE.TextureLoader();
const recentBlocks = [
  "stone", "dirt", "grass", "oak_planks", "glass",
  "cobblestone", "sand", "white_concrete", "oak_log", "water"
];

function shortBlockId(id) {
  return id.replace(/^minecraft:/, "");
}

function blockColor(id) {
  const short = shortBlockId(id);
  if (blockTypes[short]) return blockTypes[short].color;
  if (/air|barrier|structure_void/.test(short)) return 0x8899aa;
  if (/glass|ice/.test(short)) return 0x9fd9df;
  if (/leaves|moss|grass|vine|cactus|azalea/.test(short)) return 0x5eaa43;
  if (/log|wood|planks|bamboo|chest|barrel/.test(short)) return 0x9a7148;
  if (/water|blue|lapis/.test(short)) return 0x397bc6;
  if (/lava|orange|magma|copper/.test(short)) return 0xd46a35;
  if (/red|nether|brick/.test(short)) return 0xa4473e;
  if (/gold|yellow|honey|glowstone/.test(short)) return 0xe0b63d;
  if (/white|quartz|snow|bone/.test(short)) return 0xe5e8e3;
  if (/black|deepslate|coal|obsidian/.test(short)) return 0x303138;
  if (/purple|amethyst|purpur/.test(short)) return 0x8f62b3;
  if (/pink/.test(short)) return 0xd883a7;
  if (/sand|end_stone/.test(short)) return 0xd8c486;
  return 0x7d8586;
}

function blockTextureTint(id, face = "all") {
  const short = shortBlockId(id).toLowerCase();
  if (/^(?:flowing_)?water$/.test(short)) return 0x3f76e4;
  if (/^(?:grass|grass_block)$/.test(short)) return face === "up" || face === "all" ? 0x79c05a : null;
  if (/^(?:short_grass|tall_grass|fern|large_fern|vine|waterlily|reeds)$/.test(short)) return 0x79c05a;
  if (/^(?:spruce_leaves)$/.test(short)) return 0x619961;
  if (/^(?:birch_leaves)$/.test(short)) return 0x80a755;
  if (/^(?:oak|jungle|acacia|dark_oak|mangrove)_leaves$/.test(short)) return 0x59ae30;
  return null;
}

function isCutoutTextureBlock(id) {
  const short = shortBlockId(id).toLowerCase();
  return /(?:_leaves$|^short_grass$|^tall_grass$|^fern$|^large_fern$|^vine$|^waterlily$|^reeds$|^seagrass$)/.test(short);
}

function isTranslucentGlassBlock(id) {
  const short = shortBlockId(id).toLowerCase();
  return /^(?:glass|glass_pane|tinted_glass|(?:hard_)?[a-z_]+_stained_glass(?:_pane)?)$/.test(short);
}

function clearBlockTextureCache() {
  blockTextureCache.forEach(texture => texture.dispose());
  blockTextureCache.clear();
}

function blockTextureUri(id, face = "all") {
  const entry = blockTextureUris[shortBlockId(id).toLowerCase()];
  if (!entry) return null;
  if (typeof entry === "string") return entry;
  if (face === "up") return entry.up || entry.side || entry.all || null;
  if (face === "down") return entry.down || entry.side || entry.all || null;
  return entry[face] || entry.side || entry.all || entry.up || entry.down || null;
}

function blockTexture(id, face = "all") {
  if (blockRenderMode !== "texture") return null;
  const uri = blockTextureUri(id, face);
  if (!uri) return null;
  if (blockTextureCache.has(uri)) return blockTextureCache.get(uri);
  const texture = blockTextureLoader.load(uri);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.magFilter = THREE.NearestFilter;
  // 16×16 블록 텍스처의 밉맵은 조금만 멀어져도 평균색 한 칸으로
  // 축소되어 단색처럼 보인다. 원본 픽셀을 유지해 반복 UV가 보이게 한다.
  texture.minFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  texture.colorSpace = THREE.SRGBColorSpace;
  blockTextureCache.set(uri, texture);
  return texture;
}

function updateTextureModeUi() {
  document.getElementById("use-color-rendering")?.classList.toggle("active", blockRenderMode === "color");
  document.getElementById("use-texture-rendering")?.classList.toggle("active", blockRenderMode === "texture");
  const status = document.getElementById("texture-pack-status");
  if (status) status.textContent = blockRenderMode === "texture"
    ? `적용 중: ${activeTexturePackLabel} · ${Object.keys(blockTextureUris).length}개 텍스처`
    : "단색 고속 렌더링";
}

function decorateBlockSwatch(swatch, id) {
  const short = shortBlockId(id).toLowerCase();
  const textureUri = blockRenderMode === "texture" ? blockTextureUri(short, "up") : null;
  swatch.classList.toggle("textured", Boolean(textureUri));
  swatch.style.backgroundColor = `#${blockColor(short).toString(16).padStart(6, "0")}`;
  swatch.style.backgroundImage = textureUri ? `url("${textureUri.replace(/"/g, "%22")}")` : "none";
  const tint = blockTextureTint(short, "up");
  if (textureUri && tint !== null) {
    swatch.style.backgroundColor = `#${tint.toString(16).padStart(6, "0")}`;
    swatch.style.backgroundBlendMode = "multiply";
  } else {
    swatch.style.backgroundBlendMode = "normal";
  }
  swatch.title = textureUri
    ? `minecraft:${short} · ${activeTexturePackLabel}`
    : `minecraft:${short} · 단색`;
}

function refreshBlockIcons() {
  renderPalette(document.getElementById("block-search")?.value || "");
  renderRecentBlocks();
}

const blockCategoryLabels = {
  all: "전체", building: "건축", nature: "자연", functional: "기능",
  redstone: "레드스톤", colored: "색상"
};
let activeBlockCategory = "all";
let paletteRenderRevision = 0;

function blockCategories(id) {
  const short = shortBlockId(id).toLowerCase();
  const categories = new Set();
  if (/(?:redstone|repeater|comparator|observer|piston|dispenser|dropper|hopper|lever|tripwire|daylight_detector|target|sculk_sensor|lightning_rod|rail|powered_rail|detector_rail|activator_rail|pressure_plate|button)/.test(short)) {
    categories.add("redstone");
  }
  if (/(?:concrete|terracotta|wool|carpet|stained_glass|glazed_terracotta|shulker_box|candle|banner|coral|coral_block|coral_fan)/.test(short)) {
    categories.add("colored");
  }
  if (/(?:grass|dirt|mud|sand|gravel|clay|stone|deepslate|ore|log|wood|stem|hyphae|leaves|sapling|flower|mushroom|vine|moss|azalea|cactus|bamboo|reeds|waterlily|seagrass|kelp|dripleaf|roots|nylium|wart|snow|ice|amethyst|sponge|egg|crop|farmland|podzol|mycelium|netherrack|soul_sand|soul_soil|end_stone)/.test(short)) {
    categories.add("nature");
  }
  if (/(?:crafting|furnace|smoker|blast_furnace|chest|barrel|anvil|enchant|brewing|beacon|bed$|door|trapdoor|fence_gate|ladder|scaffolding|sign|hanging_sign|bookshelf|lectern|composter|cauldron|grindstone|stonecutter|loom|cartography|smithing|jukebox|note_block|bell|respawn_anchor|lodestone|conduit|light|torch|lantern|campfire|tnt|command_block|structure_block|jigsaw|end_portal|nether_portal|decorated_pot|flower_pot|item_frame|skull|head)/.test(short)) {
    categories.add("functional");
  }
  if (/(?:planks|brick|tile|slab|stairs|wall|fence|pillar|block|concrete|terracotta|wool|glass|pane|copper|quartz|prismarine|purpur|sandstone|blackstone|tuff|basalt|polished|chiseled|cut_|mosaic|packed_mud|resin|bookshelf)/.test(short)) {
    categories.add("building");
  }
  if (!categories.size) categories.add("building");
  return categories;
}

function renderPalette(query = "") {
  const palette = document.getElementById("block-palette");
  if (!palette) return;
  const normalized = query.trim().toLowerCase().replace(/^minecraft:/, "");
  const searchableBlocks = [...new Set([...recentBlocks, ...allBedrockBlocks.map(shortBlockId)])];
  const categorizedBlocks = activeBlockCategory === "all"
    ? searchableBlocks
    : searchableBlocks.filter(id => blockCategories(id).has(activeBlockCategory));
  const searchInput = document.getElementById("block-search");
  if (searchInput) {
    searchInput.placeholder = `${blockCategoryLabels[activeBlockCategory]} ${categorizedBlocks.length}개 블록 검색…`;
  }
  const source = normalized
    ? categorizedBlocks
        .filter(id => id.toLowerCase().includes(normalized))
        .sort((a, b) => {
          const aName = a.toLowerCase();
          const bName = b.toLowerCase();
          const rank = name => name === normalized ? 0 : name.startsWith(normalized) ? 1 : 2;
          return rank(aName) - rank(bName) || aName.localeCompare(bName);
        })
    : categorizedBlocks;
  const visible = source;
  const revision = ++paletteRenderRevision;
  palette.replaceChildren();
  const appendBatch = start => {
    if (revision !== paletteRenderRevision) return;
    const fragment = document.createDocumentFragment();
    const end = Math.min(visible.length, start + 120);
    for (let index = start; index < end; index++) {
      const id = shortBlockId(visible[index]);
      const button = document.createElement("button");
      button.type = "button";
      button.className = "block";
      button.dataset.block = id;
      button.title = `minecraft:${id}`;
      button.setAttribute("aria-pressed", String(id === activeBlock));
      const swatch = document.createElement("span");
      swatch.className = "swatch";
      decorateBlockSwatch(swatch, id);
      const label = document.createElement("span");
      label.textContent = id;
      button.append(swatch, label);
      button.addEventListener("click", () => {
        selectBlock(id);
        ghostSignature = "";
        refreshHover();
      });
      fragment.appendChild(button);
    }
    palette.appendChild(fragment);
    if (end < visible.length) requestAnimationFrame(() => appendBatch(end));
  };
  appendBatch(0);
  const result = document.getElementById("block-result-count");
  if (result) result.textContent = `${blockCategoryLabels[activeBlockCategory]} · ${source.length}개`;
}

function selectBlock(next) {
  if (!next) return;
  activeBlock = next;
  const recentIndex = recentBlocks.indexOf(next);
  if (recentIndex >= 0) recentBlocks.splice(recentIndex, 1);
  recentBlocks.unshift(next);
  if (recentBlocks.length > 10) recentBlocks.pop();
  document.querySelectorAll("[data-block]").forEach(item => {
    const selected = item.dataset.block === activeBlock;
    item.classList.toggle("active", selected);
    item.setAttribute("aria-pressed", String(selected));
  });
  const label = document.getElementById("active-block");
  if (label) label.textContent = activeBlock;
  renderRecentBlocks();
}

function renderRecentBlocks() {
  const host = document.getElementById("recent-blocks");
  if (!host) return;
  const eyedropper = document.createElement("button");
  eyedropper.type = "button";
  eyedropper.className = "recent-block eyedropper";
  eyedropper.title = "스포이드: 화면의 블록 종류 선택";
  eyedropper.textContent = "◉";
  eyedropper.addEventListener("click", activateEyedropper);
  host.replaceChildren(eyedropper, ...recentBlocks.slice(0, 10).map(id => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `recent-block${id === activeBlock ? " active" : ""}`;
    button.title = `최근 블록: minecraft:${id}`;
    button.dataset.block = id;
    const swatch = document.createElement("span");
    swatch.className = "swatch";
    decorateBlockSwatch(swatch, id);
    button.appendChild(swatch);
    button.addEventListener("click", () => {
      selectBlock(id);
      ghostSignature = "";
      refreshHover();
    });
    return button;
  }));
}

renderPalette();
document.getElementById("block-search")?.addEventListener("input", event => renderPalette(event.target.value));
document.querySelectorAll("[data-block-category]").forEach(button => {
  button.addEventListener("click", () => {
    activeBlockCategory = button.dataset.blockCategory;
    document.querySelectorAll("[data-block-category]").forEach(item => {
      const active = item.dataset.blockCategory === activeBlockCategory;
      item.classList.toggle("active", active);
      item.setAttribute("aria-pressed", String(active));
    });
    renderPalette(document.getElementById("block-search")?.value || "");
  });
});
document.getElementById("palette-view-toggle")?.addEventListener("click", event => {
  const palette = document.getElementById("block-palette");
  const iconOnly = palette?.classList.toggle("icon-only") || false;
  event.currentTarget.textContent = iconOnly ? "☰" : "▦";
  event.currentTarget.title = iconOnly ? "이름이 보이는 목록으로 전환" : "아이콘만 크게 모아보기";
  event.currentTarget.setAttribute("aria-pressed", String(iconOnly));
  event.currentTarget.classList.toggle("active", iconOnly);
});
selectBlock(activeBlock);

function activateEyedropper() {
  if (tool !== "eyedropper") eyedropperReturnTool = tool;
  setTool("eyedropper");
}

function sampleBlockAtPointer(event) {
  const cell = pick(event, false);
  if (!cell || !valid(cell)) return false;
  const sampled = blocks.get(key(cell.x, cell.y, cell.z));
  if (!sampled) return false;
  selectBlock(sampled);
  ghostSignature = "";
  refreshHover();
  return true;
}

document.getElementById("palette-eyedropper")?.addEventListener("click", activateEyedropper);

const canvas = document.getElementById("scene");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
let activePixelRatio = Math.min(devicePixelRatio, 1.5);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x0b0f0d, 0);
const camera = new THREE.PerspectiveCamera(48, 1, 0.1, 2000);
const target = new THREE.Vector3(16, 6, 16);
let theta = Math.PI * 0.25;
let phi = Math.PI * 0.32;
let radius = 5;

scene.add(new THREE.HemisphereLight(0xd7f7e2, 0x172219, 1.8));
const sun = new THREE.DirectionalLight(0xffffff, 2.4);
sun.position.set(12, 24, 8);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
scene.add(sun);
const rim = new THREE.DirectionalLight(0x9c7cff, 1.3);
rim.position.set(-12, 10, -8);
scene.add(rim);

const transformVisualGizmo = new THREE.Group();
transformVisualGizmo.visible = false;
scene.add(transformVisualGizmo);
const transformHandles = [];
function addTransformHandle(object, kind, axis) {
  object.userData.transformHandle = { kind, axis };
  object.traverse(child => {
    child.userData.transformHandle = { kind, axis };
    child.renderOrder = 31;
  });
  transformHandles.push(object);
  transformVisualGizmo.add(object);
}
function buildTransformVisualGizmo() {
  const colors = { x: 0xff5f5f, y: 0x69e86b, z: 0x6295ff };
  const directions = {
    x: new THREE.Vector3(1, 0, 0),
    y: new THREE.Vector3(0, 1, 0),
    z: new THREE.Vector3(0, 0, 1)
  };
  for (const axis of ["x", "y", "z"]) {
    const material = new THREE.MeshBasicMaterial({ color: colors[axis], depthTest: false });
    const arrow = new THREE.Group();
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 1.6, 10), material);
    const head = new THREE.Mesh(new THREE.ConeGeometry(0.23, 0.48, 12), material);
    shaft.position.y = 0.8;
    head.position.y = 1.84;
    arrow.add(shaft, head);
    arrow.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), directions[axis]);
    addTransformHandle(arrow, "move", axis);
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(1.35, 0.075, 10, 64),
      new THREE.MeshBasicMaterial({ color: colors[axis], transparent: true, opacity: 0.85, depthTest: false })
    );
    if (axis === "x") ring.rotation.y = Math.PI / 2;
    if (axis === "y") ring.rotation.x = Math.PI / 2;
    addTransformHandle(ring, "rotate", axis);
  }
  const scaleHandle = new THREE.Mesh(
    new THREE.BoxGeometry(0.42, 0.42, 0.42),
    new THREE.MeshBasicMaterial({ color: 0xffd75f, depthTest: false })
  );
  scaleHandle.position.set(1.55, 1.55, 1.55);
  addTransformHandle(scaleHandle, "scale", "uniform");
  for (const axis of ["x", "y", "z"]) {
    const stretchHandle = new THREE.Mesh(
      new THREE.BoxGeometry(axis === "x" ? 0.5 : 0.24, axis === "y" ? 0.5 : 0.24, axis === "z" ? 0.5 : 0.24),
      new THREE.MeshBasicMaterial({ color: colors[axis], depthTest: false })
    );
    stretchHandle.position[axis] = 2.55;
    addTransformHandle(stretchHandle, "stretch", axis);
  }
}
buildTransformVisualGizmo();

let grid;
let boundary;
let ground;

function rebuildWorkspaceGuides() {
  if (grid) {
    scene.remove(grid);
    grid.geometry.dispose();
    grid.material.dispose();
  }
  if (boundary) {
    scene.remove(boundary);
    boundary.geometry.dispose();
    boundary.material.dispose();
  }
  if (ground) {
    scene.remove(ground);
    ground.geometry.dispose();
    ground.material.dispose();
  }
  const span = Math.max(workspaceSize.x, workspaceSize.z);
  grid = new THREE.GridHelper(span, span, 0x6b825f, 0x26342b);
  grid.position.set(workspaceSize.x / 2, 0, workspaceSize.z / 2);
  scene.add(grid);
  boundary = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(workspaceSize.x, workspaceSize.y, workspaceSize.z)),
    new THREE.LineBasicMaterial({ color: 0x3f5145, transparent: true, opacity: 0.35 })
  );
  boundary.position.set(workspaceSize.x / 2, workspaceSize.y / 2, workspaceSize.z / 2);
  scene.add(boundary);
  ground = new THREE.Mesh(
    new THREE.PlaneGeometry(workspaceSize.x, workspaceSize.z),
    new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, side: THREE.DoubleSide })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(workspaceSize.x / 2, -0.001, workspaceSize.z / 2);
  ground.userData.ground = true;
  scene.add(ground);
}
rebuildWorkspaceGuides();

const hover = new THREE.LineSegments(
  new THREE.EdgesGeometry(new THREE.BoxGeometry(1.035, 1.035, 1.035)),
  new THREE.LineBasicMaterial({ color: 0xb8ff4a })
);
hover.visible = false;
scene.add(hover);

let ghostMesh = null;
let ghostBounds = null;
let ghostMeshUsesCachedGeometry = false;
let ghostSignature = "";
let brushPreviewSignature = "";
let liveEditPreviewMesh = null;
let liveEditPreviewScheduled = false;
let lastLiveEditPreviewAt = 0;
const liveEditPreviewCells = new Map();

function clearGhost() {
  if (ghostMesh) {
    scene.remove(ghostMesh);
    if (!ghostMeshUsesCachedGeometry) ghostMesh.geometry.dispose();
    ghostMesh.material.dispose();
    ghostMesh = null;
    ghostMeshUsesCachedGeometry = false;
  }
  if (ghostBounds) {
    scene.remove(ghostBounds);
    ghostBounds.geometry.dispose();
    ghostBounds.material.dispose();
    ghostBounds = null;
  }
  ghostSignature = "";
  brushPreviewSignature = "";
}

function recordLiveEditPreview(x, y, z, erase = false) {
  if (!groupedMutation) return;
  const position = key(x, y, z);
  const previewLimit = tool === "sculpt" ? 6000 : 30000;
  if (liveEditPreviewCells.size < previewLimit || liveEditPreviewCells.has(position)) {
    liveEditPreviewCells.set(position, erase);
  }
  if (liveEditPreviewScheduled) return;
  liveEditPreviewScheduled = true;
  const previewInterval = tool === "sculpt" ? 120 : 70;
  const delay = Math.max(0, previewInterval - (performance.now() - lastLiveEditPreviewAt));
  setTimeout(() => requestAnimationFrame(() => {
      liveEditPreviewScheduled = false;
      lastLiveEditPreviewAt = performance.now();
      renderLiveEditPreview();
    }), delay);
}

function renderLiveEditPreview() {
  if (liveEditPreviewMesh) {
    scene.remove(liveEditPreviewMesh);
    liveEditPreviewMesh.geometry.dispose();
    liveEditPreviewMesh.material.dispose();
    liveEditPreviewMesh = null;
  }
  if (!liveEditPreviewCells.size) return;
  const entries = [...liveEditPreviewCells.entries()];
  const previewPointLimit = tool === "sculpt" ? 1500 : 5000;
  const stride = Math.max(1, Math.ceil(entries.length / previewPointLimit));
  const positions = [];
  for (let index = 0; index < entries.length; index += stride) {
    const [position] = entries[index];
    const [x, y, z] = position.split(",").map(Number);
    positions.push(x + 0.5, y + 0.5, z + 0.5);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  const erase = tool === "erase";
  const material = new THREE.PointsMaterial({
    color: erase ? 0xff5555 : blockColor(activeBlock),
    size: 7,
    sizeAttenuation: false,
    transparent: true,
    opacity: 0.9,
    depthWrite: false
  });
  liveEditPreviewMesh = new THREE.Points(geometry, material);
  liveEditPreviewMesh.renderOrder = 20;
  scene.add(liveEditPreviewMesh);
}

function clearLiveEditPreview() {
  liveEditPreviewCells.clear();
  if (!liveEditPreviewMesh) return;
  scene.remove(liveEditPreviewMesh);
  liveEditPreviewMesh.geometry.dispose();
  liveEditPreviewMesh.material.dispose();
  liveEditPreviewMesh = null;
}

const selectionBox = new THREE.LineSegments(
  new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1)),
  new THREE.LineBasicMaterial({ color: 0xc6a8ff, transparent: true, opacity: 1, depthTest: false })
);
selectionBox.renderOrder = 26;
selectionBox.visible = false;
scene.add(selectionBox);
const selectionFill = new THREE.Mesh(
  new THREE.BoxGeometry(1, 1, 1),
  new THREE.MeshBasicMaterial({
    color: 0x9c7cff, transparent: true, opacity: 0.075,
    depthTest: false, depthWrite: false, side: THREE.DoubleSide
  })
);
selectionFill.renderOrder = 25;
selectionFill.visible = false;
scene.add(selectionFill);

const renderChunkSize = 16;
const dirtyRenderChunks = new Set();
const pendingRenderChunks = new Set();
const progressiveChunksPerFrame = 1;
const chunkRenderMeshes = new Map();
const chunkVisibleFaces = new Map();
const sharedChunkMaterials = new Map();
const blockTypeCounts = new Map();
const blockChunkCounts = new Map();
const columnTopCache = new Map();
let residentRenderChunks = new Set();
let forceFullRebuildPending = true;
let lastChunkShadowMode = true;
let lastChunkStreamingSignature = "";
let activeUndoChanges = null;
let blockMutationRevision = 0;
let structureDataLoading = false;
let structureMeshLoadingProgress = false;
let structureLoadRevision = 0;
let cameraHoverRefreshPending = false;
let lastCameraMotionAt = 0;
let cameraMotionActive = false;
let lastPlayViewUiAt = 0;

function noteCameraMotion(now = performance.now()) {
  lastCameraMotionAt = now;
  cameraHoverRefreshPending = true;
  if (cameraMotionActive) return;
  cameraMotionActive = true;
  hover.visible = false;
  updateCursorCoordinate(null);
}

function renderChunkKey(x, y, z) {
  return `${Math.floor(x / renderChunkSize)},${Math.floor(y / renderChunkSize)},${Math.floor(z / renderChunkSize)}`;
}

function markRenderChunkDirty(x, y, z) {
  const chunkX = Math.floor(x / renderChunkSize);
  const chunkY = Math.floor(y / renderChunkSize);
  const chunkZ = Math.floor(z / renderChunkSize);
  dirtyRenderChunks.add(`${chunkX},${chunkY},${chunkZ}`);
  const localX = ((x % renderChunkSize) + renderChunkSize) % renderChunkSize;
  const localY = ((y % renderChunkSize) + renderChunkSize) % renderChunkSize;
  const localZ = ((z % renderChunkSize) + renderChunkSize) % renderChunkSize;
  if (localX === 0) dirtyRenderChunks.add(`${chunkX - 1},${chunkY},${chunkZ}`);
  if (localX === renderChunkSize - 1) dirtyRenderChunks.add(`${chunkX + 1},${chunkY},${chunkZ}`);
  if (localY === 0) dirtyRenderChunks.add(`${chunkX},${chunkY - 1},${chunkZ}`);
  if (localY === renderChunkSize - 1) dirtyRenderChunks.add(`${chunkX},${chunkY + 1},${chunkZ}`);
  if (localZ === 0) dirtyRenderChunks.add(`${chunkX},${chunkY},${chunkZ - 1}`);
  if (localZ === renderChunkSize - 1) dirtyRenderChunks.add(`${chunkX},${chunkY},${chunkZ + 1}`);
}

function adjustBlockChunkCount(position, amount) {
  const [x, y, z] = String(position).split(",").map(Number);
  if (![x, y, z].every(Number.isFinite)) return;
  const chunkKey = renderChunkKey(x, y, z);
  const next = (blockChunkCounts.get(chunkKey) || 0) + amount;
  if (next > 0) blockChunkCounts.set(chunkKey, next);
  else blockChunkCounts.delete(chunkKey);
}

class TrackedBlockMap extends Map {
  set(position, type) {
    const previous = this.get(position);
    super.set(position, type);
    if (previous !== type) {
      blockMutationRevision++;
      if (activeUndoChanges && !activeUndoChanges.has(position)) {
        activeUndoChanges.set(position, previous ?? null);
      }
      if (previous != null) {
        const previousCount = (blockTypeCounts.get(previous) || 1) - 1;
        if (previousCount > 0) blockTypeCounts.set(previous, previousCount);
        else blockTypeCounts.delete(previous);
      }
      blockTypeCounts.set(type, (blockTypeCounts.get(type) || 0) + 1);
      if (previous == null) adjustBlockChunkCount(position, 1);
      const [x, y, z] = String(position).split(",").map(Number);
      if ([x, y, z].every(Number.isFinite)) {
        const columnKey = `${x},${z}`;
        if (!columnTopCache.has(columnKey) || y > columnTopCache.get(columnKey)) {
          columnTopCache.set(columnKey, y);
        }
        markRenderChunkDirty(x, y, z);
      }
    }
    return this;
  }

  delete(position) {
    if (!this.has(position)) return false;
    const previous = this.get(position);
    if (activeUndoChanges && !activeUndoChanges.has(position)) {
      activeUndoChanges.set(position, previous ?? null);
    }
    const deleted = super.delete(position);
    blockMutationRevision++;
    const previousCount = (blockTypeCounts.get(previous) || 1) - 1;
    if (previousCount > 0) blockTypeCounts.set(previous, previousCount);
    else blockTypeCounts.delete(previous);
    adjustBlockChunkCount(position, -1);
    const [x, y, z] = String(position).split(",").map(Number);
    if ([x, y, z].every(Number.isFinite)) {
      const columnKey = `${x},${z}`;
      if (columnTopCache.get(columnKey) === y) {
        let nextTop = y - 1;
        while (nextTop >= 0 && !this.has(key(x, nextTop, z))) nextTop--;
        columnTopCache.set(columnKey, nextTop);
      }
      markRenderChunkDirty(x, y, z);
    }
    return deleted;
  }
}

function createTrackedBlockMap(entries = []) {
  blockTypeCounts.clear();
  blockChunkCounts.clear();
  columnTopCache.clear();
  return new TrackedBlockMap(entries);
}

async function createTrackedBlockMapFromBlocks(rawBlocks, revision, showProgress) {
  blockTypeCounts.clear();
  blockChunkCounts.clear();
  columnTopCache.clear();
  dirtyRenderChunks.clear();
  pendingRenderChunks.clear();
  const map = new TrackedBlockMap();
  const total = rawBlocks.length;
  let batchStartedAt = performance.now();
  for (let index = 0; index < total; index++) {
    if (revision !== structureLoadRevision) return null;
    const block = rawBlocks[index];
    const x = Number(block.x), y = Number(block.y), z = Number(block.z);
    if (valid({ x, y, z })) {
      const position = key(x, y, z);
      const type = block.type || "stone";
      const previous = map.get(position);
      Map.prototype.set.call(map, position, type);
      if (previous !== type) {
        if (previous != null) {
          const previousCount = (blockTypeCounts.get(previous) || 1) - 1;
          if (previousCount > 0) blockTypeCounts.set(previous, previousCount);
          else blockTypeCounts.delete(previous);
        }
        blockTypeCounts.set(type, (blockTypeCounts.get(type) || 0) + 1);
        if (previous == null) {
          const chunkKey = renderChunkKey(x, y, z);
          blockChunkCounts.set(chunkKey, (blockChunkCounts.get(chunkKey) || 0) + 1);
        }
        const columnKey = `${x},${z}`;
        if (!columnTopCache.has(columnKey) || y > columnTopCache.get(columnKey)) columnTopCache.set(columnKey, y);
      }
    }
    if (performance.now() - batchStartedAt >= 12) {
      if (showProgress) updateBpyProgress(
        5 + (total ? (index + 1) / total : 1) * 68,
        `${(index + 1).toLocaleString()} / ${total.toLocaleString()} 블록 읽는 중…`,
        "큰 구조물 불러오는 중"
      );
      await nextUiFrame();
      batchStartedAt = performance.now();
    }
  }
  blockMutationRevision++;
  return map;
}

let blocks = createTrackedBlockMap();
let renderedMeshes = [];
let renderedFaceCount = 0;
let tool = "move";
let selectionA = null;
let selectionB = null;
let selectionMask = new Set();
let selectionBoundsCache = null;
let selectionMaskMesh = null;
let selectionSurfaceMesh = null;
let currentFile = null;
let history = [];
let future = [];
let groupedMutation = false;
let pointerDown = null;
let hoveredCell = null;
let lastPointer = null;
let clipboardBlocks = [];
let placementScale = 1;
let placementStretch = { x: 1, y: 1, z: 1 };
let placementRotation = { x: 0, y: 0, z: 0 };
let pendingPlacement = null;
let transformMode = "scale";
let transformAxis = "y";
const zeroRotation = () => ({ x: 0, y: 0, z: 0 });
const cloneRotation = rotation => ({ x: rotation.x, y: rotation.y, z: rotation.z });
const unitStretch = () => ({ x: 1, y: 1, z: 1 });
const cloneStretch = stretch => ({ x: stretch.x, y: stretch.y, z: stretch.z });
const effectiveScale = () => new THREE.Vector3(
  placementScale * placementStretch.x,
  placementScale * placementStretch.y,
  placementScale * placementStretch.z
);
const rotationText = rotation =>
  `X ${rotation.x}° · Y ${rotation.y}° · Z ${rotation.z}°`;
const scaleText = () => `${placementScale}× · 늘이기 X ${placementStretch.x} · Y ${placementStretch.y} · Z ${placementStretch.z}`;

const key = (x, y, z) => `${x},${y},${z}`;
const valid = ({ x, y, z }) =>
  x >= 0 && y >= 0 && z >= 0 &&
  x < workspaceSize.x && y < workspaceSize.y && z < workspaceSize.z;
const cloneCell = cell => cell && ({ x: cell.x, y: cell.y, z: cell.z });

function updateCamera() {
  const sinPhi = Math.sin(phi);
  camera.position.set(
    target.x + radius * sinPhi * Math.sin(theta),
    target.y + radius * Math.cos(phi),
    target.z + radius * sinPhi * Math.cos(theta)
  );
  camera.lookAt(target);
  camera.updateMatrixWorld();
  updateAxisGizmo();
  updateTransformVisualGizmoScale();
}

function renderDistanceBlocks() {
  return Number(document.getElementById("render-distance")?.value || 256);
}

function chunkDistanceToCamera(chunkKey) {
  const [chunkX, chunkY, chunkZ] = chunkKey.split(",").map(Number);
  const minX = chunkX * renderChunkSize;
  const minY = chunkY * renderChunkSize;
  const minZ = chunkZ * renderChunkSize;
  const maxX = minX + renderChunkSize;
  const maxY = minY + renderChunkSize;
  const maxZ = minZ + renderChunkSize;
  const dx = Math.max(minX - camera.position.x, 0, camera.position.x - maxX);
  const dy = Math.max(minY - camera.position.y, 0, camera.position.y - maxY);
  const dz = Math.max(minZ - camera.position.z, 0, camera.position.z - maxZ);
  return Math.hypot(dx, dy, dz);
}

function desiredResidentRenderChunks() {
  const maximumDistance = renderDistanceBlocks() + renderChunkSize;
  return new Set([...blockChunkCounts.keys()].filter(
    chunkKey => chunkDistanceToCamera(chunkKey) <= maximumDistance
  ));
}

function syncChunkStreaming(force = false) {
  const signature = [
    Math.floor(camera.position.x / renderChunkSize),
    Math.floor(camera.position.y / renderChunkSize),
    Math.floor(camera.position.z / renderChunkSize),
    renderDistanceBlocks()
  ].join(",");
  if (!force && signature === lastChunkStreamingSignature) return;
  lastChunkStreamingSignature = signature;
  rebuild(false, true);
}

function updateTransformVisualGizmoScale() {
  if (!transformVisualGizmo.visible) return;
  const distance = camera.position.distanceTo(transformVisualGizmo.position);
  transformVisualGizmo.scale.setScalar(Math.max(0.8, distance * 0.055));
}

function updateAxisGizmo() {
  const gizmo = document.getElementById("axis-gizmo");
  if (!gizmo) return;
  const projectedOrigin = target.clone().project(camera);
  const axes = {
    x: new THREE.Vector3(1, 0, 0),
    y: new THREE.Vector3(0, 1, 0),
    z: new THREE.Vector3(0, 0, 1)
  };
  for (const [name, direction] of Object.entries(axes)) {
    const projectedEnd = target.clone().add(direction).project(camera);
    let dx = projectedEnd.x - projectedOrigin.x;
    let dy = -(projectedEnd.y - projectedOrigin.y);
    const length = Math.hypot(dx, dy) || 1;
    dx /= length;
    dy /= length;
    const line = gizmo.querySelector(`.axis-line.${name}`);
    const label = gizmo.querySelector(`span.${name}`);
    if (line) line.style.transform = `rotate(${Math.atan2(dy, dx)}rad)`;
    if (label) {
      label.style.left = `${29 + dx * 23}px`;
      label.style.top = `${29 + dy * 23}px`;
    }
  }
}
updateCamera();

const pressedKeys = new Set();
const movementCodeNames = {
  KeyW: "w", KeyA: "a", KeyS: "s", KeyD: "d",
  Space: "space", ShiftLeft: "shift", ShiftRight: "shift"
};
window.addEventListener("keydown", event => {
  if (!playMode && (event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement)) return;
  if (event.metaKey || event.ctrlKey || event.altKey) return;
  const keyName = movementCodeNames[event.code];
  if (keyName) {
    pressedKeys.add(keyName);
    event.preventDefault();
  }
});
window.addEventListener("keyup", event => {
  const keyName = movementCodeNames[event.code];
  if (keyName) pressedKeys.delete(keyName);
});
window.addEventListener("blur", () => pressedKeys.clear());

let playMode = false;
let playerPosition = new THREE.Vector3();
let playerVelocityY = 0;
let playerGrounded = false;
let playerYaw = 0;
let playerPitch = 0;
let playLookPointer = null;
let playCoordinatePrecise = true;
let editorCameraFov = camera.fov;
let selectionVisibilityBeforePlay = null;
const playerHalfWidth = 0.3;
const playerHeight = 1.8;
const playerEyeHeight = 1.62;

function playerCollides(position) {
  if (position.y < 0) return true;
  const epsilon = 0.001;
  const minX = Math.floor(position.x - playerHalfWidth + epsilon);
  const maxX = Math.floor(position.x + playerHalfWidth - epsilon);
  const minY = Math.floor(position.y + epsilon);
  const maxY = Math.floor(position.y + playerHeight - epsilon);
  const minZ = Math.floor(position.z - playerHalfWidth + epsilon);
  const maxZ = Math.floor(position.z + playerHalfWidth - epsilon);
  for (let x = minX; x <= maxX; x++)
    for (let y = minY; y <= maxY; y++)
      for (let z = minZ; z <= maxZ; z++)
        if (blocks.has(key(x, y, z))) return true;
  return false;
}

function movePlayerAxis(axis, amount) {
  if (!amount) return false;
  const steps = Math.max(1, Math.ceil(Math.abs(amount) / 0.08));
  const step = amount / steps;
  for (let index = 0; index < steps; index++) {
    const next = playerPosition.clone();
    next[axis] += step;
    if (playerCollides(next)) return true;
    playerPosition.copy(next);
  }
  return false;
}

function updatePlayCamera() {
  camera.position.set(
    playerPosition.x,
    playerPosition.y + playerEyeHeight,
    playerPosition.z
  );
  camera.rotation.order = "YXZ";
  camera.rotation.set(playerPitch, playerYaw, 0);
  camera.updateMatrixWorld();
  const now = performance.now();
  if (now - lastPlayViewUiAt >= 50) {
    lastPlayViewUiAt = now;
    updateAxisGizmo();
    refreshHover();
  }
}

function findPlaySpawn() {
  const x = Math.floor(workspaceSize.x / 2) + 0.5;
  const z = Math.floor(workspaceSize.z / 2) + 0.5;
  let y = 0;
  for (const position of blocks.keys()) {
    const [blockX, blockY, blockZ] = position.split(",").map(Number);
    if (blockX === Math.floor(x) && blockZ === Math.floor(z)) y = Math.max(y, blockY + 1);
  }
  const spawn = new THREE.Vector3(x, y, z);
  while (playerCollides(spawn) && spawn.y < workspaceSize.y + 16) spawn.y += 1;
  return spawn;
}

function enterPlayMode() {
  if (playMode) return;
  if (pendingPlacement) cancelPendingPlacement();
  setTool("move");
  const editorCameraPosition = camera.position.clone();
  const editorCameraDirection = new THREE.Vector3();
  camera.getWorldDirection(editorCameraDirection);
  playMode = true;
  editorCameraFov = camera.fov;
  camera.fov = Number(document.getElementById("play-fov")?.value || 70);
  camera.updateProjectionMatrix();
  playerPosition.set(
    editorCameraPosition.x,
    editorCameraPosition.y - playerEyeHeight,
    editorCameraPosition.z
  );
  while (playerCollides(playerPosition) && playerPosition.y < workspaceSize.y + 32) {
    playerPosition.y += 0.25;
  }
  playerVelocityY = 0;
  playerGrounded = false;
  playerYaw = Math.atan2(-editorCameraDirection.x, -editorCameraDirection.z);
  playerPitch = Math.asin(THREE.MathUtils.clamp(editorCameraDirection.y, -1, 1));
  selectionVisibilityBeforePlay = {
    box: selectionBox.visible,
    fill: selectionFill.visible,
    mask: selectionMaskMesh?.visible ?? false,
    surface: selectionSurfaceMesh?.visible ?? false
  };
  selectionBox.visible = false;
  selectionFill.visible = false;
  if (selectionMaskMesh) selectionMaskMesh.visible = false;
  if (selectionSurfaceMesh) selectionSurfaceMesh.visible = false;
  hover.visible = false;
  clearGhost();
  transformVisualGizmo.visible = false;
  document.querySelector(".viewport")?.classList.add("playing");
  pressedKeys.clear();
  updatePlayCamera();
  canvas.focus();
}

function exitPlayMode() {
  if (!playMode) return;
  playMode = false;
  pressedKeys.clear();
  playerVelocityY = 0;
  playLookPointer = null;
  selectionVisibilityBeforePlay = null;
  updateSelection();
  document.querySelector(".viewport")?.classList.remove("playing");
  camera.fov = editorCameraFov;
  camera.updateProjectionMatrix();
  updateCamera();
  refreshHover();
}

function movePlayer(deltaSeconds) {
  const forwardAmount = (pressedKeys.has("w") ? 1 : 0) - (pressedKeys.has("s") ? 1 : 0);
  const rightAmount = (pressedKeys.has("d") ? 1 : 0) - (pressedKeys.has("a") ? 1 : 0);
  const length = Math.hypot(forwardAmount, rightAmount) || 1;
  const speed = (pressedKeys.has("shift") ? 8.6 : 4.3) * deltaSeconds;
  const forwardX = -Math.sin(playerYaw);
  const forwardZ = -Math.cos(playerYaw);
  const rightX = Math.cos(playerYaw);
  const rightZ = -Math.sin(playerYaw);
  movePlayerAxis("x", (forwardX * forwardAmount + rightX * rightAmount) / length * speed);
  movePlayerAxis("z", (forwardZ * forwardAmount + rightZ * rightAmount) / length * speed);
  if (pressedKeys.has("space") && playerGrounded) {
    playerVelocityY = 8.4;
    playerGrounded = false;
  }
  playerVelocityY = Math.max(-24, playerVelocityY - 24 * deltaSeconds);
  const verticalCollision = movePlayerAxis("y", playerVelocityY * deltaSeconds);
  if (verticalCollision) {
    if (playerVelocityY < 0) playerGrounded = true;
    playerVelocityY = 0;
  } else {
    const probe = playerPosition.clone();
    probe.y -= 0.04;
    playerGrounded = playerCollides(probe);
  }
  if (playerPosition.y < -8) playerPosition.copy(findPlaySpawn());
  updatePlayCamera();
}

document.getElementById("play-mode")?.addEventListener("click", enterPlayMode);
window.addEventListener("pointermove", event => {
  if (!playMode || playLookPointer?.pointerId !== event.pointerId) return;
  const movementX = event.clientX - playLookPointer.x;
  const movementY = event.clientY - playLookPointer.y;
  playLookPointer.x = event.clientX;
  playLookPointer.y = event.clientY;
  const sensitivity = Number(document.getElementById("play-sensitivity")?.value || 100) / 100;
  playerYaw -= movementX * 0.004 * sensitivity;
  playerPitch = THREE.MathUtils.clamp(playerPitch - movementY * 0.004 * sensitivity, -1.54, 1.54);
  updatePlayCamera();
});
window.addEventListener("pointerup", event => {
  if (playLookPointer?.pointerId === event.pointerId) playLookPointer = null;
});
window.addEventListener("pointercancel", event => {
  if (playLookPointer?.pointerId === event.pointerId) playLookPointer = null;
});
document.getElementById("play-fov")?.addEventListener("input", event => {
  const value = Number(event.target.value);
  document.getElementById("play-fov-value").textContent = `${value}°`;
  if (!playMode) return;
  camera.fov = value;
  camera.updateProjectionMatrix();
});
document.getElementById("play-sensitivity")?.addEventListener("input", event => {
  document.getElementById("play-sensitivity-value").textContent = `${Number(event.target.value)}%`;
});
document.querySelectorAll(".play-settings input").forEach(input => {
  input.addEventListener("change", () => {
    input.blur();
    canvas.focus();
  });
});

function moveCamera(deltaSeconds) {
  if (!pressedKeys.size) return false;
  const speed = Number(document.getElementById("camera-speed")?.value || 64) * deltaSeconds;
  const forward = new THREE.Vector3();
  camera.getWorldDirection(forward);
  forward.y = 0;
  if (forward.lengthSq()) forward.normalize();
  const right = new THREE.Vector3().crossVectors(forward, camera.up).normalize();
  const movement = new THREE.Vector3();
  if (pressedKeys.has("w")) movement.add(forward);
  if (pressedKeys.has("s")) movement.sub(forward);
  if (pressedKeys.has("d")) movement.add(right);
  if (pressedKeys.has("a")) movement.sub(right);
  if (pressedKeys.has("space")) movement.y += 1;
  if (pressedKeys.has("shift")) movement.y -= 1;
  if (!movement.lengthSq()) return false;
  movement.normalize().multiplyScalar(speed);
  target.add(movement);
  updateCamera();
  noteCameraMotion();
  return true;
}

function updateLighting(value) {
  const time = Number(value);
  const angle = ((time - 6000) / 24000) * Math.PI * 2;
  const daylight = THREE.MathUtils.clamp(Math.cos(angle) * 0.85 + 0.15, 0.05, 1);
  sun.position.set(
    Math.sin(angle) * 30 + workspaceSize.x / 2,
    Math.cos(angle) * 30,
    Math.cos(angle * 0.7) * 20 + workspaceSize.z / 2
  );
  sun.intensity = 0.25 + daylight * 2.4;
  rim.intensity = 0.45 + (1 - daylight) * 1.2;
  const night = new THREE.Color(0x07101d);
  const day = new THREE.Color(0x86b9d8);
  const sunset = new THREE.Color(0xd36b4b);
  let sky = night.clone().lerp(day, daylight);
  if ((time > 11500 && time < 14500) || (time > 22500 || time < 1500)) {
    const edge = time > 11500 && time < 14500
      ? 1 - Math.abs(time - 13000) / 1500
      : 1 - Math.min(Math.abs(time - 24000), Math.abs(time)) / 1500;
    sky.lerp(sunset, Math.max(0, edge) * 0.65);
  }
  scene.background = sky;
  scene.fog.color.copy(sky).multiplyScalar(0.55);
  const hours = (time / 1000 + 6) % 24;
  document.getElementById("time-value").textContent =
    `${String(Math.floor(hours)).padStart(2, "0")}:${String(Math.floor((hours % 1) * 60)).padStart(2, "0")} · ${time} ticks`;
}

function updateViewSettings() {
  const fogAmount = Number(document.getElementById("fog-density")?.value || 0);
  const renderDistance = Number(document.getElementById("render-distance")?.value || 256);
  scene.fog.density = fogAmount / 1000;
  camera.far = renderDistance;
  camera.updateProjectionMatrix();
  document.getElementById("fog-value").textContent = fogAmount === 0 ? "꺼짐" : `${fogAmount}%`;
  document.getElementById("render-distance-value").textContent = `${renderDistance} blocks`;
  document.getElementById("speed-value").textContent =
    `${Number(document.getElementById("camera-speed")?.value || 64).toFixed(1)} blocks/s`;
  syncChunkStreaming(true);
}

function remember() {
  if (!activeUndoChanges) activeUndoChanges = new Map();
}

function commitUndoTransaction() {
  if (!activeUndoChanges) return;
  const changes = [];
  for (const [position, before] of activeUndoChanges) {
    const after = blocks.get(position) ?? null;
    if (before !== after) changes.push({ position, before, after });
  }
  activeUndoChanges = null;
  if (!changes.length) return;
  history.push({ changes });
  if (history.length > 100) history.shift();
  future = [];
}

function applyUndoTransaction(transaction, direction) {
  activeUndoChanges = null;
  for (const change of transaction.changes) {
    const value = direction === "undo" ? change.before : change.after;
    if (value == null) blocks.delete(change.position);
    else blocks.set(change.position, value);
  }
  rebuild();
}

function mutate(action) {
  const ownTransaction = !groupedMutation;
  if (ownTransaction) remember();
  action();
  if (ownTransaction) commitUndoTransaction();
  markCurrentProjectFileDirty();
  if (groupedMutation) {
    pendingGroupedRebuild = true;
    updateStatsLightweight();
  } else {
    rebuild();
  }
}

let pendingGroupedRebuild = false;
function updateStatsLightweight() {
  document.getElementById("block-count").textContent = String(blocks.size);
  document.getElementById("status-count").textContent = `${blocks.size} blocks · 편집 중`;
  document.getElementById("dirty-state").textContent = "수정됨";
}

function flushGroupedRebuild() {
  commitUndoTransaction();
  if (!pendingGroupedRebuild) return;
  pendingGroupedRebuild = false;
  clearLiveEditPreview();
  rebuild();
}

function sharedChunkMaterial(type, face, definition) {
  const shortType = shortBlockId(type);
  const texture = blockTexture(type, face);
  const textureTint = blockTextureTint(shortType, face);
  const waterTint = /^(?:flowing_)?water$/.test(shortType) ? textureTint : null;
  const cutout = isCutoutTextureBlock(shortType);
  const translucentGlass = isTranslucentGlassBlock(shortType);
  const cacheKey = [
    type, face, texture?.uuid || 'solid', textureTint ?? '', waterTint ?? '',
    definition.color ?? '', definition.opacity ?? '', cutout ? 1 : 0, translucentGlass ? 1 : 0
  ].join('|');
  if (sharedChunkMaterials.has(cacheKey)) return sharedChunkMaterials.get(cacheKey);
  const material = texture ? new THREE.MeshStandardMaterial({
    color: textureTint ?? 0xffffff,
    map: texture,
    transparent: Boolean(definition.opacity) || waterTint !== null || cutout || translucentGlass,
    opacity: waterTint !== null ? 0.76 : translucentGlass ? 0.72 : (definition.opacity || 1),
    depthWrite: waterTint === null && !translucentGlass,
    alphaTest: cutout ? 0.35 : 0,
    roughness: waterTint !== null ? 0.32 : translucentGlass ? 0.16 : 0.9,
    metalness: 0
  }) : new THREE.MeshStandardMaterial({
    color: definition.color,
    transparent: Boolean(definition.opacity),
    opacity: definition.opacity || 1,
    roughness: 0.82,
    metalness: type === 'gold_block' ? 0.28 : 0.02
  });
  material.userData.sharedChunkMaterial = true;
  sharedChunkMaterials.set(cacheKey, material);
  return material;
}

function rebuild(forceAll = false, streamingOnly = false) {
  const desiredPixelRatio = blocks.size > 100000 ? 1 : Math.min(devicePixelRatio, 1.5);
  if (desiredPixelRatio !== activePixelRatio) {
    activePixelRatio = desiredPixelRatio;
    renderer.setPixelRatio(activePixelRatio);
  }
  const chunkShadowMode = blocks.size <= 50000;
  const desiredChunks = desiredResidentRenderChunks();
  const rebuildAll = forceAll || forceFullRebuildPending ||
    chunkShadowMode !== lastChunkShadowMode;
  for (const chunkKey of [...pendingRenderChunks]) {
    if (!desiredChunks.has(chunkKey)) pendingRenderChunks.delete(chunkKey);
  }
  const chunksToDispose = new Set(
    [...residentRenderChunks].filter(chunkKey => !desiredChunks.has(chunkKey))
  );
  if (rebuildAll) {
    for (const chunkKey of residentRenderChunks) chunksToDispose.add(chunkKey);
    for (const chunkKey of desiredChunks) pendingRenderChunks.add(chunkKey);
    forceFullRebuildPending = false;
    lastChunkShadowMode = chunkShadowMode;
  } else {
    for (const chunkKey of desiredChunks) {
      if (!residentRenderChunks.has(chunkKey) ||
          (!streamingOnly && dirtyRenderChunks.has(chunkKey))) pendingRenderChunks.add(chunkKey);
    }
  }
  const chunksToBuild = [...pendingRenderChunks]
    .sort((left, right) => chunkDistanceToCamera(left) - chunkDistanceToCamera(right))
    .slice(0, progressiveChunksPerFrame);
  for (const chunkKey of chunksToBuild) chunksToDispose.add(chunkKey);
  if (!chunksToBuild.length && !chunksToDispose.size) {
    updateSelection();
    updateStats();
    refreshHover();
    if (structureMeshLoadingProgress) {
      structureMeshLoadingProgress = false;
      updateBpyProgress(100, `${blocks.size.toLocaleString()}개 블록 로딩 완료`, "큰 구조물 불러오는 중");
      setTimeout(hideBpyProgress, 180);
    }
    return;
  }
  for (const chunkKey of chunksToDispose) {
    for (const mesh of chunkRenderMeshes.get(chunkKey) || []) {
      scene.remove(mesh);
      mesh.geometry.dispose();
      if (Array.isArray(mesh.material)) mesh.material.forEach(material => {
        if (!material.userData.sharedChunkMaterial) material.dispose();
      });
      else if (!mesh.material.userData.sharedChunkMaterial) mesh.material.dispose();
    }
    chunkRenderMeshes.delete(chunkKey);
    chunkVisibleFaces.delete(chunkKey);
    residentRenderChunks.delete(chunkKey);
  }

  const faceDefinitions = [
    { textureFace: "east", neighbor: [1, 0, 0], normal: [1, 0, 0], axis: 0, u: 1, v: 2, corners: [[1,0,0],[1,1,0],[1,1,1],[1,0,1]] },
    { textureFace: "west", neighbor: [-1, 0, 0], normal: [-1, 0, 0], axis: 0, u: 1, v: 2, corners: [[0,0,1],[0,1,1],[0,1,0],[0,0,0]] },
    { textureFace: "up", neighbor: [0, 1, 0], normal: [0, 1, 0], axis: 1, u: 0, v: 2, corners: [[0,1,1],[1,1,1],[1,1,0],[0,1,0]] },
    { textureFace: "down", neighbor: [0, -1, 0], normal: [0, -1, 0], axis: 1, u: 0, v: 2, corners: [[0,0,0],[1,0,0],[1,0,1],[0,0,1]] },
    { textureFace: "south", neighbor: [0, 0, 1], normal: [0, 0, 1], axis: 2, u: 0, v: 1, corners: [[1,0,1],[1,1,1],[0,1,1],[0,0,1]] },
    { textureFace: "north", neighbor: [0, 0, -1], normal: [0, 0,-1], axis: 2, u: 0, v: 1, corners: [[0,0,0],[0,1,0],[1,1,0],[1,0,0]] }
  ];
  for (const activeChunkKey of chunksToBuild) {
    const [chunkX, chunkY, chunkZ] = activeChunkKey.split(",").map(Number);
    const grouped = new Map();
    const startX = chunkX * renderChunkSize;
    const startY = chunkY * renderChunkSize;
    const startZ = chunkZ * renderChunkSize;
    for (let x = Math.max(0, startX); x < Math.min(workspaceSize.x, startX + renderChunkSize); x++)
      for (let y = Math.max(0, startY); y < Math.min(workspaceSize.y, startY + renderChunkSize); y++)
        for (let z = Math.max(0, startZ); z < Math.min(workspaceSize.z, startZ + renderChunkSize); z++) {
          const type = blocks.get(key(x, y, z));
          if (!type) continue;
          if (!grouped.has(type)) grouped.set(type, []);
          grouped.get(type).push([x, y, z]);
        }
    const meshesForChunk = [];
    let visibleFacesForChunk = 0;
    for (const [type, cells] of grouped) {
    const positions = [];
    const normals = [];
    const uvs = [];
    const materialGroups = [];
    let mergedFaceCount = 0;
    for (const face of faceDefinitions) {
      const faceVertexStart = positions.length / 3;
      const planes = new Map();
      for (const cell of cells) {
        const [x, y, z] = cell;
        const [dx, dy, dz] = face.neighbor;
        if (blocks.has(key(x + dx, y + dy, z + dz))) continue;
        const plane = cell[face.axis];
        if (!planes.has(plane)) planes.set(plane, new Set());
        planes.get(plane).add(`${cell[face.u]},${cell[face.v]}`);
      }
      for (const [plane, remaining] of planes) {
        while (remaining.size) {
          const first = remaining.values().next().value;
          const [startU, startV] = first.split(",").map(Number);
          let width = 1;
          while (remaining.has(`${startU + width},${startV}`)) width++;
          let height = 1;
          grow: while (true) {
            for (let offset = 0; offset < width; offset++) {
              if (!remaining.has(`${startU + offset},${startV + height}`)) break grow;
            }
            height++;
          }
          for (let du = 0; du < width; du++)
            for (let dv = 0; dv < height; dv++)
              remaining.delete(`${startU + du},${startV + dv}`);
          const base = [0, 0, 0];
          base[face.axis] = plane;
          base[face.u] = startU;
          base[face.v] = startV;
          const expandedCorners = face.corners.map(corner => {
            const point = [...base];
            point[face.axis] += corner[face.axis];
            point[face.u] += corner[face.u] ? width : 0;
            point[face.v] += corner[face.v] ? height : 0;
            return point;
          });
          const vertices = [expandedCorners[0], expandedCorners[1], expandedCorners[2],
            expandedCorners[0], expandedCorners[2], expandedCorners[3]];
          const faceUvs = face.corners.map(corner => face.axis === 0
            // 동·서쪽 면은 Z가 텍스처 가로축이고 Y가 세로축이다.
            ? [corner[face.v] ? height : 0, corner[face.u] ? width : 0]
            : [corner[face.u] ? width : 0, corner[face.v] ? height : 0]
          );
          const vertexUvs = [faceUvs[0], faceUvs[1], faceUvs[2], faceUvs[0], faceUvs[2], faceUvs[3]];
          vertices.forEach(([vx, vy, vz], vertexIndex) => {
            positions.push(vx, vy, vz);
            normals.push(...face.normal);
            uvs.push(...vertexUvs[vertexIndex]);
          });
          mergedFaceCount++;
        }
      }
      const faceVertexCount = positions.length / 3 - faceVertexStart;
      if (faceVertexCount) materialGroups.push({
        start: faceVertexStart,
        count: faceVertexCount,
        face: face.textureFace
      });
    }
    if (!positions.length) continue;
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
    geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
    materialGroups.forEach((group, index) => geometry.addGroup(group.start, group.count, index));
    geometry.computeBoundingSphere();
    visibleFacesForChunk += mergedFaceCount;
    const definition = blockTypes[shortBlockId(type)] || { color: blockColor(type) };
    const materials = materialGroups.map(group => sharedChunkMaterial(type, group.face, definition));
    const material = materials.length === 1 ? materials[0] : materials;
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = chunkShadowMode;
    mesh.receiveShadow = chunkShadowMode;
    mesh.userData.greedyMeshed = true;
    mesh.userData.chunkKey = activeChunkKey;
    scene.add(mesh);
    meshesForChunk.push(mesh);
    }
    if (meshesForChunk.length) chunkRenderMeshes.set(activeChunkKey, meshesForChunk);
    if (visibleFacesForChunk) chunkVisibleFaces.set(activeChunkKey, visibleFacesForChunk);
    residentRenderChunks.add(activeChunkKey);
    pendingRenderChunks.delete(activeChunkKey);
    dirtyRenderChunks.delete(activeChunkKey);
  }
  const renderingComplete = !pendingRenderChunks.size;
  if (renderingComplete) lastChunkShadowMode = chunkShadowMode;
  renderedMeshes = [...chunkRenderMeshes.values()].flat();
  renderedFaceCount = [...chunkVisibleFaces.values()].reduce((sum, count) => sum + count, 0);
  if (renderingComplete) {
    updateSelection();
    updateStats();
    refreshHover();
    if (structureMeshLoadingProgress) {
      structureMeshLoadingProgress = false;
      updateBpyProgress(100, `${blocks.size.toLocaleString()}개 블록 로딩 완료`, "큰 구조물 불러오는 중");
      setTimeout(hideBpyProgress, 180);
    }
  }
}

function updateStats() {
  document.getElementById("block-count").textContent = String(blocks.size);
  document.getElementById("type-count").textContent = String(blockTypeCounts.size);
  document.getElementById("status-count").textContent =
    `${blocks.size} blocks · ${residentRenderChunks.size}/${blockChunkCounts.size} chunks · ${renderedFaceCount} visible faces`;
  document.getElementById("selection-a").textContent = selectionA ? `${selectionA.x}, ${selectionA.y}, ${selectionA.z}` : "미지정";
  document.getElementById("selection-b").textContent = selectionB ? `${selectionB.x}, ${selectionB.y}, ${selectionB.z}` : "미지정";
  document.getElementById("selection-mode-label").textContent = selectionMask.size
    ? `브러시 선택 · ${selectionMask.size}칸`
    : selectionA && selectionB ? "직육면체 선택" : "선택 없음";
  syncSelectionInputs();
  const dirty = history.length > 0 ? "수정됨" : "저장됨";
  document.getElementById("dirty-state").textContent = dirty;
}

function updateSelection() {
  if (selectionSurfaceMesh) {
    scene.remove(selectionSurfaceMesh);
    selectionSurfaceMesh.material.dispose();
    selectionSurfaceMesh = null;
  }
  if (selectionMaskMesh) {
    scene.remove(selectionMaskMesh);
    selectionMaskMesh.geometry.dispose();
    selectionMaskMesh.material.dispose();
    selectionMaskMesh = null;
  }
  if (playMode) {
    selectionBox.visible = false;
    selectionFill.visible = false;
    return;
  }
  if (selectionMask.size) {
    const selectionCount = selectionMask.size;
    const instanceLimit = selectionCount <= 1000 ? selectionCount : 0;
    const selectionCells = [];
    const bounds = {
      min: { x: Infinity, y: Infinity, z: Infinity },
      max: { x: -Infinity, y: -Infinity, z: -Infinity }
    };
    for (const position of selectionMask) {
      const [x, y, z] = position.split(",").map(Number);
      if (instanceLimit) selectionCells.push({ x, y, z });
      bounds.min.x = Math.min(bounds.min.x, x);
      bounds.min.y = Math.min(bounds.min.y, y);
      bounds.min.z = Math.min(bounds.min.z, z);
      bounds.max.x = Math.max(bounds.max.x, x);
      bounds.max.y = Math.max(bounds.max.y, y);
      bounds.max.z = Math.max(bounds.max.z, z);
    }
    const sampledPositions = instanceLimit ? selectionCells : [];
    selectionBoundsCache = {
      min: { ...bounds.min },
      max: { ...bounds.max }
    };
    const adaptiveOpacity = selectionCount <= 256 ? 0.34
      : selectionCount <= 1000 ? 0.2
        : selectionCount <= 10000 ? 0.1 : 0.055;
    if (sampledPositions.length) {
      const geometry = new THREE.BoxGeometry(1.035, 1.035, 1.035);
      const material = new THREE.MeshBasicMaterial({
        color: 0xc6a8ff, transparent: true, opacity: adaptiveOpacity,
        depthTest: selectionCount > 256, depthWrite: false, wireframe: true
      });
      selectionMaskMesh = new THREE.InstancedMesh(geometry, material, sampledPositions.length);
      selectionMaskMesh.renderOrder = 26;
      const matrix = new THREE.Matrix4();
      sampledPositions.forEach(({ x, y, z }, index) => {
        matrix.makeTranslation(x + 0.5, y + 0.5, z + 0.5);
        selectionMaskMesh.setMatrixAt(index, matrix);
      });
      scene.add(selectionMaskMesh);
    }
    if (selectionCount > 1000) {
      const width = bounds.max.x - bounds.min.x + 1.04;
      const height = bounds.max.y - bounds.min.y + 1.04;
      const depth = bounds.max.z - bounds.min.z + 1.04;
      selectionBox.geometry.dispose();
      selectionBox.geometry = new THREE.EdgesGeometry(new THREE.BoxGeometry(width, height, depth));
      selectionBox.position.set(
        (bounds.min.x + bounds.max.x + 1) / 2,
        (bounds.min.y + bounds.max.y + 1) / 2,
        (bounds.min.z + bounds.max.z + 1) / 2
      );
      selectionBox.material.opacity = selectionCount > 10000 ? 0.58 : 0.72;
      selectionBox.visible = true;
      selectionFill.visible = false;
      renderSelectionSurfacePreview(bounds);
    } else {
      selectionBox.visible = false;
      selectionFill.visible = false;
    }
    return;
  }
  if (!selectionA || !selectionB) {
    selectionBoundsCache = null;
    selectionBox.visible = false;
    selectionFill.visible = false;
    return;
  }
  const min = {
    x: Math.min(selectionA.x, selectionB.x),
    y: Math.min(selectionA.y, selectionB.y),
    z: Math.min(selectionA.z, selectionB.z),
  };
  const max = {
    x: Math.max(selectionA.x, selectionB.x),
    y: Math.max(selectionA.y, selectionB.y),
    z: Math.max(selectionA.z, selectionB.z),
  };
  selectionBoundsCache = { min: { ...min }, max: { ...max } };
  selectionBox.geometry.dispose();
  selectionBox.geometry = new THREE.EdgesGeometry(
    new THREE.BoxGeometry(max.x - min.x + 1.04, max.y - min.y + 1.04, max.z - min.z + 1.04)
  );
  selectionBox.position.set((min.x + max.x + 1) / 2, (min.y + max.y + 1) / 2, (min.z + max.z + 1) / 2);
  selectionBox.material.opacity = 1;
  selectionBox.visible = true;
  selectionFill.geometry.dispose();
  selectionFill.geometry = new THREE.BoxGeometry(
    max.x - min.x + 1.03, max.y - min.y + 1.03, max.z - min.z + 1.03
  );
  selectionFill.position.copy(selectionBox.position);
  selectionFill.visible = true;
  const selectionVolume = (max.x - min.x + 1) * (max.y - min.y + 1) * (max.z - min.z + 1);
  if (selectionVolume > 1000) {
    selectionFill.visible = false;
    renderSelectionSurfacePreview({ min, max });
  }
}

function resize() {
  const rect = canvas.getBoundingClientRect();
  renderer.setSize(rect.width, rect.height, false);
  camera.aspect = rect.width / Math.max(rect.height, 1);
  camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(canvas);
resize();

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();

function pick(event, adjacent = false) {
  const rect = canvas.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  const maximumPickDistance = blocks.size > 100000
    ? Math.min(renderDistanceBlocks() + renderChunkSize, 96)
    : renderDistanceBlocks() + renderChunkSize;
  raycaster.far = maximumPickDistance;
  const pickMeshes = blocks.size > 100000
    ? renderedMeshes.filter(mesh => chunkDistanceToCamera(mesh.userData.chunkKey) <= maximumPickDistance)
    : renderedMeshes;
  const intersections = raycaster.intersectObjects([...pickMeshes, ground], false);
  raycaster.far = Infinity;
  if (!intersections.length) return null;
  const hit = intersections[0];
  if (hit.object.userData.ground) {
    return { x: Math.floor(hit.point.x), y: 0, z: Math.floor(hit.point.z) };
  }
  const normal = hit.face.normal.clone().transformDirection(hit.object.matrixWorld);
  const inside = hit.point.clone().addScaledVector(normal, -0.001);
  const base = {
    x: Math.floor(inside.x),
    y: Math.floor(inside.y),
    z: Math.floor(inside.z)
  };
  if (!valid(base)) return null;
  if (!adjacent) return base;
  base.x += Math.round(normal.x);
  base.y += Math.round(normal.y);
  base.z += Math.round(normal.z);
  return base;
}

function pickTransformHandle(event) {
  if (!transformVisualGizmo.visible) return null;
  const rect = canvas.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  const hit = raycaster.intersectObjects(transformHandles, true)[0];
  return hit?.object?.userData?.transformHandle || null;
}

let highlightedTransformHandle = null;
function highlightTransformHandle(handle, active = false) {
  const nextKey = handle ? `${handle.kind}:${handle.axis}:${active}` : null;
  if (nextKey === highlightedTransformHandle) return;
  highlightedTransformHandle = nextKey;
  const materials = new Set();
  transformHandles.forEach(object => object.traverse(child => {
    if (child.material) materials.add(child.material);
  }));
  materials.forEach(material => {
    if (!material.userData.transformBaseColor) {
      material.userData.transformBaseColor = material.color.clone();
    }
    material.color.copy(material.userData.transformBaseColor);
  });
  if (!handle) {
    canvas.style.cursor = pendingPlacement?.locked
      ? "grab"
      : tool === "erase"
        ? "not-allowed"
        : isTransformPlacementTool()
          ? "move"
          : tool === "move"
            ? "grab"
            : "crosshair";
    return;
  }
  transformHandles.forEach(object => object.traverse(child => {
    const childHandle = child.userData.transformHandle;
    if (!child.material || childHandle?.kind !== handle.kind || childHandle?.axis !== handle.axis) return;
    child.material.color.copy(child.material.userData.transformBaseColor)
      .lerp(new THREE.Color(0xffffff), active ? 0.78 : 0.5);
  }));
  canvas.style.cursor = active ? "grabbing" : "pointer";
}

function targetsAdjacentCell() {
  if (tool === "erase" || tool === "sculpt") return false;
  if (document.getElementById("place-solid-only")?.checked &&
      (tool === "place" || tool.startsWith("generate:"))) return false;
  return tool === "place" || tool === "paste" || tool.startsWith("generate:");
}

function refreshHover() {
  if (playMode) {
    const rect = canvas.getBoundingClientRect();
    const viewCenter = {
      clientX: rect.left + rect.width / 2,
      clientY: rect.top + rect.height / 2
    };
    const viewedCell = pick(viewCenter, false);
    hoveredCell = viewedCell && valid(viewedCell) && blocks.has(key(viewedCell.x, viewedCell.y, viewedCell.z))
      ? viewedCell
      : null;
    hover.visible = Boolean(hoveredCell);
    if (hoveredCell) {
      hover.position.set(hoveredCell.x + 0.5, hoveredCell.y + 0.5, hoveredCell.z + 0.5);
    }
    if (ghostMesh || ghostBounds) clearGhost();
    transformVisualGizmo.visible = false;
    updateCursorCoordinate(playerPosition, true);
    return;
  }
  if (!lastPointer) {
    hover.visible = false;
    updateCursorCoordinate(null);
    return;
  }
  const pointedCell = pick(lastPointer, false);
  const cell = pick(lastPointer, targetsAdjacentCell());
  hoveredCell = cell && valid(cell) ? cell : null;
  updateCursorCoordinate(pointedCell && valid(pointedCell) ? pointedCell : null);
  hover.visible = Boolean(hoveredCell);
  if (hoveredCell) hover.position.set(hoveredCell.x + 0.5, hoveredCell.y + 0.5, hoveredCell.z + 0.5);
  const previewCell = pendingPlacement?.tool === tool && pendingPlacement.locked
    ? pendingPlacement.origin
    : hoveredCell;
  updateGhostPreview(previewCell);
}

function updateCursorCoordinate(cell, precise = false) {
  const label = document.getElementById("cursor-coordinate");
  if (!label) return;
  const useDecimals = precise && playCoordinatePrecise;
  const coordinate = value => useDecimals
    ? Number(value).toFixed(2)
    : precise ? Math.floor(Number(value)) : value;
  label.textContent = cell
    ? `X ${coordinate(cell.x)} · Y ${coordinate(cell.y)} · Z ${coordinate(cell.z)}`
    : "X — · Y — · Z —";
  if (precise) {
    label.dataset.coordinateMode = useDecimals ? "decimal" : "integer";
    label.title = `클릭하여 ${useDecimals ? "정수" : "소수점"} 좌표로 전환`;
  } else {
    delete label.dataset.coordinateMode;
    label.removeAttribute("title");
  }
}

document.getElementById("cursor-coordinate")?.addEventListener("click", event => {
  if (!playMode) return;
  playCoordinatePrecise = !playCoordinatePrecise;
  updateCursorCoordinate(playerPosition, true);
  event.stopPropagation();
});

function brushRange() {
  const size = Math.max(1, Number(document.getElementById("brush-size")?.value || 1));
  return {
    size,
    min: -Math.floor((size - 1) / 2),
    max: Math.ceil((size - 1) / 2)
  };
}

function addSelectionBrush(cell) {
  const range = brushRange();
  const round = document.getElementById("brush-shape")?.value === "sphere";
  const radius = (range.size - 1) / 2;
  for (let x = cell.x + range.min; x <= cell.x + range.max; x++)
    for (let y = cell.y + range.min; y <= cell.y + range.max; y++)
      for (let z = cell.z + range.min; z <= cell.z + range.max; z++) {
        if (!valid({ x, y, z })) continue;
        if (round && radius > 0 && Math.hypot(x - cell.x, y - cell.y, z - cell.z) > radius + 0.35) continue;
        selectionMask.add(key(x, y, z));
      }
}

function addInterpolatedSelection(from, to) {
  const dx = to.x - from.x, dy = to.y - from.y, dz = to.z - from.z;
  const steps = Math.max(Math.abs(dx), Math.abs(dy), Math.abs(dz));
  for (let index = 0; index <= steps; index++) {
    const amount = steps ? index / steps : 0;
    addSelectionBrush({
      x: Math.round(from.x + dx * amount),
      y: Math.round(from.y + dy * amount),
      z: Math.round(from.z + dz * amount)
    });
  }
}

function currentSelectionMask() {
  return new Set(selectedCellList().map(cell => key(cell.x, cell.y, cell.z)));
}

function selectConnectedAt(start, additive = false, sameTypeOnly = true) {
  const sourceType = blocks.get(key(start.x, start.y, start.z));
  if (!sourceType) return;
  const combined = additive ? currentSelectionMask() : new Set();
  const visited = new Set();
  const queue = [cloneCell(start)];
  for (let index = 0; index < queue.length; index++) {
    const cell = queue[index];
    const position = key(cell.x, cell.y, cell.z);
    if (visited.has(position)) continue;
    visited.add(position);
    const currentType = blocks.get(position);
    if (!currentType || (sameTypeOnly && currentType !== sourceType)) continue;
    combined.add(position);
    for (const [dx, dy, dz] of [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]]) {
      const neighbor = { x: cell.x + dx, y: cell.y + dy, z: cell.z + dz };
      const neighborPosition = key(neighbor.x, neighbor.y, neighbor.z);
      const neighborType = blocks.get(neighborPosition);
      if (valid(neighbor) && !visited.has(neighborPosition) && neighborType &&
          (!sameTypeOnly || neighborType === sourceType)) queue.push(neighbor);
    }
  }
  selectionA = null;
  selectionB = null;
  selectionMask = combined;
  updateSelection();
  updateStats();
  refreshHover();
}

function cellInSelection(cell) {
  if (selectionMask.size) return selectionMask.has(key(cell.x, cell.y, cell.z));
  const bounds = selectedBounds();
  return Boolean(bounds && inBounds(cell, bounds));
}

function brushAllowed(cell) {
  return !document.getElementById("limit-to-selection")?.checked || cellInSelection(cell);
}

function insideBrush(center, x, y, z, range, round, radius) {
  if (x < center.x + range.min || x > center.x + range.max ||
      y < center.y + range.min || y > center.y + range.max ||
      z < center.z + range.min || z > center.z + range.max) return false;
  return !round || !radius || Math.hypot(x - center.x, y - center.y, z - center.z) <= radius + 0.35;
}

function applyBrushVoxel(x, y, z, erase) {
  const cell = { x, y, z };
  if (!valid(cell) || !brushAllowed(cell)) return;
  const occupied = blocks.has(key(x, y, z));
  if (!erase && document.getElementById("place-air-only")?.checked && occupied) return;
  if (!erase && document.getElementById("place-solid-only")?.checked && !occupied) return;
  recordLiveEditPreview(x, y, z, erase);
  if (erase) blocks.delete(key(x, y, z));
  else blocks.set(key(x, y, z), activeBlock);
}

function paintBrush(cell, erase = false, previousCenter = null) {
  const range = brushRange();
  const radius = (range.size - 1) / 2;
  const round = document.getElementById("brush-shape")?.value === "sphere";
  for (let x = cell.x + range.min; x <= cell.x + range.max; x++)
    for (let y = cell.y + range.min; y <= cell.y + range.max; y++)
      for (let z = cell.z + range.min; z <= cell.z + range.max; z++) {
        if (!insideBrush(cell, x, y, z, range, round, radius)) continue;
        if (previousCenter && insideBrush(previousCenter, x, y, z, range, round, radius)) continue;
        applyBrushVoxel(x, y, z, erase);
      }
}

function scaledPlacement(origin, items) {
  if (!items.length) return [];
  const max = items.reduce((value, item) => ({
    x: Math.max(value.x, item.x),
    y: Math.max(value.y, item.y),
    z: Math.max(value.z, item.z)
  }), { x: 0, y: 0, z: 0 });
  const source = new Map(items.map(item => [key(item.x, item.y, item.z), item]));
  const width = max.x + 1, height = max.y + 1, depth = max.z + 1;
  const center = new THREE.Vector3(width / 2, height / 2, depth / 2);
  const euler = new THREE.Euler(
    THREE.MathUtils.degToRad(placementRotation.x),
    THREE.MathUtils.degToRad(placementRotation.y),
    THREE.MathUtils.degToRad(placementRotation.z),
    "XYZ"
  );
  const rotationMatrix = new THREE.Matrix4().makeRotationFromEuler(euler);
  const inverseRotation = rotationMatrix.clone().invert();
  const corners = [];
  for (const x of [-center.x, width - center.x])
    for (const y of [-center.y, height - center.y])
      for (const z of [-center.z, depth - center.z])
        corners.push(new THREE.Vector3(x, y, z).applyMatrix4(rotationMatrix));
  const minimum = new THREE.Vector3(
    Math.min(...corners.map(corner => corner.x)),
    Math.min(...corners.map(corner => corner.y)),
    Math.min(...corners.map(corner => corner.z))
  );
  const maximum = new THREE.Vector3(
    Math.max(...corners.map(corner => corner.x)),
    Math.max(...corners.map(corner => corner.y)),
    Math.max(...corners.map(corner => corner.z))
  );
  const axisScale = effectiveScale();
  const size = {
    x: Math.max(1, Math.min(workspaceSize.x - origin.x, Math.ceil((maximum.x - minimum.x) * axisScale.x))),
    y: Math.max(1, Math.min(workspaceSize.y - origin.y, Math.ceil((maximum.y - minimum.y) * axisScale.y))),
    z: Math.max(1, Math.min(workspaceSize.z - origin.z, Math.ceil((maximum.z - minimum.z) * axisScale.z)))
  };
  const result = [];
  const sample = new THREE.Vector3();
  for (let x = 0; x < size.x; x++)
    for (let y = 0; y < size.y; y++)
      for (let z = 0; z < size.z; z++) {
        sample.set(
          minimum.x + (x + 0.5) / axisScale.x,
          minimum.y + (y + 0.5) / axisScale.y,
          minimum.z + (z + 0.5) / axisScale.z
        ).applyMatrix4(inverseRotation).add(center);
        const sourceX = Math.floor(sample.x);
        const sourceY = Math.floor(sample.y);
        const sourceZ = Math.floor(sample.z);
        const sourceCell = source.get(key(sourceX, sourceY, sourceZ));
        if (!sourceCell) continue;
        result.push({
          x: origin.x + x,
          y: origin.y + y,
          z: origin.z + z,
          type: sourceCell.type
        });
      }
  return result;
}

function applyCell(cell, eventButton = 0) {
  if (!cell || !valid(cell)) return;
  if (tool === "move") return;
  if (tool === "eyedropper") {
    const sampled = blocks.get(key(cell.x, cell.y, cell.z));
    if (!sampled) return;
    selectBlock(sampled);
    setTool(eyedropperReturnTool === "eyedropper" ? "place" : eyedropperReturnTool);
    return;
  }
  if (tool === "paste") {
    if (!clipboardBlocks.length) return;
    const placement = scaledPlacement(cell, clipboardBlocks);
    mutate(() => placement.forEach(targetCell => {
      const { x, y, z, type } = targetCell;
      if (!valid(targetCell) || !brushAllowed(targetCell)) return;
      if (type === "__air__") {
        if (document.getElementById("paste-air")?.checked) blocks.delete(key(x, y, z));
      } else putGenerated(x, y, z, type);
    }));
    return;
  }
  if (tool === "replace") {
    if (document.getElementById("connected-replace")?.checked) floodFillAt(cell);
    else replaceAt(cell);
    return;
  }
  if (tool === "moveSelection") {
    moveSelectionTo(cell);
    return;
  }
  if (tool === "sculpt") {
    sculptAt(cell);
    return;
  }
  if (tool.startsWith("generate:")) {
    const generator = tool.slice("generate:".length);
    if (isSpecialTransformTool()) {
      const placement = scaledPlacement(cell, specialGeneratorItems(generator));
      if (placement.length)
        mutate(() => placement.forEach(item => putGenerated(item.x, item.y, item.z, item.type)));
      return;
    }
    if (generator === "sphere") generateSphere(false, cell);
    if (generator === "hollow-sphere") generateSphere(true, cell);
    if (generator === "circle") generateCircle(false, cell);
    if (generator === "disc") generateCircle(true, cell);
    if (generator === "cylinder") generateCylinder(cell);
    if (generator === "mountain") generateMountain(cell);
    if (generator === "text") generateBlockText(cell);
    if (generator === "line") {
      if (!selectionA) {
        selectionA = cloneCell(cell);
        selectionB = null;
        updateSelection();
        updateStats();
      } else {
        selectionB = cloneCell(cell);
        generateLine();
        selectionA = cloneCell(cell);
        selectionB = null;
        selectionMask.clear();
        updateSelection();
        updateStats();
      }
    }
    return;
  }
  if (tool === "selectA" || tool === "selectB") {
    selectionMask.clear();
    if (tool === "selectA") selectionA = cloneCell(cell);
    else selectionB = cloneCell(cell);
    updateSelection();
    updateStats();
    return;
  }
  if (tool === "erase" || eventButton === 2) {
    mutate(() => paintBrush(cell, true));
    return;
  }
  mutate(() => paintBrush(cell, false));
}

function hideTransformBadge() {
  document.getElementById("scale-drag-badge")?.classList.remove("visible");
  document.getElementById("transform-gizmo")?.classList.remove("visible");
  transformVisualGizmo.visible = false;
}

function commitPendingPlacement() {
  if (!pendingPlacement) return;
  const pending = pendingPlacement;
  pendingPlacement = null;
  placementScale = pending.scale;
  placementStretch = cloneStretch(pending.stretch || unitStretch());
  placementRotation = cloneRotation(pending.rotation);
  applyCell(pending.origin, 0);
  if (!isTransformPlacementTool(pending.tool) || pending.tool === "moveSelection") {
    placementScale = 1;
    placementStretch = unitStretch();
    placementRotation = zeroRotation();
  }
  hideTransformBadge();
  ghostSignature = "";
  refreshHover();
}

function isSpecialTransformTool(candidate = tool) {
  return candidate === "generate:text" || candidate === "generate:image" ||
    candidate === "generate:model";
}

function isTransformPlacementTool(candidate = tool) {
  return candidate === "paste" || candidate === "moveSelection" ||
    isSpecialTransformTool(candidate);
}

function cancelPendingPlacement() {
  pendingPlacement = null;
  placementScale = 1;
  placementStretch = unitStretch();
  placementRotation = zeroRotation();
  hideTransformBadge();
  ghostSignature = "";
  refreshHover();
}

canvas.addEventListener("contextmenu", event => event.preventDefault());
canvas.addEventListener("auxclick", event => {
  if (event.button === 1) event.preventDefault();
});
canvas.addEventListener("pointerleave", () => {
  if (pointerDown) return;
  highlightTransformHandle(null);
  lastPointer = null;
  hoveredCell = null;
  hover.visible = false;
  updateCursorCoordinate(null);
  clearGhost();
});

function beginCameraDrag(event, mode = "camera") {
  pointerDown = {
    mode,
    x: event.clientX,
    y: event.clientY,
    theta,
    phi,
    button: event.button,
    moved: false,
    pointerId: event.pointerId
  };
  canvas.style.cursor = "grabbing";
  canvas.setPointerCapture(event.pointerId);
}

canvas.addEventListener("pointerdown", event => {
  if (playMode) {
    if (event.button !== 0) return;
    playLookPointer = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY
    };
    canvas.setPointerCapture?.(event.pointerId);
    event.preventDefault();
    return;
  }
  lastPointer = { clientX: event.clientX, clientY: event.clientY };
  if (event.button === 1) {
    event.preventDefault();
    event.stopPropagation();
    sampleBlockAtPointer(event);
    return;
  }
  const visualHandle = pickTransformHandle(event);
  if (visualHandle && isTransformPlacementTool() && event.button === 0) {
    const origin = cloneCell(pendingPlacement?.origin || hoveredCell);
    if (!origin) return;
    placementScale = pendingPlacement?.scale ?? placementScale;
    placementStretch = cloneStretch(pendingPlacement?.stretch ?? placementStretch);
    placementRotation = cloneRotation(pendingPlacement?.rotation ?? placementRotation);
    pendingPlacement = null;
    pointerDown = {
      mode: "visualTransform",
      kind: visualHandle.kind,
      axis: visualHandle.axis,
      origin,
      baseOrigin: cloneCell(origin),
      baseScale: placementScale,
      baseStretch: cloneStretch(placementStretch),
      baseRotation: cloneRotation(placementRotation),
      startX: event.clientX,
      startY: event.clientY,
      pointerId: event.pointerId
    };
    highlightTransformHandle(visualHandle, true);
    canvas.setPointerCapture(event.pointerId);
    return;
  }
  if (isTransformPlacementTool() && event.button === 2) {
    if (pendingPlacement?.tool === tool && pendingPlacement.locked) {
      commitPendingPlacement();
      return;
    }
    const cell = pick(event, targetsAdjacentCell());
    if (!cell || !valid(cell)) return;
    pendingPlacement = {
      tool,
      origin: cloneCell(cell),
      scale: pendingPlacement?.scale ?? placementScale,
      stretch: cloneStretch(pendingPlacement?.stretch ?? placementStretch),
      rotation: cloneRotation(pendingPlacement?.rotation ?? placementRotation)
    };
    commitPendingPlacement();
    return;
  }
  if (tool === "selectBox" && event.button === 0) {
    const cell = pick(event, false);
    if (!cell || !valid(cell)) {
      beginCameraDrag(event);
      return;
    }
    const additiveBase = event.shiftKey ? currentSelectionMask() : null;
    selectionMask.clear();
    selectionA = cloneCell(cell);
    selectionB = cloneCell(cell);
    pointerDown = { mode: "selection", additiveBase, pointerId: event.pointerId };
    canvas.setPointerCapture(event.pointerId);
    updateSelection();
    updateStats();
    return;
  }
  if (tool === "lasso" && event.button === 0) {
    const cell = pick(event, false);
    if (!cell || !valid(cell)) {
      beginCameraDrag(event);
      return;
    }
    const connectedAny = document.getElementById("connected-any-selection")?.checked;
    if (connectedAny || document.getElementById("connected-selection")?.checked) {
      selectConnectedAt(cell, event.shiftKey, !connectedAny);
      return;
    }
    const additiveBase = event.shiftKey ? currentSelectionMask() : new Set();
    selectionA = null;
    selectionB = null;
    selectionMask = additiveBase;
    addSelectionBrush(cell);
    pointerDown = { mode: "lasso", lastCell: cloneCell(cell), pointerId: event.pointerId };
    canvas.setPointerCapture(event.pointerId);
    updateSelection();
    updateStats();
    return;
  }
  if (isTransformPlacementTool() && event.button === 0 &&
      !event.altKey && !pendingPlacement?.locked) {
    if (pendingPlacement && pendingPlacement.tool !== tool) commitPendingPlacement();
    const pickedCell = pick(event, targetsAdjacentCell());
    if (!pickedCell || !valid(pickedCell)) {
      beginCameraDrag(event);
      return;
    }
    pendingPlacement = {
      tool,
      origin: cloneCell(pickedCell),
      scale: pendingPlacement?.scale ?? placementScale,
      stretch: cloneStretch(pendingPlacement?.stretch ?? placementStretch),
      rotation: cloneRotation(pendingPlacement?.rotation ?? placementRotation),
      locked: true
    };
    placementScale = pendingPlacement.scale;
    placementStretch = cloneStretch(pendingPlacement.stretch);
    placementRotation = cloneRotation(pendingPlacement.rotation);
    const badge = document.getElementById("scale-drag-badge");
    if (badge) {
      badge.textContent = `${scaleText()} · ${rotationText(placementRotation)} · 핸들 드래그 · 우클릭 적용`;
      badge.classList.add("visible");
    }
    document.getElementById("transform-gizmo")?.classList.add("visible");
    updateGhostPreview(pendingPlacement.origin);
    return;
  }
  if (pendingPlacement?.locked && pendingPlacement.tool === tool &&
      isTransformPlacementTool() && event.button === 0) {
    beginCameraDrag(event, "cameraWhileTransforming");
    return;
  }
  const repeatable = event.button === 0 && !event.altKey && (
    tool === "place" || tool === "erase" || tool === "sculpt" ||
    (tool.startsWith("generate:") && tool !== "generate:line" && tool !== "generate:text" &&
      tool !== "generate:image" && tool !== "generate:model")
  );
  if (repeatable) {
    const adjacent = targetsAdjacentCell();
    const cell = pick(event, adjacent);
    if (!cell || !valid(cell)) {
      beginCameraDrag(event);
      return;
    }
    pointerDown = {
      mode: "armedBrush",
      origin: cloneCell(cell),
      currentCell: cloneCell(cell),
      lastCell: cloneCell(cell),
      startedAt: performance.now(),
      activated: false,
      lastScreenX: event.clientX,
      lastScreenY: event.clientY,
      pointerId: event.pointerId
    };
    canvas.setPointerCapture(event.pointerId);
    return;
  }
  beginCameraDrag(event);
});
canvas.addEventListener("pointermove", event => {
  lastPointer = { clientX: event.clientX, clientY: event.clientY };
  if (!pointerDown) highlightTransformHandle(pickTransformHandle(event));
  else if (pointerDown.mode === "visualTransform") {
    highlightTransformHandle({ kind: pointerDown.kind, axis: pointerDown.axis }, true);
  }
  const livePointedCell = pick(event, false);
  updateCursorCoordinate(livePointedCell && valid(livePointedCell) ? livePointedCell : null);
  if (!pointerDown && pendingPlacement && pendingPlacement.tool === tool && !pendingPlacement.locked) {
    const followedCell = pick(event, targetsAdjacentCell());
    if (followedCell && valid(followedCell)) {
      pendingPlacement.origin = cloneCell(followedCell);
      placementScale = pendingPlacement.scale;
      placementStretch = cloneStretch(pendingPlacement.stretch || unitStretch());
      placementRotation = cloneRotation(pendingPlacement.rotation);
      const badge = document.getElementById("scale-drag-badge");
      if (badge) badge.textContent = `${scaleText()} · ${rotationText(placementRotation)} · 우클릭 적용`;
      updateGhostPreview(pendingPlacement.origin);
    }
  }
  if (pointerDown?.mode === "selection") {
    const cell = pick(event, false);
    if (cell && valid(cell)) {
      selectionB = cloneCell(cell);
      updateSelection();
      updateStats();
    }
    return;
  }
  if (pointerDown?.mode === "lasso") {
    const cell = pick(event, false);
    if (cell && valid(cell)) {
      addInterpolatedSelection(pointerDown.lastCell, cell);
      pointerDown.lastCell = cloneCell(cell);
      updateSelection();
      updateStats();
    }
    return;
  }
  if (pointerDown?.mode === "scalePlacement") {
    const distance = event.clientX - pointerDown.startX;
    if (pointerDown.transformMode === "scale") {
      const rawScale = distance >= 0
        ? pointerDown.baseScale * (1 + distance / 55)
        : pointerDown.baseScale / (1 + Math.abs(distance) / 55);
      placementScale = Math.round(THREE.MathUtils.clamp(rawScale, 0.1, 8) * 100) / 100;
    } else if (pointerDown.transformMode === "rotate") {
      placementRotation = cloneRotation(pointerDown.baseRotation);
      placementRotation[transformAxis] = Math.round(
        (((pointerDown.baseRotation[transformAxis] + distance * 0.7) % 360) + 360) % 360 * 10
      ) / 10;
    }
    const badge = document.getElementById("scale-drag-badge");
    if (badge) badge.textContent = `${placementScale}× · ${rotationText(placementRotation)}`;
    updateGhostPreview(pointerDown.origin);
    return;
  }
  if (pointerDown?.mode === "visualTransform") {
    const dx = event.clientX - pointerDown.startX;
    const dy = event.clientY - pointerDown.startY;
    if (pointerDown.kind === "move") {
      const axisVector = {
        x: new THREE.Vector3(1, 0, 0),
        y: new THREE.Vector3(0, 1, 0),
        z: new THREE.Vector3(0, 0, 1)
      }[pointerDown.axis];
      const center = transformVisualGizmo.position.clone();
      const projectedStart = center.clone().project(camera);
      const projectedEnd = center.clone().add(axisVector).project(camera);
      const screenAxis = new THREE.Vector2(
        projectedEnd.x - projectedStart.x,
        -(projectedEnd.y - projectedStart.y)
      ).normalize();
      const projectedPixels = dx * screenAxis.x + dy * screenAxis.y;
      const amount = Math.round(projectedPixels * Math.max(0.01, camera.position.distanceTo(center) / 500));
      pointerDown.origin = cloneCell(pointerDown.baseOrigin);
      pointerDown.origin[pointerDown.axis] = THREE.MathUtils.clamp(
        pointerDown.origin[pointerDown.axis] + amount, 0, workspaceSize[pointerDown.axis] - 1
      );
    } else if (pointerDown.kind === "rotate") {
      placementRotation = cloneRotation(pointerDown.baseRotation);
      placementRotation[pointerDown.axis] = Math.round(
        (((pointerDown.baseRotation[pointerDown.axis] + (dx - dy) * 0.65) % 360) + 360) % 360 * 10
      ) / 10;
    } else if (pointerDown.kind === "stretch") {
      const axisVector = {
        x: new THREE.Vector3(1, 0, 0),
        y: new THREE.Vector3(0, 1, 0),
        z: new THREE.Vector3(0, 0, 1)
      }[pointerDown.axis];
      const center = transformVisualGizmo.position.clone();
      const projectedStart = center.clone().project(camera);
      const projectedEnd = center.clone().add(axisVector).project(camera);
      const screenAxis = new THREE.Vector2(
        projectedEnd.x - projectedStart.x,
        -(projectedEnd.y - projectedStart.y)
      ).normalize();
      const projectedPixels = dx * screenAxis.x + dy * screenAxis.y;
      const rawStretch = projectedPixels >= 0
        ? pointerDown.baseStretch[pointerDown.axis] * (1 + projectedPixels / 90)
        : pointerDown.baseStretch[pointerDown.axis] / (1 + Math.abs(projectedPixels) / 90);
      placementStretch = cloneStretch(pointerDown.baseStretch);
      placementStretch[pointerDown.axis] = Math.round(THREE.MathUtils.clamp(rawStretch, 0.1, 8) * 100) / 100;
    } else {
      const distance = dx - dy;
      const rawScale = distance >= 0
        ? pointerDown.baseScale * (1 + distance / 90)
        : pointerDown.baseScale / (1 + Math.abs(distance) / 90);
      placementScale = Math.round(THREE.MathUtils.clamp(rawScale, 0.1, 8) * 100) / 100;
    }
    const badge = document.getElementById("scale-drag-badge");
    if (badge) badge.textContent = `${scaleText()} · ${rotationText(placementRotation)} · 우클릭 적용`;
    updateGhostPreview(pointerDown.origin);
    return;
  }
  if (pointerDown?.mode === "armedBrush") {
    const startX = pointerDown.lastScreenX;
    const startY = pointerDown.lastScreenY;
    const screenDistance = Math.hypot(event.clientX - startX, event.clientY - startY);
    if (screenDistance < 2) {
      refreshHover();
      return;
    }
    const screenStepPixels = tool === "sculpt" ? 12 : 4;
    const maximumScreenSteps = tool === "sculpt" ? 16 : 300;
    const screenSteps = Math.min(maximumScreenSteps, Math.max(1, Math.ceil(screenDistance / screenStepPixels)));
    const candidates = [];
    let previousKey = key(pointerDown.lastCell.x, pointerDown.lastCell.y, pointerDown.lastCell.z);
    for (let index = 1; index <= screenSteps; index++) {
      const amount = index / screenSteps;
      const sampledEvent = {
        clientX: startX + (event.clientX - startX) * amount,
        clientY: startY + (event.clientY - startY) * amount
      };
      const sampledCell = pick(sampledEvent, targetsAdjacentCell());
      if (!sampledCell || !valid(sampledCell)) continue;
      const sampledKey = key(sampledCell.x, sampledCell.y, sampledCell.z);
      if (sampledKey === previousKey) continue;
      candidates.push(cloneCell(sampledCell));
      previousKey = sampledKey;
    }
    pointerDown.lastScreenX = event.clientX;
    pointerDown.lastScreenY = event.clientY;
    if (candidates.length) {
      pointerDown.currentCell = cloneCell(candidates[candidates.length - 1]);
      const firstActivation = !pointerDown.activated;
      if (!pointerDown.activated) {
        remember();
        groupedMutation = true;
        pointerDown.activated = true;
      }
      if (tool === "place" || tool === "erase") {
        mutate(() => {
          let previousBrushCenter = pointerDown.lastAppliedBrushCenter || null;
          if (firstActivation) {
            paintBrush(pointerDown.origin, tool === "erase");
            previousBrushCenter = pointerDown.origin;
          }
          candidates.forEach(cell => {
            paintBrush(cell, tool === "erase", previousBrushCenter);
            previousBrushCenter = cell;
          });
          pointerDown.lastAppliedBrushCenter = cloneCell(previousBrushCenter);
        });
      } else {
        if (firstActivation) applyCell(pointerDown.origin, 0);
        if (tool === "sculpt") {
          const minimumSpacing = Math.max(1, Math.floor(brushRange().size / 3));
          let previous = pointerDown.lastAppliedSculpt || pointerDown.origin;
          const sculptCandidates = candidates.length <= 3
            ? candidates
            : [1, 2, 3].map(index => candidates[Math.ceil(candidates.length * index / 3) - 1]);
          for (const cell of sculptCandidates) {
            if (Math.hypot(cell.x - previous.x, cell.y - previous.y, cell.z - previous.z) < minimumSpacing) continue;
            applyCell(cell, 0);
            previous = cell;
          }
          pointerDown.lastAppliedSculpt = cloneCell(previous);
        } else {
          candidates.forEach(cell => applyCell(cell, 0));
        }
      }
      const afterPaint = pick(event, targetsAdjacentCell());
      const lastCandidate = candidates[candidates.length - 1];
      pointerDown.lastCell = cloneCell(afterPaint && valid(afterPaint) ? afterPaint : lastCandidate);
    }
    refreshHover();
    return;
  }
  if (pointerDown && pointerDown.button === 0) {
    const dx = event.clientX - pointerDown.x;
    const dy = event.clientY - pointerDown.y;
    if (Math.hypot(dx, dy) > 8) {
      pointerDown.moved = true;
      theta = pointerDown.theta - dx * 0.008;
      phi = THREE.MathUtils.clamp(pointerDown.phi - dy * 0.008, 0.05, Math.PI - 0.05);
      updateCamera();
      noteCameraMotion();
      return;
    }
  }
  refreshHover();
});
canvas.addEventListener("pointerup", event => {
  if (!pointerDown) return;
  if (pointerDown.mode === "selection" || pointerDown.mode === "lasso") {
    if (pointerDown.mode === "selection" && pointerDown.additiveBase) {
      const bounds = selectedBounds();
      const combined = new Set(pointerDown.additiveBase);
      if (bounds) {
        for (let x = bounds.min.x; x <= bounds.max.x; x++)
          for (let y = bounds.min.y; y <= bounds.max.y; y++)
            for (let z = bounds.min.z; z <= bounds.max.z; z++)
              combined.add(key(x, y, z));
      }
      selectionA = null;
      selectionB = null;
      selectionMask = combined;
    }
    keepOnlyInstalledSelection();
    updateSelection();
    updateStats();
    pointerDown = null;
    refreshHover();
    return;
  }
  if (pointerDown.mode === "scalePlacement" || pointerDown.mode === "visualTransform") {
    pendingPlacement = {
      tool,
      origin: cloneCell(pointerDown.origin),
      scale: placementScale,
      stretch: cloneStretch(placementStretch),
      rotation: cloneRotation(placementRotation),
      locked: true
    };
    const badge = document.getElementById("scale-drag-badge");
    if (badge) badge.textContent = `${scaleText()} · ${rotationText(placementRotation)} · 우클릭 적용`;
    pointerDown = null;
    highlightTransformHandle(pickTransformHandle(event));
    updateGhostPreview(pendingPlacement.origin);
    return;
  }
  if (pointerDown.mode === "cameraWhileTransforming") {
    pointerDown = null;
    setTool(tool);
    refreshHover();
    return;
  }
  if (pointerDown.mode === "armedBrush") {
    if (!pointerDown.activated) applyCell(pointerDown.currentCell || pointerDown.origin, 0);
    groupedMutation = false;
    pointerDown = null;
    flushGroupedRebuild();
    refreshHover();
    return;
  }
  if (!pointerDown.moved && !(
    pendingPlacement?.locked && isTransformPlacementTool()
  )) {
    const adjacent = targetsAdjacentCell() && event.button !== 2;
    applyCell(pick(event, adjacent), event.button);
  }
  pointerDown = null;
  setTool(tool);
});
canvas.addEventListener("pointercancel", () => {
  groupedMutation = false;
  flushGroupedRebuild();
  cancelPendingPlacement();
  pointerDown = null;
  setTool(tool);
  refreshHover();
});
canvas.addEventListener("wheel", event => {
  event.preventDefault();
  radius = THREE.MathUtils.clamp(radius * Math.exp(event.deltaY * 0.001), 5, 900);
  updateCamera();
  noteCameraMotion();
}, { passive: false });

function setTool(next) {
  const previousTool = tool;
  if (pendingPlacement && next !== tool) commitPendingPlacement();
  if (next === "moveSelection" && previousTool !== next) {
    placementScale = 1;
    placementStretch = unitStretch();
    placementRotation = zeroRotation();
  }
  if (isSpecialTransformTool(next) && previousTool !== next) {
    placementScale = 1;
    placementStretch = unitStretch();
    placementRotation = zeroRotation();
  }
  tool = next;
  document.querySelectorAll("[data-tool], [data-generator]").forEach(button => {
    const buttonTool = button.dataset.tool || `generate:${button.dataset.generator}`;
    button.classList.toggle("active", buttonTool === tool);
  });
  canvas.style.cursor = tool === "erase"
    ? "not-allowed"
    : isTransformPlacementTool()
      ? "move"
    : tool === "move"
      ? "grab"
    : tool === "selectBox"
      ? "cell"
      : tool.startsWith("generate:")
        ? "copy"
        : "crosshair";
  updateToolPanels();
  refreshHover();
}

function toolMatches(specification) {
  return String(specification || "").split(/\s+/).filter(Boolean).some(pattern =>
    pattern.endsWith("*") ? tool.startsWith(pattern.slice(0, -1)) : tool === pattern
  );
}

function updateToolPanels() {
  document.querySelectorAll("[data-tool-panel]").forEach(panel => {
    panel.classList.toggle("tool-context-hidden", !toolMatches(panel.dataset.toolPanel));
  });
  document.querySelectorAll("[data-tool-detail]").forEach(detail => {
    detail.classList.toggle("tool-context-hidden", !toolMatches(detail.dataset.toolDetail));
  });
  document.getElementById("recent-blocks")?.classList.toggle(
    "tool-context-hidden",
    !toolMatches("place replace eyedropper generate:* selectBox lasso selectA selectB moveSelection")
  );
}

document.querySelectorAll("[data-tool]").forEach(button => button.addEventListener("click", () => setTool(button.dataset.tool)));
document.querySelectorAll("[data-generator]").forEach(button => button.addEventListener("click", () => {
  const next = `generate:${button.dataset.generator}`;
  setTool(tool === next ? "move" : next);
}));
document.getElementById("image-block-tool")?.addEventListener("click", () => {
  if (!voxelImageAsset) vscode.postMessage({ type: "chooseVoxelImage" });
});
document.getElementById("model-block-tool")?.addEventListener("click", () => {
  if (!voxelModelAsset) vscode.postMessage({ type: "chooseVoxelModel" });
});
document.getElementById("choose-voxel-image")?.addEventListener("click", () => {
  vscode.postMessage({ type: "chooseVoxelImage" });
});
document.getElementById("choose-voxel-model")?.addEventListener("click", () => {
  vscode.postMessage({ type: "chooseVoxelModel" });
});
for (const [currentId, otherId] of [
  ["connected-selection", "connected-any-selection"],
  ["connected-any-selection", "connected-selection"],
  ["place-air-only", "place-solid-only"],
  ["place-solid-only", "place-air-only"]
]) {
  document.getElementById(currentId)?.addEventListener("change", event => {
    if (event.currentTarget.checked) document.getElementById(otherId).checked = false;
  });
}
document.querySelectorAll("[data-transform-mode]").forEach(button => button.addEventListener("click", () => {
  transformMode = button.dataset.transformMode;
  document.querySelectorAll("[data-transform-mode]").forEach(item => {
    item.classList.toggle("active", item === button);
  });
}));
document.querySelectorAll("[data-transform-axis]").forEach(button => button.addEventListener("click", () => {
  transformAxis = button.dataset.transformAxis;
  document.querySelectorAll("[data-transform-axis]").forEach(item => {
    item.classList.toggle("active", item === button);
  });
}));
document.getElementById("cancel-transform")?.addEventListener("click", cancelPendingPlacement);

const viewportPanels = document.getElementById("viewport-panels");
document.querySelectorAll(".sidebar:not(.right) > .section:not(.project-section), .sidebar.right > .section")
  .forEach(section => viewportPanels?.appendChild(section));
const brushOptionsDock = document.getElementById("brush-options-dock");
const brushPanel = document.getElementById("brush-panel");
if (brushOptionsDock && brushPanel) brushOptionsDock.appendChild(brushPanel);
const utilityPopover = document.getElementById("utility-popover");
const utilityButtons = document.getElementById("utility-buttons");
const utilityGroups = new Map();
document.querySelectorAll("[data-utility]").forEach(section => {
  section.classList.add("utility-section");
  utilityPopover?.appendChild(section);
  const group = section.dataset.utilityGroup || section.dataset.utility;
  if (!utilityGroups.has(group)) utilityGroups.set(group, []);
  utilityGroups.get(group).push(section);
});
// 팔레트는 항목이 매우 길기 때문에 선택·변형 패널 뒤, 목록의 맨 아래에 둔다.
const blockPaletteSection = document.getElementById("block-palette-section");
if (viewportPanels && blockPaletteSection) viewportPanels.appendChild(blockPaletteSection);
utilityGroups.forEach((sections, group) => {
  const section = sections[0];
  const button = document.createElement("button");
  button.type = "button";
  button.className = "utility-button";
  button.textContent = section.dataset.utilityIcon;
  button.title = section.dataset.utilityLabel;
  button.setAttribute("aria-label", `${section.dataset.utilityLabel} 열기`);
  button.addEventListener("click", () => {
    const willOpen = !sections.some(item => item.classList.contains("utility-open"));
    document.querySelectorAll(".utility-section").forEach(item => item.classList.remove("utility-open"));
    document.querySelectorAll(".utility-button").forEach(item => item.classList.remove("active"));
    sections.forEach(item => item.classList.toggle("utility-open", willOpen));
    button.classList.toggle("active", willOpen);
    utilityPopover?.classList.toggle("open", willOpen);
  });
  button.dataset.utilityGroup = group;
  utilityButtons?.appendChild(button);
});
document.getElementById("toggle-workspace-ui")?.addEventListener("click", event => {
  viewportPanels?.classList.toggle("ui-hidden");
  event.currentTarget.classList.toggle("active", !viewportPanels?.classList.contains("ui-hidden"));
});

document.getElementById("undo").addEventListener("click", () => {
  if (!history.length) return;
  const transaction = history.pop();
  future.push(transaction);
  applyUndoTransaction(transaction, "undo");
});
document.getElementById("redo").addEventListener("click", () => {
  if (!future.length) return;
  const transaction = future.pop();
  history.push(transaction);
  applyUndoTransaction(transaction, "redo");
});

function selectionCellCount() {
  if (selectionMask.size) return selectionMask.size;
  const bounds = selectedBounds();
  if (!bounds) return 0;
  return (bounds.max.x - bounds.min.x + 1) *
    (bounds.max.y - bounds.min.y + 1) *
    (bounds.max.z - bounds.min.z + 1);
}

function formatOperationDuration(milliseconds) {
  if (!Number.isFinite(milliseconds)) return "계산 중";
  const seconds = Math.max(0, Math.round(milliseconds / 1000));
  if (seconds < 60) return `${seconds}초`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes}분 ${seconds % 60}초`;
}

let activeBlockOperation = false;

async function runSelectionBlockOperation(title, applyCellOperation) {
  if (activeBlockOperation || activeBpyOperationId) return;
  const total = selectionCellCount();
  if (!total) return;
  activeBlockOperation = true;
  const startedAt = performance.now();
  updateBpyProgress(0, `${total.toLocaleString()}개 블록 준비 중…`, title);
  await nextUiFrame();
  remember();
  let processed = 0;
  let lastYield = performance.now();
  const updateProgress = async () => {
    const now = performance.now();
    const elapsed = now - startedAt;
    const remaining = processed
      ? elapsed / processed * Math.max(0, total - processed)
      : Infinity;
    updateBpyProgress(
      total ? processed / total * 96 : 96,
      `${processed.toLocaleString()} / ${total.toLocaleString()} 블록 · ` +
      `경과 ${formatOperationDuration(elapsed)} · 남은 시간 약 ${formatOperationDuration(remaining)}`,
      title
    );
    await nextUiFrame();
    lastYield = performance.now();
  };
  try {
    if (selectionMask.size) {
      for (const position of selectionMask) {
        const [x, y, z] = position.split(",").map(Number);
        applyCellOperation({ x, y, z });
        processed++;
        if (performance.now() - lastYield >= 24) await updateProgress();
      }
    } else {
      const bounds = selectedBounds();
      for (let x = bounds.min.x; x <= bounds.max.x; x++)
        for (let y = bounds.min.y; y <= bounds.max.y; y++)
          for (let z = bounds.min.z; z <= bounds.max.z; z++) {
            applyCellOperation({ x, y, z });
            processed++;
            if (performance.now() - lastYield >= 24) await updateProgress();
          }
    }
    await updateProgress();
    commitUndoTransaction();
    markCurrentProjectFileDirty();
    updateBpyProgress(98, "변경된 청크 렌더링 중…", title);
    await nextUiFrame();
    rebuild();
    const elapsed = performance.now() - startedAt;
    updateBpyProgress(100, `완료 · 총 ${formatOperationDuration(elapsed)}`, title);
    await new Promise(resolve => setTimeout(resolve, 450));
  } finally {
    commitUndoTransaction();
    activeBlockOperation = false;
    hideBpyProgress();
  }
}

document.getElementById("fill-selection").addEventListener("click", () =>
  runSelectionBlockOperation("선택 영역 채우는 중", cell => {
    blocks.set(key(cell.x, cell.y, cell.z), activeBlock);
  })
);
document.getElementById("clear-selection").addEventListener("click", () =>
  runSelectionBlockOperation("선택 영역 비우는 중", cell => {
    blocks.delete(key(cell.x, cell.y, cell.z));
  })
);

function selectedBounds() {
  if (selectionBoundsCache) {
    return {
      min: { ...selectionBoundsCache.min },
      max: { ...selectionBoundsCache.max }
    };
  }
  if (selectionMask.size) {
    const min = { x: Infinity, y: Infinity, z: Infinity };
    const max = { x: -Infinity, y: -Infinity, z: -Infinity };
    for (const position of selectionMask) {
      const [x, y, z] = position.split(",").map(Number);
      min.x = Math.min(min.x, x); min.y = Math.min(min.y, y); min.z = Math.min(min.z, z);
      max.x = Math.max(max.x, x); max.y = Math.max(max.y, y); max.z = Math.max(max.z, z);
    }
    return { min, max };
  }
  if (!selectionA || !selectionB) return null;
  return {
    min: {
      x: Math.min(selectionA.x, selectionB.x),
      y: Math.min(selectionA.y, selectionB.y),
      z: Math.min(selectionA.z, selectionB.z)
    },
    max: {
      x: Math.max(selectionA.x, selectionB.x),
      y: Math.max(selectionA.y, selectionB.y),
      z: Math.max(selectionA.z, selectionB.z)
    }
  };
}

function selectedCellList() {
  if (selectionMask.size) {
    return [...selectionMask].map(position => {
      const [x, y, z] = position.split(",").map(Number);
      return { x, y, z };
    });
  }
  const bounds = selectedBounds();
  if (!bounds) return [];
  const cells = [];
  for (let x = bounds.min.x; x <= bounds.max.x; x++)
    for (let y = bounds.min.y; y <= bounds.max.y; y++)
      for (let z = bounds.min.z; z <= bounds.max.z; z++) cells.push({ x, y, z });
  return cells;
}

function keepOnlyInstalledSelection() {
  if (!document.getElementById("select-solid-only")?.checked) return;
  const occupied = selectedCellList().filter(cell => blocks.has(key(cell.x, cell.y, cell.z)));
  selectionMask = new Set(occupied.map(cell => key(cell.x, cell.y, cell.z)));
  selectionA = null;
  selectionB = null;
  updateSelection();
  updateStats();
}

function syncSelectionInputs() {
  const bounds = selectedBounds();
  const values = bounds ? {
    "selection-a-x": selectionA?.x ?? bounds.min.x,
    "selection-a-y": selectionA?.y ?? bounds.min.y,
    "selection-a-z": selectionA?.z ?? bounds.min.z,
    "selection-b-x": selectionB?.x ?? bounds.max.x,
    "selection-b-y": selectionB?.y ?? bounds.max.y,
    "selection-b-z": selectionB?.z ?? bounds.max.z
  } : {
    "selection-a-x": 0, "selection-a-y": 0, "selection-a-z": 0,
    "selection-b-x": 0, "selection-b-y": 0, "selection-b-z": 0
  };
  for (const [id, value] of Object.entries(values)) {
    const input = document.getElementById(id);
    if (input && document.activeElement !== input) input.value = value;
  }
}

function applySelectionPoints() {
  const readPoint = prefix => ({
    x: THREE.MathUtils.clamp(Math.round(Number(document.getElementById(`${prefix}-x`)?.value || 0)), 0, workspaceSize.x - 1),
    y: THREE.MathUtils.clamp(Math.round(Number(document.getElementById(`${prefix}-y`)?.value || 0)), 0, workspaceSize.y - 1),
    z: THREE.MathUtils.clamp(Math.round(Number(document.getElementById(`${prefix}-z`)?.value || 0)), 0, workspaceSize.z - 1)
  });
  selectionMask.clear();
  selectionA = readPoint("selection-a");
  selectionB = readPoint("selection-b");
  updateSelection();
  updateStats();
  refreshHover();
}

document.getElementById("apply-selection-points")?.addEventListener("click", applySelectionPoints);
document.getElementById("clear-selection-shape")?.addEventListener("click", () => {
  selectionA = null;
  selectionB = null;
  selectionMask.clear();
  updateSelection();
  updateStats();
  refreshHover();
});

function inBounds(cell, bounds) {
  return !bounds || (
    cell.x >= bounds.min.x && cell.x <= bounds.max.x &&
    cell.y >= bounds.min.y && cell.y <= bounds.max.y &&
    cell.z >= bounds.min.z && cell.z <= bounds.max.z
  );
}

function copySelection(cut = false) {
  const bounds = selectedBounds();
  if (!bounds) return;
  if (pendingPlacement) cancelPendingPlacement();
  placementScale = 1;
  placementStretch = unitStretch();
  placementRotation = zeroRotation();
  clipboardBlocks = [];
  const selectedCells = selectedCellList();
  for (const { x, y, z } of selectedCells) {
    const type = blocks.get(key(x, y, z));
    clipboardBlocks.push({
      x: x - bounds.min.x,
      y: y - bounds.min.y,
      z: z - bounds.min.z,
      type: type || "__air__"
    });
  }
  if (cut && clipboardBlocks.length) {
    mutate(() => {
      selectedCells.forEach(({ x, y, z }) => blocks.delete(key(x, y, z)));
    });
  }
  document.getElementById("clipboard-count").textContent = `${clipboardBlocks.length} blocks`;
}

function selectAllStructure() {
  if (!blocks.size) return;
  const minimum = { x: Infinity, y: Infinity, z: Infinity };
  const maximum = { x: -Infinity, y: -Infinity, z: -Infinity };
  for (const position of blocks.keys()) {
    const [x, y, z] = position.split(",").map(Number);
    minimum.x = Math.min(minimum.x, x);
    minimum.y = Math.min(minimum.y, y);
    minimum.z = Math.min(minimum.z, z);
    maximum.x = Math.max(maximum.x, x);
    maximum.y = Math.max(maximum.y, y);
    maximum.z = Math.max(maximum.z, z);
  }
  selectionMask.clear();
  selectionA = minimum;
  selectionB = maximum;
  updateSelection();
  updateStats();
  refreshHover();
}

function floodFillAt(start) {
  const sourceType = blocks.get(key(start.x, start.y, start.z));
  if (!sourceType || sourceType === activeBlock) return;
  const hasSelectionLimit = selectionMask.size > 0 || Boolean(selectionA && selectionB);
  if (hasSelectionLimit && !cellInSelection(start)) return;
  const queue = [cloneCell(start)];
  const visited = new Set();
  const connected = [];
  const directions = [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]];
  for (let index = 0; index < queue.length; index++) {
    const cell = queue[index];
    const cellKey = key(cell.x, cell.y, cell.z);
    if (visited.has(cellKey)) continue;
    visited.add(cellKey);
    if (blocks.get(cellKey) !== sourceType) continue;
    if (hasSelectionLimit && !cellInSelection(cell)) continue;
    connected.push(cellKey);
    for (const [dx, dy, dz] of directions) {
      const next = { x: cell.x + dx, y: cell.y + dy, z: cell.z + dz };
      const nextKey = key(next.x, next.y, next.z);
      if (valid(next) && !visited.has(nextKey) && blocks.get(nextKey) === sourceType) {
        queue.push(next);
      }
    }
  }
  if (!connected.length) return;
  mutate(() => {
    connected.forEach(position => blocks.set(position, activeBlock));
  });
}

function replaceAt(cell) {
  const sourceType = blocks.get(key(cell.x, cell.y, cell.z));
  if (!sourceType || sourceType === activeBlock) return;
  const selected = selectedCellList();
  if (!selected.length) return;
  mutate(() => {
    selected.forEach(({ x, y, z }) => {
      const position = key(x, y, z);
      if (blocks.get(position) === sourceType) blocks.set(position, activeBlock);
    });
  });
}

function moveSelectionTo(anchor) {
  const bounds = selectedBounds();
  const selected = selectedCellList();
  if (!bounds || !selected.length) return;
  const wasMask = selectionMask.size > 0;
  const moved = scaledPlacement(anchor, selected.map(source => ({
    x: source.x - bounds.min.x,
    y: source.y - bounds.min.y,
    z: source.z - bounds.min.z,
    type: blocks.get(key(source.x, source.y, source.z))
  })));
  if (moved.some(targetCell => !valid(targetCell))) return;
  mutate(() => {
    selected.forEach(source => blocks.delete(key(source.x, source.y, source.z)));
    moved.forEach(targetCell => {
      const position = key(targetCell.x, targetCell.y, targetCell.z);
      if (targetCell.type) blocks.set(position, targetCell.type);
      else blocks.delete(position);
    });
  });
  if (wasMask) {
    selectionMask = new Set(moved.map(targetCell => key(targetCell.x, targetCell.y, targetCell.z)));
  } else {
    const xs = moved.map(item => item.x), ys = moved.map(item => item.y), zs = moved.map(item => item.z);
    selectionA = { x: Math.min(...xs), y: Math.min(...ys), z: Math.min(...zs) };
    selectionB = { x: Math.max(...xs), y: Math.max(...ys), z: Math.max(...zs) };
  }
  updateSelection();
  updateStats();
  refreshHover();
}

document.getElementById("copy-selection")?.addEventListener("click", () => copySelection(false));
document.getElementById("cut-selection")?.addEventListener("click", () => copySelection(true));
document.getElementById("paste-selection")?.addEventListener("click", () => {
  if (clipboardBlocks.length) setTool("paste");
});

function terrainColumns(bounds = selectedBounds()) {
  const minX = bounds?.min.x ?? 0, maxX = bounds?.max.x ?? workspaceSize.x - 1;
  const minZ = bounds?.min.z ?? 0, maxZ = bounds?.max.z ?? workspaceSize.z - 1;
  const result = new Map();
  for (let x = minX; x <= maxX; x++)
    for (let z = minZ; z <= maxZ; z++) {
      result.set(`${x},${z}`, columnTop(x, z));
    }
  return { heights: result, minX, maxX, minZ, maxZ };
}

function setColumnHeight(x, z, current, targetHeight) {
  const targetTop = THREE.MathUtils.clamp(Math.round(targetHeight), -1, workspaceSize.y - 1);
  if (targetTop > current) {
    const fillType = current >= 0 ? blocks.get(key(x, current, z)) || activeBlock : activeBlock;
    for (let y = current + 1; y <= targetTop; y++) {
      recordLiveEditPreview(x, y, z, false);
      blocks.set(key(x, y, z), fillType);
    }
  } else {
    for (let y = current; y > targetTop; y--) {
      recordLiveEditPreview(x, y, z, true);
      blocks.delete(key(x, y, z));
    }
  }
}

function columnTop(x, z) {
  const columnKey = `${x},${z}`;
  if (columnTopCache.has(columnKey)) return columnTopCache.get(columnKey);
  let top = workspaceSize.y - 1;
  while (top >= 0 && !blocks.has(key(x, top, z))) top--;
  columnTopCache.set(columnKey, top);
  return top;
}

function thermalErodeColumns(columns, iterations, minY = 0, maxY = workspaceSize.y - 1) {
  const allowed = new Set(columns.map(column => `${column.x},${column.z}`));
  const heights = new Map();
  for (const column of columns) {
    let top = Math.min(maxY, columnTop(column.x, column.z));
    while (top >= minY && !blocks.has(key(column.x, top, column.z))) top--;
    heights.set(`${column.x},${column.z}`, top);
  }
  const directions = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  for (let iteration = 0; iteration < iterations; iteration++) {
    let movedThisPass = false;
    const ordered = [...allowed].sort((a, b) => (heights.get(b) ?? -1) - (heights.get(a) ?? -1));
    for (const position of ordered) {
      const [x, z] = position.split(",").map(Number);
      const sourceY = heights.get(position) ?? -1;
      if (sourceY < minY) continue;
      let destination = null;
      for (const [dx, dz] of directions) {
        const neighborKey = `${x + dx},${z + dz}`;
        if (!allowed.has(neighborKey)) continue;
        const neighborY = heights.get(neighborKey) ?? minY - 1;
        if (!destination || neighborY < destination.y) {
          destination = { x: x + dx, z: z + dz, y: neighborY, key: neighborKey };
        }
      }
      // 높이 차이가 두 칸 이상일 때만 한 블록을 낮은 이웃으로 흘려보낸다.
      if (!destination || sourceY - destination.y <= 1 || destination.y + 1 > maxY) continue;
      const sourceKey = key(x, sourceY, z);
      const type = blocks.get(sourceKey);
      if (!type) continue;
      const targetY = Math.max(minY, destination.y + 1);
      blocks.delete(sourceKey);
      blocks.set(key(destination.x, targetY, destination.z), type);
      recordLiveEditPreview(x, sourceY, z, true);
      recordLiveEditPreview(destination.x, targetY, destination.z, false);
      let nextSourceY = sourceY - 1;
      while (nextSourceY >= minY && !blocks.has(key(x, nextSourceY, z))) nextSourceY--;
      heights.set(position, nextSourceY);
      heights.set(destination.key, targetY);
      movedThisPass = true;
    }
    if (!movedThisPass) break;
  }
}

function smoothVoxelObject(bounds, iterations, allowed = () => true, options = {}) {
  const removeThreshold = options.removeThreshold ?? 7;
  const fillThreshold = options.fillThreshold ?? 18;
  const bridgeGaps = Boolean(options.bridgeGaps);
  const directions = [];
  for (let dx = -1; dx <= 1; dx++)
    for (let dy = -1; dy <= 1; dy++)
      for (let dz = -1; dz <= 1; dz++)
        if (dx || dy || dz) directions.push([dx, dy, dz]);
  const inside = cell => valid(cell) && inBounds(cell, bounds) && allowed(cell);
  for (let iteration = 0; iteration < Math.min(8, iterations); iteration++) {
    const candidates = new Map();
    const volume = (bounds.max.x - bounds.min.x + 1) *
      (bounds.max.y - bounds.min.y + 1) * (bounds.max.z - bounds.min.z + 1);
    if (volume <= 100000) {
      for (let x = bounds.min.x; x <= bounds.max.x; x++)
        for (let y = bounds.min.y; y <= bounds.max.y; y++)
          for (let z = bounds.min.z; z <= bounds.max.z; z++) {
            const cell = { x, y, z };
            if (inside(cell)) candidates.set(key(x, y, z), cell);
          }
    } else {
      for (const position of blocks.keys()) {
        const [x, y, z] = position.split(",").map(Number);
        const occupied = { x, y, z };
        if (!inside(occupied)) continue;
        candidates.set(position, occupied);
        for (const [dx, dy, dz] of directions) {
          const neighbor = { x: x + dx, y: y + dy, z: z + dz };
          if (inside(neighbor)) candidates.set(key(neighbor.x, neighbor.y, neighbor.z), neighbor);
        }
      }
    }
    const changes = [];
    for (const [position, cell] of candidates) {
      const currentType = blocks.get(position);
      let occupiedNeighbors = 0;
      const neighborTypes = new Map();
      for (const [dx, dy, dz] of directions) {
        const type = blocks.get(key(cell.x + dx, cell.y + dy, cell.z + dz));
        if (!type) continue;
        occupiedNeighbors++;
        neighborTypes.set(type, (neighborTypes.get(type) || 0) + 1);
      }
      const bridgesGap = bridgeGaps && (
        (blocks.has(key(cell.x - 1, cell.y, cell.z)) && blocks.has(key(cell.x + 1, cell.y, cell.z))) ||
        (blocks.has(key(cell.x, cell.y - 1, cell.z)) && blocks.has(key(cell.x, cell.y + 1, cell.z))) ||
        (blocks.has(key(cell.x, cell.y, cell.z - 1)) && blocks.has(key(cell.x, cell.y, cell.z + 1)))
      );
      if (currentType && occupiedNeighbors <= removeThreshold) {
        changes.push({ ...cell, type: null });
      } else if (!currentType && (occupiedNeighbors >= fillThreshold || bridgesGap)) {
        let fillType = activeBlock, bestCount = -1;
        for (const [type, count] of neighborTypes) {
          if (count > bestCount) { fillType = type; bestCount = count; }
        }
        changes.push({ ...cell, type: fillType });
      }
    }
    if (!changes.length) break;
    for (const change of changes) {
      recordLiveEditPreview(change.x, change.y, change.z, !change.type);
      const position = key(change.x, change.y, change.z);
      if (change.type) blocks.set(position, change.type);
      else blocks.delete(position);
    }
  }
}

function sculptAt(center) {
  const mode = document.getElementById("sculpt-mode")?.value || "smooth";
  const strength = Math.max(1, Number(document.getElementById("sculpt-strength")?.value || 1));
  const range = brushRange();
  const radius = Math.max(0.5, range.size / 2);
  const round = document.getElementById("brush-shape")?.value === "sphere";
  if (mode === "object_smooth" || mode === "object_connect") {
    const bounds = {
      min: {
        x: Math.max(0, center.x + range.min), y: Math.max(0, center.y + range.min),
        z: Math.max(0, center.z + range.min)
      },
      max: {
        x: Math.min(workspaceSize.x - 1, center.x + range.max),
        y: Math.min(workspaceSize.y - 1, center.y + range.max),
        z: Math.min(workspaceSize.z - 1, center.z + range.max)
      }
    };
    const allowed = cell => {
      if (round && Math.hypot(cell.x - center.x, cell.y - center.y, cell.z - center.z) > radius) return false;
      return !document.getElementById("limit-to-selection")?.checked || cellInSelection(cell);
    };
    const options = mode === "object_connect"
      ? { removeThreshold: 2, fillThreshold: 10, bridgeGaps: true }
      : undefined;
    mutate(() => smoothVoxelObject(bounds, strength, allowed, options));
    return;
  }
  const columns = [];
  for (let x = center.x + range.min; x <= center.x + range.max; x++)
    for (let z = center.z + range.min; z <= center.z + range.max; z++) {
      if (x < 0 || z < 0 || x >= workspaceSize.x || z >= workspaceSize.z) continue;
      const distance = Math.hypot(x - center.x, z - center.z);
      if (round && distance > radius) continue;
      const current = columnTop(x, z);
      const selectionY = THREE.MathUtils.clamp(Math.max(0, current), 0, workspaceSize.y - 1);
      if (document.getElementById("limit-to-selection")?.checked &&
          !cellInSelection({ x, y: selectionY, z })) continue;
      columns.push({ x, z, current, distance });
    }
  if (!columns.length) return;
  const originalHeights = new Map(columns.map(column => [`${column.x},${column.z}`, column.current]));
  const centerHeight = columnTop(center.x, center.z);
  mutate(() => {
    if (mode === "natural_flatten") {
      thermalErodeColumns(columns, strength * 2);
      return;
    }
    for (const column of columns) {
      const falloff = Math.max(0.15, 1 - column.distance / (radius + 0.5));
      const amount = Math.max(1, Math.round(strength * falloff));
      if (mode === "raise") {
        setColumnHeight(column.x, column.z, column.current, column.current + amount);
      } else if (mode === "lower") {
        setColumnHeight(column.x, column.z, column.current, column.current - amount);
      } else if (mode === "flatten") {
        if (centerHeight >= 0) {
          const target = column.current + (centerHeight - column.current) * Math.min(1, strength / 4);
          setColumnHeight(column.x, column.z, column.current, target);
        }
      } else if (mode === "smooth") {
        let sum = 0, count = 0;
        for (let dx = -1; dx <= 1; dx++)
          for (let dz = -1; dz <= 1; dz++) {
            const value = originalHeights.get(`${column.x + dx},${column.z + dz}`);
            if (value != null && value >= 0) { sum += value; count++; }
          }
        if (count) {
          const average = sum / count;
          const target = column.current + (average - column.current) * Math.min(1, strength / 4);
          setColumnHeight(column.x, column.z, column.current, target);
        }
      } else if (mode === "settle") {
        const occupied = [];
        for (let y = 0; y <= column.current; y++) {
          const type = blocks.get(key(column.x, y, column.z));
          if (type) occupied.push({ y, type });
          if (type) recordLiveEditPreview(column.x, y, column.z, true);
          blocks.delete(key(column.x, y, column.z));
        }
        const settledY = new Set();
        occupied.forEach(({ y, type }) => {
          let targetY = Math.max(0, y - amount);
          while (settledY.has(targetY) && targetY < workspaceSize.y - 1) targetY++;
          settledY.add(targetY);
          recordLiveEditPreview(column.x, targetY, column.z, false);
          blocks.set(key(column.x, targetY, column.z), type);
        });
      }
    }
  });
}

function sculptSelectionTerrain() {
  const bounds = selectedBounds();
  if (!bounds) return;
  const mode = document.getElementById("selection-sculpt-mode")?.value || "smooth";
  const strength = Math.max(1, Number(document.getElementById("selection-sculpt-strength")?.value || 1));
  if (mode === "object_smooth" || mode === "object_connect") {
    const options = mode === "object_connect"
      ? { removeThreshold: 2, fillThreshold: 10, bridgeGaps: true }
      : undefined;
    mutate(() => smoothVoxelObject(bounds, strength, cell => cellInSelection(cell), options));
    return;
  }
  const data = terrainColumns();
  const originalHeights = new Map(data.heights);
  const flattenHeight = selectionA?.y ?? Math.round(
    [...data.heights.values()].filter(value => value >= 0)
      .reduce((sum, value, _, values) => sum + value / Math.max(1, values.length), 0)
  );
  mutate(() => {
    if (mode === "natural_flatten") {
      const columns = [...originalHeights].map(([position, current]) => {
        const [x, z] = position.split(",").map(Number);
        return { x, z, current };
      });
      thermalErodeColumns(columns, strength * 2, bounds.min.y, bounds.max.y);
      return;
    }
    for (const [position, current] of originalHeights) {
      const [x, z] = position.split(",").map(Number);
      if (mode === "raise") {
        setColumnHeight(x, z, current, current + strength);
      } else if (mode === "lower") {
        setColumnHeight(x, z, current, current - strength);
      } else if (mode === "flatten") {
        const target = current + (flattenHeight - current) * Math.min(1, strength / 4);
        setColumnHeight(x, z, current, target);
      } else if (mode === "smooth") {
        let sum = 0, count = 0;
        for (let dx = -1; dx <= 1; dx++)
          for (let dz = -1; dz <= 1; dz++) {
            const value = originalHeights.get(`${x + dx},${z + dz}`);
            if (value != null && value >= 0) { sum += value; count++; }
          }
        if (count) {
          const average = sum / count;
          setColumnHeight(x, z, current, current + (average - current) * Math.min(1, strength / 4));
        }
      } else if (mode === "settle") {
        const occupied = [];
        for (let y = bounds.min.y; y <= bounds.max.y; y++) {
          const type = blocks.get(key(x, y, z));
          if (type) occupied.push({ y, type });
          blocks.delete(key(x, y, z));
        }
        const settledY = new Set();
        occupied.forEach(({ y, type }) => {
          let targetY = Math.max(bounds.min.y, y - strength);
          while (settledY.has(targetY) && targetY < bounds.max.y) targetY++;
          settledY.add(targetY);
          blocks.set(key(x, targetY, z), type);
        });
      }
    }
  });
}

function extrudeSelection() {
  const bounds = selectedBounds();
  if (!bounds) return;
  const amount = shapeNumber("extrude-amount", 1, -64, 64);
  if (!amount) return;
  const source = [];
  for (const [position, type] of blocks) {
    const [x, y, z] = position.split(",").map(Number);
    if (inBounds({ x, y, z }, bounds)) source.push({ x, y, z, type });
  }
  mutate(() => {
    const direction = Math.sign(amount);
    for (let step = 1; step <= Math.abs(amount); step++)
      source.forEach(block => putGenerated(block.x, block.y + step * direction, block.z, block.type, false));
  });
}

document.getElementById("apply-selection-sculpt")?.addEventListener("click", sculptSelectionTerrain);
document.getElementById("extrude-selection")?.addEventListener("click", extrudeSelection);

function shapeOrigin(override) {
  return override || selectionA || {
    x: Math.floor(workspaceSize.x / 2),
    y: 0,
    z: Math.floor(workspaceSize.z / 2)
  };
}

function shapeNumber(id, fallback, min, max) {
  const value = Number(document.getElementById(id)?.value);
  return THREE.MathUtils.clamp(Number.isFinite(value) ? Math.round(value) : fallback, min, max);
}

function putGenerated(x, y, z, type = activeBlock, respectMask = true) {
  if (valid({ x, y, z }) && (!respectMask || brushAllowed({ x, y, z }))) {
    if (document.getElementById("place-air-only")?.checked &&
        tool !== "paste" && tool !== "moveSelection" && blocks.has(key(x, y, z))) return;
    if (document.getElementById("place-solid-only")?.checked &&
        tool !== "paste" && tool !== "moveSelection" && !blocks.has(key(x, y, z))) return;
    recordLiveEditPreview(x, y, z, false);
    blocks.set(key(x, y, z), type);
  }
}

function generateSphere(hollow = false, override) {
  const center = shapeOrigin(override);
  const radius = shapeNumber("shape-radius", 5, 1, 64);
  mutate(() => {
    for (let x = center.x - radius; x <= center.x + radius; x++)
      for (let y = center.y - radius; y <= center.y + radius; y++)
        for (let z = center.z - radius; z <= center.z + radius; z++) {
          const distance = Math.hypot(x - center.x, y - center.y, z - center.z);
          if (distance > radius + 0.35) continue;
          if (hollow && distance < radius - 0.75) continue;
          putGenerated(x, y, z);
        }
  });
}

function generateCircle(filled = false, override) {
  const center = shapeOrigin(override);
  const radius = shapeNumber("shape-radius", 5, 1, 64);
  mutate(() => {
    for (let x = center.x - radius; x <= center.x + radius; x++)
      for (let z = center.z - radius; z <= center.z + radius; z++) {
        const distance = Math.hypot(x - center.x, z - center.z);
        if (distance > radius + 0.35) continue;
        if (!filled && distance < radius - 0.65) continue;
        putGenerated(x, center.y, z);
      }
  });
}

function generateCylinder(override) {
  const center = shapeOrigin(override);
  const radius = shapeNumber("shape-radius", 5, 1, 64);
  const height = shapeNumber("shape-height", 8, 1, 128);
  const hollow = document.getElementById("shape-hollow")?.checked;
  mutate(() => {
    for (let y = center.y; y < center.y + height; y++)
      for (let x = center.x - radius; x <= center.x + radius; x++)
        for (let z = center.z - radius; z <= center.z + radius; z++) {
          const distance = Math.hypot(x - center.x, z - center.z);
          if (distance > radius + 0.35) continue;
          if (hollow && distance < radius - 0.65 && y > center.y && y < center.y + height - 1) continue;
          putGenerated(x, y, z);
        }
  });
}

function noise2d(x, z, seed) {
  const value = Math.sin(x * 127.1 + z * 311.7 + seed * 74.7) * 43758.5453;
  return value - Math.floor(value);
}

let blockTextRasterCache = { signature: "", offsets: [] };
let voxelImageAsset = null;
let voxelImageRasterCache = { signature: "", offsets: [] };
let voxelModelAsset = null;
let voxelModelRasterCache = { signature: "", offsets: [] };
const MAX_IMPORTED_VOXELS = 250000;
const imageBlockPalette = [
  ["white_concrete", 207, 213, 214], ["light_gray_concrete", 125, 125, 115],
  ["gray_concrete", 54, 57, 61], ["black_concrete", 8, 10, 15],
  ["red_concrete", 142, 32, 32], ["orange_concrete", 224, 97, 0],
  ["yellow_concrete", 241, 175, 21], ["lime_concrete", 94, 168, 24],
  ["green_concrete", 73, 91, 36], ["cyan_concrete", 21, 119, 136],
  ["light_blue_concrete", 36, 137, 199], ["blue_concrete", 44, 46, 143],
  ["purple_concrete", 100, 31, 156], ["magenta_concrete", 169, 48, 159],
  ["pink_concrete", 214, 101, 143], ["brown_concrete", 96, 59, 31]
];

function nearestImageBlock(red, green, blue) {
  let nearest = imageBlockPalette[0];
  let nearestDistance = Infinity;
  for (const candidate of imageBlockPalette) {
    const distance = (red - candidate[1]) ** 2 + (green - candidate[2]) ** 2 +
      (blue - candidate[3]) ** 2;
    if (distance < nearestDistance) {
      nearest = candidate;
      nearestDistance = distance;
    }
  }
  return nearest[0];
}

function collectVoxelImageCells(center, respectMask = true) {
  if (!voxelImageAsset) return [];
  const width = shapeNumber("image-block-width", 64, 1, 256);
  const height = Math.max(1, Math.min(256,
    Math.round(width * voxelImageAsset.height / voxelImageAsset.width)));
  const depth = shapeNumber("image-block-depth", 1, 1, 16);
  const signature = `${voxelImageAsset.id}:${width}:${height}:${depth}`;
  if (voxelImageRasterCache.signature !== signature) {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    context.imageSmoothingEnabled = false;
    context.drawImage(voxelImageAsset.image, 0, 0, width, height);
    const pixels = context.getImageData(0, 0, width, height).data;
    const offsets = [];
    imagePixels: for (let pixelY = 0; pixelY < height; pixelY++)
      for (let pixelX = 0; pixelX < width; pixelX++) {
        const index = (pixelY * width + pixelX) * 4;
        if (pixels[index + 3] < 64) continue;
        const type = nearestImageBlock(pixels[index], pixels[index + 1], pixels[index + 2]);
        for (let offsetZ = 0; offsetZ < depth; offsetZ++) {
          offsets.push({ x: pixelX, y: height - 1 - pixelY, z: offsetZ, type });
          if (offsets.length >= MAX_IMPORTED_VOXELS) break imagePixels;
        }
      }
    voxelImageRasterCache = { signature, offsets };
  }
  return voxelImageRasterCache.offsets.map(offset => ({
    x: center.x + offset.x, y: center.y + offset.y, z: center.z + offset.z, type: offset.type
  })).filter(cell => valid(cell) && (!respectMask || brushAllowed(cell)));
}

function decodeBase64Bytes(data) {
  const binary = atob(data);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

function parseObjModel(bytes) {
  const vertices = [];
  const triangles = [];
  for (const rawLine of new TextDecoder().decode(bytes).split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line.startsWith("v ")) {
      const values = line.slice(2).trim().split(/\s+/).map(Number);
      if (values.length >= 3 && values.slice(0, 3).every(Number.isFinite))
        vertices.push({ x: values[0], y: values[1], z: values[2] });
    } else if (line.startsWith("f ")) {
      const face = line.slice(2).trim().split(/\s+/).map(token => {
        const value = Number(token.split("/")[0]);
        return value < 0 ? vertices.length + value : value - 1;
      }).filter(index => Number.isInteger(index) && vertices[index]);
      for (let index = 1; index + 1 < face.length; index++)
        triangles.push([vertices[face[0]], vertices[face[index]], vertices[face[index + 1]]]);
    }
  }
  return triangles;
}

function parseStlModel(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const triangles = [];
  const binaryCount = bytes.byteLength >= 84 ? view.getUint32(80, true) : 0;
  if (binaryCount && 84 + binaryCount * 50 === bytes.byteLength) {
    for (let triangle = 0; triangle < binaryCount; triangle++) {
      const offset = 84 + triangle * 50 + 12;
      const points = [];
      for (let vertex = 0; vertex < 3; vertex++) {
        const start = offset + vertex * 12;
        points.push({
          x: view.getFloat32(start, true),
          y: view.getFloat32(start + 4, true),
          z: view.getFloat32(start + 8, true)
        });
      }
      if (points.every(point => Object.values(point).every(Number.isFinite))) triangles.push(points);
    }
    return triangles;
  }
  const vertices = [...new TextDecoder().decode(bytes).matchAll(
    /vertex\s+([+\-\d.eE]+)\s+([+\-\d.eE]+)\s+([+\-\d.eE]+)/g
  )].map(match => ({ x: Number(match[1]), y: Number(match[2]), z: Number(match[3]) }));
  for (let index = 0; index + 2 < vertices.length; index += 3)
    triangles.push(vertices.slice(index, index + 3));
  return triangles;
}

function collectVoxelModelOffsets() {
  if (!voxelModelAsset?.triangles.length) return [];
  const size = shapeNumber("model-block-size", 32, 4, 128);
  const solid = Boolean(document.getElementById("model-solid")?.checked);
  const signature = `${voxelModelAsset.id}:${size}:${solid}`;
  if (voxelModelRasterCache.signature === signature) return voxelModelRasterCache.offsets;
  const points = voxelModelAsset.triangles.flat();
  const minimum = { x: Infinity, y: Infinity, z: Infinity };
  const maximum = { x: -Infinity, y: -Infinity, z: -Infinity };
  for (const point of points) {
    minimum.x = Math.min(minimum.x, point.x);
    minimum.y = Math.min(minimum.y, point.y);
    minimum.z = Math.min(minimum.z, point.z);
    maximum.x = Math.max(maximum.x, point.x);
    maximum.y = Math.max(maximum.y, point.y);
    maximum.z = Math.max(maximum.z, point.z);
  }
  const longest = Math.max(maximum.x - minimum.x, maximum.y - minimum.y,
    maximum.z - minimum.z, Number.EPSILON);
  const scale = (size - 1) / longest;
  const occupied = new Map();
  const add = point => {
    const offset = {
      x: Math.round((point.x - minimum.x) * scale),
      y: Math.round((point.y - minimum.y) * scale),
      z: Math.round((point.z - minimum.z) * scale)
    };
    occupied.set(`${offset.x},${offset.y},${offset.z}`, offset);
  };
  for (const [a, b, c] of voxelModelAsset.triangles) {
    const edge = Math.max(
      Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z),
      Math.hypot(a.x - c.x, a.y - c.y, a.z - c.z),
      Math.hypot(b.x - c.x, b.y - c.y, b.z - c.z)
    ) * scale;
    const steps = Math.max(1, Math.min(256, Math.ceil(edge * 2)));
    triangleSamples: for (let first = 0; first <= steps; first++)
      for (let second = 0; second <= steps - first; second++) {
        const u = first / steps, v = second / steps, w = 1 - u - v;
        add({
          x: a.x * w + b.x * u + c.x * v,
          y: a.y * w + b.y * u + c.y * v,
          z: a.z * w + b.z * u + c.z * v
        });
        if (occupied.size >= MAX_IMPORTED_VOXELS) break triangleSamples;
      }
    if (occupied.size >= MAX_IMPORTED_VOXELS) break;
  }
  if (solid && occupied.size < MAX_IMPORTED_VOXELS) {
    const columns = new Map();
    for (const point of occupied.values()) {
      const columnKey = `${point.x},${point.z}`;
      const range = columns.get(columnKey) || { min: point.y, max: point.y };
      range.min = Math.min(range.min, point.y);
      range.max = Math.max(range.max, point.y);
      columns.set(columnKey, range);
    }
    for (const [columnKey, range] of columns) {
      const [x, z] = columnKey.split(",").map(Number);
      for (let y = range.min; y <= range.max && occupied.size < MAX_IMPORTED_VOXELS; y++)
        occupied.set(`${x},${y},${z}`, { x, y, z });
    }
  }
  voxelModelRasterCache = { signature, offsets: [...occupied.values()] };
  return voxelModelRasterCache.offsets;
}

function collectVoxelModelCells(center, respectMask = true) {
  return collectVoxelModelOffsets().map(offset => ({
    x: center.x + offset.x, y: center.y + offset.y, z: center.z + offset.z, type: activeBlock
  })).filter(cell => valid(cell) && (!respectMask || brushAllowed(cell)));
}

function collectBlockTextCells(center, respectMask = true) {
  const text = String(document.getElementById("block-text")?.value || "").slice(0, 64);
  if (!text) return [];
  const fontSize = shapeNumber("block-text-size", 12, 5, 64);
  const depth = shapeNumber("block-text-depth", 1, 1, 16);
  const signature = `${text}\u0000${fontSize}\u0000${depth}`;
  if (blockTextRasterCache.signature !== signature) {
    const textCanvas = document.createElement("canvas");
    const context = textCanvas.getContext("2d", { willReadFrequently: true });
    context.font = `900 ${fontSize}px -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", sans-serif`;
    const metrics = context.measureText(text);
    const ascent = Math.ceil(metrics.actualBoundingBoxAscent || fontSize);
    const descent = Math.ceil(metrics.actualBoundingBoxDescent || fontSize * 0.25);
    textCanvas.width = Math.max(1, Math.ceil(metrics.width) + 4);
    textCanvas.height = Math.max(1, ascent + descent + 4);
    context.font = `900 ${fontSize}px -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", sans-serif`;
    context.fillStyle = "#fff";
    context.textBaseline = "alphabetic";
    context.fillText(text, 2, 2 + ascent);
    const pixels = context.getImageData(0, 0, textCanvas.width, textCanvas.height).data;
    const offsets = [];
    for (let pixelY = 0; pixelY < textCanvas.height; pixelY++)
      for (let pixelX = 0; pixelX < textCanvas.width; pixelX++) {
        if (pixels[(pixelY * textCanvas.width + pixelX) * 4 + 3] < 128) continue;
        for (let offsetZ = 0; offsetZ < depth; offsetZ++) {
          offsets.push({
            x: pixelX,
            y: textCanvas.height - 1 - pixelY,
            z: offsetZ
          });
        }
      }
    blockTextRasterCache = { signature, offsets };
  }
  return blockTextRasterCache.offsets
    .map(offset => ({
      x: center.x + offset.x,
      y: center.y + offset.y,
      z: center.z + offset.z,
      type: activeBlock
    }))
    .filter(cell => valid(cell) && (!respectMask || brushAllowed(cell)));
}

function generateBlockText(override) {
  const cells = collectBlockTextCells(shapeOrigin(override));
  if (!cells.length) return;
  mutate(() => cells.forEach(cell => putGenerated(cell.x, cell.y, cell.z, cell.type)));
}

function collectGeneratedCells(generator, center) {
  if (generator === "text") return collectBlockTextCells(center);
  if (generator === "image") return collectVoxelImageCells(center);
  if (generator === "model") return collectVoxelModelCells(center);
  const cells = [];
  const add = (x, y, z, type = activeBlock) => {
    if (valid({ x, y, z }) && brushAllowed({ x, y, z })) cells.push({ x, y, z, type });
  };
  const radius = shapeNumber("shape-radius", generator === "mountain" ? 10 : 5, generator === "mountain" ? 2 : 1, 64);
  const height = shapeNumber("shape-height", generator === "mountain" ? 14 : 8, 1, 128);
  if (generator === "sphere" || generator === "hollow-sphere") {
    for (let x = center.x - radius; x <= center.x + radius; x++)
      for (let y = center.y - radius; y <= center.y + radius; y++)
        for (let z = center.z - radius; z <= center.z + radius; z++) {
          const distance = Math.hypot(x - center.x, y - center.y, z - center.z);
          if (distance <= radius + 0.35 && (generator !== "hollow-sphere" || distance >= radius - 0.75)) add(x, y, z);
        }
  } else if (generator === "circle" || generator === "disc") {
    for (let x = center.x - radius; x <= center.x + radius; x++)
      for (let z = center.z - radius; z <= center.z + radius; z++) {
        const distance = Math.hypot(x - center.x, z - center.z);
        if (distance <= radius + 0.35 && (generator === "disc" || distance >= radius - 0.65)) add(x, center.y, z);
      }
  } else if (generator === "cylinder") {
    const hollow = document.getElementById("shape-hollow")?.checked;
    for (let y = center.y; y < center.y + height; y++)
      for (let x = center.x - radius; x <= center.x + radius; x++)
        for (let z = center.z - radius; z <= center.z + radius; z++) {
          const distance = Math.hypot(x - center.x, z - center.z);
          if (distance <= radius + 0.35 &&
              (!hollow || distance >= radius - 0.65 || y === center.y || y === center.y + height - 1)) add(x, y, z);
        }
  } else if (generator === "mountain") {
    const roughness = Number(document.getElementById("mountain-roughness")?.value || 0.3);
    const seed = Number(document.getElementById("mountain-seed")?.value || 1);
    for (let x = center.x - radius; x <= center.x + radius; x++)
      for (let z = center.z - radius; z <= center.z + radius; z++) {
        const normalized = Math.hypot(x - center.x, z - center.z) / radius;
        if (normalized > 1) continue;
        const ridge = Math.pow(1 - normalized, 1.45);
        const detail = (noise2d(x, z, seed) - 0.5) * roughness * (1 - normalized);
        const column = Math.max(1, Math.round(height * Math.max(0, ridge + detail)));
        for (let y = center.y; y < center.y + column; y++) add(x, y, z);
      }
  } else if (generator === "line" && selectionA) {
    const dx = center.x - selectionA.x, dy = center.y - selectionA.y, dz = center.z - selectionA.z;
    const steps = Math.max(Math.abs(dx), Math.abs(dy), Math.abs(dz));
    for (let index = 0; index <= steps; index++) {
      const amount = steps ? index / steps : 0;
      add(
        Math.round(selectionA.x + dx * amount),
        Math.round(selectionA.y + dy * amount),
        Math.round(selectionA.z + dz * amount)
      );
    }
  }
  return cells;
}

let specialPlacementSourceCache = { signature: "", items: [] };
function specialGeneratorItems(generator) {
  const signature = [
    generator, activeBlock, voxelImageAsset?.id || "", voxelModelAsset?.id || "",
    document.getElementById("block-text")?.value || "",
    document.getElementById("block-text-size")?.value || "",
    document.getElementById("block-text-depth")?.value || "",
    document.getElementById("image-block-width")?.value || "",
    document.getElementById("image-block-depth")?.value || "",
    document.getElementById("model-block-size")?.value || "",
    document.getElementById("model-solid")?.checked || false
  ].join("|");
  if (specialPlacementSourceCache.signature === signature)
    return specialPlacementSourceCache.items;
  const cells = generator === "text"
    ? collectBlockTextCells({ x: 0, y: 0, z: 0 }, false)
    : generator === "image"
      ? collectVoxelImageCells({ x: 0, y: 0, z: 0 }, false)
      : collectVoxelModelCells({ x: 0, y: 0, z: 0 }, false);
  if (!cells.length) {
    specialPlacementSourceCache = { signature, items: [] };
    return [];
  }
  const minimum = cells.reduce((value, cell) => ({
    x: Math.min(value.x, cell.x),
    y: Math.min(value.y, cell.y),
    z: Math.min(value.z, cell.z)
  }), { x: Infinity, y: Infinity, z: Infinity });
  const items = cells.map(cell => ({
    x: cell.x - minimum.x,
    y: cell.y - minimum.y,
    z: cell.z - minimum.z,
    type: cell.type
  }));
  specialPlacementSourceCache = { signature, items };
  return items;
}

function transformedPreviewPlacement(origin, items) {
  return scaledPlacement(origin, items).filter(item => item.type !== "__air__");
}

function selectedCellCount() {
  if (selectionMask.size) return selectionMask.size;
  const bounds = selectedBounds();
  if (!bounds) return 0;
  return (bounds.max.x - bounds.min.x + 1) *
    (bounds.max.y - bounds.min.y + 1) *
    (bounds.max.z - bounds.min.z + 1);
}

function transformedSelectionOutline(origin) {
  const bounds = selectedBounds();
  if (!bounds) return [];
  const width = bounds.max.x - bounds.min.x + 1;
  const height = bounds.max.y - bounds.min.y + 1;
  const depth = bounds.max.z - bounds.min.z + 1;
  const center = new THREE.Vector3(width / 2, height / 2, depth / 2);
  const rotation = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(
    THREE.MathUtils.degToRad(placementRotation.x),
    THREE.MathUtils.degToRad(placementRotation.y),
    THREE.MathUtils.degToRad(placementRotation.z),
    "XYZ"
  ));
  const rotated = [];
  for (const x of [-center.x, width - center.x])
    for (const y of [-center.y, height - center.y])
      for (const z of [-center.z, depth - center.z])
        rotated.push(new THREE.Vector3(x, y, z).applyMatrix4(rotation));
  const minimum = new THREE.Vector3(
    Math.min(...rotated.map(point => point.x)),
    Math.min(...rotated.map(point => point.y)),
    Math.min(...rotated.map(point => point.z))
  );
  const maximum = new THREE.Vector3(
    Math.max(...rotated.map(point => point.x)),
    Math.max(...rotated.map(point => point.y)),
    Math.max(...rotated.map(point => point.z))
  );
  const axisScale = effectiveScale();
  const size = {
    x: Math.max(1, Math.ceil((maximum.x - minimum.x) * axisScale.x)),
    y: Math.max(1, Math.ceil((maximum.y - minimum.y) * axisScale.y)),
    z: Math.max(1, Math.ceil((maximum.z - minimum.z) * axisScale.z))
  };
  return [
    { x: origin.x, y: origin.y, z: origin.z, type: "__outline__" },
    { x: origin.x + size.x - 1, y: origin.y + size.y - 1, z: origin.z + size.z - 1, type: "__outline__" }
  ];
}

const transformedSourceBoundsCache = new WeakMap();
function transformedSourceDimensions(items) {
  let dimensions = transformedSourceBoundsCache.get(items);
  if (!dimensions) {
    const maximum = items.reduce((value, item) => ({
      x: Math.max(value.x, item.x),
      y: Math.max(value.y, item.y),
      z: Math.max(value.z, item.z)
    }), { x: 0, y: 0, z: 0 });
    dimensions = { x: maximum.x + 1, y: maximum.y + 1, z: maximum.z + 1 };
    transformedSourceBoundsCache.set(items, dimensions);
  }
  return dimensions;
}

const largeSurfacePreviewCaches = {
  transform: { source: null, status: "empty", token: 0, geometry: null, dimensions: null },
  selection: { source: null, status: "empty", token: 0, geometry: null, dimensions: null }
};

function scheduleLargeSurfacePreview(items, channel = "transform") {
  const previousCache = largeSurfacePreviewCaches[channel];
  if (previousCache.source === items) return previousCache;
  if (previousCache.geometry) previousCache.geometry.dispose();
  const dimensions = transformedSourceDimensions(items);
  const longest = Math.max(dimensions.x, dimensions.y, dimensions.z);
  const step = Math.max(
    1,
    Math.ceil(longest / 32),
    Math.ceil(Math.cbrt(items.length / 12000))
  );
  const cache = {
    source: items, status: "building", token: previousCache.token + 1,
    geometry: null, dimensions, step, index: 0, occupied: new Set()
  };
  largeSurfacePreviewCaches[channel] = cache;
  const processBatch = () => {
    if (largeSurfacePreviewCaches[channel] !== cache) return;
    const started = performance.now();
    while (cache.index < items.length && performance.now() - started < 6) {
      const item = items[cache.index++];
      if (item.type !== "__air__") {
        cache.occupied.add(
          `${Math.floor(item.x / step)},${Math.floor(item.y / step)},${Math.floor(item.z / step)}`
        );
      }
    }
    if (cache.index < items.length) {
      setTimeout(processBatch, 0);
      return;
    }
    const positions = [];
    const center = {
      x: dimensions.x / 2, y: dimensions.y / 2, z: dimensions.z / 2
    };
    const faces = [
      { d: [1,0,0], c: [[1,0,0],[1,1,0],[1,1,1],[1,0,1]] },
      { d: [-1,0,0], c: [[0,0,1],[0,1,1],[0,1,0],[0,0,0]] },
      { d: [0,1,0], c: [[0,1,1],[1,1,1],[1,1,0],[0,1,0]] },
      { d: [0,-1,0], c: [[0,0,0],[1,0,0],[1,0,1],[0,0,1]] },
      { d: [0,0,1], c: [[1,0,1],[1,1,1],[0,1,1],[0,0,1]] },
      { d: [0,0,-1], c: [[0,0,0],[0,1,0],[1,1,0],[1,0,0]] }
    ];
    for (const position of cache.occupied) {
      const [gridX, gridY, gridZ] = position.split(",").map(Number);
      const base = [gridX * step, gridY * step, gridZ * step];
      const size = [
        Math.min(step, dimensions.x - base[0]),
        Math.min(step, dimensions.y - base[1]),
        Math.min(step, dimensions.z - base[2])
      ];
      for (const face of faces) {
        if (cache.occupied.has(`${gridX + face.d[0]},${gridY + face.d[1]},${gridZ + face.d[2]}`)) continue;
        const corners = face.c.map(corner => [
          base[0] + corner[0] * size[0] - center.x,
          base[1] + corner[1] * size[1] - center.y,
          base[2] + corner[2] * size[2] - center.z
        ]);
        for (const index of [0,1,2,0,2,3]) positions.push(...corners[index]);
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geometry.computeVertexNormals();
    geometry.computeBoundingSphere();
    cache.geometry = geometry;
    cache.status = "ready";
    cache.occupied.clear();
    if (channel === "selection") updateSelection();
    else {
      ghostSignature = "";
      refreshHover();
    }
  };
  setTimeout(processBatch, 120);
  return cache;
}

function transformedSourceFrame(origin, dimensions) {
  const center = new THREE.Vector3(dimensions.x / 2, dimensions.y / 2, dimensions.z / 2);
  const rotation = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(
    THREE.MathUtils.degToRad(placementRotation.x),
    THREE.MathUtils.degToRad(placementRotation.y),
    THREE.MathUtils.degToRad(placementRotation.z),
    "XYZ"
  ));
  const rotatedCorners = [];
  for (const x of [-center.x, dimensions.x - center.x])
    for (const y of [-center.y, dimensions.y - center.y])
      for (const z of [-center.z, dimensions.z - center.z])
        rotatedCorners.push(new THREE.Vector3(x, y, z).applyMatrix4(rotation));
  const minimum = new THREE.Vector3(
    Math.min(...rotatedCorners.map(point => point.x)),
    Math.min(...rotatedCorners.map(point => point.y)),
    Math.min(...rotatedCorners.map(point => point.z))
  );
  const maximum = new THREE.Vector3(
    Math.max(...rotatedCorners.map(point => point.x)),
    Math.max(...rotatedCorners.map(point => point.y)),
    Math.max(...rotatedCorners.map(point => point.z))
  );
  const axisScale = effectiveScale();
  const size = {
    x: Math.max(1, Math.ceil((maximum.x - minimum.x) * axisScale.x)),
    y: Math.max(1, Math.ceil((maximum.y - minimum.y) * axisScale.y)),
    z: Math.max(1, Math.ceil((maximum.z - minimum.z) * axisScale.z))
  };
  return { minimum, maximum, size };
}

function transformedSourceOutline(origin, items) {
  if (!items.length) return [];
  const dimensions = transformedSourceDimensions(items);
  const { size } = transformedSourceFrame(origin, dimensions);
  return [
    { x: origin.x, y: origin.y, z: origin.z, type: "__outline__" },
    { x: origin.x + size.x - 1, y: origin.y + size.y - 1, z: origin.z + size.z - 1, type: "__outline__" }
  ];
}

let selectionSurfaceSourceCache = { signature: "", items: [] };
function selectionSurfaceItems() {
  const bounds = selectedBounds();
  if (!bounds) return [];
  const signature = [
    bounds.min.x, bounds.min.y, bounds.min.z,
    bounds.max.x, bounds.max.y, bounds.max.z,
    selectionMask.size, blockMutationRevision
  ].join(",");
  if (selectionSurfaceSourceCache.signature !== signature) {
    const items = [];
    if (selectionMask.size) {
      for (const position of selectionMask) {
        const type = blocks.get(position);
        if (!type) continue;
        const [x, y, z] = position.split(",").map(Number);
        items.push({ x: x - bounds.min.x, y: y - bounds.min.y, z: z - bounds.min.z, type });
      }
    } else {
      for (const [position, type] of blocks) {
        const [x, y, z] = position.split(",").map(Number);
        if (x < bounds.min.x || x > bounds.max.x || y < bounds.min.y || y > bounds.max.y ||
            z < bounds.min.z || z > bounds.max.z) continue;
        items.push({ x: x - bounds.min.x, y: y - bounds.min.y, z: z - bounds.min.z, type });
      }
    }
    items.push({ x: 0, y: 0, z: 0, type: "__air__" });
    items.push({
      x: bounds.max.x - bounds.min.x,
      y: bounds.max.y - bounds.min.y,
      z: bounds.max.z - bounds.min.z,
      type: "__air__"
    });
    selectionSurfaceSourceCache = {
      signature,
      items
    };
  }
  return selectionSurfaceSourceCache.items;
}

function renderSelectionSurfacePreview(bounds) {
  const items = selectionSurfaceItems();
  if (!items.length) return;
  const cache = scheduleLargeSurfacePreview(items, "selection");
  if (cache.status !== "ready" || !cache.geometry) return;
  const material = new THREE.MeshStandardMaterial({
    color: 0xc6a8ff, transparent: true, opacity: 0.2,
    depthWrite: false, depthTest: true, roughness: 0.76,
    metalness: 0, side: THREE.DoubleSide
  });
  selectionSurfaceMesh = new THREE.Mesh(cache.geometry, material);
  selectionSurfaceMesh.position.set(
    bounds.min.x + cache.dimensions.x / 2,
    bounds.min.y + cache.dimensions.y / 2,
    bounds.min.z + cache.dimensions.z / 2
  );
  selectionSurfaceMesh.renderOrder = 24;
  selectionSurfaceMesh.visible = !playMode;
  scene.add(selectionSurfaceMesh);
}

function largeTransformPreviewSource() {
  if (tool === "paste") return clipboardBlocks;
  if (isSpecialTransformTool())
    return specialGeneratorItems(tool.slice("generate:".length));
  if (tool === "moveSelection" && selectedCellCount() > 1000) {
    return selectionSurfaceItems();
  }
  return null;
}

function simplifiedBrushPreview(cell, range, round) {
  const radius = (range.size - 1) / 2;
  const estimatedCount = round
    ? Math.max(1, Math.round(4 / 3 * Math.PI * Math.pow(radius + 0.5, 3)))
    : range.size * range.size * range.size;
  if (estimatedCount <= 2000) return null;
  const sampled = new Map();
  const add = (x, y, z) => {
    const preview = { x: Math.round(x), y: Math.round(y), z: Math.round(z), type: activeBlock };
    if (!valid(preview) || !brushAllowed(preview)) return;
    sampled.set(key(preview.x, preview.y, preview.z), preview);
  };
  if (round) {
    const latitudeSteps = 12;
    const longitudeSteps = 24;
    for (let latitude = 0; latitude <= latitudeSteps; latitude++) {
      const phi = Math.PI * latitude / latitudeSteps;
      for (let longitude = 0; longitude < longitudeSteps; longitude++) {
        const theta = Math.PI * 2 * longitude / longitudeSteps;
        add(
          cell.x + Math.sin(phi) * Math.cos(theta) * radius,
          cell.y + Math.cos(phi) * radius,
          cell.z + Math.sin(phi) * Math.sin(theta) * radius
        );
      }
    }
  } else {
    const step = Math.max(1, Math.ceil(range.size / 8));
    const minimum = { x: cell.x + range.min, y: cell.y + range.min, z: cell.z + range.min };
    const maximum = { x: cell.x + range.max, y: cell.y + range.max, z: cell.z + range.max };
    for (let u = range.min; u <= range.max; u += step)
      for (let v = range.min; v <= range.max; v += step) {
        add(minimum.x, cell.y + u, cell.z + v); add(maximum.x, cell.y + u, cell.z + v);
        add(cell.x + u, minimum.y, cell.z + v); add(cell.x + u, maximum.y, cell.z + v);
        add(cell.x + u, cell.y + v, minimum.z); add(cell.x + u, cell.y + v, maximum.z);
      }
  }
  const cells = [...sampled.values()];
  if (!cells.length) return cells;
  cells.simplifiedBrush = true;
  cells.estimatedCount = estimatedCount;
  cells.previewBounds = cells.reduce((bounds, preview) => ({
    minX: Math.min(bounds.minX, preview.x), minY: Math.min(bounds.minY, preview.y), minZ: Math.min(bounds.minZ, preview.z),
    maxX: Math.max(bounds.maxX, preview.x), maxY: Math.max(bounds.maxY, preview.y), maxZ: Math.max(bounds.maxZ, preview.z)
  }), { minX: Infinity, minY: Infinity, minZ: Infinity, maxX: -Infinity, maxY: -Infinity, maxZ: -Infinity });
  return cells;
}

function previewCellsForTool(cell) {
  if (!cell) return [];
  if (isSpecialTransformTool())
    return transformedPreviewPlacement(cell, specialGeneratorItems(tool.slice("generate:".length)));
  if (tool.startsWith("generate:")) return collectGeneratedCells(tool.slice("generate:".length), cell);
  if (tool === "moveSelection") {
    const bounds = selectedBounds();
    if (!bounds) return [];
    return transformedPreviewPlacement(cell, selectedCellList().map(source => ({
      x: source.x - bounds.min.x,
      y: source.y - bounds.min.y,
      z: source.z - bounds.min.z,
      type: blocks.get(key(source.x, source.y, source.z))
    }))).filter(preview => preview.type && valid(preview));
  }
  if (tool === "paste") return transformedPreviewPlacement(cell, clipboardBlocks)
    .filter(preview =>
      valid(preview) &&
      brushAllowed(preview) &&
      (preview.type !== "__air__" || document.getElementById("paste-air")?.checked)
    );
  if (tool === "place" || tool === "erase" || tool === "sculpt") {
    const collected = [];
    const range = brushRange();
    const radius = (range.size - 1) / 2;
    const round = document.getElementById("brush-shape")?.value === "sphere";
    const simplified = simplifiedBrushPreview(cell, range, round);
    if (simplified) return simplified;
    for (let x = cell.x + range.min; x <= cell.x + range.max; x++)
      for (let y = cell.y + range.min; y <= cell.y + range.max; y++)
        for (let z = cell.z + range.min; z <= cell.z + range.max; z++) {
          if (!valid({ x, y, z })) continue;
          if (round && radius && Math.hypot(x - cell.x, y - cell.y, z - cell.z) > radius + 0.35) continue;
          if (!brushAllowed({ x, y, z })) continue;
          collected.push({ x, y, z, type: activeBlock });
        }
    return collected;
  }
  return [];
}

function nearestPreviewCells(cells, limit) {
  if (cells.length <= limit) return cells;
  const heap = [];
  const distanceSquared = cell => {
    const dx = cell.x + 0.5 - camera.position.x;
    const dy = cell.y + 0.5 - camera.position.y;
    const dz = cell.z + 0.5 - camera.position.z;
    return dx * dx + dy * dy + dz * dz;
  };
  const swap = (a, b) => {
    const temporary = heap[a];
    heap[a] = heap[b];
    heap[b] = temporary;
  };
  const siftUp = index => {
    while (index > 0) {
      const parent = Math.floor((index - 1) / 2);
      if (heap[parent].distance >= heap[index].distance) break;
      swap(parent, index);
      index = parent;
    }
  };
  const siftDown = index => {
    while (true) {
      const left = index * 2 + 1;
      const right = left + 1;
      let largest = index;
      if (left < heap.length && heap[left].distance > heap[largest].distance) largest = left;
      if (right < heap.length && heap[right].distance > heap[largest].distance) largest = right;
      if (largest === index) return;
      swap(index, largest);
      index = largest;
    }
  };
  for (const cell of cells) {
    const candidate = { cell, distance: distanceSquared(cell) };
    if (heap.length < limit) {
      heap.push(candidate);
      siftUp(heap.length - 1);
    } else if (candidate.distance < heap[0].distance) {
      heap[0] = candidate;
      siftDown(0);
    }
  }
  return heap.sort((a, b) => a.distance - b.distance).map(item => item.cell);
}

function updateGhostPreview(cell) {
  const brushPreviewTool = tool === "place" || tool === "erase" || tool === "sculpt";
  let nextBrushPreviewSignature = "";
  if (brushPreviewTool) {
    const brushSignature = `${tool}|${activeBlock}|${cell ? key(cell.x, cell.y, cell.z) : ""}|` +
      `${document.getElementById("brush-size")?.value}|${document.getElementById("brush-shape")?.value}|` +
      `${document.getElementById("limit-to-selection")?.checked}|${selectionMask.size}|` +
      `${selectionA ? key(selectionA.x, selectionA.y, selectionA.z) : ""}|` +
      `${selectionB ? key(selectionB.x, selectionB.y, selectionB.z) : ""}`;
    if (brushSignature === brushPreviewSignature && (ghostMesh || ghostBounds)) return;
    nextBrushPreviewSignature = brushSignature;
    brushPreviewSignature = brushSignature;
  } else {
    brushPreviewSignature = "";
  }
  const transformSource = largeTransformPreviewSource();
  const largeTransformPreview = Boolean(cell && transformSource && (
    transformSource.length > 1000 || (tool === "moveSelection" && selectedCellCount() > 1000)
  ));
  const cells = largeTransformPreview
      ? transformedSourceOutline(cell, transformSource)
      : previewCellsForTool(cell);
  const previewCellCount = largeTransformPreview
    ? tool === "moveSelection" ? selectedCellCount() : transformSource.length
    : cells.estimatedCount || cells.length;
  const simplifiedBrush = Boolean(cells.simplifiedBrush);
  const placementPreview = isTransformPlacementTool();
  const outlineOnlyPreview = placementPreview && previewCellCount > 1000;
  const surfacePreview = largeTransformPreview ? scheduleLargeSurfacePreview(transformSource) : null;
  const showDetailedSurface = Boolean(
    surfacePreview?.status === "ready" &&
    pointerDown?.mode !== "visualTransform" &&
    pointerDown?.mode !== "scalePlacement"
  );
  const showTransformGizmo = Boolean(
    pendingPlacement?.locked ||
    pointerDown?.mode === "visualTransform"
  );
  const signature = `${tool}|${activeBlock}|${cell ? key(cell.x, cell.y, cell.z) : ""}|${placementScale}|` +
    `${placementStretch.x},${placementStretch.y},${placementStretch.z}|` +
    `${placementRotation.x},${placementRotation.y},${placementRotation.z}|${previewCellCount}|` +
    `${outlineOnlyPreview ? cells.map(preview => key(preview.x, preview.y, preview.z)).join(";") : ""}|` +
    `${surfacePreview?.status || ""}|${showDetailedSurface}|` +
    `${showTransformGizmo}|` +
    `${Math.floor(camera.position.x / 4)},${Math.floor(camera.position.y / 4)},${Math.floor(camera.position.z / 4)}|` +
    `${document.getElementById("shape-radius")?.value}|${document.getElementById("shape-height")?.value}|` +
    `${document.getElementById("mountain-roughness")?.value}|${document.getElementById("mountain-seed")?.value}`;
  if (signature === ghostSignature) return;
  clearGhost();
  ghostSignature = signature;
  brushPreviewSignature = nextBrushPreviewSignature;
  if (!cells.length) return;
  const maxPreview = simplifiedBrush ? 500 : placementPreview
    ? previewCellCount <= 1000 ? previewCellCount : previewCellCount <= 10000 ? 600 : 200
    : 4000;
  const stride = simplifiedBrush ? 1 : Math.max(1, Math.ceil(previewCellCount / maxPreview));
  const visible = outlineOnlyPreview
    ? []
    : simplifiedBrush
      ? cells
    : placementPreview
      ? nearestPreviewCells(cells, maxPreview)
    : cells.filter((_, index) => index % stride === 0);
  const placementOpacity = previewCellCount <= 256 ? 0.5
    : previewCellCount <= 1000 ? 0.3
      : previewCellCount <= 10000 ? 0.16 : 0.09;
  if (visible.length) {
    const geometry = new THREE.BoxGeometry(0.98, 0.98, 0.98);
    const material = new THREE.MeshBasicMaterial({
      color: tool === "erase" ? 0xff6b6b : placementPreview ? 0xb8ff4a : blockColor(activeBlock),
      transparent: true,
      opacity: placementPreview ? placementOpacity : 0.32,
      depthWrite: false,
      depthTest: !placementPreview || previewCellCount > 256
    });
    material.userData.baseOpacity = material.opacity;
    ghostMesh = new THREE.InstancedMesh(geometry, material, visible.length);
    const matrix = new THREE.Matrix4();
    visible.forEach((preview, index) => {
      matrix.makeTranslation(preview.x + 0.5, preview.y + 0.5, preview.z + 0.5);
      ghostMesh.setMatrixAt(index, matrix);
    });
    ghostMesh.renderOrder = 10;
    scene.add(ghostMesh);
  }
  if (showDetailedSurface && surfacePreview?.geometry && cell) {
    const frame = transformedSourceFrame(cell, surfacePreview.dimensions);
    const material = new THREE.MeshStandardMaterial({
      color: 0xb8ff4a, transparent: true, opacity: 0.3,
      depthWrite: false, depthTest: true, roughness: 0.72,
      metalness: 0, side: THREE.DoubleSide
    });
    material.userData.baseOpacity = material.opacity;
    ghostMesh = new THREE.Mesh(surfacePreview.geometry, material);
    ghostMeshUsesCachedGeometry = true;
    ghostMesh.rotation.set(
      THREE.MathUtils.degToRad(placementRotation.x),
      THREE.MathUtils.degToRad(placementRotation.y),
      THREE.MathUtils.degToRad(placementRotation.z),
      "XYZ"
    );
    const axisScale = effectiveScale();
    ghostMesh.scale.copy(axisScale);
    ghostMesh.position.set(
      cell.x - frame.minimum.x * axisScale.x,
      cell.y - frame.minimum.y * axisScale.y,
      cell.z - frame.minimum.z * axisScale.z
    );
    ghostMesh.renderOrder = 10;
    scene.add(ghostMesh);
  }
  const bounds = cells.previewBounds || ((placementPreview || simplifiedBrush) ? cells.reduce((value, preview) => ({
    minX: Math.min(value.minX, preview.x), minY: Math.min(value.minY, preview.y), minZ: Math.min(value.minZ, preview.z),
    maxX: Math.max(value.maxX, preview.x), maxY: Math.max(value.maxY, preview.y), maxZ: Math.max(value.maxZ, preview.z)
  }), { minX: Infinity, minY: Infinity, minZ: Infinity, maxX: -Infinity, maxY: -Infinity, maxZ: -Infinity }) : null);
  if (outlineOnlyPreview || simplifiedBrush) {
    ghostBounds = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(
        bounds.maxX - bounds.minX + 1.06,
        bounds.maxY - bounds.minY + 1.06,
        bounds.maxZ - bounds.minZ + 1.06
      )),
      new THREE.LineBasicMaterial({
        color: tool === "erase" ? 0xff7474 : 0xd7ff63,
        transparent: true, opacity: simplifiedBrush ? 0.58 : 0.88, depthTest: false
      })
    );
    ghostBounds.position.set(
      (bounds.minX + bounds.maxX + 1) / 2,
      (bounds.minY + bounds.maxY + 1) / 2,
      (bounds.minZ + bounds.maxZ + 1) / 2
    );
    ghostBounds.renderOrder = 12;
    scene.add(ghostBounds);
  }
  if (isTransformPlacementTool() && showTransformGizmo) {
    transformVisualGizmo.position.set(
      (bounds.minX + bounds.maxX + 1) / 2,
      (bounds.minY + bounds.maxY + 1) / 2,
      (bounds.minZ + bounds.maxZ + 1) / 2
    );
    transformVisualGizmo.visible = true;
    updateTransformVisualGizmoScale();
  } else {
    transformVisualGizmo.visible = false;
    highlightTransformHandle(null);
  }
}

function generateMountain(override) {
  const center = shapeOrigin(override);
  const radius = shapeNumber("shape-radius", 10, 2, 64);
  const height = shapeNumber("shape-height", 14, 2, 128);
  const roughness = Number(document.getElementById("mountain-roughness")?.value || 0.3);
  const seed = Number(document.getElementById("mountain-seed")?.value || 1);
  mutate(() => {
    for (let x = center.x - radius; x <= center.x + radius; x++)
      for (let z = center.z - radius; z <= center.z + radius; z++) {
        const normalized = Math.hypot(x - center.x, z - center.z) / radius;
        if (normalized > 1) continue;
        const ridge = Math.pow(1 - normalized, 1.45);
        const detail = (noise2d(x, z, seed) - 0.5) * roughness * (1 - normalized);
        const column = Math.max(1, Math.round(height * Math.max(0, ridge + detail)));
        for (let y = center.y; y < center.y + column; y++) putGenerated(x, y, z);
      }
  });
}

function generateLine() {
  if (!selectionA || !selectionB) return;
  const dx = selectionB.x - selectionA.x;
  const dy = selectionB.y - selectionA.y;
  const dz = selectionB.z - selectionA.z;
  const steps = Math.max(Math.abs(dx), Math.abs(dy), Math.abs(dz));
  mutate(() => {
    for (let index = 0; index <= steps; index++) {
      const amount = steps ? index / steps : 0;
      putGenerated(
        Math.round(selectionA.x + dx * amount),
        Math.round(selectionA.y + dy * amount),
        Math.round(selectionA.z + dz * amount)
      );
    }
  });
}

function transformSelection(mapper) {
  const selected = selectedCellList();
  if (!selected.length) return;
  const wasMask = selectionMask.size > 0;
  const sourceBlocks = selected
    .map(cell => ({ ...cell, type: blocks.get(key(cell.x, cell.y, cell.z)) }))
    .filter(block => block.type);
  const mappedCells = selected.map(mapper).filter(valid);
  mutate(() => {
    selected.forEach(cell => blocks.delete(key(cell.x, cell.y, cell.z)));
    sourceBlocks.forEach(block => {
      const mapped = mapper(block);
      if (valid(mapped)) blocks.set(key(mapped.x, mapped.y, mapped.z), block.type);
    });
    if (wasMask) {
      selectionMask = new Set(mappedCells.map(cell => key(cell.x, cell.y, cell.z)));
      selectionA = null;
      selectionB = null;
    } else if (mappedCells.length) {
      const min = { x: Infinity, y: Infinity, z: Infinity };
      const max = { x: -Infinity, y: -Infinity, z: -Infinity };
      mappedCells.forEach(cell => {
        min.x = Math.min(min.x, cell.x); min.y = Math.min(min.y, cell.y); min.z = Math.min(min.z, cell.z);
        max.x = Math.max(max.x, cell.x); max.y = Math.max(max.y, cell.y); max.z = Math.max(max.z, cell.z);
      });
      selectionA = min;
      selectionB = max;
    }
  });
}

document.getElementById("rotate-y").addEventListener("click", () => {
  const bounds = selectedBounds();
  if (!bounds) return;
  transformSelection(cell => ({
    x: bounds.min.x + (bounds.max.z - cell.z),
    y: cell.y,
    z: bounds.min.z + (cell.x - bounds.min.x)
  }));
});
document.getElementById("mirror-x").addEventListener("click", () => {
  const bounds = selectedBounds();
  if (bounds) transformSelection(cell => ({ x: bounds.min.x + bounds.max.x - cell.x, y: cell.y, z: cell.z }));
});
document.getElementById("mirror-z").addEventListener("click", () => {
  const bounds = selectedBounds();
  if (bounds) transformSelection(cell => ({ x: cell.x, y: cell.y, z: bounds.min.z + bounds.max.z - cell.z }));
});
document.getElementById("clear-all").addEventListener("click", () => {
  if (!selectionCellCount() || !confirm("선택 영역의 블록을 삭제할까요?")) return;
  runSelectionBlockOperation("선택 블록 삭제 중", cell => {
    blocks.delete(key(cell.x, cell.y, cell.z));
  });
});

function serialize() {
  return {
    version: 1,
    functionName: normalizedFunctionName(document.getElementById("function-name")?.value),
    size: { ...workspaceSize },
    blocks: [...blocks.entries()].map(([position, type]) => {
      const [x, y, z] = position.split(",").map(Number);
      return { x, y, z, type };
    }),
  };
}

function normalizedFunctionName(value, fallback = "build_structure") {
  return String(value || fallback)
    .toLowerCase()
    .replace(/[^a-z0-9_/-]+/g, "_")
    .replace(/^\/+|\/+$/g, "") || fallback;
}

function defaultFunctionNameForFile(fileName) {
  const baseName = String(fileName || "").replace(/\.(?:bpstructure|mcstructure)$/i, "");
  return normalizedFunctionName(baseName, "build_structure");
}

function normalizedSize(value) {
  if (Array.isArray(value)) return {
    x: THREE.MathUtils.clamp(Number(value[0]) || 32, 1, 512),
    y: THREE.MathUtils.clamp(Number(value[1]) || 32, 1, 512),
    z: THREE.MathUtils.clamp(Number(value[2]) || 32, 1, 512)
  };
  if (value && typeof value === "object") return {
    x: THREE.MathUtils.clamp(Number(value.x) || 32, 1, 512),
    y: THREE.MathUtils.clamp(Number(value.y) || 32, 1, 512),
    z: THREE.MathUtils.clamp(Number(value.z) || 32, 1, 512)
  };
  const side = THREE.MathUtils.clamp(Number(value) || 32, 1, 512);
  return { x: side, y: side, z: side };
}

function syncSizeInputs() {
  document.getElementById("size-x").value = workspaceSize.x;
  document.getElementById("size-y").value = workspaceSize.y;
  document.getElementById("size-z").value = workspaceSize.z;
}

function applyWorkspaceSize(nextSize) {
  const normalized = normalizedSize(nextSize);
  mutate(() => {
    workspaceSize = normalized;
    blocks = createTrackedBlockMap([...blocks].filter(([position]) => {
      const [x, y, z] = position.split(",").map(Number);
      return valid({ x, y, z });
    }));
    selectionA = selectionA && valid(selectionA) ? selectionA : null;
    selectionB = selectionB && valid(selectionB) ? selectionB : null;
    selectionMask = new Set([...selectionMask].filter(position => {
      const [x, y, z] = position.split(",").map(Number);
      return valid({ x, y, z });
    }));
    forceFullRebuildPending = true;
    target.set(workspaceSize.x / 2, Math.min(workspaceSize.y / 3, 12), workspaceSize.z / 2);
    radius = 5;
    rebuildWorkspaceGuides();
    syncSizeInputs();
    updateCamera();
  });
}

async function loadStructure(data, fileName) {
  const revision = ++structureLoadRevision;
  const rawBlocks = data.blocks || [];
  const showProgress = rawBlocks.length >= 5000;
  structureDataLoading = true;
  structureMeshLoadingProgress = false;
  if (showProgress) updateBpyProgress(2, `${rawBlocks.length.toLocaleString()}개 블록 준비 중…`, "큰 구조물 불러오는 중");
  await nextUiFrame();
  activeUndoChanges = null;
  workspaceSize = normalizedSize(data.size);
  document.getElementById("function-name").value = normalizedFunctionName(
    data.functionName,
    defaultFunctionNameForFile(fileName)
  );
  const loadedBlocks = await createTrackedBlockMapFromBlocks(rawBlocks, revision, showProgress);
  if (!loadedBlocks || revision !== structureLoadRevision) return;
  blocks = loadedBlocks;
  currentFile = fileName || null;
  history = [];
  future = [];
  selectionA = null;
  selectionB = null;
  selectionMask.clear();
  rebuildWorkspaceGuides();
  syncSizeInputs();
  target.set(workspaceSize.x / 2, Math.min(workspaceSize.y / 3, 12), workspaceSize.z / 2);
  radius = 5;
  updateCamera();
  forceFullRebuildPending = true;
  structureDataLoading = false;
  structureMeshLoadingProgress = showProgress;
  if (showProgress) updateBpyProgress(76, "가까운 청크부터 화면 생성 중…", "큰 구조물 불러오는 중");
  rebuild(true);
}

document.getElementById("function-name")?.addEventListener("input", () => {
  markCurrentProjectFileDirty();
  document.getElementById("dirty-state").textContent = "수정됨";
});
document.getElementById("function-name")?.addEventListener("change", event => {
  event.target.value = normalizedFunctionName(event.target.value);
});

document.getElementById("apply-size")?.addEventListener("click", () => applyWorkspaceSize({
  x: document.getElementById("size-x").value,
  y: document.getElementById("size-y").value,
  z: document.getElementById("size-z").value
}));
document.getElementById("time-of-day")?.addEventListener("input", event => updateLighting(event.target.value));
document.getElementById("fog-density")?.addEventListener("input", updateViewSettings);
document.getElementById("camera-speed")?.addEventListener("input", updateViewSettings);
document.getElementById("render-distance")?.addEventListener("input", updateViewSettings);
document.getElementById("use-color-rendering")?.addEventListener("click", () => {
  blockRenderMode = "color";
  updateTextureModeUi();
  refreshBlockIcons();
  rebuild(true);
});
document.getElementById("use-texture-rendering")?.addEventListener("click", () => {
  blockRenderMode = "texture";
  updateTextureModeUi();
  refreshBlockIcons();
  rebuild(true);
});
document.getElementById("install-vanilla-textures")?.addEventListener("click", () => {
  vscode.postMessage({ type: "installVanillaTextures", force: true });
});
document.getElementById("choose-resource-pack")?.addEventListener("click", () => {
  vscode.postMessage({ type: "chooseResourcePack" });
});
for (const id of [
  "brush-size", "brush-shape", "shape-radius", "shape-height", "shape-hollow",
  "mountain-roughness", "mountain-seed", "limit-to-selection", "paste-air",
  "place-air-only", "place-solid-only", "block-text", "block-text-size", "block-text-depth",
  "image-block-width", "image-block-depth", "model-block-size", "model-solid",
  "sculpt-mode", "sculpt-strength", "selection-sculpt-mode", "selection-sculpt-strength"
]) {
  document.getElementById(id)?.addEventListener("input", () => {
    if (id === "brush-size") {
      document.getElementById("brush-size-value").textContent = document.getElementById("brush-size").value;
    }
    if (id === "sculpt-strength") {
      document.getElementById("sculpt-strength-value").textContent =
        document.getElementById("sculpt-strength").value;
    }
    if (id === "selection-sculpt-strength") {
      document.getElementById("selection-sculpt-strength-value").textContent =
        document.getElementById("selection-sculpt-strength").value;
    }
    ghostSignature = "";
    refreshHover();
  });
}

function relative(value) {
  return value === 0 ? "~" : `~${value}`;
}

function nextUiFrame() {
  return new Promise(resolve => requestAnimationFrame(() => resolve()));
}

let activeBpyOperationId = null;

function updateBpyProgress(percent, detail, title = "BedrockPy 코드 생성 중") {
  const overlay = document.getElementById("bpy-progress");
  const normalized = THREE.MathUtils.clamp(Math.round(Number(percent) || 0), 0, 100);
  overlay.hidden = false;
  document.getElementById("bpy-progress-title").textContent = title;
  document.getElementById("bpy-progress-detail").textContent = detail;
  document.getElementById("bpy-progress-percent").textContent = `${normalized}%`;
  document.getElementById("bpy-progress-bar").style.width = `${normalized}%`;
}

function hideBpyProgress() {
  document.getElementById("bpy-progress").hidden = true;
  activeBpyOperationId = null;
}

async function compileCuboids(onProgress) {
  const remaining = new Map(blocks);
  const cuboids = [];
  const total = remaining.size;
  onProgress?.(8, "블록 순서 정리 중…");
  await nextUiFrame();
  const sortedKeys = [...remaining.keys()].sort((a, b) => {
    const aa = a.split(",").map(Number), bb = b.split(",").map(Number);
    return aa[1] - bb[1] || aa[2] - bb[2] || aa[0] - bb[0];
  });
  let lastYield = performance.now();
  for (const firstKey of sortedKeys) {
    if (!remaining.has(firstKey)) continue;
    const [x0, y0, z0] = firstKey.split(",").map(Number);
    const type = remaining.get(firstKey);
    let x1 = x0;
    while (remaining.get(key(x1 + 1, y0, z0)) === type) x1++;
    let z1 = z0;
    outerZ: while (z1 + 1 < workspaceSize.z) {
      for (let x = x0; x <= x1; x++) if (remaining.get(key(x, y0, z1 + 1)) !== type) break outerZ;
      z1++;
    }
    let y1 = y0;
    outerY: while (y1 + 1 < workspaceSize.y) {
      for (let z = z0; z <= z1; z++)
        for (let x = x0; x <= x1; x++)
          if (remaining.get(key(x, y1 + 1, z)) !== type) break outerY;
      y1++;
    }
    for (let y = y0; y <= y1; y++)
      for (let z = z0; z <= z1; z++)
        for (let x = x0; x <= x1; x++) remaining.delete(key(x, y, z));
    cuboids.push({ x0, y0, z0, x1, y1, z1, type });
    if (performance.now() - lastYield >= 20) {
      const processed = total - remaining.size;
      onProgress?.(10 + (total ? processed / total : 1) * 72,
        `${processed.toLocaleString()} / ${total.toLocaleString()} 블록 변환 중…`);
      await nextUiFrame();
      lastYield = performance.now();
    }
  }
  onProgress?.(82, `${total.toLocaleString()}개 블록 압축 완료`);
  return cuboids;
}

async function generateCode() {
  const functionName = normalizedFunctionName(document.getElementById("function-name").value);
  document.getElementById("function-name").value = functionName;
  const cuboids = await compileCuboids((percent, detail) => updateBpyProgress(percent, detail));
  updateBpyProgress(86, `${cuboids.length.toLocaleString()}개 명령 생성 중…`);
  await nextUiFrame();
  const tickingTileSize = 128;
  const tiledCuboids = new Map();
  for (const cuboid of cuboids) {
    for (let x0 = cuboid.x0; x0 <= cuboid.x1;) {
      const tileX = Math.floor(x0 / tickingTileSize);
      const x1 = Math.min(cuboid.x1, (tileX + 1) * tickingTileSize - 1);
      for (let z0 = cuboid.z0; z0 <= cuboid.z1;) {
        const tileZ = Math.floor(z0 / tickingTileSize);
        const z1 = Math.min(cuboid.z1, (tileZ + 1) * tickingTileSize - 1);
        const tileKey = `${tileX},${tileZ}`;
        if (!tiledCuboids.has(tileKey)) tiledCuboids.set(tileKey, []);
        const horizontalArea = (x1 - x0 + 1) * (z1 - z0 + 1);
        const maximumFillHeight = Math.max(1, Math.floor(32768 / horizontalArea));
        for (let y0 = cuboid.y0; y0 <= cuboid.y1;) {
          const y1 = Math.min(cuboid.y1, y0 + maximumFillHeight - 1);
          tiledCuboids.get(tileKey).push({ ...cuboid, x0, x1, y0, y1, z0, z1 });
          y0 = y1 + 1;
        }
        z0 = z1 + 1;
      }
      x0 = x1 + 1;
    }
  }
  const commandForCuboid = cuboid => {
    const start = `${relative(cuboid.x0)} ${relative(cuboid.y0)} ${relative(cuboid.z0)}`;
    if (cuboid.x0 === cuboid.x1 && cuboid.y0 === cuboid.y1 && cuboid.z0 === cuboid.z1)
      return `    /execute at ${anchorSelector} positioned ~ ~-1000 ~ run setblock ${start} ${cuboid.type}`;
    const end = `${relative(cuboid.x1)} ${relative(cuboid.y1)} ${relative(cuboid.z1)}`;
    return `    /execute at ${anchorSelector} positioned ~ ~-1000 ~ run fill ${start} ${end} ${cuboid.type}`;
  };
  const commands = [];
  const tiles = [...tiledCuboids.entries()];
  const areaBaseName = `bpy_${functionName.split("/").pop().replace(/[^a-z0-9_]+/g, "_").slice(0, 20) || "structure"}`;
  const anchorTag = `${areaBaseName.slice(0, 30)}_anchor`;
  const anchorAreaName = `${areaBaseName}_anchor`;
  const anchorSelector = `@e[type=ender_crystal,tag=${anchorTag},c=1]`;
  if (tiles.length) {
    commands.push("    /summon ender_crystal ~ ~1000 ~");
    commands.push(
      `    /execute positioned ~ ~1000 ~ run tag @e[type=ender_crystal,r=0.2,c=1,tag=!${anchorTag}] add ${anchorTag}`
    );
    commands.push(
      `    /execute at ${anchorSelector} run tickingarea add circle ~ ~ ~ 0 ${anchorAreaName} true`
    );
  }
  for (let batchStart = 0; batchStart < tiles.length; batchStart += 1) {
    const batch = tiles.slice(batchStart, batchStart + 1);
    const areaName = `${areaBaseName}_${String(batchStart).padStart(4, "0")}`;
    batch.forEach(([tileKey]) => {
      const [tileX, tileZ] = tileKey.split(",").map(Number);
      const x0 = tileX * tickingTileSize;
      const z0 = tileZ * tickingTileSize;
      const x1 = Math.min(workspaceSize.x - 1, x0 + tickingTileSize - 1);
      const z1 = Math.min(workspaceSize.z - 1, z0 + tickingTileSize - 1);
      commands.push(
        `    /execute at ${anchorSelector} positioned ~ ~-1000 ~ run tickingarea add ` +
        `${relative(x0)} ~ ${relative(z0)} ${relative(x1)} ~ ${relative(z1)} ${areaName} true`
      );
    });
    // 영역마다 고유 이름을 사용하고 청크가 준비될 시간을 20틱 확보한다.
    commands.push("    sleep(20)");
    batch.forEach(([, fragments]) => fragments.forEach(fragment => commands.push(commandForCuboid(fragment))));
    commands.push(`    /tickingarea remove ${areaName}`);
  }
  if (tiles.length) {
    commands.push(`    /kill @e[type=ender_crystal,tag=${anchorTag}]`);
    commands.push(`    /tickingarea remove ${anchorAreaName}`);
  }
  if (!commands.length) commands.push("    pass");
  updateBpyProgress(92, "VS Code에 전달 중…");
  return { functionName, code: `function ${functionName}:\n${commands.join("\n")}\n` };
}

let projectEntries = [];
let selectedProjectPath = null;
let currentProjectRoot = null;
let currentProjectPath = null;
const dirtyProjectPaths = new Set();
const projectDrafts = new Map();

function refreshProjectDirtyMarkers() {
  document.querySelectorAll(".project-entry").forEach(row => {
    const dirty = dirtyProjectPaths.has(row.dataset.path);
    row.classList.toggle("dirty", dirty);
    const marker = row.querySelector(".dirty-marker");
    if (marker) marker.hidden = !dirty;
  });
}

function markCurrentProjectFileDirty() {
  if (!currentProjectPath) return;
  dirtyProjectPaths.add(currentProjectPath);
  refreshProjectDirtyMarkers();
}

function stashCurrentProjectDraft() {
  if (!currentProjectPath || !dirtyProjectPaths.has(currentProjectPath)) return;
  projectDrafts.set(currentProjectPath, serialize());
}

function remapProjectDraftPaths(oldPath, newPath) {
  for (const dirtyPath of [...dirtyProjectPaths]) {
    if (dirtyPath !== oldPath && !dirtyPath.startsWith(`${oldPath}/`)) continue;
    const mapped = newPath + dirtyPath.slice(oldPath.length);
    dirtyProjectPaths.delete(dirtyPath);
    dirtyProjectPaths.add(mapped);
    if (projectDrafts.has(dirtyPath)) {
      projectDrafts.set(mapped, projectDrafts.get(dirtyPath));
      projectDrafts.delete(dirtyPath);
    }
  }
  if (currentProjectPath === oldPath || currentProjectPath?.startsWith(`${oldPath}/`)) {
    currentProjectPath = newPath + currentProjectPath.slice(oldPath.length);
  }
}

function removeProjectDraftPaths(deletedPath) {
  for (const dirtyPath of [...dirtyProjectPaths]) {
    if (dirtyPath !== deletedPath && !dirtyPath.startsWith(`${deletedPath}/`)) continue;
    dirtyProjectPaths.delete(dirtyPath);
    projectDrafts.delete(dirtyPath);
  }
  if (currentProjectPath === deletedPath || currentProjectPath?.startsWith(`${deletedPath}/`)) {
    currentProjectPath = null;
  }
}

function renderProjectTree(message) {
  if (message.rootPath !== currentProjectRoot) {
    currentProjectRoot = message.rootPath;
    selectedProjectPath = null;
    currentProjectPath = null;
    dirtyProjectPaths.clear();
    projectDrafts.clear();
  }
  currentProjectPath = message.currentPath || currentProjectPath;
  projectEntries = message.entries || [];
  const tree = document.getElementById("project-tree");
  document.getElementById("project-name").textContent = message.rootName || "프로젝트";
  tree.replaceChildren();
  if (!projectEntries.length) {
    const empty = document.createElement("p");
    empty.className = "project-empty";
    empty.textContent = "빈 프로젝트입니다. 새 구조물을 만들어보세요.";
    tree.appendChild(empty);
    return;
  }
  for (const entry of projectEntries) {
    const row = document.createElement("button");
    row.type = "button";
    row.className = `project-entry${entry.directory ? " folder" : ""}${entry.structure ? " structure-file" : " other-file"}`;
    if (entry.path === message.currentPath) row.classList.add("current");
    if (entry.path === selectedProjectPath) row.classList.add("selected");
    if (dirtyProjectPaths.has(entry.path)) row.classList.add("dirty");
    row.style.setProperty("--depth", String(entry.path.split("/").length - 1));
    row.dataset.path = entry.path;
    row.dataset.directory = String(entry.directory);
    row.dataset.structure = String(entry.structure);
    const icon = document.createElement("span");
    icon.className = "file-icon";
    icon.textContent = entry.directory ? "▸" : entry.structure ? "◆" : "·";
    const name = document.createElement("span");
    name.textContent = entry.name;
    const dirtyMarker = document.createElement("span");
    dirtyMarker.className = "dirty-marker";
    dirtyMarker.textContent = "●";
    dirtyMarker.title = "저장되지 않은 변경사항";
    dirtyMarker.hidden = !dirtyProjectPaths.has(entry.path);
    row.append(icon, name, dirtyMarker);
    row.addEventListener("click", () => {
      selectedProjectPath = entry.path;
      document.querySelectorAll(".project-entry").forEach(item => item.classList.toggle("selected", item.dataset.path === selectedProjectPath));
      if (entry.structure) {
        if (entry.path === currentProjectPath) return;
        stashCurrentProjectDraft();
        vscode.postMessage({
          type: "projectOpenFile",
          path: entry.path,
          draftData: projectDrafts.get(entry.path) || null
        });
      }
    });
    tree.appendChild(row);
  }
}

document.getElementById("open-project").addEventListener("click", () => vscode.postMessage({ type: "openProject" }));
document.getElementById("refresh-project").addEventListener("click", () => vscode.postMessage({ type: "refreshProject" }));
function selectedProjectDirectory() {
  if (!selectedProjectPath) return "";
  const entry = projectEntries.find(item => item.path === selectedProjectPath);
  if (entry?.directory) return entry.path;
  const separator = selectedProjectPath.lastIndexOf("/");
  return separator < 0 ? "" : selectedProjectPath.slice(0, separator);
}
document.getElementById("new-structure").addEventListener("click", () => {
  vscode.postMessage({ type: "requestProjectNew", parentPath: selectedProjectDirectory() });
});
document.getElementById("new-project-folder").addEventListener("click", () => {
  vscode.postMessage({ type: "requestProjectNewFolder", parentPath: selectedProjectDirectory() });
});
document.getElementById("rename-project-entry").addEventListener("click", () => {
  if (!selectedProjectPath) return;
  vscode.postMessage({ type: "requestProjectRename", path: selectedProjectPath });
});
document.getElementById("delete-project-entry").addEventListener("click", () => {
  if (!selectedProjectPath) return;
  vscode.postMessage({ type: "requestProjectDelete", path: selectedProjectPath });
});

document.getElementById("save").addEventListener("click", () => vscode.postMessage({ type: "save", data: serialize(), saveAs: false }));
document.getElementById("save-as").addEventListener("click", () => vscode.postMessage({ type: "save", data: serialize(), saveAs: true }));
document.getElementById("open").addEventListener("click", () => vscode.postMessage({ type: "open" }));
document.getElementById("export").addEventListener("click", async () => {
  if (activeBpyOperationId) return;
  activeBpyOperationId = `export-${Date.now()}`;
  updateBpyProgress(1, "구조물 분석 준비 중…", ".bpy로 내보내는 중");
  await nextUiFrame();
  const output = await generateCode();
  vscode.postMessage({ type: "export", operationId: activeBpyOperationId, ...output });
});
document.getElementById("export-mcworld")?.addEventListener("click", () => {
  if (activeBpyOperationId) return;
  activeBpyOperationId = `mcworld-${Date.now()}`;
  updateBpyProgress(2, "월드 데이터 준비 중…", ".mcworld로 내보내는 중");
  vscode.postMessage({ type: "exportMcworld", operationId: activeBpyOperationId, data: serialize() });
});
document.getElementById("insert").addEventListener("click", async () => {
  if (activeBpyOperationId) return;
  activeBpyOperationId = `insert-${Date.now()}`;
  updateBpyProgress(1, "구조물 분석 준비 중…", ".bpy에 삽입하는 중");
  await nextUiFrame();
  const output = await generateCode();
  vscode.postMessage({ type: "insert", operationId: activeBpyOperationId, ...output });
});

window.addEventListener("keydown", event => {
  const editingText = event.target instanceof HTMLInputElement ||
    event.target instanceof HTMLSelectElement ||
    event.target instanceof HTMLTextAreaElement;
  if (playMode && event.key === "Escape") {
    event.preventDefault();
    exitPlayMode();
    return;
  }
  if ((event.key === "Delete" || event.key === "Backspace") && !editingText) {
    const selected = selectedCellList();
    if (selected.length) {
      event.preventDefault();
      if (pendingPlacement) cancelPendingPlacement();
      document.getElementById("clear-selection")?.click();
    }
    return;
  }
  if (event.key === "Escape" && pendingPlacement) {
    event.preventDefault();
    cancelPendingPlacement();
    return;
  }
  if (event.key === "Enter" && pendingPlacement) {
    event.preventDefault();
    commitPendingPlacement();
    return;
  }
  const modifier = event.metaKey || event.ctrlKey;
  if (modifier && event.code === "KeyA" && !editingText) {
    event.preventDefault();
    event.stopImmediatePropagation();
    window.getSelection()?.removeAllRanges();
    if (pendingPlacement) cancelPendingPlacement();
    selectAllStructure();
    return;
  }
  if (modifier && event.code === "KeyC" && !editingText) {
    event.preventDefault();
    copySelection(false);
  }
  if (modifier && event.code === "KeyX" && !editingText) {
    event.preventDefault();
    copySelection(true);
  }
  if (modifier && event.code === "KeyV" && !editingText) {
    event.preventDefault();
    if (clipboardBlocks.length) setTool("paste");
  }
  if (modifier && event.code === "KeyZ") {
    event.preventDefault();
    document.getElementById(event.shiftKey ? "redo" : "undo").click();
  }
  if (modifier && event.code === "KeyS") {
    event.preventDefault();
    commitPendingPlacement();
    document.getElementById("save").click();
  }
  if (!editingText) {
    const numberTools = {
      "1": "move", "2": "place", "3": "erase", "4": "selectBox",
      "5": "lasso", "6": "replace", "7": "paste", "8": "moveSelection", "9": "sculpt"
    };
    const pointTools = { BracketLeft: "selectA", BracketRight: "selectB" };
    if (numberTools[event.key]) {
      event.preventDefault();
      setTool(numberTools[event.key]);
    } else if (pointTools[event.code]) {
      event.preventDefault();
      setTool(pointTools[event.code]);
    }
  }
}, true);

document.addEventListener("pointerdown", event => {
  if (pendingPlacement && event.target !== canvas && !event.target.closest?.("#transform-gizmo")) {
    commitPendingPlacement();
  }
}, true);
window.addEventListener("blur", commitPendingPlacement);

window.addEventListener("message", event => {
  const message = event.data;
  if (message.type === "voxelImageLoaded") {
    const status = document.getElementById("voxel-image-status");
    if (status) status.textContent = `${message.fileName} 읽는 중…`;
    const image = new Image();
    image.onload = () => {
      voxelImageAsset = {
        id: `${message.fileName}:${message.data.length}`,
        name: message.fileName,
        width: image.naturalWidth,
        height: image.naturalHeight,
        image
      };
      voxelImageRasterCache = { signature: "", offsets: [] };
      if (status) status.textContent =
        `${message.fileName} · ${image.naturalWidth}×${image.naturalHeight} · 투명 영역 제외`;
      setTool("generate:image");
      ghostSignature = "";
      refreshHover();
    };
    image.onerror = () => {
      if (status) status.textContent = `${message.fileName} 이미지를 읽을 수 없습니다.`;
    };
    image.src = `data:${message.mime};base64,${message.data}`;
  }
  if (message.type === "voxelModelLoaded") {
    const status = document.getElementById("voxel-model-status");
    if (status) status.textContent = `${message.fileName} 처리 중…`;
    try {
      const bytes = decodeBase64Bytes(message.data);
      const triangles = message.extension === ".obj" ? parseObjModel(bytes) : parseStlModel(bytes);
      if (!triangles.length) throw new Error("삼각형 면을 찾지 못했습니다.");
      voxelModelAsset = {
        id: `${message.fileName}:${message.data.length}`,
        name: message.fileName,
        triangles
      };
      voxelModelRasterCache = { signature: "", offsets: [] };
      if (status) status.textContent = `${message.fileName} · 삼각형 ${triangles.length.toLocaleString()}개`;
      setTool("generate:model");
      ghostSignature = "";
      refreshHover();
    } catch (error) {
      voxelModelAsset = null;
      if (status) status.textContent = `불러오기 오류: ${error.message}`;
    }
  }
  if (message.type === "load") {
    if (message.projectPath) currentProjectPath = message.projectPath;
    loadStructure(message.data, message.fileName);
  }
  if (message.type === "project") renderProjectTree(message);
  if (message.type === "projectEntryRenamed") {
    remapProjectDraftPaths(message.oldPath, message.newPath);
    if (selectedProjectPath === message.oldPath || selectedProjectPath?.startsWith(`${message.oldPath}/`)) {
      selectedProjectPath = message.newPath + selectedProjectPath.slice(message.oldPath.length);
    }
  }
  if (message.type === "projectEntryDeleted") {
    removeProjectDraftPaths(message.path);
    if (selectedProjectPath === message.path || selectedProjectPath?.startsWith(`${message.path}/`)) {
      selectedProjectPath = null;
    }
  }
  if (message.type === "texturePack") {
    clearBlockTextureCache();
    blockTextureUris = message.mapping || {};
    activeTexturePackLabel = message.label || "리소스팩";
    blockRenderMode = "texture";
    updateTextureModeUi();
    refreshBlockIcons();
    if (structureDataLoading) forceFullRebuildPending = true;
    else rebuild(true);
  }
  if (message.type === "texturePackStatus") {
    const status = document.getElementById("texture-pack-status");
    if (status) status.textContent = message.status === "loading"
      ? `${message.label || "리소스팩"} 다운로드·처리 중…`
      : message.status === "missing"
        ? `${message.label || "리소스팩"}을 찾을 수 없습니다.`
        : `오류: ${message.label || "리소스팩을 불러올 수 없습니다."}`;
  }
  if (message.type === "saved") {
    currentFile = message.fileName;
    history = [];
    const savedPath = message.projectPath;
    if (savedPath) {
      dirtyProjectPaths.delete(savedPath);
      projectDrafts.delete(savedPath);
    }
    refreshProjectDirtyMarkers();
    updateStats();
  }
  if (message.type === "bpyOperationProgress" && message.operationId === activeBpyOperationId) {
    updateBpyProgress(message.percent, message.detail || "처리 중…");
  }
  if (message.type === "bpyOperationComplete" && message.operationId === activeBpyOperationId) {
    if (message.error) {
      updateBpyProgress(100, `오류: ${message.error}`);
      setTimeout(hideBpyProgress, 1800);
    } else if (message.cancelled) {
      hideBpyProgress();
    } else {
      updateBpyProgress(100, "완료되었습니다.");
      setTimeout(hideBpyProgress, 500);
    }
  }
});

const persistedUiState = vscode.getState() || {};
const workspaceElement = document.querySelector(".workspace");
const projectSidebarToggle = document.getElementById("toggle-project-sidebar");
function setProjectSidebarCollapsed(collapsed, persist = true) {
  workspaceElement?.classList.toggle("project-sidebar-collapsed", collapsed);
  if (projectSidebarToggle) {
    projectSidebarToggle.textContent = collapsed ? "›" : "‹";
    projectSidebarToggle.title = collapsed ? "프로젝트 창 펼치기" : "프로젝트 창 접기";
    projectSidebarToggle.setAttribute("aria-label", projectSidebarToggle.title);
    projectSidebarToggle.setAttribute("aria-expanded", String(!collapsed));
  }
  if (persist) vscode.setState({
    ...(vscode.getState() || {}),
    projectSidebarCollapsed: collapsed
  });
  requestAnimationFrame(() => {
    resize();
    updateCamera();
  });
}
projectSidebarToggle?.addEventListener("click", () => {
  setProjectSidebarCollapsed(!workspaceElement?.classList.contains("project-sidebar-collapsed"));
});
setProjectSidebarCollapsed(Boolean(persistedUiState.projectSidebarCollapsed), false);

const collapsedSections = new Set(persistedUiState.collapsedSections || []);
document.querySelectorAll(".section").forEach((section, index) => {
  const title = section.querySelector(":scope > .section-title");
  if (!title) return;
  const sectionKey = `${index}:${title.textContent.trim()}`;
  const toggle = document.createElement("button");
  toggle.type = "button";
  toggle.className = "section-toggle";
  toggle.title = "이 기능 박스의 상세 내용을 접거나 펼칩니다.";
  toggle.setAttribute("aria-label", `${title.textContent.trim()} 상세 표시 전환`);
  const update = () => {
    const collapsed = collapsedSections.has(sectionKey);
    section.classList.toggle("collapsed", collapsed);
    toggle.textContent = collapsed ? "＋" : "－";
    toggle.setAttribute("aria-expanded", String(!collapsed));
  };
  toggle.addEventListener("click", event => {
    event.stopPropagation();
    if (collapsedSections.has(sectionKey)) collapsedSections.delete(sectionKey);
    else collapsedSections.add(sectionKey);
    vscode.setState({ ...(vscode.getState() || {}), collapsedSections: [...collapsedSections] });
    update();
  });
  title.appendChild(toggle);
  update();
});

const buttonHelp = {
  "open-project": "폴더를 구조물 프로젝트로 열고 내부 파일을 왼쪽 트리에 표시합니다.",
  "refresh-project": "프로젝트 폴더의 현재 파일 구조를 다시 읽습니다.",
  "new-structure": "프로젝트 안에 비어 있는 새 .bpstructure 파일을 만듭니다.",
  "new-project-folder": "프로젝트 안에 구조물을 분류할 새 폴더를 만듭니다.",
  "rename-project-entry": "선택한 파일이나 폴더의 프로젝트 상대 경로와 이름을 변경합니다.",
  "delete-project-entry": "선택한 파일이나 폴더를 복구 가능한 시스템 휴지통으로 보냅니다.",
  open: "저장한 .bpstructure 또는 Minecraft .mcstructure 파일을 불러옵니다.",
  save: "현재 작업을 다시 편집할 수 있는 .bpstructure로 저장합니다.",
  "save-as": "현재 작업을 새로운 .bpstructure 파일로 저장합니다.",
  undo: "마지막 블록 편집을 취소합니다.",
  redo: "취소한 편집을 다시 적용합니다.",
  insert: "생성된 구조물 함수를 현재 열려 있는 .bpy 파일 끝에 삽입합니다.",
  export: "구조물을 /fill과 /setblock 명령으로 압축한 .bpy 파일로 내보냅니다.",
  "export-mcworld": "현재 구조물을 새 Minecraft Bedrock 월드로 내보냅니다. 월드를 처음 열면 구조물이 자동 설치됩니다.",
  "apply-size": "입력한 X/Y/Z 크기를 적용합니다. 범위 밖의 블록은 제거됩니다.",
  "use-color-rendering": "텍스처 없이 기존 단색 고속 렌더링을 사용합니다.",
  "use-texture-rendering": "현재 적용된 베드락 리소스팩의 실제 블록 텍스처를 사용합니다.",
  "install-vanilla-textures": "Mojang 공식 bedrock-samples에서 기본 블록 텍스처를 설치하거나 갱신합니다.",
  "choose-resource-pack": "리소스팩 폴더 또는 .mcpack/.zip 파일을 선택해 블록 텍스처를 교체합니다.",
  "fill-selection": "A와 B 사이의 모든 칸을 현재 블록으로 채웁니다.",
  "clear-selection": "A와 B 사이의 모든 블록을 삭제합니다.",
  "apply-selection-points": "입력한 A와 B의 X/Y/Z 좌표를 직육면체 선택 영역으로 적용합니다.",
  "clear-selection-shape": "현재 직육면체 또는 브러시 선택을 모두 해제합니다.",
  "copy-selection": "선택 영역을 내부 클립보드에 복사합니다.",
  "cut-selection": "선택 영역을 복사한 뒤 원본 블록을 삭제합니다.",
  "paste-selection": "복사한 구조물을 커서 위치에 미리 보고 클릭해 배치하는 도구입니다.",
  "connected-replace": "켜면 시작 블록과 면으로 연결된 같은 블록만 교체합니다. 끄면 선택 영역 안의 같은 블록을 모두 교체합니다.",
  "connected-selection": "켜면 클릭한 블록과 면으로 연결된 같은 종류 블록을 한 번에 선택합니다. Shift를 누르면 기존 선택에 더합니다.",
  "connected-any-selection": "켜면 클릭한 블록에서 면으로 이어진 모든 비공기 블록을 종류와 관계없이 선택합니다. Shift를 누르면 기존 선택에 더합니다.",
  "place-air-only": "켜면 비어 있는 공기 칸에만 블록을 설치합니다.",
  "place-solid-only": "켜면 이미 블록이 설치된 칸만 현재 블록으로 교체합니다.",
  "rotate-y": "선택한 블록만 선택 영역의 Y축 기준으로 90도 회전합니다.",
  "mirror-x": "선택한 블록만 선택 영역 안에서 X축 방향으로 반전합니다.",
  "mirror-z": "선택한 블록만 선택 영역 안에서 Z축 방향으로 반전합니다.",
  "clear-all": "현재 선택 영역의 블록만 삭제합니다.",
  "extrude-selection": "선택 영역을 입력한 높이만큼 위나 아래로 반복 복제합니다.",
  "palette-eyedropper": "3D 화면에서 클릭한 블록을 현재 배치 블록으로 선택합니다.",
  "apply-selection-sculpt": "선택 영역 전체에 선택한 조형 모드와 강도를 적용합니다.",
  "make-line": "A 지점에서 클릭한 위치까지 직선을 미리 보고 생성합니다."
};
const toolHelp = {
  move: "블록을 수정하지 않고 드래그로 화면을 회전합니다. 숫자 1로 빠르게 전환할 수 있습니다.",
  place: "클릭한 면에 현재 블록을 한 번 배치합니다.",
  erase: "브러시 범위의 블록을 삭제합니다.",
  selectBox: "블록 위를 드래그해 직육면체 선택 영역을 지정합니다.",
  lasso: "현재 브러시 크기와 모양으로 드래그한 셀들을 자유롭게 선택합니다. Shift를 누르면 기존 선택에 더합니다.",
  selectA: "선택 영역의 첫 번째 지점을 지정합니다.",
  selectB: "선택 영역의 두 번째 지점을 지정합니다.",
  replace: "선택 영역의 같은 블록을 교체합니다. 연결 옵션을 켜면 붙어 있는 블록만 교체합니다.",
  eyedropper: "화면의 블록을 클릭해 해당 블록 종류를 선택하고 이전 도구로 돌아갑니다.",
  sculpt: "브러시 범위의 지형을 부드럽게 하거나 평탄화·침하·융기·깎기 합니다.",
  paste: "미리보기는 커서를 따라 이동합니다. 크기·회전을 조정하고 원하는 위치에서 우클릭해 적용합니다.",
  moveSelection: "선택 영역을 커서로 옮기며 크기·회전을 조정하고 우클릭한 위치에 적용합니다."
};
const generatorHelp = {
  sphere: "커서 위치를 중심으로 채워진 구를 미리 보고 생성합니다.",
  "hollow-sphere": "커서 위치를 중심으로 속이 빈 구를 생성합니다.",
  circle: "커서 높이에 테두리만 있는 원을 생성합니다.",
  disc: "커서 높이에 채워진 원판을 생성합니다.",
  cylinder: "커서 위치에서 위쪽으로 원기둥을 생성합니다.",
  line: "A 지점에서 커서 위치까지 직선을 생성합니다.",
  mountain: "커서 위치를 중심으로 시드와 거칠기가 적용된 산을 생성합니다."
};
const hoverTooltip = document.createElement("div");
hoverTooltip.className = "hover-tooltip";
document.body.appendChild(hoverTooltip);
let tooltipTimer;
document.addEventListener("pointerover", event => {
  const button = event.target.closest("button");
  if (!button) return;
  const description = buttonHelp[button.id] ||
    toolHelp[button.dataset.tool] ||
    generatorHelp[button.dataset.generator] ||
    (button.dataset.block ? `${button.dataset.block} 블록을 활성 블록으로 선택합니다.` : button.title);
  if (!description) return;
  clearTimeout(tooltipTimer);
  tooltipTimer = setTimeout(() => {
    hoverTooltip.textContent = description;
    hoverTooltip.classList.add("visible");
    const rect = button.getBoundingClientRect();
    const left = Math.min(rect.left, window.innerWidth - 300);
    hoverTooltip.style.left = `${Math.max(8, left)}px`;
    hoverTooltip.style.top = `${Math.min(window.innerHeight - 80, rect.bottom + 7)}px`;
  }, 650);
});
document.addEventListener("pointerout", event => {
  if (!event.target.closest?.("button")) return;
  clearTimeout(tooltipTimer);
  hoverTooltip.classList.remove("visible");
});

let previousFrame = performance.now();
function animate(now = performance.now()) {
  requestAnimationFrame(animate);
  const deltaSeconds = Math.min((now - previousFrame) / 1000, 0.05);
  previousFrame = now;
  if (pointerDown?.mode === "armedBrush" && !pointerDown.activated && now - pointerDown.startedAt >= 600) {
    remember();
    groupedMutation = true;
    const activationCell = pointerDown.currentCell || pointerDown.origin;
    applyCell(activationCell, 0);
    if (tool === "place" || tool === "erase") pointerDown.lastAppliedBrushCenter = cloneCell(activationCell);
    pointerDown.activated = true;
    if (lastPointer) {
      const afterPaint = pick(lastPointer, targetsAdjacentCell());
      if (afterPaint && valid(afterPaint)) {
        pointerDown.lastCell = cloneCell(afterPaint);
        pointerDown.currentCell = cloneCell(afterPaint);
      }
    }
  }
  if (playMode) movePlayer(deltaSeconds);
  else moveCamera(deltaSeconds);
  if (!playMode && cameraHoverRefreshPending &&
      !pressedKeys.size &&
      pointerDown?.mode !== "camera" &&
      pointerDown?.mode !== "cameraWhileTransforming" &&
      now - lastCameraMotionAt >= 90) {
    cameraHoverRefreshPending = false;
    cameraMotionActive = false;
    refreshHover();
  }
  if (!structureDataLoading) {
    syncChunkStreaming();
    if (pendingRenderChunks.size) rebuild(false, true);
  }
  if (ghostMesh && isTransformPlacementTool()) {
    const baseOpacity = ghostMesh.material.userData.baseOpacity || 0.2;
    ghostMesh.material.opacity = baseOpacity * (0.88 + Math.sin(now * 0.006) * 0.12);
  }
  renderer.render(scene, camera);
}
setTool("move");
syncSizeInputs();
updateLighting(document.getElementById("time-of-day")?.value || 6000);
updateViewSettings();
updateTextureModeUi();
rebuild(true);
animate();
vscode.postMessage({ type: "ready" });
