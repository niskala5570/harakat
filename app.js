// Arabic Harakat Easy Input - Application logic

// List of Arabic diacritics
const DIACRITICS = new Set([
  '\u064b', // Fathatain
  '\u064c', // Dommatain
  '\u064d', // Kasratain
  '\u064e', // Fathah
  '\u064f', // Dommah
  '\u0650', // Kasrah
  '\u0651', // Shaddah (Tasydid)
  '\u0652', // Sukun (ring)
  '\u0653', // Maddah
  '\u0654', // Hamza Above
  '\u0655', // Hamza Below
  '\u0670', // Superscript Alef (Alef Dagger Above)
  '\u0656', // Subscript Alef (Alef Below)
  '\ufbc2', // Arabic Symbol Wasla Above
  '\u06df', // Small High Round Zero
  '\u06e0', // Small High Upright Rectangular Zero
  '\u06e1', // Sukun C (Small High Dotless Head of Khah)
]);

// Map to configure default key bindings
const DEFAULT_KEY_BINDINGS = {
  i: { name: 'Fathah', type: 'fathah', char: '\u064e' },
  k: { name: 'Kasrah', type: 'kasrah', char: '\u0650' },
  j: { name: 'Dommah', type: 'dommah', char: '\u064f' },
  l: { name: 'Sukun C', type: 'sukun_c', char: '\u06e1' },
  m: { name: 'Sukun Ring', type: 'sukun_ring', char: '\u0652' },
  u: { name: 'Alef Wasla', type: 'wasal', char: '\u0671' },
  y: { name: 'Wasla Di Atas', type: 'wasla_above', char: '\ufbc2' },
  h: { name: 'Alef Kecil Di Atas', type: 'alef_dagger', char: '\u0670' },
  b: { name: 'Alef Kecil Di Bawah', type: 'alef_below', char: '\u0656' },
  t: { name: 'Tatweel', type: 'tatweel', char: '\u0640' },
  p: { name: 'Tasydid', type: 'taysdid', char: '\u0651' }
};

// Application State
let state = {
  text: 'كَتَبَ ٱللَّهُ لَكُمْ',
  caretIndex: 0,
  keyBindings: { ...DEFAULT_KEY_BINDINGS },
  keyboardShortcutsEnabled: true,
  autoMoveDirection: 'forward', // 'forward', 'backward', 'none'
  renderingMode: 'connected', // 'connected', 'split'
  harakatModeEnabled: false, // Space bar skips characters
  wrapPreview: true, // Wrap by default
  previewSpacing: 0, // px
  fontSource: 'local', // 'google', 'local'
  googleFont: 'Readex Pro',
  localFont: 'JAWI Readex Pro',
  harakahColor: '#f97316', // Orange-500
  theme: 'dark'
};

// DOM Elements
let rawInputEl, previewEl, shortcutToggleEl, autoMoveEl, renderingModeEl, harakatModeToggleEl, wrapPreviewToggleEl, copyBtnEl, themeToggleEl, keyConfigContainerEl;
let previewSpacingEl, previewSpacingValueEl, fontSourceEl, googleFontSelectEl, localFontInputEl, googleFontContainerEl, localFontContainerEl;

// Parse text into clusters
function parseTextToClusters(text) {
  const clusters = [];
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (DIACRITICS.has(char)) {
      if (clusters.length > 0) {
        clusters[clusters.length - 1].diacritics.push(char);
      } else {
        clusters.push({ base: char, diacritics: [] });
      }
    } else {
      clusters.push({ base: char, diacritics: [] });
    }
  }
  return clusters;
}

// Convert clusters back to text
function clustersToText(clusters) {
  return clusters.map(c => {
    const sortedDiacritics = [...c.diacritics].sort((a, b) => {
      if (a === '\u0651') return -1;
      if (b === '\u0651') return 1;
      return 0;
    });
    return c.base + sortedDiacritics.join('');
  }).join('');
}

