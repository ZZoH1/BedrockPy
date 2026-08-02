const assert = require('assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const cp = require('child_process');

const root = path.resolve(__dirname, '..');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const grammar = JSON.parse(fs.readFileSync(path.join(root, 'syntaxes', 'bedrockpy.tmLanguage.json'), 'utf8'));
const language = JSON.parse(fs.readFileSync(path.join(root, 'language-configuration.json'), 'utf8'));

assert.strictEqual(pkg.contributes.languages[0].extensions[0], '.bpy');
assert.strictEqual(grammar.scopeName, 'source.bedrockpy');
assert.ok(language.indentationRules.increaseIndentPattern.includes('tick'));
assert.ok(fs.existsSync(path.join(root, 'compiler', 'bedrockpy.py')));
const sleepSplitRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'bedrockpy-sleep-split-'));
try {
  const sleepSource = path.join(sleepSplitRoot, 'sleep_split.bpy');
  const sleepOutput = path.join(sleepSplitRoot, 'pack');
  fs.writeFileSync(sleepSource, [
    'function build:',
    '    sleep(1)',
    '    /say one',
    '    /say two',
    '    /say three',
    '    await_tickingarea("test_area")',
    '    /say four',
    '    /say five',
    '    /say six',
    '    /say seven',
    '    /say eight',
    ''
  ].join('\n'));
  cp.execFileSync('python3', [
    path.join(root, 'compiler', 'bedrockpy.py'), sleepSource,
    '-o', sleepOutput, '--namespace', 'split_test', '--max-lines', '3',
    '--no-mcpack', '--no-mcaddon'
  ]);
  const internalRoot = path.join(sleepOutput, 'functions', 'split_test', '__internal');
  const allInternalFiles = fs.readdirSync(internalRoot).filter(name => name.endsWith('.mcfunction'));
  const sleepFiles = allInternalFiles.filter(name => name.startsWith('sleep_'));
  assert.ok(sleepFiles.some(name => name.includes('__part_')), 'sleep continuation was not split');
  const internalContents = allInternalFiles.map(name =>
    fs.readFileSync(path.join(internalRoot, name), 'utf8')
  ).join('\n');
  assert.ok(internalContents.includes(
    'schedule on_area_loaded add tickingarea test_area split_test/__internal/tickingarea_'
  ), 'ticking area continuation was not scheduled');
  for (const name of allInternalFiles) {
    const lines = fs.readFileSync(path.join(internalRoot, name), 'utf8').trim().split('\n');
    assert.ok(lines.length <= 3, `${name} exceeded max_lines`);
  }
} finally {
  fs.rmSync(sleepSplitRoot, { recursive: true, force: true });
}
const extensionSource = fs.readFileSync(path.join(root, 'extension.js'), 'utf8');
assert.ok(extensionSource.includes("registerHoverProvider('bedrockpy'"));
assert.ok(extensionSource.includes('Float exponent holder'));
assert.ok(extensionSource.includes('scoreboard players set ${symbol.holder} ${symbol.objective} <가수>'));
assert.ok(extensionSource.includes('scoreboard players set ${symbol.exponentHolder} ${symbol.objective} <지수>'));
assert.ok(extensionSource.includes('scoreboard players set ${symbol.holder} ${symbol.objective} <0 또는 1>'));
assert.ok(extensionSource.includes('scoreboard players set ${symbol.holder} ${symbol.objective} <정수>'));
assert.ok(pkg.contributes.commands.some(command => command.command === 'bedrockpy.openStructureEditor'));
assert.ok(pkg.files.includes('media/bedrockpy-logo-128.png'));
assert.ok(pkg.files.includes('media/voxel-editor.bundle.js'));
assert.strictEqual(pkg.dependencies['@8crafter/leveldb-zlib'], '^1.6.0');
for (const runtimeModule of [
  'debug', 'ms', 'bindings', 'file-uri-to-path', 'lodash.reduce',
  'protodef-validator', 'fast-deep-equal', 'fast-json-stable-stringify',
  'uri-js', 'punycode', 'abort-controller', 'event-target-shim', 'buffer',
  'base64-js', 'ieee754', 'events', 'process'
]) {
  assert.ok(pkg.files.includes(`node_modules/${runtimeModule}/**`));
}
assert.ok(extensionSource.includes("message.type === 'exportMcworld'"));
assert.ok(extensionSource.includes('createMcworld(message.data'));
assert.ok(extensionSource.includes("nbtInt('Generator', 5)"));
assert.ok(extensionSource.includes("nbtString('FlatWorldLayers', voidLayers)"));
assert.ok(extensionSource.includes("block_name: 'minecraft:air'"));
assert.ok(extensionSource.includes('y: baseCoordinate.y'));
assert.ok(extensionSource.includes("generateChunkKeyFromIndices(indices, 'SubChunkPrefix')"));
assert.ok(extensionSource.includes("createWebviewPanel("));
assert.ok(extensionSource.includes("bedrockpyStructureEditor"));
assert.ok(extensionSource.includes('축 끝 사각형 늘이기'));
assert.ok(extensionSource.includes("mapping.grass_block = grassFaces"));
assert.ok(extensionSource.includes("textures/blocks/grass_side_carried"));
assert.ok(extensionSource.includes('mapping[`hard_${glassId}`] = mapping[glassId]'));
assert.ok(extensionSource.includes('id="block-category-tabs"'));
assert.ok(extensionSource.includes('data-block-category="redstone"'));
assert.ok(extensionSource.includes('id="palette-view-toggle"'));
assert.ok(extensionSource.includes('class="field tool-detail" data-tool-detail="generate:cylinder generate:mountain"'));
assert.ok(extensionSource.includes('class="field tool-detail" data-tool-detail="place erase lasso sculpt"'));
assert.ok(extensionSource.includes('data-tool-detail="place generate:sphere generate:hollow-sphere generate:circle generate:disc generate:cylinder generate:line generate:curve generate:mountain"'));
assert.ok(extensionSource.indexOf('id="make-mountain"') < extensionSource.indexOf('id="make-line"'));
assert.ok(extensionSource.indexOf('id="make-line"') < extensionSource.indexOf('id="make-curve"'));
assert.ok(!extensionSource.includes('<div class="tool-detail" data-tool-detail="place generate:*">'));
assert.ok(extensionSource.includes('class="check-field tool-detail" data-tool-detail="generate:cylinder"><input id="shape-hollow"'));
assert.ok(!extensionSource.includes('id="new-window-editor"'));
assert.ok(extensionSource.includes("workbench.action.moveEditorToNewWindow"));
assert.ok(extensionSource.includes('id="base-x"'));
assert.ok(extensionSource.includes('id="base-y"'));
assert.ok(extensionSource.includes('id="base-z"'));
assert.ok(!extensionSource.includes('id="bpy-coordinate-mode"'));
assert.ok(extensionSource.includes("message.type === 'requestBpyCoordinateMode'"));
assert.ok(extensionSource.includes("title: '.bpy 좌표 방식 선택'"));
assert.ok(!extensionSource.includes('id="insert"'));
assert.ok(!extensionSource.includes("message.type === 'insert'"));
assert.ok(extensionSource.includes('async function getVanillaTextureManifest()'));
assert.ok(extensionSource.includes('async function downloadVanillaTextures('));
assert.ok(extensionSource.includes("raw.githubusercontent.com/Mojang/bedrock-samples"));
assert.ok(!extensionSource.includes("runFile('git'"));
assert.ok(fs.existsSync(path.join(root, 'media', 'voxel-editor.js')));
assert.ok(fs.existsSync(path.join(root, 'media', 'voxel-editor.bundle.js')));
assert.ok(fs.existsSync(path.join(root, 'media', 'voxel-editor.css')));
assert.ok(fs.existsSync(path.join(root, 'media', 'three.module.min.js')));
assert.ok(fs.existsSync(path.join(root, 'media', 'three.core.min.js')));
const blockRegistry = JSON.parse(fs.readFileSync(path.join(root, 'media', 'bedrock-blocks.json'), 'utf8'));
assert.ok(blockRegistry.length > 1300);
assert.ok(blockRegistry.includes('minecraft:stone'));
const voxelSource = fs.readFileSync(path.join(root, 'media', 'voxel-editor.js'), 'utf8');
assert.ok(voxelSource.includes('function noteCameraMotion'));
assert.ok(voxelSource.includes('const maximumDistance = renderDistanceBlocks() + renderChunkSize'));
assert.ok(!voxelSource.includes('Math.min(renderDistanceBlocks() + renderChunkSize, 96)'));
assert.ok(voxelSource.includes('cameraHoverRefreshPending'));
assert.ok(voxelSource.includes('function sharedChunkMaterial'));
assert.ok(!voxelSource.includes('raycaster.intersectObjects([...pickMeshes, ground], false)'));
const voxelCss = fs.readFileSync(path.join(root, 'media', 'voxel-editor.css'), 'utf8');
assert.ok(!/\.special-text-tool\s*\{[^}]*grid-column:\s*1\s*\/\s*-1/.test(voxelCss));
assert.ok(/\.special-import-row\s*\{\s*display:\s*contents;\s*\}/.test(voxelCss));
assert.ok(voxelCss.includes('top: 56px; bottom: 12px'));
assert.ok(voxelCss.includes('min-height: 0; flex: 1 1 auto'));
assert.ok(voxelCss.includes('scroll-padding-bottom: 14px'));
assert.ok(/\.utility-dock\s*\{[\s\S]*?pointer-events: none;[\s\S]*?\}/.test(voxelCss));
assert.ok(/\.utility-buttons\s*\{[\s\S]*?pointer-events: auto;[\s\S]*?\}/.test(voxelCss));
assert.ok(voxelSource.includes('grid.position.set(centerX, 0, centerZ)'));
assert.ok(voxelSource.includes('x - centerX, 0.02, z0 - centerZ'));
assert.ok(voxelSource.includes('4 ** Math.max(0, Math.floor(Math.log(distanceToGround / 48) / Math.log(4)))'));
assert.ok(voxelSource.includes('Math.floor(maximumRange / Math.max(1, gridStep * 2))'));
assert.ok(voxelSource.includes('grid.frustumCulled = false'));
assert.ok(voxelSource.includes('colorWrite: false'));
assert.ok(voxelSource.includes('depthWrite: false'));
assert.ok(voxelSource.includes('KeyC: "axisLock"'));
assert.ok(voxelSource.includes('function constrainBrushCellToAutomaticAxis'));
assert.ok(voxelSource.includes('pointerState.axisConstraintAxis = axis'));
assert.ok(voxelSource.includes('screenVectors[axis]'));
assert.ok(voxelSource.includes('mouseDelta.dot(axisVector.clone().normalize()) / pixelsPerBlock'));
assert.ok(voxelSource.includes('tool === "place" || pressedKeys.has("axisLock")'));
assert.ok(voxelSource.includes('lastPointer && !pressedKeys.has("axisLock")'));
assert.ok(voxelSource.includes('let clipboardSourceOrigin = null'));
assert.ok(voxelSource.includes('function effectiveTransformPlacementOrigin'));
assert.ok(voxelSource.includes('clipboardSourceOrigin = cloneCell(bounds.min)'));
assert.ok(voxelCss.includes(':not(.play-hud):not(.cursor-coordinate)'));
assert.ok(voxelCss.includes(':not(.cursor-coordinate):not(.bpy-progress)'));
assert.ok(voxelCss.includes('.viewport.playing .bpy-progress:not([hidden]) { display: grid !important; }'));
assert.ok(/\.viewport\.playing \.cursor-coordinate \{[\s\S]*?display: block !important; z-index: 51;/.test(voxelCss));
assert.ok(voxelSource.includes('const renderChunkSize = 16'));
assert.ok(voxelSource.includes('let placementStretch = { x: 1, y: 1, z: 1 }'));
assert.ok(voxelSource.includes('addTransformHandle(stretchHandle, "stretch", axis)'));
assert.ok(voxelSource.includes('pointerDown.kind === "stretch"'));
assert.ok(voxelSource.includes('stretch: cloneStretch(placementStretch)'));
assert.ok(voxelSource.includes('const effectiveScale = () => new THREE.Vector3('));
assert.ok(voxelSource.includes('minimum.x + (x + 0.5) / axisScale.x'));
assert.ok(voxelSource.includes('function blockTextureTint(id, face = "all")'));
assert.ok(voxelSource.includes('function isCutoutTextureBlock(id)'));
assert.ok(voxelSource.includes('function isTranslucentGlassBlock(id)'));
assert.ok(voxelSource.includes('translucentGlass ? 0.72'));
assert.ok(voxelSource.includes('alphaTest: cutout ? 0.35 : 0'));
assert.ok(voxelSource.includes('swatch.style.backgroundBlendMode = "multiply"'));
assert.ok(voxelSource.includes('function blockCategories(id)'));
assert.ok(voxelSource.includes('let activeBlockCategory = "all"'));
assert.ok(voxelSource.includes('blockCategories(id).has(activeBlockCategory)'));
assert.ok(voxelSource.includes('`${blockCategoryLabels[activeBlockCategory]} ${categorizedBlocks.length}개 블록 검색…`'));
assert.ok(voxelSource.includes('const visible = source;'));
assert.ok(!voxelSource.includes('source.slice(0, 240)'));
assert.ok(voxelSource.includes('start + 120'));
assert.ok(voxelSource.includes('requestAnimationFrame(() => appendBatch(end))'));
assert.ok(voxelSource.includes('classList.toggle("icon-only")'));
assert.ok(voxelCss.includes('.block-category-tabs'));
assert.ok(voxelCss.includes('.palette.icon-only'));
assert.ok(!voxelSource.includes('type: "moveEditorToNewWindow"'));
assert.ok(!voxelCss.includes('.new-window-editor-button'));
assert.ok(voxelSource.includes('class TrackedBlockMap extends Map'));
assert.ok(voxelSource.includes('async function createTrackedBlockMapFromBlocks('));
assert.ok(voxelSource.includes('Map.prototype.set.call(map, position, type)'));
assert.ok(voxelSource.includes('performance.now() - batchStartedAt >= 12'));
assert.ok(voxelSource.includes('rawBlocks.length >= 5000'));
assert.ok(/structureDataLoading = false;[\s\S]*?structureMeshLoadingProgress = false;[\s\S]*?hideBpyProgress\(\);[\s\S]*?rebuild\(true\);/.test(voxelSource));
assert.ok(voxelSource.includes('updateBpyProgress(1, `${entry.name} 파일 읽는 중…`, "구조물 불러오는 중")'));
assert.ok(voxelSource.includes('message.type === "projectOpenFailed"'));
assert.ok(extensionSource.includes("type: 'projectOpenFailed'"));
assert.ok(!voxelSource.includes('if (showProgress) updateBpyProgress(76, "가까운 청크부터 화면 생성 중…"'));
assert.ok(voxelSource.includes('if (!structureDataLoading) {'));
assert.ok(voxelSource.includes('const chunkRenderMeshes = new Map()'));
assert.ok(voxelSource.includes('const blockChunkCounts = new Map()'));
assert.ok(voxelSource.includes('function desiredResidentRenderChunks()'));
assert.ok(voxelSource.includes('function syncChunkStreaming(force = false)'));
assert.ok(voxelSource.includes('residentRenderChunks.add(activeChunkKey)'));
assert.ok(voxelSource.includes('mesh.geometry.dispose()'));
assert.ok(/function enterPlayMode\(\)[\s\S]*?setTool\("move"\);[\s\S]*?const editorCameraPosition/.test(voxelSource));
assert.ok(/function enterPlayMode\(\)[\s\S]*?selectionBox\.visible = false;[\s\S]*?selectionFill\.visible = false;/.test(voxelSource));
assert.ok(/function enterPlayMode\(\)[\s\S]*?hover\.visible = false;[\s\S]*?clearGhost\(\);[\s\S]*?transformVisualGizmo\.visible = false;/.test(voxelSource));
assert.ok(/function exitPlayMode\(\)[\s\S]*?playMode = false;[\s\S]*?updateSelection\(\);/.test(voxelSource));
assert.ok(/function updateSelection\(previewOnly = false\)[\s\S]*?if \(playMode\)[\s\S]*?selectionBox\.visible = false;[\s\S]*?return;/.test(voxelSource));
assert.ok(/function refreshHover\(\) \{[\s\S]*?if \(playMode\)[\s\S]*?pickPlayBlockVoxelRay\(\)[\s\S]*?hover\.visible = Boolean\(hoveredCell\)[\s\S]*?updateCursorCoordinate\(playerPosition, true\)/.test(voxelSource));
assert.ok(voxelSource.includes('let playCoordinatePrecise = true'));
assert.ok(/cursor-coordinate"\)\?\.addEventListener\("click"[\s\S]*?playCoordinatePrecise = !playCoordinatePrecise/.test(voxelSource));
assert.ok(voxelSource.includes('Number(value).toFixed(2)'));
assert.ok(voxelSource.includes('precise ? Math.floor(Number(value)) : value'));
assert.ok(voxelSource.includes('x: Number(cell.x) + baseCoordinate.x'));
assert.ok(voxelSource.includes('`X ${coordinate(worldCell.x)} · Y ${coordinate(worldCell.y)} · Z ${coordinate(worldCell.z)}`'));
assert.ok(voxelCss.includes('pointer-events: auto; cursor: pointer'));
assert.ok(voxelSource.includes('function beginCameraDrag(event, mode = "camera")'));
assert.ok(extensionSource.includes('id="bpy-progress"'));
assert.ok(voxelSource.includes('async function compileCuboids(onProgress)'));
assert.ok(voxelSource.includes('function updateBpyProgress('));
assert.ok(voxelSource.includes('async function runSelectionBlockOperation('));
assert.ok(voxelSource.includes('남은 시간 약 ${formatOperationDuration(remaining)}'));
assert.ok(voxelSource.includes('function selectionCellCount()'));
assert.ok(voxelSource.includes('let activeUndoChanges = null'));
assert.ok(voxelSource.includes('function commitUndoTransaction()'));
assert.ok(voxelSource.includes('function applyUndoTransaction(transaction, direction)'));
assert.ok(!voxelSource.includes('JSON.stringify([...blocks.entries()])'));
assert.ok(voxelSource.includes('const columnTopCache = new Map()'));
assert.ok(voxelSource.includes('if (columnTopCache.has(columnKey)) return columnTopCache.get(columnKey)'));
assert.ok(voxelSource.includes('const minimumSpacing = Math.max(1, Math.floor(brushRange().size / 2))'));
assert.ok(voxelSource.includes('previewInterval - (performance.now() - lastLiveEditPreviewAt)'));
assert.ok(voxelSource.includes('let radius = 5'));
assert.ok(!voxelSource.includes('radius = Math.max(8, Math.max(workspaceSize.x'));
assert.ok(voxelSource.includes('functionName: normalizedFunctionName('));
assert.ok(voxelSource.includes('const generatedCells = collectGeneratedCells(generator, cell)'));
assert.ok(voxelSource.includes('putGenerated(generated.x, generated.y, generated.z, generated.type)'));
assert.ok(voxelSource.includes('baseCoordinate: { ...baseCoordinate }'));
assert.ok(!voxelSource.includes('bpyCoordinateMode:'));
assert.ok(voxelSource.includes('const absoluteCoordinates = bpyExportCoordinateMode === "absolute"'));
assert.ok(voxelSource.includes('type: "requestBpyCoordinateMode"'));
assert.ok(voxelSource.includes('message.type === "bpyCoordinateModeSelected"'));
assert.ok(voxelSource.includes('String(baseCoordinate[axis] + value)'));
assert.ok(voxelSource.includes('function defaultFunctionNameForFile(fileName)'));
assert.ok(voxelSource.includes('data.functionName'));
assert.ok(voxelSource.includes('document.getElementById("function-name")?.addEventListener("input"'));
assert.ok(voxelSource.includes('const tickingTileSize = 128'));
assert.ok(voxelSource.includes('batchStart += 1'));
assert.ok(voxelSource.includes('tiles.slice(batchStart, batchStart + 1)'));
assert.ok(voxelSource.includes('commands.push("    sleep(20)")'));
assert.ok(voxelSource.includes('const areaName = `${areaBaseName}_${String(batchStart).padStart(4, "0")}`'));
assert.ok(voxelSource.includes('const anchorAreaName = `${areaBaseName}_anchor`'));
assert.ok(voxelSource.includes('run tickingarea add circle ~ ~ ~ 0 ${anchorAreaName} true'));
assert.ok(voxelSource.includes('/tickingarea remove ${anchorAreaName}'));
assert.ok(voxelSource.includes('/tickingarea remove ${areaName}'));
assert.ok(!voxelSource.includes('commands.push(`    await_tickingarea('));
assert.ok(voxelSource.includes('const maximumFillHeight = Math.max(1, Math.floor(32768 / horizontalArea))'));
assert.ok(voxelSource.includes('run tickingarea add'));
assert.ok(voxelSource.includes('/tickingarea remove'));
assert.ok(voxelSource.includes('/summon ender_crystal ~ ~1000 ~'));
assert.ok(voxelSource.includes('`    /execute at ${anchorSelector} positioned ~ ~-1000 ~ run `'));
assert.ok(voxelSource.includes('`${commandPrefix}setblock ${start} ${cuboid.type}`'));
assert.ok(voxelSource.includes('`${commandPrefix}fill ${start} ${end} ${cuboid.type}`'));
assert.ok(voxelSource.includes('/kill @e[type=ender_crystal,tag=${anchorTag}]'));
assert.ok(extensionSource.includes("type: 'bpyOperationComplete'"));
assert.ok(/tool === "selectBox"[\s\S]*?if \(!cell \|\| !valid\(cell\)\) \{[\s\S]*?beginCameraDrag\(event\)/.test(voxelSource));
assert.ok(/if \(repeatable\)[\s\S]*?if \(!cell \|\| !valid\(cell\)\) \{[\s\S]*?beginCameraDrag\(event\)/.test(voxelSource));
for (const feature of [
  'selectBox', 'generateSphere', 'generateCircle', 'generateCylinder', 'generateMountain',
  'generateLine', 'moveCamera', 'applyWorkspaceSize', 'updateLighting', 'mode: "armedBrush"',
  'updateGhostPreview', 'copySelection', 'floodFillAt', 'replaceAt',
  'sculptSelectionTerrain', 'extrudeSelection', 'addSelectionBrush',
  'moveSelectionTo', 'scaledPlacement', 'scalePlacement', 'placementRotation',
  'transformMode', 'transformAxis', 'rotationText', 'keepOnlyInstalledSelection',
  'pendingPlacement', 'commitPendingPlacement',
  'cancelPendingPlacement', 'selectAllStructure',
  'pendingGroupedRebuild', 'flushGroupedRebuild', 'updateStatsLightweight',
  'recordLiveEditPreview', 'renderLiveEditPreview', 'clearLiveEditPreview',
  'applySelectionPoints', 'limit-to-selection', 'armedBrush',
  'collapsedSections', '"1": "move"', 'renderProjectTree', 'projectOpenFile',
  'projectOpenRequestId',
  'pickPlayBlockVoxelRay',
  'traceVoxelRay',
  'continuousBrushHoldDelayMs = 2000',
  'planPlacementBrush', 'deferredPlacementCenters',
  'planDeletionBrush', 'deferredDeletionCenters', 'planSculptCenter', 'deferredSculptCenters',
  'createLazyTrackedBlockMap', 'lazyBlockChunkPayloads', 'encodeChunkPayload',
  'ensureBlockChunkLoaded',
  'serializeFlat',
  'dirtyBlockDataChunks', 'evictCleanBlockChunks',
  'viewpoint:', 'hasSavedViewpoint',
  'editorViewpointBeforePlay',
  'tool === "place" || tool === "erase" || tool === "sculpt"',
  'requestStructureSave', 'structureSaveProgress', 'activeStructureSaveId',
  'function updateAdaptiveGrid(force = false)', 'distanceToGround / 48',
  'adaptiveGridStep', 'const snap = gridStep * snapCells',
  'const maximumRange = Math.max(64, renderDistanceBlocks() + renderChunkSize)',
  'settings:', 'restoreStructureSettings', 'playSensitivity',
  'commitDeferredBrushPath', 'deferredBrushCommitActive', 'scheduleEditRebuild',
  'commitUndoTransactionAsync', 'commitUndoTransactionAdaptively',
  'maximumUndoChangedBlocks = 500000', 'maximumUndoTransactions = 50',
  'minimumUndoTransactions = 1', 'history.length > minimumUndoTransactions',
  'nearbyTerrainBlockType', 'tool === "sculpt" ? 0x66d9c7',
  'brushPreviewBlockToken = tool === "sculpt" ? "sculpt" : activeBlock',
  'function updateSelection(previewOnly = false)',
  'const selectionVolume = (max.x - min.x + 1)',
  'selectionSurfaceSourceCaches', 'forTransform ? blockMutationRevision : "cached-display"',
  'return selectionSurfaceItems(true)',
  'scheduleSelectionDisplayPatch', 'pendingSelectionDisplayChangeBatches',
  'performance.now() - frameStartedAt >= 5',
  'beginCameraDrag(event, "cameraDuringCommit")', 'pointerDown.mode === "cameraDuringCommit"',
  '"4": "sculpt"', '"5": "selectBox"', '"9": "moveSelection"',
  'generator === "curve"', 'function commitCurvePath()',
  'curveControlPoints', 'THREE.CatmullRomCurve3', '"centripetal"',
  'curve-thickness', 'finish-curve', 'clear-curve-points',
  'line-thickness', 'shapeNumber("line-thickness", 1, 1, 16)',
  'updateGhostPreview(pointerDown.lastCell)',
  'isDeferredShapeTool', 'planGeneratedShape', 'deferredGeneratedCenters',
  'transformSelection', 'updateToolPanels', 'tool-context-hidden', 'groupedMutation',
  'renderRecentBlocks', 'movementCodeNames', 'updateAxisGizmo', 'updateCursorCoordinate',
  'sculptAt', 'columnTop', 'faceDefinitions', 'greedyMeshed', 'renderedFaceCount'
]) {
  assert.ok(voxelSource.includes(feature), `missing 3D editor feature: ${feature}`);
}
assert.ok(extensionSource.includes('latestProjectOpenRequestId'));
assert.ok(!extensionSource.includes('class="crosshair"'));
assert.ok(extensionSource.includes('id="viewport-panels"'));
assert.ok(extensionSource.includes('id="utility-dock"'));
assert.ok(extensionSource.includes('id="brush-options-dock"'));
assert.ok(extensionSource.includes('id="brush-panel"'));
assert.ok(extensionSource.includes('<kbd>C+브러시 드래그</kbd>'));
assert.ok(extensionSource.includes('id="paste-air"'));
assert.ok(extensionSource.includes('data-utility-group="environment"'));
assert.ok(extensionSource.includes('data-utility-group="information"'));
assert.ok(extensionSource.includes('id="fog-density" type="range" min="0" max="100" step="1" value="50"'));
assert.ok(voxelSource.includes('scene.fog.near = fogRatio > 0 ? renderDistance * (1 - fogCoverage) : renderDistance'));
assert.ok(voxelSource.includes('scene.fog.far = fogRatio > 0 ? renderDistance : renderDistance + 1'));
assert.ok(extensionSource.includes('id="camera-speed" type="range" min="1" max="1000"'));
assert.ok(extensionSource.includes('id="camera-speed" type="range" min="1" max="1000" step="1" value="64"'));
assert.ok(extensionSource.includes('id="render-distance" type="range" min="16" max="1024"'));
assert.ok(extensionSource.includes('id="size-x" type="number" min="1" max="65536"'));
assert.ok(voxelSource.includes('THREE.MathUtils.clamp(Number(value.x) || 32, 1, 65536)'));
assert.ok(extensionSource.includes('id="jump-camera"'));
assert.ok(voxelSource.includes('function jumpCameraToCoordinate()'));
assert.ok(extensionSource.includes('id="bedrock-y-limit-warning"'));
assert.ok(voxelSource.includes('function updateBedrockYLimitWarning()'));
assert.ok(voxelSource.includes('const minimumBuildY = -64'));
assert.ok(voxelSource.includes('const maximumBuildY = 319'));
assert.ok(voxelSource.includes('selectionA = cloneCell(cell);'));
assert.ok(voxelSource.includes('const selectionFill = new THREE.Mesh('));
assert.ok(voxelSource.includes('selectionCount <= 1000 ? selectionCount : 0'));
assert.ok(voxelSource.includes('const adaptiveOpacity = selectionCount <= 256'));
assert.ok(voxelSource.includes('function selectedProjectDirectory()'));
assert.ok(voxelSource.includes('generate:* selectBox lasso selectA selectB moveSelection'));
assert.ok(extensionSource.includes("message.type === 'requestProjectRename'"));
assert.ok(extensionSource.includes("message.type === 'requestProjectDelete'"));
assert.ok(extensionSource.includes('class="point-tool-row"'));
assert.ok(extensionSource.includes('class="special-text-tool" data-generator="text"'));
assert.ok(extensionSource.includes('id="block-text"'));
assert.ok(voxelSource.includes('function collectBlockTextCells(center, respectMask = true)'));
assert.ok(voxelSource.includes('function generateBlockText(override)'));
assert.ok(voxelSource.includes('generator === "text"'));
assert.ok(extensionSource.includes('id="image-block-tool"'));
assert.ok(extensionSource.includes('id="model-block-tool"'));
assert.ok(extensionSource.includes('class="special-tool-divider"'));
assert.ok(extensionSource.includes('id="toggle-project-sidebar"'));
assert.ok(voxelSource.includes('function setProjectSidebarCollapsed('));
assert.ok(voxelSource.includes('projectSidebarCollapsed'));
assert.ok(voxelSource.includes('const pendingRenderChunks = new Set()'));
assert.ok(voxelSource.includes('const maximumChunksPerFrame = 1'));
assert.ok(voxelSource.includes('const chunkBuildBudgetMs = 4'));
assert.ok(voxelSource.includes('Math.floor(chunkBuildBudgetMs / Math.max(0.5, averageChunkBuildMs))'));
assert.ok(voxelSource.includes('const blockChunkPositions = new Map()'));
assert.ok(voxelSource.includes('for (const position of blockChunkPositions.get(activeChunkKey) || [])'));
assert.ok(voxelSource.includes('function beginBulkMutation()'));
assert.ok(voxelSource.includes('for (const columnKey of dirtyColumnTops) recomputeColumnTop(columnKey)'));
assert.ok(voxelSource.includes('chunkDistanceToCamera(left) - chunkDistanceToCamera(right)'));
assert.ok(voxelSource.includes('if (pendingRenderChunks.size) rebuild(false, true)'));
assert.ok(voxelSource.includes('const transformedSourceBoundsCache = new WeakMap()'));
assert.ok(voxelSource.includes('function transformedSourceOutline('));
assert.ok(voxelSource.includes('function largeTransformPreviewSource()'));
assert.ok(voxelSource.includes('tool === "moveSelection" ? selectedCellCount() : transformSource.length'));
assert.ok(voxelSource.includes('function scheduleLargeSurfacePreview('));
assert.ok(voxelSource.includes('performance.now() - started < 6'));
assert.ok(voxelSource.includes('function transformedSourceFrame('));
assert.ok(voxelSource.includes('ghostMeshUsesCachedGeometry'));
assert.ok(voxelSource.includes('selectionSurfaceSourceCache'));
assert.ok(voxelSource.includes('pending.tool === "moveSelection"'));
assert.ok(voxelSource.includes('let selectionSurfaceMesh = null'));
assert.ok(voxelSource.includes('function renderSelectionSurfacePreview('));
assert.ok(voxelSource.includes('selection: { source: null, status: "empty"'));
assert.ok(voxelSource.includes('blockMutationRevision'));
assert.ok(extensionSource.includes("message.type === 'chooseVoxelImage'"));
assert.ok(extensionSource.includes("message.type === 'chooseVoxelModel'"));
assert.ok(voxelSource.includes('function collectVoxelImageCells(center, respectMask = true)'));
assert.ok(voxelSource.includes('function parseObjModel(bytes)'));
assert.ok(voxelSource.includes('function parseStlModel(bytes)'));
assert.ok(voxelSource.includes('function collectVoxelModelCells(center, respectMask = true)'));
assert.ok(voxelSource.includes('MAX_IMPORTED_VOXELS = 250000'));
assert.ok(voxelSource.includes('function isSpecialTransformTool('));
assert.ok(voxelSource.includes('function isTransformPlacementTool('));
assert.ok(voxelSource.includes('function specialGeneratorItems('));
assert.ok(voxelSource.includes('scaledPlacement(cell, specialGeneratorItems(generator))'));
assert.ok(voxelSource.includes('BracketLeft: "selectA"'));
assert.ok(voxelSource.includes('BracketRight: "selectB"'));
assert.ok(voxelSource.includes('const modifier = event.metaKey || event.ctrlKey'));
assert.ok(!voxelSource.includes('navigator.platform.includes("Mac")'));
assert.ok(voxelSource.includes('pendingPlacement.locked'));
assert.ok(voxelSource.includes('locked: true'));
assert.ok(voxelSource.includes('sizeAttenuation: false'));
assert.ok(voxelSource.includes('!pendingPlacement?.locked'));
assert.ok(voxelSource.includes('if (event.metaKey || event.ctrlKey || event.altKey) return;'));
assert.ok(voxelSource.includes('updateTransformVisualGizmoScale'));
assert.ok(voxelSource.includes('window.getSelection()?.removeAllRanges()'));
assert.ok(voxelSource.includes('event.stopImmediatePropagation()'));
assert.ok(voxelSource.includes('pendingPlacement?.tool === tool && pendingPlacement.locked'));
assert.ok(voxelSource.includes('CylinderGeometry(0.08, 0.08, 1.6'));
assert.ok(voxelSource.includes('highlightTransformHandle'));
assert.ok(voxelSource.includes('transformBaseColor'));
assert.ok(voxelSource.includes('if (pendingPlacement) cancelPendingPlacement();'));
assert.ok(extensionSource.includes('id="palette-eyedropper"'));
assert.ok(voxelSource.includes('function activateEyedropper()'));
assert.ok(voxelSource.includes('function sampleBlockAtPointer(event)'));
assert.ok(voxelSource.includes('event.button === 1'));
assert.ok(voxelSource.includes('tool === "eyedropper"'));
assert.ok(voxelSource.includes('beginCameraDrag(event, "cameraWhileTransforming")'));
assert.ok(voxelSource.includes('mergedFaceCount'));
assert.ok(voxelSource.includes('const showTransformGizmo = Boolean('));
assert.ok(voxelSource.includes('camera.far = renderDistance'));
assert.ok(extensionSource.includes('id="connected-selection"'));
assert.ok(extensionSource.includes('id="connected-any-selection"'));
assert.ok(extensionSource.includes('data-tool-detail="place erase sculpt generate:*"'));
assert.ok(voxelSource.includes('function selectConnectedAt('));
assert.ok(voxelSource.includes('sameTypeOnly = true'));
assert.ok(voxelSource.includes('!sameTypeOnly || neighborType === sourceType'));
assert.ok(voxelSource.includes('additiveBase'));
assert.ok(voxelSource.includes('const connected = [];'));
assert.ok(voxelSource.includes('connected.forEach(position => blocks.set(position, activeBlock))'));
assert.ok(voxelSource.includes('placementPreview ? 0xb8ff4a'));
assert.ok(voxelSource.includes('let ghostBounds = null'));
assert.ok(voxelSource.includes('previewCellCount <= 10000 ? 600 : 200'));
assert.ok(voxelSource.includes('function nearestPreviewCells(cells, limit)'));
assert.ok(voxelSource.includes('const outlineOnlyPreview = placementPreview && previewCellCount > 1000'));
assert.ok(voxelSource.includes('function transformedSelectionOutline(origin)'));
assert.ok(voxelSource.includes('const visible = outlineOnlyPreview'));
assert.ok(voxelSource.includes('let selectionBoundsCache = null'));
assert.ok(voxelSource.includes('depthTest: !placementPreview'));
assert.ok(extensionSource.includes('id="use-texture-rendering"'));
assert.ok(extensionSource.includes("message.type === 'chooseResourcePack'"));
assert.ok(extensionSource.includes('https://api.github.com/repos/Mojang/bedrock-samples/releases/latest'));
assert.ok(extensionSource.includes('data:image/png;base64,'));
assert.ok(voxelSource.includes('function blockTexture('));
assert.ok(voxelSource.includes('const searchableBlocks ='));
assert.ok(voxelSource.includes('function blockTextureUri('));
assert.ok(voxelSource.includes('textureFace: "up"'));
assert.ok(voxelSource.includes('geometry.addGroup('));
assert.ok(voxelSource.includes('face.axis === 0'));
assert.ok(voxelSource.includes('function decorateBlockSwatch('));
assert.ok(voxelSource.includes('function refreshBlockIcons()'));
assert.ok(voxelSource.includes('texture.minFilter = THREE.NearestMipmapLinearFilter'));
assert.ok(voxelSource.includes('texture.generateMipmaps = true'));
assert.ok(voxelSource.includes('texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy())'));
assert.ok(voxelSource.includes('roughness: waterTint !== null ? 0.32 : translucentGlass ? 0.16 : 0.9'));
assert.ok(voxelSource.includes('geometry.setAttribute("uv"'));
assert.ok(voxelSource.includes('textureFace: "east"'));
assert.ok(voxelSource.includes('textureFace: "south"'));
assert.ok(voxelSource.includes('textureFace: "west"'));
assert.ok(/textureFace: "east"[^\n]*flipU: true/.test(voxelSource));
assert.ok(/textureFace: "north"[^\n]*flipU: true/.test(voxelSource));
assert.ok(!/textureFace: "west"[^\n]*flipU: true/.test(voxelSource));
assert.ok(!/textureFace: "south"[^\n]*flipU: true/.test(voxelSource));
assert.ok(voxelSource.includes('if (face.flipU) uv[0]'));
assert.ok(voxelSource.includes('dirtyProjectPaths'));
assert.ok(voxelSource.includes('projectDrafts'));
assert.ok(voxelSource.includes('markCurrentProjectFileDirty'));
assert.ok(extensionSource.includes("type: 'projectEntryRenamed'"));
assert.ok(!extensionSource.includes('data-tool="noise"'));
assert.ok(!extensionSource.includes('data-tool="flood"'));
assert.ok(!extensionSource.includes('id="noise-density"'));
assert.ok(!extensionSource.includes('id="selection-size-x"'));
assert.ok(extensionSource.includes('id="connected-replace"'));
assert.ok(extensionSource.includes('data-tool="moveSelection"'));
assert.ok(extensionSource.includes('id="scale-drag-badge"'));
assert.ok(extensionSource.includes('id="transform-gizmo"'));
assert.ok(extensionSource.includes('id="axis-gizmo"'));
assert.ok(extensionSource.includes('id="cursor-coordinate"'));
assert.ok(extensionSource.includes('id="play-mode"'));
assert.ok(extensionSource.includes('id="place-air-only"'));
assert.ok(extensionSource.includes('id="place-solid-only"'));
assert.ok(!extensionSource.includes('structureEditorStatus'));
assert.ok(pkg.contributes.commands.some(command =>
  command.command === 'bedrockpy.compilePack' && command.icon === '$(gear)'
));
assert.ok(voxelSource.includes('["place-solid-only", "place-air-only"]'));
assert.ok(voxelSource.includes('function targetsAdjacentCell()'));
assert.ok(voxelCss.includes('isolation: isolate'));
assert.ok(voxelCss.includes('backdrop-filter: none !important'));
assert.ok(extensionSource.includes('<option value="object_smooth">객체 다듬기</option>'));
assert.ok(voxelSource.includes('function smoothVoxelObject('));
assert.ok(voxelSource.includes('function simplifiedBrushPreview('));
assert.ok(voxelSource.includes('estimatedCount <= 2000'));
assert.ok(voxelSource.includes('cells.simplifiedBrush = true'));
assert.ok(voxelSource.includes('function insideBrush('));
assert.ok(voxelSource.includes('previousCenter && insideBrush(previousCenter'));
assert.ok(voxelSource.includes('pointerDown.lastAppliedBrushCenter'));
assert.ok(voxelSource.includes('if (brushSignature === brushPreviewSignature'));
assert.ok(voxelSource.includes('const previewLimit = tool === "sculpt" ? 400 : 1200'));
assert.ok(voxelSource.includes('const maximumScreenSteps = tool === "sculpt" ? 3 : 8'));
assert.ok(voxelSource.includes('candidates.push(...interpolatedBrushCenters(previous, sampled))'));
assert.ok(!voxelSource.includes('pointerDown.lastSculptAppliedAt || 0) < 90'));
assert.ok(!voxelSource.includes('const sculptCandidates = candidates.length <= 2'));
assert.ok(voxelSource.includes('Math.floor(brushRange().size / 2)'));
assert.ok(voxelSource.includes('if (renderingComplete) {'));
assert.ok(voxelSource.includes('removeThreshold = options.removeThreshold ?? 7'));
assert.ok(voxelSource.includes('fillThreshold = options.fillThreshold ?? 18'));
assert.ok(extensionSource.includes('<option value="object_connect">객체 연결</option>'));
assert.ok(voxelSource.includes('bridgeGaps: true'));
assert.ok(voxelSource.includes('removeThreshold: 2, fillThreshold: 10'));
assert.ok(!voxelSource.includes('||\n      isSpecialTransformTool(pending.tool)'));
assert.ok(voxelSource.includes('isSpecialTransformTool(next) && previousTool !== next'));
assert.ok(voxelSource.includes('tool.startsWith("generate:"))) return false'));
assert.ok(extensionSource.includes('id="block-palette-section"'));
assert.ok(voxelSource.includes('viewportPanels.appendChild(blockPaletteSection)'));
assert.ok(extensionSource.includes('id="play-fov"'));
assert.ok(extensionSource.includes('id="play-sensitivity"'));
assert.ok(voxelSource.includes('document.querySelectorAll(".play-settings input")'));
assert.ok(voxelSource.includes('function enterPlayMode()'));
assert.ok(voxelSource.includes('function playerCollides('));
assert.ok(voxelSource.includes('editorCameraPosition'));
assert.ok(voxelSource.includes('playLookPointer'));
assert.ok(extensionSource.includes('data-tool="sculpt"'));
assert.ok(extensionSource.includes('id="sculpt-mode"'));
assert.ok(extensionSource.includes('id="selection-sculpt-mode"'));
assert.ok(extensionSource.includes('<option value="natural_flatten">자연 평탄화</option>'));
assert.ok(voxelSource.includes('function thermalErodeColumns('));
assert.ok(extensionSource.includes('id="apply-selection-sculpt"'));
assert.ok(extensionSource.includes('class="transform-help"'));
assert.ok(voxelSource.includes('buildTransformVisualGizmo'));
assert.ok(voxelSource.includes('pickTransformHandle'));
assert.ok(voxelSource.includes('transformedPreviewPlacement'));
assert.ok(voxelSource.includes('mode: "visualTransform"'));
assert.ok(!extensionSource.includes('data-transform-mode="move"'));
assert.ok(!extensionSource.includes('id="apply-transform"'));
assert.ok(extensionSource.includes('id="select-solid-only"'));
assert.ok(voxelSource.includes('event.key === "Delete"'));
assert.ok(voxelSource.includes('event.key === "Backspace"'));
assert.ok(voxelSource.includes('event.code === "KeyA"'));
assert.ok(voxelSource.includes('event.code === "KeyC"'));
assert.ok(voxelSource.includes('!isTransformPlacementTool(pending.tool)'));
assert.ok(voxelSource.includes('Math.ceil(screenDistance / screenStepPixels)'));
assert.ok(voxelSource.includes('const editingTextValue ='));
assert.ok(voxelSource.includes('if (editingTextValue) {'));
assert.ok(/modifier && event\.code === "KeyZ"[\s\S]*?event\.stopImmediatePropagation\(\);[\s\S]*?document\.getElementById\(event\.shiftKey \? "redo" : "undo"\)\.click\(\);/.test(voxelSource));
assert.ok(voxelSource.includes('modifier && event.code === "KeyY" && !editingTextValue'));
assert.ok(!extensionSource.includes('class="viewport-hud"'));
assert.ok(!extensionSource.includes('id="workspace-label"'));
assert.ok(extensionSource.includes('decodeMcstructure'));
assert.ok(extensionSource.includes("['bpstructure', 'mcstructure']"));
assert.ok(extensionSource.includes('listStructureProject'));
assert.ok(extensionSource.includes('projectNewFolder'));
assert.ok(extensionSource.includes('requestProjectNew'));
assert.ok(extensionSource.includes('requestProjectNewFolder'));
assert.ok(extensionSource.includes("title: '새 구조물 만들기'"));
assert.ok(extensionSource.includes('useTrash: true'));
console.log('BedrockPy extension smoke test passed.');
