/**
 * Client ComfyUI — génération d'images (SDXL Turbo, Flux Schnell GGUF).
 * ComfyUI Desktop utilise souvent un port dynamique (pas toujours 8188).
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const config = require('../config.json');

class ComfyUIService {
  constructor() {
    this.configuredUrl = (process.env.COMFYUI_URL || config.comfyui.baseUrl || '').replace(/\/$/, '');
    this.resolvedBaseUrl = null;
    this.models = config.comfyui.models || {};
    this.defaultModel = process.env.MEDIA_STUDIO_MODEL || config.comfyui.defaultModel || 'sdxl';
    this.defaults = this.getModelDefaults(this.defaultModel);
    this.timeoutMs = config.comfyui.timeoutMs || 300000;
    this.pollIntervalMs = config.comfyui.pollIntervalMs || 1500;
    this.i2vConfig = config.i2v || {};
    this.videoTimeoutMs = this.i2vConfig.timeoutMs || 900000;
  }

  getModelDefaults(modelKey) {
    const key = String(modelKey || this.defaultModel || 'sdxl').toLowerCase();
    if (key === 'ltx' || key === 'i2v') {
      return { ...(this.i2vConfig.ltx || {}), ...(this.models.ltx || {}) };
    }
    return this.models[key] || this.models.sdxl || this.models.flux || {};
  }

  listModels() {
    return Object.entries(this.models).map(([id, model]) => ({
      id,
      label: model.label || id,
      width: model.width,
      height: model.height,
    }));
  }

  resolveModelKey(modelKey) {
    const key = String(modelKey || this.defaultModel || 'sdxl').toLowerCase();
    if (key === 'ltx' || key === 'i2v') return key;
    if (!this.models[key]) {
      throw new Error(`Modèle inconnu: ${key}. Modèles disponibles: ${Object.keys(this.models).join(', ')}, ltx`);
    }
    return key;
  }

  round32(n) {
    return Math.max(32, Math.round(n / 32) * 32);
  }

  roundLength(n) {
    const v = Math.max(9, Math.round(n));
    const mod = v % 8;
    return mod === 1 ? v : v + (8 - mod) + 1;
  }

  get baseUrl() {
    return this.resolvedBaseUrl || this.configuredUrl;
  }

  async pingUrl(baseUrl) {
    try {
      const res = await fetch(`${baseUrl}/system_stats`, {
        method: 'GET',
        signal: AbortSignal.timeout(2500),
      });
      if (!res.ok) return false;
      const ct = res.headers.get('content-type') || '';
      if (!ct.includes('json')) return false;
      const data = await res.json();
      return data && typeof data === 'object' && Object.keys(data).length > 0;
    } catch {
      return false;
    }
  }

  getLocalListeningPorts() {
    try {
      const out = execSync('netstat -ano', { encoding: 'utf8', windowsHide: true });
      const ports = new Set();
      for (const line of out.split('\n')) {
        const m = line.match(/127\.0\.0\.1:(\d+)\s+.*LISTENING/);
        if (m) ports.add(parseInt(m[1], 10));
      }
      return [...ports].sort((a, b) => a - b);
    } catch {
      return [];
    }
  }

  async resolveBaseUrl(force = false) {
    if (!force && this.resolvedBaseUrl) return this.resolvedBaseUrl;

    const candidates = [];
    if (this.configuredUrl) candidates.push(this.configuredUrl);

    for (let port = 8188; port <= 8205; port += 1) {
      candidates.push(`http://127.0.0.1:${port}`);
    }

    for (const port of this.getLocalListeningPorts()) {
      candidates.push(`http://127.0.0.1:${port}`);
    }

    const seen = new Set();
    for (const url of candidates) {
      if (!url || seen.has(url)) continue;
      seen.add(url);
      if (await this.pingUrl(url)) {
        this.resolvedBaseUrl = url;
        return url;
      }
    }

    this.resolvedBaseUrl = null;
    return null;
  }

  buildFluxWorkflow(prompt, options = {}) {
    const modelDefaults = this.getModelDefaults('flux');
    const seed = options.seed ?? Math.floor(Math.random() * 2 ** 32);
    const width = options.width ?? modelDefaults.width;
    const height = options.height ?? modelDefaults.height;
    const steps = options.steps ?? modelDefaults.steps;
    const cfg = options.cfg ?? modelDefaults.cfg;
    const text = String(prompt || '').trim() || 'a beautiful landscape';

    return {
      '1': {
        inputs: { unet_name: modelDefaults.unet },
        class_type: 'UnetLoaderGGUF',
      },
      '2': {
        inputs: {
          clip_name1: modelDefaults.clipL,
          clip_name2: modelDefaults.t5,
          type: 'flux',
        },
        class_type: 'DualCLIPLoader',
      },
      '3': {
        inputs: { vae_name: modelDefaults.vae },
        class_type: 'VAELoader',
      },
      '4': {
        inputs: { width, height, batch_size: 1 },
        class_type: 'EmptySD3LatentImage',
      },
      '5': {
        inputs: {
          clip: ['2', 0],
          clip_l: text,
          t5xxl: text,
          guidance: 3.5,
        },
        class_type: 'CLIPTextEncodeFlux',
      },
      '6': {
        inputs: {
          clip: ['2', 0],
          clip_l: '',
          t5xxl: '',
          guidance: 3.5,
        },
        class_type: 'CLIPTextEncodeFlux',
      },
      '7': {
        inputs: {
          seed,
          steps,
          cfg,
          sampler_name: modelDefaults.sampler,
          scheduler: modelDefaults.scheduler,
          denoise: 1,
          model: ['1', 0],
          positive: ['5', 0],
          negative: ['6', 0],
          latent_image: ['4', 0],
        },
        class_type: 'KSampler',
      },
      '8': {
        inputs: { samples: ['7', 0], vae: ['3', 0] },
        class_type: 'VAEDecode',
      },
      '9': {
        inputs: { filename_prefix: 'gdri-media-studio-flux', images: ['8', 0] },
        class_type: 'SaveImage',
      },
      __meta: { model: 'flux', seedNode: '7', seed },
    };
  }

  buildSdxlWorkflow(prompt, options = {}) {
    const modelDefaults = this.getModelDefaults('sdxl');
    const seed = options.seed ?? Math.floor(Math.random() * 2 ** 32);
    const width = options.width ?? modelDefaults.width;
    const height = options.height ?? modelDefaults.height;
    const steps = options.steps ?? modelDefaults.steps;
    const cfg = options.cfg ?? modelDefaults.cfg;
    const text = String(prompt || '').trim() || 'a beautiful landscape';
    const negative = String(options.negativePrompt ?? modelDefaults.negativePrompt ?? '').trim();

    return {
      '1': {
        inputs: { ckpt_name: modelDefaults.checkpoint },
        class_type: 'CheckpointLoaderSimple',
      },
      '2': {
        inputs: { width, height, batch_size: 1 },
        class_type: 'EmptyLatentImage',
      },
      '3': {
        inputs: { text, clip: ['1', 1] },
        class_type: 'CLIPTextEncode',
      },
      '4': {
        inputs: { text: negative, clip: ['1', 1] },
        class_type: 'CLIPTextEncode',
      },
      '5': {
        inputs: {
          seed,
          steps,
          cfg,
          sampler_name: modelDefaults.sampler,
          scheduler: modelDefaults.scheduler,
          denoise: 1,
          model: ['1', 0],
          positive: ['3', 0],
          negative: ['4', 0],
          latent_image: ['2', 0],
        },
        class_type: 'KSampler',
      },
      '6': {
        inputs: { samples: ['5', 0], vae: ['1', 2] },
        class_type: 'VAEDecode',
      },
      '7': {
        inputs: { filename_prefix: 'gdri-media-studio-sdxl', images: ['6', 0] },
        class_type: 'SaveImage',
      },
      __meta: { model: 'sdxl', seedNode: '5', seed },
    };
  }

  async fetchObjectInfo(force = false) {
    if (!force && this._objectInfoCache) return this._objectInfoCache;
    const data = await this.request('/object_info', { method: 'GET' });
    this._objectInfoCache = data;
    return data;
  }

  async getNodeInputChoices(nodeType, inputName) {
    const info = await this.fetchObjectInfo();
    const node = info[nodeType];
    if (!node || !node.input || !node.input.required) return [];
    const field = node.input.required[inputName];
    if (!Array.isArray(field) || !Array.isArray(field[0])) return [];
    return field[0].filter((v) => typeof v === 'string');
  }

  getDefaultCheckpointsDir() {
    const local = process.env.LOCALAPPDATA || '';
    return path.join(local, 'Comfy-Desktop', 'ComfyUI-Shared', 'models', 'checkpoints');
  }

  async resolveLtxCheckpoint(configuredName) {
    const wanted = String(configuredName || this.i2vConfig.ltx?.checkpoint || 'ltx-video-2b-v0.9.1.safetensors');
    const list = await this.getNodeInputChoices('CheckpointLoaderSimple', 'ckpt_name');
    if (list.includes(wanted)) return wanted;
    const fuzzy = list.find((n) => /ltx/i.test(n));
    if (fuzzy) return fuzzy;

    const ckptDir = this.getDefaultCheckpointsDir();
    const onDisk = path.join(ckptDir, wanted);
    if (fs.existsSync(onDisk)) {
      throw new Error(
        `Modèle LTX trouvé sur disque (${wanted}) mais ComfyUI ne le voit pas. `
        + 'Redémarrez ComfyUI Desktop puis réessayez.'
      );
    }

    throw new Error(
      `Modèle LTX manquant : ${wanted}. `
      + `Installez-le dans ${ckptDir} puis redémarrez ComfyUI. `
      + 'Script : modules/media-studio/scripts/Install-LTX-I2V.ps1'
    );
  }

  async getI2vStatus() {
    const checkpoints = await this.getNodeInputChoices('CheckpointLoaderSimple', 'ckpt_name').catch(() => []);
    const configured = this.i2vConfig.ltx?.checkpoint || 'ltx-video-2b-v0.9.1.safetensors';
    const ckptDir = this.getDefaultCheckpointsDir();
    const onDisk = fs.existsSync(path.join(ckptDir, configured));
    let resolved = null;
    let error = null;
    try {
      resolved = await this.resolveLtxCheckpoint(configured);
    } catch (err) {
      error = err.message;
      resolved = null;
    }
    return {
      configured,
      resolved,
      checkpoints,
      onDisk,
      checkpointsDir: ckptDir,
      ready: !!resolved,
      error,
    };
  }

  buildLtxI2vWorkflow(prompt, options = {}) {
    const cfg = { ...this.getModelDefaults('ltx'), ...(this.i2vConfig.ltx || {}), ...options };
    const seed = options.seed ?? Math.floor(Math.random() * 2 ** 32);
    const width = this.round32(options.width ?? cfg.width ?? 512);
    const height = this.round32(options.height ?? cfg.height ?? 512);
    const length = this.roundLength(options.length ?? cfg.length ?? 49);
    const steps = options.steps ?? cfg.steps ?? 8;
    const cfgScale = options.cfg ?? cfg.cfg ?? 3;
    const strength = options.strength ?? cfg.strength ?? 0.72;
    const fps = options.frameRate ?? cfg.frameRate ?? 24;
    const text = String(prompt || '').trim() || 'subtle cinematic motion';
    const negative = String(cfg.negativePrompt || 'blurry, low quality, distorted, watermark, text, static, flicker');
    const textEncoder = options.textEncoder || cfg.textEncoder || 't5xxl_fp8_e4m3fn.safetensors';

    if (!options.imageName) {
      throw new Error('imageName requis pour LTX i2v.');
    }
    const checkpoint = options.checkpoint || cfg.checkpoint;
    if (!checkpoint) {
      throw new Error('Checkpoint LTX non configuré.');
    }

    return {
      '1': {
        inputs: { ckpt_name: checkpoint },
        class_type: 'CheckpointLoaderSimple',
      },
      '2': {
        inputs: {
          clip_name: textEncoder,
          type: 'ltxv',
          device: 'default',
        },
        class_type: 'CLIPLoader',
      },
      '3': {
        inputs: { image: options.imageName, upload: 'image' },
        class_type: 'LoadImage',
      },
      '4': {
        inputs: { clip: ['2', 0], text },
        class_type: 'CLIPTextEncode',
      },
      '5': {
        inputs: { clip: ['2', 0], text: negative },
        class_type: 'CLIPTextEncode',
      },
      '6': {
        inputs: {
          positive: ['4', 0],
          negative: ['5', 0],
          vae: ['1', 2],
          image: ['3', 0],
          width,
          height,
          length,
          batch_size: 1,
          strength,
        },
        class_type: 'LTXVImgToVideo',
      },
      '7': {
        inputs: {
          positive: ['6', 0],
          negative: ['6', 1],
          frame_rate: fps,
        },
        class_type: 'LTXVConditioning',
      },
      '8': {
        inputs: {
          steps,
          max_shift: cfg.schedulerMaxShift ?? 2.05,
          base_shift: cfg.schedulerBaseShift ?? 0.95,
          stretch: true,
          terminal: cfg.schedulerTerminal ?? 0.1,
          latent: ['6', 2],
        },
        class_type: 'LTXVScheduler',
      },
      '9': {
        inputs: { sampler_name: cfg.sampler || 'euler' },
        class_type: 'KSamplerSelect',
      },
      '10': {
        inputs: {
          model: ['1', 0],
          add_noise: true,
          noise_seed: seed,
          cfg: cfgScale,
          positive: ['7', 0],
          negative: ['7', 1],
          sampler: ['9', 0],
          sigmas: ['8', 0],
          latent_image: ['6', 2],
        },
        class_type: 'SamplerCustom',
      },
      '11': {
        inputs: { samples: ['10', 0], vae: ['1', 2] },
        class_type: 'VAEDecode',
      },
      '12': {
        inputs: { images: ['11', 0], fps },
        class_type: 'CreateVideo',
      },
      '13': {
        inputs: {
          video: ['12', 0],
          filename_prefix: 'gdri-i2v',
          format: 'auto',
          codec: 'auto',
        },
        class_type: 'SaveVideo',
      },
      __meta: {
        engine: 'ltx',
        seed,
        width,
        height,
        length,
        fps,
        strength,
        cfg: cfgScale,
        positivePrompt: text,
        outputNode: '13',
      },
    };
  }

  buildI2vWorkflow(prompt, options = {}) {
    const engine = String(options.engine || this.i2vConfig.defaultEngine || 'ltx').toLowerCase();
    if (engine === 'ltx') return this.buildLtxI2vWorkflow(prompt, options);
    throw new Error(`Moteur i2v inconnu: ${engine}. Utilisez "ltx".`);
  }

  buildWorkflow(prompt, options = {}) {
    const modelKey = this.resolveModelKey(options.model);
    if (modelKey === 'sdxl') return this.buildSdxlWorkflow(prompt, options);
    if (options.referenceImageName) return this.buildFluxImg2ImgWorkflow(prompt, options);
    return this.buildFluxWorkflow(prompt, options);
  }

  buildFluxImg2ImgWorkflow(prompt, options = {}) {
    const workflow = this.buildFluxWorkflow(prompt, options);
    const imgName = options.referenceImageName;
    const denoise = options.denoise ?? 0.72;
    if (!imgName) return workflow;

    workflow['10'] = {
      inputs: { image: imgName },
      class_type: 'LoadImage',
    };
    workflow['11'] = {
      inputs: { pixels: ['10', 0], vae: ['3', 0] },
      class_type: 'VAEEncode',
    };
    workflow['7'].inputs = {
      ...workflow['7'].inputs,
      latent_image: ['11', 0],
      denoise,
    };
    delete workflow['4'];
    return workflow;
  }

  async uploadImageToComfy(filePath) {
    const base = await this.resolveBaseUrl();
    if (!base) throw new Error('ComfyUI introuvable.');
    const buffer = fs.readFileSync(filePath);
    const filename = path.basename(filePath);
    const form = new FormData();
    form.append('image', new Blob([buffer]), filename);
    const res = await fetch(`${base}/upload/image`, {
      method: 'POST',
      body: form,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`ComfyUI upload: ${text.slice(0, 200)}`);
    }
    const data = await res.json();
    return data.name || filename;
  }

  stripWorkflowMeta(workflow) {
    const prompt = { ...workflow };
    delete prompt.__meta;
    return prompt;
  }

  async request(pathname, options = {}) {
    const base = await this.resolveBaseUrl();
    if (!base) {
      throw new Error('ComfyUI introuvable. Lancez ComfyUI Desktop (le serveur doit être démarré).');
    }
    const url = `${base}${pathname}`;
    const res = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`ComfyUI ${res.status}: ${text.slice(0, 300)}`);
    }
    const ct = res.headers.get('content-type') || '';
    if (ct.includes('application/json')) return res.json();
    return res.arrayBuffer();
  }

  async checkHealth() {
    const url = await this.resolveBaseUrl(true);
    if (!url) {
      return {
        ok: false,
        url: this.configuredUrl || 'auto',
        message: 'ComfyUI introuvable sur localhost. Ouvrez ComfyUI Desktop et attendez le chargement complet.',
      };
    }
    return { ok: true, url };
  }

  async queuePrompt(workflow) {
    const body = { prompt: workflow };
    const data = await this.request('/prompt', { method: 'POST', body: JSON.stringify(body) });
    if (!data.prompt_id) throw new Error('ComfyUI: prompt_id manquant');
    return data.prompt_id;
  }

  extractHistoryError(entry) {
    const status = entry && entry.status;
    if (!status || status.status_str !== 'error') return null;
    const messages = Array.isArray(status.messages) ? status.messages : [];
    for (const msg of messages) {
      if (!Array.isArray(msg) || msg[0] !== 'execution_error') continue;
      const payload = msg[1] || {};
      const node = payload.node_type ? ` (${payload.node_type})` : '';
      const detail = payload.exception_message || payload.exception_type || 'Erreur ComfyUI';
      return `ComfyUI${node}: ${String(detail).split('\n')[0]}`;
    }
    return 'ComfyUI: exécution échouée.';
  }

  async waitForOutput(promptId, timeoutMs) {
    const limit = timeoutMs || this.timeoutMs;
    const started = Date.now();
    while (Date.now() - started < limit) {
      const history = await this.request(`/history/${promptId}`, { method: 'GET' });
      const entry = history[promptId];
      if (entry) {
        const execError = this.extractHistoryError(entry);
        if (execError) throw new Error(execError);

        if (entry.outputs) {
          for (const nodeId of Object.keys(entry.outputs)) {
            const out = entry.outputs[nodeId];
            if (out.images && out.images.length) {
              return { kind: 'image', meta: out.images[0], nodeId };
            }
            if (out.videos && out.videos.length) {
              return { kind: 'video', meta: out.videos[0], nodeId };
            }
            if (out.gifs && out.gifs.length) {
              return { kind: 'gif', meta: out.gifs[0], nodeId };
            }
          }
        }

        if (entry.status && entry.status.completed && entry.status.status_str === 'success') {
          throw new Error('ComfyUI: génération terminée sans fichier de sortie.');
        }
      }
      await new Promise((r) => setTimeout(r, this.pollIntervalMs));
    }
    throw new Error('ComfyUI: délai dépassé (génération trop longue)');
  }

  async fetchMediaBuffer(fileMeta) {
    const params = new URLSearchParams({
      filename: fileMeta.filename,
      subfolder: fileMeta.subfolder || '',
      type: fileMeta.type || 'output',
    });
    const buf = await this.request(`/view?${params}`, { method: 'GET' });
    return Buffer.from(buf);
  }

  async fetchImageBuffer(imageMeta) {
    return this.fetchMediaBuffer(imageMeta);
  }

  inferMediaExt(fileMeta) {
    const name = String(fileMeta.filename || '').toLowerCase();
    if (name.endsWith('.mp4')) return '.mp4';
    if (name.endsWith('.mov')) return '.mov';
    if (name.endsWith('.webm')) return '.webm';
    if (name.endsWith('.gif')) return '.gif';
    if (name.endsWith('.webp')) return '.webp';
    if (name.endsWith('.png')) return '.png';
    return '.webp';
  }

  async generateI2vVideo(prompt, options = {}) {
    const health = await this.checkHealth();
    if (!health.ok) {
      throw new Error(health.message || 'ComfyUI indisponible. Lancez ComfyUI Desktop.');
    }

    if (!options.imagePath || !fs.existsSync(options.imagePath)) {
      throw new Error('imagePath requis pour i2v.');
    }

    const checkpoint = await this.resolveLtxCheckpoint(options.checkpoint);
    const imageName = await this.uploadImageToComfy(options.imagePath);
    const workflow = this.buildI2vWorkflow(prompt, { ...options, imageName, checkpoint });
    const meta = workflow.__meta || {};
    const promptPayload = this.stripWorkflowMeta(workflow);
    const promptId = await this.queuePrompt(promptPayload);
    const output = await this.waitForOutput(promptId, options.timeoutMs || this.videoTimeoutMs);
    const buffer = await this.fetchMediaBuffer(output.meta);
    const ext = this.inferMediaExt(output.meta);
    const fps = meta.fps || 24;
    const frameCount = meta.length || null;
    const duration = frameCount ? frameCount / fps : null;

    return {
      buffer,
      ext,
      output,
      promptId,
      seed: meta.seed,
      engine: meta.engine || options.engine || 'ltx',
      width: meta.width,
      height: meta.height,
      frameCount,
      fps,
      duration,
      strength: meta.strength,
      cfg: meta.cfg,
      ltxPrompt: meta.positivePrompt,
    };
  }

  async generateImage(prompt, options = {}) {
    const modelKey = this.resolveModelKey(options.model);
    const modelDefaults = this.getModelDefaults(modelKey);
    if (options.referenceImagePath && fs.existsSync(options.referenceImagePath)) {
      options.referenceImageName = await this.uploadImageToComfy(options.referenceImagePath);
    }
    const workflow = this.buildWorkflow(prompt, { ...options, model: modelKey });
    const meta = workflow.__meta || {};
    const promptPayload = this.stripWorkflowMeta(workflow);
    const promptId = await this.queuePrompt(promptPayload);
    const output = await this.waitForOutput(promptId);
    const buffer = await this.fetchMediaBuffer(output.meta);
    return {
      buffer,
      imageMeta: output.meta,
      promptId,
      seed: meta.seed,
      model: modelKey,
      width: options.width || modelDefaults.width,
      height: options.height || modelDefaults.height,
    };
  }

  saveToUploads(buffer, uploadsDir, prefix = 'img') {
    const dir = path.join(uploadsDir, 'media-studio');
    fs.mkdirSync(dir, { recursive: true });
    const filename = `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.png`;
    const fullPath = path.join(dir, filename);
    fs.writeFileSync(fullPath, buffer);
    return { filename, fullPath, url: `/api/media-studio/media/${filename}` };
  }
}

module.exports = ComfyUIService;
