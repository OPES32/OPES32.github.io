import { TRACKS, DEFAULT_TRACK_ID } from './data.js?v=20261021-agents';
import { AnthemAudio } from './audio.js?v=20261021-agents';
import { SignalField } from './visuals.js?v=20261021-agents';

const $ = (selector, scope = document) => scope.querySelector(selector);
const $$ = (selector, scope = document) => [...scope.querySelectorAll(selector)];
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const pad = (value) => String(value).padStart(2, '0');
const escapeHtml = (value) => String(value)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#039;');
const formatTime = (seconds) => {
  const safe = Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
  return `${pad(Math.floor(safe / 60))}:${pad(Math.floor(safe % 60))}`;
};
const formatDuration = (seconds) => formatTime(Math.round(Number.isFinite(seconds) ? seconds : 0));

const reduceMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
const initialHash = window.location.hash.replace('#', '');
const initialQuery = new URLSearchParams(window.location.search).get('track');
const initialIndex = Math.max(
  0,
  TRACKS.findIndex((track) => track.year === (initialQuery || initialHash || DEFAULT_TRACK_ID))
);

const state = {
  currentIndex: initialIndex === -1 ? TRACKS.length - 1 : initialIndex,
  entered: false,
  starting: false,
  scrubbing: false,
  selectionToken: 0,
  archiveOpen: false,
  lastProgressPaint: 0,
  timeLabel: '',
  enterTimer: null,
  enterProgress: 6,
  switchTimer: 0,
  titleTimer: 0,
  audioErrorTimer: 0
};

const gate = $('#gate');
const site = $('#site');
const enterButton = $('#enterButton');
const enterLabel = $('#enterLabel');
const enterSub = $('#enterSub');
const gateNote = $('#gateNote');
const gateProgress = $('#gateProgress');
const gateReadyTicks = $('#gateReadyTicks');
const gateReadyValue = $('#gateReadyValue');
const signalList = $('#signalList');
const archiveRowsHost = $('#archiveList');
const archiveDialog = $('#archiveDialog');
const archiveButton = $('#archiveButton');
const archiveButtonAlt = $('#archiveButtonAlt');
const archiveClose = $('#archiveClose');
const clockLabel = $('#shanghaiClock');
const signalStatus = $('#signalStatus');
const transportStatus = $('#transportStatus');
const markButton = $('#markButton');
const mark = markButton;
const markLabel = $('#markLabel');
const fieldCanvas = $('#ambientCanvas');
const playButton = $('#playButton');
const prevButton = $('#prevButton');
const nextButton = $('#nextButton');
const muteButton = $('#muteButton');
const volumeSlider = $('#volumeSlider');
const listenLink = $('#listenLink');
const seekBar = $('#seekBar');
const waveBase = $('#waveBase');
const waveFront = $('#waveFront');
const elapsedTime = $('#elapsedTime');
const totalTime = $('#totalTime');
const nowTitle = $('#nowTitle');
const nowMeta = $('#nowMeta');
const keyPopover = $('#keyPopover');
const keysButton = $('#keysButton');
const audioError = $('#audioError');
const audioRetry = $('#audioRetry');
const bootError = $('#bootError');
const liveRegion = $('#liveRegion');
const sceneTransition = $('#sceneTransition');
const sceneTransitionIndex = $('#sceneTransitionIndex');
const sceneTransitionName = $('#sceneTransitionName');
const sceneTransitionZh = $('#sceneTransitionZh');
const sceneTransitionCity = $('#sceneTransitionCity');
const sceneTransitionYear = $('#sceneTransitionYear');
const sceneTransitionLine = $('#sceneTransitionLine');
const sceneTransitionNumber = $('#sceneTransitionNumber');
const sceneTransitionAgentIcon = $('#sceneTransitionAgentIcon');
const sceneTransitionAgentName = $('#sceneTransitionAgentName');
const sceneTransitionAgentRole = $('#sceneTransitionAgentRole');
const stageSceneNo = $('#stageSceneNo');
const stageSceneName = $('#stageSceneName');
const stageSceneZh = $('#stageSceneZh');
const stageAgent = $('#stageAgent');
const dossierScene = $('#dossierScene');
const agentGhost = $('#agentGhost');
const agentIcon = $('#agentIcon');
const agentName = $('#agentName');
const agentZh = $('#agentZh');
const agentRole = $('#agentRole');
const agentOrigin = $('#agentOrigin');
const agentUltimate = $('#agentUltimate');
const agentUltimateIcon = $('#agentUltimateIcon');
const agentLine = $('#agentLine');