// Map raw character index to cluster index
function getClusterIndexFromRawIndex(text, rawIndex) {
  let clusterIdx = 0;
  for (let i = 0; i < Math.min(rawIndex, text.length); i++) {
    if (!DIACRITICS.has(text[i])) {
      clusterIdx++;
    }
  }
  return clusterIdx;
}

// Map cluster index back to raw index (placing after all diacritics of the previous cluster)
function getRawIndexFromClusterIndex(text, clusterIndex) {
  if (clusterIndex <= 0) return 0;
  let clusterCount = 0;
  for (let i = 0; i < text.length; i++) {
    if (!DIACRITICS.has(text[i])) {
      if (clusterCount === clusterIndex) {
        return i;
      }
      clusterCount++;
    }
  }
  return text.length;
}

// Update the custom colored preview container
function renderPreview() {
  const clusters = parseTextToClusters(state.text);

  // Remove old caret overlay if it exists
  const oldCaret = previewEl.querySelector('.caret-overlay');
  if (oldCaret) oldCaret.remove();

  // Remove old text content (but not the caret overlay we might re-add)
  const oldText = previewEl.querySelector('.preview-text');
  if (oldText) oldText.remove();

  // Handle wrap class mapping based on setting
  if (state.wrapPreview) {
    previewEl.classList.remove('whitespace-nowrap', 'overflow-x-auto');
    previewEl.classList.add('whitespace-normal', 'break-words');
  } else {
    previewEl.classList.add('whitespace-nowrap', 'overflow-x-auto');
    previewEl.classList.remove('whitespace-normal', 'break-words');
  }

  // If text is completely empty, draw a standalone caret
  if (clusters.length === 0) {
    previewEl.innerHTML = '';
    const caret = document.createElement('span');
    caret.className = 'custom-caret';
    caret.style.backgroundColor = state.harakahColor;
    previewEl.appendChild(caret);
    return;
  }

  // --- Layer 1: Text (no caret classes, no position changes) ---
  const textLayer = document.createElement('div');
  textLayer.className = 'preview-text';

  clusters.forEach((cluster, idx) => {
    const clusterSpan = document.createElement('span');
    if (state.renderingMode === 'split') {
      clusterSpan.className = 'inline-block select-none cursor-pointer hover:bg-neutral-200 dark:hover:bg-neutral-800 rounded px-0.5 transition-colors duration-150';
    } else {
      // Pure inline — no borders, no position, no margins. Preserves Arabic shaping.
      clusterSpan.className = 'select-none cursor-pointer';
      clusterSpan.style.display = 'inline';
    }
    clusterSpan.dataset.index = idx;

    // Base character
    const baseSpan = document.createElement('span');
    baseSpan.textContent = cluster.base;
    baseSpan.className = 'text-neutral-900 dark:text-neutral-100';
    clusterSpan.appendChild(baseSpan);

    // Diacritics
    cluster.diacritics.forEach(diacritic => {
      const diacriticSpan = document.createElement('span');
      diacriticSpan.textContent = diacritic;
      diacriticSpan.className = 'harakah';
      diacriticSpan.style.color = state.harakahColor;
      clusterSpan.appendChild(diacriticSpan);
    });

    clusterSpan.addEventListener('click', () => {
      state.caretIndex = idx + 1;
      updateRawCaret();
      renderPreview();
    });

    textLayer.appendChild(clusterSpan);
  });

  previewEl.appendChild(textLayer);

  // --- Layer 2: Caret overlay (separate, absolutely positioned) ---
  requestAnimationFrame(() => {
    positionCaretOverlay(clusters);
  });
}