const laneElements = {
  stage: $('#stage'),
  stageYear: $('#stageYear'),
  stageIssue: $('#stageIssue'),
  stageCity: $('#stageCity'),
  stageYearLabel: $('#stageYearLabel'),
  stageMotif: $('#stageMotif'),
  stageFileCode: $('#stageFileCode'),
  trackTitle: $('#trackTitle'),
  trackMotifZh: $('#trackMotifZh'),
  trackTagline: $('#trackTagline'),
  trackCredit: $('#trackCredit'),
  dossierCity: $('#dossierCity'),
  dossierCityZh: $('#dossierCityZh'),
  dossierCoords: $('#dossierCoords'),
  dossierNote: $('#dossierNote'),
  dossierTagline: $('#dossierTagline'),
  fileNumber: $('#fileNumber'),
  metaReleased: $('#metaReleased'),
  metaArtist: $('#metaArtist')
};

const audio = new AnthemAudio({
  tracks: TRACKS,
  onProgress: updateGatePreload,
  onState: handleAudioState,
  onError: handleAudioError
});

const field = new SignalField(fieldCanvas, {
  reducedMotion: reduceMotionQuery.matches
});

let themeColorMeta = null;
let sceneSlateTimer = 0;
let sceneSlateDelay = 0;
let agentVisualRequest = 0;

function getTrack() {
  return TRACKS[state.currentIndex];
}

function buildGateReadyTicks() {
  gateReadyTicks.innerHTML = TRACKS.map(() => '<i></i>').join('');
}

function updateGatePreload({ loaded, total, failed }) {
  const ticks = $$('i', gateReadyTicks);
  ticks.forEach((tick, index) => {
    tick.classList.toggle('is-ready', index < loaded);
  });
  gateReadyValue.textContent = `${pad(loaded)} / ${pad(total)}`;

  if (gateNote && !state.starting) {
    const track = getTrack();
    if (loaded >= total) {
      gateNote.textContent = `六段信号就绪 · ${track.year} ${track.city} · 官方试听片段`;
    } else if (failed > 0) {
      gateNote.textContent = '部分信号暂时不可用 · 点击后重试';
    }
  }
}

function buildSignalIndex() {
  signalList.innerHTML = TRACKS.map((track, index) => `
    <li>
      <button class="signal" type="button" data-track-index="${index}" aria-current="${index === state.currentIndex}">
        <span class="signal__year">${escapeHtml(track.year)}</span>
        <span>
          <span class="signal__title">${escapeHtml(track.listTitle || track.title)}</span>
          <span class="signal__motif">${escapeHtml(track.motif)} / ${escapeHtml(track.motifZh)}</span>
        </span>
        <span class="signal__meter" aria-hidden="true"><i></i><i></i><i></i><i></i></span>
      </button>
    </li>
  `).join('');
}

function buildArchiveList() {
  archiveRowsHost.innerHTML = TRACKS.map((track, index) => `
    <button class="archive__row" type="button" data-track-index="${index}" aria-current="${index === state.currentIndex}">
      <span class="archive__year">${escapeHtml(track.year)}</span>
      <span class="archive__spark" aria-hidden="true"><span class="spark spark--xs"></span></span>
      <span class="archive__title">
        <strong>${escapeHtml(track.title)}</strong>
        <small>${escapeHtml(track.tagline)}</small>
      </span>
      <span class="archive__city">${escapeHtml(track.city)} · ${escapeHtml(track.cityZh)}</span>
      <span class="archive__motif">${escapeHtml(track.motif)} / ${escapeHtml(track.motifZh)}</span>
      <span class="archive__cue" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none"><path d="M8 5.5 19 12 8 18.5V5.5Z" fill="currentColor"/></svg>
      </span>
    </button>
  `).join('');
}