// Position a separate caret element by measuring text span positions
function positionCaretOverlay(clusters) {
  // Remove any existing caret overlay
  const existing = previewEl.querySelector('.caret-overlay');
  if (existing) existing.remove();

  if (clusters.length === 0) return;

  const previewRect = previewEl.getBoundingClientRect();
  let caretX, caretTop, caretHeight;

  if (state.caretIndex === 0) {
    // Before the first cluster — in RTL, this is the RIGHT edge of the first span
    const firstSpan = previewEl.querySelector('[data-index="0"]');
    if (!firstSpan) return;
    const rect = firstSpan.getBoundingClientRect();
    caretX = rect.right - previewRect.left + previewEl.scrollLeft;
    caretTop = rect.top - previewRect.top;
    caretHeight = rect.height;
  } else if (state.caretIndex >= clusters.length) {
    // After the last cluster — in RTL, this is the LEFT edge of the last span
    const lastSpan = previewEl.querySelector(`[data-index="${clusters.length - 1}"]`);
    if (!lastSpan) return;
    const rect = lastSpan.getBoundingClientRect();
    caretX = rect.left - previewRect.left + previewEl.scrollLeft;
    caretTop = rect.top - previewRect.top;
    caretHeight = rect.height;
  } else {
    // Between clusters — in RTL, LEFT edge of the cluster before the caret
    const span = previewEl.querySelector(`[data-index="${state.caretIndex - 1}"]`);
    if (!span) return;
    const rect = span.getBoundingClientRect();
    caretX = rect.left - previewRect.left + previewEl.scrollLeft;
    caretTop = rect.top - previewRect.top;
    caretHeight = rect.height;
  }

  const caretEl = document.createElement('div');
  caretEl.className = 'caret-overlay';
  Object.assign(caretEl.style, {
    position: 'absolute',
    left: `${caretX - 1}px`,
    top: `${caretTop + caretHeight * 0.1}px`,
    width: '2px',
    height: `${caretHeight * 0.8}px`,
    backgroundColor: state.harakahColor,
    pointerEvents: 'none',
    zIndex: '10',
    animation: 'blink 1s infinite'
  });

  previewEl.appendChild(caretEl);
}

// Sync caret back to raw text area
function updateRawCaret() {
  const rawIdx = getRawIndexFromClusterIndex(state.text, state.caretIndex);
  rawInputEl.setSelectionRange(rawIdx, rawIdx);
}

// Set caret position in state based on raw input's selection start
function syncCaretFromRaw() {
  state.caretIndex = getClusterIndexFromRawIndex(state.text, rawInputEl.selectionStart);
  renderPreview();
}

// Handle Harakah Injection
function handleHarakahInjection(type) {
  const clusters = parseTextToClusters(state.text);

  // Find character for this binding
  let binding = null;
  for (let key in state.keyBindings) {
    if (state.keyBindings[key].type === type) {
      binding = state.keyBindings[key];
      break;
    }
  }
  if (!binding) return;
  const char = binding.char;

  if (!DIACRITICS.has(char)) {
    // Base character like Tatweel (U+0640) or Alef Wasla (U+0671)
    if (char === '\u0671') {
      const activeIdx = state.caretIndex > 0 ? state.caretIndex - 1 : 0;
      if (clusters.length > 0) {
        const activeCluster = clusters[activeIdx];
        if (['ا', 'أ', 'إ', 'آ'].includes(activeCluster.base)) {
          activeCluster.base = '\u0671'; // Replace Alef with Alef Wasla
        } else {
          clusters.splice(state.caretIndex, 0, { base: '\u0671', diacritics: [] });
        }
      } else {
        clusters.push({ base: '\u0671', diacritics: [] });
      }
    } else {
      // Standard base character insertion
      clusters.splice(state.caretIndex, 0, { base: char, diacritics: [] });
    }
    state.text = clustersToText(clusters);
    advanceCaret(clusters.length);
  } else {
    // Apply diacritic to the active cluster
    const activeIdx = state.caretIndex > 0 ? state.caretIndex - 1 : 0;

    if (clusters.length > 0) {
      applyHarakahToCluster(clusters[activeIdx], type, char);
      state.text = clustersToText(clusters);
      if (char !== '\u0651') {
        advanceCaret(clusters.length);
      }
    }
  }

  rawInputEl.value = state.text;
  updateRawCaret();
  renderPreview();
}