function renderTrack(index, { animate = false, updateHash = false } = {}) {
  const track = TRACKS[index];
  if (!track) return;

  state.currentIndex = index;
  document.body.dataset.theme = track.year;
  if (themeColorMeta) themeColorMeta.setAttribute('content', track.fx.ink);

  laneElements.stageYear.textContent = track.year;
  laneElements.stageIssue.textContent = `SCENE ${pad(track.index)} / ${track.city}`;
  laneElements.stageCity.textContent = track.city;
  laneElements.stageYearLabel.textContent = track.year;
  laneElements.stageMotif.textContent = `${track.motif} / ${track.motifZh}`;
  laneElements.stageFileCode.textContent = `TXR_${track.year}_${pad(track.index)}`;
  laneElements.trackMotifZh.textContent = track.titleZh || track.motifZh;
  laneElements.trackTagline.textContent = track.tagline;
  laneElements.trackCredit.textContent = track.credit;

  stageSceneNo.textContent = `SCENE ${pad(track.index)}`;
  stageSceneName.textContent = track.sceneName;
  stageSceneZh.textContent = track.sceneZh;
  stageAgent.textContent = `AGENT / ${track.agent.name}`;
  dossierScene.textContent = `SCENE ${pad(track.index)} / ${track.sceneName} · ${track.sceneZh}`;

  sceneTransitionIndex.textContent = `SCENE ${pad(track.index)}`;
  sceneTransitionName.textContent = track.sceneName;
  sceneTransitionZh.textContent = track.sceneZh;
  sceneTransitionCity.textContent = track.city;
  sceneTransitionYear.textContent = track.year;
  sceneTransitionLine.textContent = track.sceneLine;
  sceneTransitionNumber.textContent = pad(track.index);

  renderAgent(track);

  laneElements.trackTitle.setAttribute('aria-label', track.title);
  laneElements.trackTitle.innerHTML = track.lines.map((line, lineIndex) => (
    `<span class="title-line" style="--line:${lineIndex}">${escapeHtml(line)}</span>`
  )).join('');

  laneElements.dossierCity.textContent = track.city;
  laneElements.dossierCityZh.textContent = track.cityZh;
  laneElements.dossierCoords.textContent = track.coordinates;
  laneElements.dossierNote.textContent = track.note;
  laneElements.dossierTagline.textContent = track.tagline;
  laneElements.fileNumber.textContent = pad(track.index);
  laneElements.metaReleased.textContent = track.released;
  laneElements.metaArtist.textContent = track.artist;

  if (listenLink) {
    listenLink.href = track.listenUrl;
    listenLink.setAttribute('aria-label', `在 Apple Music 收听完整版：${track.title}`);
  }

  nowTitle.textContent = track.title;
  nowMeta.textContent = `${track.city} / ${track.year} / 00:30`;
  document.title = `${track.title} — VCT / THE CHAMPIONS FREQUENCY`;

  if (!state.entered && !state.starting) {
    gateNote.textContent = `${track.year} ${track.city} · 官方试听片段 · 建议佩戴耳机`;
  }

  $$('.signal', signalList).forEach((button) => {
    const active = Number(button.dataset.trackIndex) === index;
    button.setAttribute('aria-current', String(active));
  });

  $$('.archive__row', archiveRowsHost).forEach((button) => {
    const active = Number(button.dataset.trackIndex) === index;
    button.setAttribute('aria-current', String(active));
  });

  field.setTrack(track);
  drawWaveform(audio.getPeaks(index));
  updateProgress(0, track.duration * 1000);
  updateTransportDuration(track.duration);

  if (animate) {
    animateThemeChange();
  }

  if (updateHash) {
    window.history.replaceState(null, '', `#${track.year}`);
  }

  scrollActiveSignal('smooth');

  if (state.entered) {
    liveRegion.textContent = `已进入 ${track.year} ${track.city}，${track.sceneName}，特工 ${track.agent.name}，${track.title}`;
  }
}