// Core rules for adding or upgrading a diacritic
function applyHarakahToCluster(cluster, type, char) {
  const map = {
    fathah: { single: '\u064e', double: '\u064b' },
    kasrah: { single: '\u0650', double: '\u064d' },
    dommah: { single: '\u064f', double: '\u064c' }
  };

  const target = map[type];
  if (target && target.double) {
    const singleIdx = cluster.diacritics.indexOf(target.single);
    const doubleIdx = cluster.diacritics.indexOf(target.double);
    if (singleIdx !== -1) {
      // Upgrade to double
      cluster.diacritics[singleIdx] = target.double;
    } else if (doubleIdx !== -1) {
      // Toggle back to single
      cluster.diacritics[doubleIdx] = target.single;
    } else {
      // Add single
      cluster.diacritics.push(target.single);
    }
  } else {
    // Clear other sukun types if applicable
    if (type === 'sukun_c' || type === 'sukun_ring') {
      const otherSukun = type === 'sukun_c' ? '\u0652' : '\u06e1';
      const otherIdx = cluster.diacritics.indexOf(otherSukun);
      if (otherIdx !== -1) {
        cluster.diacritics.splice(otherIdx, 1);
      }
    }

    const idx = cluster.diacritics.indexOf(char);
    if (idx !== -1) {
      // Toggle off
      cluster.diacritics.splice(idx, 1);
    } else {
      // Toggle on
      cluster.diacritics.push(char);
    }
  }
}

// Move caret according to direction and cycle configuration, skipping spaces at word boundaries
function advanceCaret(totalClusters) {
  if (state.autoMoveDirection === 'none') return;
  const clusters = parseTextToClusters(state.text);

  // Move first time
  if (state.autoMoveDirection === 'forward') {
    state.caretIndex++;
    if (state.caretIndex > totalClusters) {
      state.caretIndex = 0; // Cycle back to start
    }
  } else if (state.autoMoveDirection === 'backward') {
    state.caretIndex--;
    if (state.caretIndex < 0) {
      state.caretIndex = totalClusters; // Cycle to end
    }
  }

  // If the active character (before the caret) is a space, move a second time to skip past it
  if (state.caretIndex > 0 && state.caretIndex <= totalClusters) {
    const activeCluster = clusters[state.caretIndex - 1];
    if (activeCluster && (activeCluster.base === ' ' || activeCluster.base === '\u00a0')) {
      if (state.autoMoveDirection === 'forward') {
        state.caretIndex++;
        if (state.caretIndex > totalClusters) {
          state.caretIndex = 0;
        }
      } else if (state.autoMoveDirection === 'backward') {
        state.caretIndex--;
        if (state.caretIndex < 0) {
          state.caretIndex = totalClusters;
        }
      }
    }
  }
}

// Theme setup and toggling
function initTheme() {
  const savedTheme = localStorage.getItem('theme') || 'dark';
  state.theme = savedTheme;
  updateThemeUI();
}