function renderAgent(track) {
  const agent = track.agent;
  const request = ++agentVisualRequest;
  const portraitUrl = new URL(agent.portrait, document.baseURI).href;

  document.body.dataset.agent = agent.key;
  document.body.style.setProperty('--agent-accent', agent.color);
  agentGhost.classList.remove('is-ready');
  agentGhost.style.setProperty('--agent-portrait', 'none');

  const portrait = new Image();
  portrait.decoding = 'async';
  portrait.onload = () => {
    if (request !== agentVisualRequest) return;
    agentGhost.style.setProperty('--agent-portrait', `url("${portraitUrl}")`);
    agentGhost.classList.add('is-ready');
  };
  portrait.onerror = () => {
    if (request === agentVisualRequest) agentGhost.classList.remove('is-ready');
  };
  portrait.src = portraitUrl;

  agentIcon.src = new URL(agent.icon, document.baseURI).href;
  agentIcon.alt = `${agent.zh} ${agent.name} 头像`;
  agentUltimateIcon.src = new URL(agent.ultimateIcon, document.baseURI).href;
  agentUltimateIcon.alt = '';

  agentName.textContent = agent.name;
  agentZh.textContent = agent.zh;
  agentRole.textContent = `${agent.role} / ${agent.roleZh}`;
  agentOrigin.textContent = `${agent.origin} / ${agent.originZh}`;
  agentUltimate.textContent = `${agent.ultimate} / ${agent.ultimateZh}`;
  agentLine.textContent = agent.lineZh;

  sceneTransitionAgentIcon.src = new URL(agent.icon, document.baseURI).href;
  sceneTransitionAgentIcon.alt = '';
  sceneTransitionAgentName.textContent = agent.name;
  sceneTransitionAgentRole.textContent = `${agent.role} / ${agent.roleZh}`;
}

function playSceneTransition() {
  if (!sceneTransition) return;
  window.clearTimeout(sceneSlateTimer);
  window.clearTimeout(sceneSlateDelay);
  sceneTransition.classList.remove('is-active');
  void sceneTransition.offsetWidth;

  sceneSlateDelay = window.setTimeout(() => {
    sceneTransition.classList.add('is-active');
    sceneSlateTimer = window.setTimeout(() => {
      sceneTransition.classList.remove('is-active');
    }, 1480);
  }, 120);
}

function scrollActiveSignal(behavior = 'smooth') {
  if (window.innerWidth > 1080) return;
  const activeButton = $('.signal[aria-current="true"]', signalList);
  if (!activeButton) return;
  const item = activeButton.closest('li');
  const listRect = signalList.getBoundingClientRect();
  const itemRect = item.getBoundingClientRect();
  const delta = (itemRect.left - listRect.left) - (listRect.width - itemRect.width) / 2;
  signalList.scrollTo({
    left: signalList.scrollLeft + delta,
    behavior
  });
}

function animateThemeChange() {
  window.clearTimeout(state.switchTimer);
  window.clearTimeout(state.titleTimer);

  site.classList.remove('is-sweeping');
  mark.classList.remove('is-switching');
  laneElements.stage.classList.remove('is-entering');

  // Force a style read so the finite animations restart.
  void site.offsetWidth;

  site.classList.add('is-sweeping');
  mark.classList.add('is-switching');
  laneElements.stage.classList.add('is-entering');
  playSceneTransition();

  state.switchTimer = window.setTimeout(() => {
    site.classList.remove('is-sweeping');
    mark.classList.remove('is-switching');
  }, 900);

  state.titleTimer = window.setTimeout(() => {
    laneElements.stage.classList.remove('is-entering');
  }, 1250);
}

function updateTransportDuration(duration) {
  totalTime.textContent = formatDuration(duration);
  seekBar.setAttribute('aria-valuemax', String(Math.round(duration)));
}

function updateProgress(milliseconds, durationMs = null) {
  const duration = durationMs || audio.getDuration() * 1000 || 30000;
  const position = clamp(milliseconds, 0, duration);
  const ratio = duration > 0 ? position / duration : 0;
  const percentage = `${(ratio * 100).toFixed(3)}%`;

  seekBar.style.setProperty('--progress', percentage);
  seekBar.setAttribute('aria-valuenow', String(Math.round(position / 1000)));
  const text = `${formatTime(position / 1000)} / ${formatDuration(duration / 1000)}`;
  if (text !== state.timeLabel) {
    state.timeLabel = text;
    seekBar.setAttribute('aria-valuetext', text);
    elapsedTime.textContent = formatTime(position / 1000);
  }
}

function handleAudioState(nextState, track) {
  document.body.dataset.audio = nextState;
  const playing = nextState === 'playing';
  playButton.setAttribute('aria-label', playing ? '暂停' : '播放');
  markButton.setAttribute('aria-label', playing ? '暂停播放' : '播放');
  markLabel.textContent = playing ? 'HOLD' : 'PLAY';
  transportStatus.textContent = playing ? 'ON AIR / NOW PLAYING' : 'SIGNAL HELD';

  if (signalStatus) {
    const text = $('#signalText');
    if (text) text.textContent = playing ? 'ON AIR' : 'HOLD';
  }

  if (!playing) {
    mark.style.setProperty('--bass', '0');
    document.body.style.setProperty('--bass', '0');
    document.body.style.setProperty('--energy', '0');
    field.setLevels({ bass: 0, mid: 0, high: 0, energy: 0 });
  }
}

function handleAudioError(error) {
  console.warn('[VCT] Audio error', error);
  showAudioError(error?.message || 'Audio preview could not be loaded.');
}

function showAudioError(detail) {
  window.clearTimeout(state.audioErrorTimer);
  audioError.hidden = false;
  const paragraph = $('p', audioError);
  if (paragraph) {
    paragraph.textContent = `音频链路中断：${detail} 请确认 assets/audio 内的文件可访问。`;
  }
  state.audioErrorTimer = window.setTimeout(() => {
    audioError.hidden = true;
  }, 9000);
}

function hideAudioError() {
  window.clearTimeout(state.audioErrorTimer);
  audioError.hidden = true;
}

function setEnterLoading(isLoading, label, sub) {
  enterButton.classList.toggle('is-loading', isLoading);
  enterButton.setAttribute('aria-busy', String(isLoading));
  if (label) enterLabel.textContent = label;
  if (sub) enterSub.textContent = sub;
}

function beginEnterProgress() {
  window.clearInterval(state.enterTimer);
  state.enterProgress = 8;
  gateProgress.style.width = '8%';

  state.enterTimer = window.setInterval(() => {
    const remaining = 84 - state.enterProgress;
    state.enterProgress = Math.min(84, state.enterProgress + Math.max(0.6, remaining * 0.075));
    gateProgress.style.width = `${state.enterProgress}%`;
  }, 190);
}

function finishEnterProgress() {
  window.clearInterval(state.enterTimer);
  state.enterTimer = null;
  state.enterProgress = 100;
  gateProgress.style.width = '100%';
}

async function startExperience() {
  if (state.starting || state.entered) return;

  state.starting = true;
  hideAudioError();
  const track = getTrack();
  setEnterLoading(true, '正在接通', `DECODING SIGNAL / ${pad(track.index)}`);
  gateNote.textContent = `唤醒音频链路 · ${track.year} ${track.city}`;
  beginEnterProgress();

  try {
    await audio.init();
    const result = await audio.play(state.currentIndex, { fade: 1.35, restart: true });

    if (!result) {
      throw new Error('The selected signal was superseded while loading.');
    }

    finishEnterProgress();
    drawWaveform(result);
    updateTransportDuration(audio.getDuration());
    nowMeta.textContent = `${getTrack().city} / ${getTrack().year} / ${formatDuration(audio.getDuration())}`;

    setEnterLoading(true, 'ON AIR', `SIGNAL LOCKED / ${pad(track.index)}`);
    gateNote.textContent = '信号已接通 · 享受这 30 秒';
    await new Promise((resolve) => window.setTimeout(resolve, 260));

    state.starting = false;
    state.entered = true;
    document.body.classList.remove('is-gated');
    document.body.dataset.audio = 'playing';

    site.classList.add('is-live');
    site.inert = false;
    site.removeAttribute('inert');
    site.removeAttribute('aria-hidden');
    enterButton.disabled = true;
    gate.classList.add('is-closing');
    gate.setAttribute('aria-hidden', 'true');
    gate.inert = true;

    field.start();
    field.syncCenter();
    window.setTimeout(() => {
      gate.hidden = true;
      field.syncCenter();
      scrollActiveSignal('auto');
      playButton.focus({ preventScroll: true });
    }, 980);

    audio.preloadAll().catch(() => {
      /* Individual playback paths handle their own loading errors. */
    });

    if (reduceMotionQuery.matches) {
      field.drawStatic();
    }
  } catch (error) {
    state.starting = false;
    window.clearInterval(state.enterTimer);
    setEnterLoading(false, '重试接通信号', 'AUDIO LINK FAILED');
    gateProgress.style.width = '4%';
    gateNote.textContent = '音频载入失败，请确认本地服务器已启动';
    handleAudioError(error);
    enterButton.disabled = false;
  }
}