// Update Theme UI
function updateThemeUI() {
  if (state.theme === 'dark') {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
  localStorage.setItem('theme', state.theme);
}

// Save & load settings
function saveSettings() {
  localStorage.setItem('harakat_settings', JSON.stringify({
    keyBindings: state.keyBindings,
    keyboardShortcutsEnabled: state.keyboardShortcutsEnabled,
    autoMoveDirection: state.autoMoveDirection,
    renderingMode: state.renderingMode,
    harakatModeEnabled: state.harakatModeEnabled,
    wrapPreview: state.wrapPreview,
    previewSpacing: state.previewSpacing,
    fontSource: state.fontSource,
    googleFont: state.googleFont,
    localFont: state.localFont,
    harakahColor: state.harakahColor
  }));
}

// Load settings
function loadSettings() {
  const saved = localStorage.getItem('harakat_settings');
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      state.keyBindings = parsed.keyBindings || { ...DEFAULT_KEY_BINDINGS };
      
      // Ensure all current defaults are present in loaded settings
      Object.keys(DEFAULT_KEY_BINDINGS).forEach(k => {
        const found = Object.values(state.keyBindings).some(b => b.type === DEFAULT_KEY_BINDINGS[k].type);
        if (!found) {
          // If the key is not already bound, bind it to default key
          if (!state.keyBindings[k]) {
            state.keyBindings[k] = DEFAULT_KEY_BINDINGS[k];
          } else {
            // Find another key that is free
            const letters = 'abcdefghijklmnopqrstuvwxyz'.split('');
            for (let letter of letters) {
              if (!state.keyBindings[letter]) {
                state.keyBindings[letter] = DEFAULT_KEY_BINDINGS[k];
                break;
              }
            }
          }
        }
      });

      state.keyboardShortcutsEnabled = parsed.keyboardShortcutsEnabled !== false;
      state.autoMoveDirection = parsed.autoMoveDirection || 'forward';
      state.renderingMode = parsed.renderingMode || 'connected';
      state.harakatModeEnabled = parsed.harakatModeEnabled === true;
      state.wrapPreview = parsed.wrapPreview !== false;
      state.previewSpacing = parsed.previewSpacing || 0;
      state.fontSource = parsed.fontSource || 'local';
      state.googleFont = parsed.googleFont || 'Readex Pro';
      state.localFont = parsed.localFont || 'JAWI Readex Pro';
      state.harakahColor = parsed.harakahColor || '#f97316';
    } catch (e) {
      console.error("Error loading settings", e);
    }
  }

  // Register characters of all loaded custom bindings into the DIACRITICS set
  Object.keys(state.keyBindings).forEach(k => {
    const binding = state.keyBindings[k];
    if (binding.char !== '\u0640' && binding.char !== '\u0671') {
      DIACRITICS.add(binding.char);
    }
  });
}

// Dynamically load Google Font
function loadGoogleFont(fontName) {
  const fontId = 'dynamic-google-font';
  let link = document.getElementById(fontId);
  if (!link) {
    link = document.createElement('link');
    link.id = fontId;
    link.rel = 'stylesheet';
    document.head.appendChild(link);
  }
  const formattedName = fontName.replace(/\s+/g, '+');
  link.href = `https://fonts.googleapis.com/css2?family=${formattedName}:wght@300;400;500;700&display=swap`;
}

// Update font rendering based on selection
function updateFont() {
  if (state.fontSource === 'google') {
    loadGoogleFont(state.googleFont);
    previewEl.style.fontFamily = `"${state.googleFont}", "Readex Pro", "Inter", sans-serif`;
  } else {
    previewEl.style.fontFamily = `"${state.localFont}", "Readex Pro", "Inter", sans-serif`;
  }
}

// Update spacing/kerning on preview element
function updateSpacing() {
  previewEl.style.letterSpacing = `${state.previewSpacing}px`;
}