async function selectTrack(index, { fromArchive = false } = {}) {
  if (!state.entered || state.starting) return;
  const nextIndex = clamp(index, 0, TRACKS.length - 1);
  const track = TRACKS[nextIndex];

  if (nextIndex === state.currentIndex) {
    if (!audio.playing) await togglePlayback();
    if (fromArchive) closeArchive();
    return;
  }

  const token = ++state.selectionToken;
  hideAudioError();
  if (fromArchive) closeArchive();
  renderTrack(nextIndex, { animate: true, updateHash: true });
  document.body.dataset.audio = 'loading';
  transportStatus.textContent = 'TUNING SIGNAL';
  const statusText = $('#signalText');
  if (statusText) statusText.textContent = 'TUNING';

  try {
    const peaks = await audio.play(nextIndex, { fade: 0.7 });
    if (token !== state.selectionToken) return;
    drawWaveform(peaks);
    updateTransportDuration(audio.getDuration());
    nowMeta.textContent = `${track.city} / ${track.year} / ${formatDuration(audio.getDuration())}`;
  } catch (error) {
    if (token !== state.selectionToken) return;
    handleAudioState('paused', getTrack());
    transportStatus.textContent = 'SIGNAL LOST';
    handleAudioError(error);
  }
}

async function togglePlayback() {
  if (!state.entered || state.starting) return;
  try {
    hideAudioError();
    if (!field.running) field.start();
    await audio.toggle();
  } catch (error) {
    handleAudioState('paused', getTrack());
    handleAudioError(error);
  }
}

async function retryAudioLink() {
  hideAudioError();
  if (!state.entered) {
    startExperience();
    return;
  }

  try {
    await audio.play(state.currentIndex, { fade: 0.3 });
    drawWaveform(audio.getPeaks());
    if (!field.running) field.start();
  } catch (error) {
    handleAudioState('paused', getTrack());
    handleAudioError(error);
  }
}

async function stepTrack(direction) {
  if (!state.entered) return;
  const next = (state.currentIndex + direction + TRACKS.length) % TRACKS.length;
  await selectTrack(next);
}

function drawWaveform(peaks) {
  if (!waveBase || !waveFront) return;

  const baseContext = waveBase.getContext('2d');
  const frontContext = waveFront.getContext('2d');
  if (!baseContext || !frontContext) return;

  const width = Math.max(1, waveBase.clientWidth);
  const height = Math.max(1, waveBase.clientHeight);
  const dpr = Math.min(window.devicePixelRatio || 1, 2);

  for (const canvas of [waveBase, waveFront]) {
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
  }

  baseContext.setTransform(dpr, 0, 0, dpr, 0, 0);
  frontContext.setTransform(dpr, 0, 0, dpr, 0, 0);
  baseContext.clearRect(0, 0, width, height);
  frontContext.clearRect(0, 0, width, height);

  const track = getTrack();
  const data = peaks || new Float32Array(96).map((_, index) => 0.1 + Math.abs(Math.sin(index * 0.61)) * 0.1);
  const barCount = Math.max(60, Math.min(data.length, Math.floor(width / 4)));
  const rawStep = data.length / barCount;
  const column = width / barCount;
  const barWidth = Math.max(1, column * 0.46);
  const center = height / 2;
  const maxHeight = height * 0.88;

  const paint = (context, color) => {
    context.fillStyle = color;
    for (let i = 0; i < barCount; i += 1) {
      const start = Math.floor(i * rawStep);
      const end = Math.max(start + 1, Math.floor((i + 1) * rawStep));
      let value = 0;
      for (let j = start; j < end && j < data.length; j += 1) value = Math.max(value, data[j]);
      const barHeight = Math.max(2, Math.pow(value, 0.74) * maxHeight);
      const x = i * column + (column - barWidth) / 2;
      context.fillRect(x, center - barHeight / 2, barWidth, barHeight);
    }
  };

  paint(baseContext, 'rgba(244, 239, 229, 0.2)');
  paint(frontContext, track.fx.primary);
}

function resetVolumeUI() {
  const percent = Math.round(audio.volume * 100);
  volumeSlider.value = String(percent);
  document.body.classList.toggle('is-muted', audio.muted);
  muteButton.setAttribute('aria-pressed', String(audio.muted));
  muteButton.setAttribute('aria-label', audio.muted ? '取消静音' : '静音');
}

function seekFromPointer(event) {
  const rect = seekBar.getBoundingClientRect();
  const ratio = clamp((event.clientX - rect.left) / rect.width, 0, 1);
  const durationMs = audio.getDuration() * 1000;
  state.scrubbing = true;
  updateProgress(ratio * durationMs, durationMs);
  return ratio * audio.getDuration();
}

function finishPointerSeek(seconds) {
  if (seconds === null) return;
  state.scrubbing = false;
  audio.seek(seconds).catch(handleAudioError);
}

function openArchive() {
  if (!state.entered || archiveDialog.open) return;
  archiveDialog.showModal();
  state.archiveOpen = true;
  document.body.classList.add('is-archive-open');
  archiveButton.setAttribute('aria-expanded', 'true');
  archiveButtonAlt.setAttribute('aria-expanded', 'true');
  archiveClose.focus({ preventScroll: true });
}

function closeArchive() {
  if (archiveDialog.open) archiveDialog.close();
}

function toggleKeyPopover() {
  const isOpen = keyPopover.hidden;
  keyPopover.hidden = !isOpen;
  keysButton.setAttribute('aria-expanded', String(isOpen));
}

function closeKeyPopover() {
  if (keyPopover.hidden) return;
  keyPopover.hidden = true;
  keysButton.setAttribute('aria-expanded', 'false');
}

function handleGlobalKeydown(event) {
  if (event.defaultPrevented) return;
  if (archiveDialog.open) return;
  const target = event.target instanceof HTMLElement ? event.target : document.body;
  const isTyping = Boolean(target.closest('input, textarea, select, [contenteditable="true"]'));
  if (isTyping) return;
  if (!state.entered) return;

  const isButtonLike = Boolean(target.closest('button, a'));

  if (event.code === 'Space' || event.key === 'Enter') {
    if (isButtonLike) return;
    event.preventDefault();
    togglePlayback();
    closeKeyPopover();
    return;
  }

  if (event.key.toLowerCase() === 'm') {
    audio.setMuted(!audio.muted);
    resetVolumeUI();
    closeKeyPopover();
    return;
  }

  if (event.key.toLowerCase() === 'a') {
    event.preventDefault();
    openArchive();
    return;
  }

  if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
    if (target === seekBar) return;
    event.preventDefault();
    const direction = event.key === 'ArrowLeft' ? -1 : 1;
    const next = clamp(audio.getPosition() + direction * 5, 0, audio.getDuration());
    updateProgress(next * 1000);
    audio.seek(next).catch(handleAudioError);
    return;
  }

  if (/^[1-6]$/.test(event.key)) {
    selectTrack(Number(event.key) - 1);
    closeKeyPopover();
    return;
  }

  if (event.key === 'Escape') {
    closeKeyPopover();
  }
}