// Render the key binding setup form
function renderKeyConfig() {
  keyConfigContainerEl.innerHTML = '';
  Object.keys(state.keyBindings).forEach(key => {
    const binding = state.keyBindings[key];
    const row = document.createElement('div');
    row.className = 'flex items-center justify-between gap-2 p-2 bg-neutral-100 dark:bg-neutral-805 rounded border border-neutral-200 dark:border-neutral-800';

    row.innerHTML = `
      <div class="flex items-center gap-2 flex-grow min-w-0">
        <span class="text-sm font-semibold text-neutral-700 dark:text-neutral-300 truncate" title="${binding.name}">${binding.name}</span>
        <span class="text-xs bg-orange-100 dark:bg-orange-950 text-orange-600 dark:text-orange-400 px-1.5 py-0.5 rounded font-mono shrink-0">${binding.char}</span>
      </div>
      <div class="flex items-center gap-1 shrink-0">
        <input 
          type="text" 
          value="${key}" 
          maxlength="1"
          class="w-10 text-center font-mono py-1 rounded bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 text-neutral-800 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-orange-500"
          data-binding-type="${binding.type}"
          title="Tekan kekunci untuk menukar"
        />
        <button 
          class="delete-binding-btn p-1 text-neutral-400 hover:text-red-500 transition-colors"
          data-binding-type="${binding.type}"
          title="Padam pintasan ini"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>
    `;

    // Listen to key changes
    const input = row.querySelector('input');
    input.addEventListener('keydown', (e) => {
      e.preventDefault();
      const newKey = e.key.toLowerCase();

      // Allow only letters or special characters (ignore modifier keys)
      if (newKey.length === 1) {
        // Swap or assign
        const oldKey = Object.keys(state.keyBindings).find(k => k === newKey);
        if (oldKey) {
          // If already mapped to something else, clear it
          delete state.keyBindings[oldKey];
        }

        // Find existing binding to update
        const type = input.dataset.bindingType;
        const currentKey = Object.keys(state.keyBindings).find(k => state.keyBindings[k].type === type);
        const savedBinding = state.keyBindings[currentKey];

        delete state.keyBindings[currentKey];
        state.keyBindings[newKey] = savedBinding;

        saveSettings();
        renderKeyConfig();
        updateVirtualButtons();
      }
    });

    const deleteBtn = row.querySelector('.delete-binding-btn');
    deleteBtn.addEventListener('click', () => {
      const type = deleteBtn.dataset.bindingType;
      const currentKey = Object.keys(state.keyBindings).find(k => state.keyBindings[k].type === type);
      if (currentKey) {
        delete state.keyBindings[currentKey];
        saveSettings();
        renderKeyConfig();
        updateVirtualButtons();
      }
    });

    keyConfigContainerEl.appendChild(row);
  });
}

function updateVirtualButtons() {
  const container = document.getElementById('virtual-buttons');
  container.innerHTML = '';

  // Render virtual buttons based on keyBindings
  Object.keys(state.keyBindings).forEach(key => {
    const binding = state.keyBindings[key];
    const btn = document.createElement('button');
    btn.className = 'flex flex-col items-center justify-center p-3 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 hover:bg-neutral-50 dark:hover:bg-neutral-850 hover:border-orange-500 dark:hover:border-orange-500 transition-all duration-200 shadow-sm active:scale-95 group';
    btn.innerHTML = `
      <span class="text-2xl font-semibold font-arabic mb-1 text-neutral-800 dark:text-neutral-150">${binding.char}</span>
      <span class="text-xs text-neutral-500 dark:text-neutral-400 group-hover:text-orange-500 font-medium">${binding.name}</span>
      <span class="text-[10px] bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 px-1 py-0.2 rounded font-mono uppercase mt-1.5 border border-neutral-200 dark:border-neutral-750">${key}</span>
    `;
    btn.addEventListener('click', () => {
      handleHarakahInjection(binding.type);
    });
    container.appendChild(btn);
  });
}

// Initialise Events & DOM
document.addEventListener('DOMContentLoaded', () => {
  rawInputEl = document.getElementById('raw-input');
  previewEl = document.getElementById('preview');
  shortcutToggleEl = document.getElementById('shortcut-toggle');
  autoMoveEl = document.getElementById('auto-move');
  renderingModeEl = document.getElementById('rendering-mode');
  harakatModeToggleEl = document.getElementById('harakat-mode-toggle');
  wrapPreviewToggleEl = document.getElementById('wrap-preview-toggle');
  copyBtnEl = document.getElementById('copy-btn');
  themeToggleEl = document.getElementById('theme-toggle');
  keyConfigContainerEl = document.getElementById('key-config-container');
  const colorPickerEl = document.getElementById('color-picker');
  const decreaseFontEl = document.getElementById('decrease-font');
  const increaseFontEl = document.getElementById('increase-font');
  previewSpacingEl = document.getElementById('preview-spacing');
  previewSpacingValueEl = document.getElementById('preview-spacing-value');
  fontSourceEl = document.getElementById('font-source');
  googleFontSelectEl = document.getElementById('google-font-select');
  localFontInputEl = document.getElementById('local-font-input');
  googleFontContainerEl = document.getElementById('google-font-container');
  localFontContainerEl = document.getElementById('local-font-container');

  const newCharInput = document.getElementById('new-char-input');
  const newNameInput = document.getElementById('new-name-input');
  const newKeyInput = document.getElementById('new-key-input');
  const addBindingBtn = document.getElementById('add-binding-btn');

  loadSettings();
  initTheme();

  // Set initial element values
  rawInputEl.value = state.text;
  shortcutToggleEl.checked = state.keyboardShortcutsEnabled;
  autoMoveEl.value = state.autoMoveDirection;
  renderingModeEl.value = state.renderingMode;
  harakatModeToggleEl.checked = state.harakatModeEnabled;
  wrapPreviewToggleEl.checked = state.wrapPreview;
  previewSpacingEl.value = state.previewSpacing;
  previewSpacingValueEl.textContent = `${state.previewSpacing}px`;
  fontSourceEl.value = state.fontSource;
  googleFontSelectEl.value = state.googleFont;
  localFontInputEl.value = state.localFont;
  colorPickerEl.value = state.harakahColor;

  // Toggle visible font options containers
  if (state.fontSource === 'google') {
    googleFontContainerEl.classList.remove('hidden');
    localFontContainerEl.classList.add('hidden');
  } else {
    googleFontContainerEl.classList.add('hidden');
    localFontContainerEl.classList.remove('hidden');
  }

  updateFont();
  updateSpacing();

  state.caretIndex = getClusterIndexFromRawIndex(state.text, rawInputEl.selectionStart);

  // Event listeners
  rawInputEl.addEventListener('input', (e) => {
    state.text = e.target.value;
    syncCaretFromRaw();
  });

  rawInputEl.addEventListener('click', syncCaretFromRaw);
  rawInputEl.addEventListener('keyup', (e) => {
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(e.key)) {
      syncCaretFromRaw();
    }
  });

  // Handle keyboard shortcut mapping
  rawInputEl.addEventListener('keydown', (e) => {
    // Harakat input mode: space bar skips character instead of typing space
    if (state.harakatModeEnabled && e.key === ' ') {
      e.preventDefault();
      const clusters = parseTextToClusters(state.text);
      advanceCaret(clusters.length);
      updateRawCaret();
      renderPreview();
      return;
    }

    if (!state.keyboardShortcutsEnabled) return;

    const pressedKey = e.key.toLowerCase();
    if (state.keyBindings[pressedKey]) {
      e.preventDefault();
      handleHarakahInjection(state.keyBindings[pressedKey].type);
    }
  });

  // Configuration changes
  shortcutToggleEl.addEventListener('change', (e) => {
    state.keyboardShortcutsEnabled = e.target.checked;
    saveSettings();
  });

  autoMoveEl.addEventListener('change', (e) => {
    state.autoMoveDirection = e.target.value;
    saveSettings();
  });

  renderingModeEl.addEventListener('change', (e) => {
    state.renderingMode = e.target.value;
    saveSettings();
    renderPreview();
  });

  harakatModeToggleEl.addEventListener('change', (e) => {
    state.harakatModeEnabled = e.target.checked;
    saveSettings();
  });

  wrapPreviewToggleEl.addEventListener('change', (e) => {
    state.wrapPreview = e.target.checked;
    saveSettings();
    renderPreview();
  });

  previewSpacingEl.addEventListener('input', (e) => {
    state.previewSpacing = parseInt(e.target.value);
    previewSpacingValueEl.textContent = `${state.previewSpacing}px`;
    saveSettings();
    updateSpacing();
  });

  fontSourceEl.addEventListener('change', (e) => {
    state.fontSource = e.target.value;
    if (state.fontSource === 'google') {
      googleFontContainerEl.classList.remove('hidden');
      localFontContainerEl.classList.add('hidden');
    } else {
      googleFontContainerEl.classList.add('hidden');
      localFontContainerEl.classList.remove('hidden');
    }
    saveSettings();
    updateFont();
  });

  googleFontSelectEl.addEventListener('change', (e) => {
    state.googleFont = e.target.value;
    saveSettings();
    updateFont();
  });

  localFontInputEl.addEventListener('input', (e) => {
    state.localFont = e.target.value;
    saveSettings();
    updateFont();
  });

  colorPickerEl.addEventListener('input', (e) => {
    state.harakahColor = e.target.value;
    saveSettings();
    renderPreview();
    updateVirtualButtons();
  });

  // Key bind detection for new shortcut
  newKeyInput.addEventListener('keydown', (e) => {
    e.preventDefault();
    const pressed = e.key.toLowerCase();
    if (pressed.length === 1) {
      newKeyInput.value = pressed;
    }
  });

  // Adding new custom key binding
  addBindingBtn.addEventListener('click', () => {
    const char = newCharInput.value.trim();
    const name = newNameInput.value.trim();
    const key = newKeyInput.value.trim();

    if (!char || !name || !key) {
      alert('Sila isi semua ruangan (Simbol, Nama Pintasan, dan Kekunci)!');
      return;
    }

    if (state.keyBindings[key]) {
      if (!confirm(`Kekunci "${key}" telah digunakan untuk "${state.keyBindings[key].name}". Tukar?`)) {
        return;
      }
    }

    const type = 'custom_' + Date.now();
    
    if (char !== '\u0640' && char !== '\u0671') {
      DIACRITICS.add(char);
    }

    state.keyBindings[key] = {
      name: name,
      type: type,
      char: char
    };

    saveSettings();
    renderKeyConfig();
    updateVirtualButtons();

    newCharInput.value = '';
    newNameInput.value = '';
    newKeyInput.value = '';
  });

  // Theme Toggle
  themeToggleEl.addEventListener('click', () => {
    state.theme = state.theme === 'dark' ? 'light' : 'dark';
    updateThemeUI();
  });

  // Font sizing
  let fontSize = 3.5; // rem
  decreaseFontEl.addEventListener('click', () => {
    if (fontSize > 1.5) {
      fontSize -= 0.5;
      previewEl.style.fontSize = `${fontSize}rem`;
    }
  });
  increaseFontEl.addEventListener('click', () => {
    if (fontSize < 6) {
      fontSize += 0.5;
      previewEl.style.fontSize = `${fontSize}rem`;
    }
  });

  // Clipboard copy
  copyBtnEl.addEventListener('click', () => {
    navigator.clipboard.writeText(state.text).then(() => {
      const originalText = copyBtnEl.innerHTML;
      copyBtnEl.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
        </svg>
        Disalin!
      `;
      copyBtnEl.classList.remove('bg-orange-500', 'hover:bg-orange-600');
      copyBtnEl.classList.add('bg-green-600', 'hover:bg-green-700');

      setTimeout(() => {
        copyBtnEl.innerHTML = originalText;
        copyBtnEl.classList.remove('bg-green-600', 'hover:bg-green-700');
        copyBtnEl.classList.add('bg-orange-500', 'hover:bg-orange-600');
      }, 2000);
    });
  });

  // Initial render
  renderPreview();
  renderKeyConfig();
  updateVirtualButtons();
});