function bindEvents() {
  resetVolumeUI();

  enterButton.addEventListener('click', startExperience);
  audioRetry.addEventListener('click', retryAudioLink);

  signalList.addEventListener('click', (event) => {
    const button = event.target.closest('.signal');
    if (!button) return;
    selectTrack(Number(button.dataset.trackIndex));
  });

  archiveRowsHost.addEventListener('click', (event) => {
    const button = event.target.closest('.archive__row');
    if (!button) return;
    selectTrack(Number(button.dataset.trackIndex), { fromArchive: true });
  });

  archiveButton.addEventListener('click', openArchive);
  archiveButtonAlt.addEventListener('click', openArchive);
  archiveClose.addEventListener('click', closeArchive);

  archiveDialog.addEventListener('click', (event) => {
    if (event.target === archiveDialog) closeArchive();
  });

  archiveDialog.addEventListener('close', () => {
    state.archiveOpen = false;
    document.body.classList.remove('is-archive-open');
    archiveButton.setAttribute('aria-expanded', 'false');
    archiveButtonAlt.setAttribute('aria-expanded', 'false');
  });

  playButton.addEventListener('click', togglePlayback);
  markButton.addEventListener('click', togglePlayback);
  prevButton.addEventListener('click', () => stepTrack(-1));
  nextButton.addEventListener('click', () => stepTrack(1));

  muteButton.addEventListener('click', () => {
    audio.setMuted(!audio.muted);
    resetVolumeUI();
  });

  volumeSlider.addEventListener('input', (event) => {
    const value = Number(event.target.value) / 100;
    audio.setVolume(value);
    if (audio.muted && value > 0) {
      audio.setMuted(false);
    }
    resetVolumeUI();
  });

  seekBar.addEventListener('pointerdown', (event) => {
    if (!state.entered) return;
    event.preventDefault();
    seekBar.focus({ preventScroll: true });
    seekBar.setPointerCapture?.(event.pointerId);
    seekFromPointer(event);
    const move = (moveEvent) => {
      seekFromPointer(moveEvent);
    };
    const up = (upEvent) => {
      const rect = seekBar.getBoundingClientRect();
      const ratio = clamp((upEvent.clientX - rect.left) / rect.width, 0, 1);
      finishPointerSeek(ratio * audio.getDuration());
      seekBar.removeEventListener('pointermove', move);
      seekBar.removeEventListener('pointerup', up);
      seekBar.removeEventListener('pointercancel', cancel);
    };
    const cancel = () => {
      state.scrubbing = false;
      seekBar.removeEventListener('pointermove', move);
      seekBar.removeEventListener('pointerup', up);
      seekBar.removeEventListener('pointercancel', cancel);
    };
    seekBar.addEventListener('pointermove', move);
    seekBar.addEventListener('pointerup', up);
    seekBar.addEventListener('pointercancel', cancel);
  });

  seekBar.addEventListener('keydown', (event) => {
    if (!state.entered) return;
    let next = audio.getPosition();
    if (event.key === 'ArrowRight') next += 5;
    else if (event.key === 'ArrowLeft') next -= 5;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = audio.getDuration();
    else return;
    event.preventDefault();
    next = clamp(next, 0, audio.getDuration());
    updateProgress(next * 1000);
    audio.seek(next).catch(handleAudioError);
  });

  keysButton.addEventListener('click', (event) => {
    event.stopPropagation();
    toggleKeyPopover();
  });
  document.addEventListener('click', (event) => {
    if (!keyPopover.hidden && !event.target.closest('#keyPopover, #keysButton')) closeKeyPopover();
  });

  document.addEventListener('keydown', handleGlobalKeydown);

  window.addEventListener('resize', () => {
    window.clearTimeout(bindEvents.resizeTimer);
    bindEvents.resizeTimer = window.setTimeout(() => {
      drawWaveform(audio.getPeaks());
      scrollActiveSignal('auto');
    }, 140);
  });

  reduceMotionQuery.addEventListener?.('change', (event) => {
    field.reducedMotion = event.matches;
    if (event.matches) {
      field.stop();
      field.drawStatic();
    } else {
      field.start();
    }
  });

  if (document.visibilityState === 'visible') {
    field.resize();
  }
}

function startClock() {
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Shanghai',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23'
  });
  const paint = () => {
    clockLabel.textContent = `SHANGHAI / ${formatter.format(new Date())}`;
  };
  paint();
  window.setInterval(paint, 1000);
}

function startProgressLoop() {
  const loop = (timestamp) => {
    if (state.entered) {
      if (!state.scrubbing) {
        const positionMs = audio.getPosition() * 1000;
        updateProgress(positionMs);
      }

      if (timestamp - state.lastProgressPaint > 33) {
        const levels = audio.playing ? audio.getLevels() : { bass: 0, mid: 0, high: 0, energy: 0 };
        const motionLevels = reduceMotionQuery.matches
          ? { bass: 0, mid: 0, high: 0, energy: 0 }
          : levels;
        mark.style.setProperty('--bass', motionLevels.bass.toFixed(4));
        document.body.style.setProperty('--bass', motionLevels.bass.toFixed(4));
        document.body.style.setProperty('--energy', motionLevels.energy.toFixed(4));
        field.setLevels(motionLevels);
        state.lastProgressPaint = timestamp;
      }
    }
    window.requestAnimationFrame(loop);
  };
  window.requestAnimationFrame(loop);
}

function handleFileProtocol() {
  if (window.location.protocol !== 'file:') return false;
  gate.hidden = true;
  bootError.hidden = false;
  const title = $('h2', bootError);
  if (title) title.textContent = '请通过本地服务器打开这台仪器。';
  return true;
}

function init() {
  if (handleFileProtocol()) return;

  themeColorMeta = document.querySelector('meta[name="theme-color"]');
  buildSignalIndex();
  buildArchiveList();
  buildGateReadyTicks();
  renderTrack(state.currentIndex);
  bindEvents();
  startClock();
  startProgressLoop();

  if (document.fonts?.ready) {
    document.fonts.ready.then(() => field.syncCenter()).catch(() => {});
  }

  // Raw audio can be prefetched before the visitor presses ENTER.
  audio.prefetchRaw().catch((error) => {
    console.warn('[VCT] Audio prefetch unavailable.', error);
  });

  window.addEventListener('beforeunload', () => {
    field.destroy();
    audio.destroy();
  });
}

init();
