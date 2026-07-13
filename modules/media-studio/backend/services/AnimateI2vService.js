/**

 * Pipeline animation i2v : PNG → fond uni → ComfyUI LTX → clip MP4.

 */



const fs = require('fs');

const path = require('path');

const { hexToRgb, normalizeHex } = require('./ChromaColorService');

const ChromaCompositeService = require('./ChromaCompositeService');

const VideoProcessService = require('./VideoProcessService');



const DEFAULT_BG_HEX = '#E8E8E8';



class AnimateI2vService {

  constructor(comfyService, config = {}) {

    this.comfy = comfyService;

    this.config = config;

    this.composite = new ChromaCompositeService(config.composite || {});

    this.videoProcess = new VideoProcessService(config.video || {});

    this.clipsDir = config.clipsDir || null;

    this.defaultEngine = config.defaultEngine || 'ltx';

    this.backgroundColor = config.backgroundColor || DEFAULT_BG_HEX;

  }



  setClipsDir(dir) {

    this.clipsDir = dir;

    fs.mkdirSync(dir, { recursive: true });

  }



  resolveSourcePath(sourceFilename, mediaDir) {

    const base = path.basename(String(sourceFilename || ''));

    if (!base) throw new Error('sourceFilename requis.');

    const filePath = path.join(mediaDir, base);

    if (!fs.existsSync(filePath)) {

      throw new Error(`Fichier source introuvable: ${base}`);

    }

    return { filename: base, fullPath: filePath };

  }



  resolveBackgroundRgb(explicitHex) {

    const hex = normalizeHex(explicitHex) || normalizeHex(this.backgroundColor) || DEFAULT_BG_HEX;

    return { hex, rgb: hexToRgb(hex) };

  }



  /** Traduction légère FR→EN pour T5 (phrases longues d'abord). */

  frenchMotionToEnglish(text) {

    let out = String(text || '').trim();

    if (!out) return '';



    const phrases = [

      [/pisto(?:let|ler)\s+qui\s+tire(?:\s+une\s+balle?)?/gi, 'pistol firing a bullet with muzzle flash and recoil'],

      [/chargeur\s+se\s+vide(?:nt)?/gi, 'magazine progressively emptying, rounds disappearing'],

      [/boutons?(?:\s+sur\s+le\s+c[oô]t[eé])?\s+couliss(?:ent|e)/gi, 'side buttons sliding horizontally'],

      [/runes?\s+(?:qui\s+)?s'?illumin(?:ent|e)/gi, 'runes lighting up one by one with glow'],

      [/tire(?:\s+une)?\s+balle?/gi, 'fires a bullet'],

      [/chargeur/gi, 'magazine'],

      [/pisto(?:let|ler)/gi, 'pistol'],

      [/boutons?/gi, 'buttons'],

    ];

    phrases.forEach(([re, en]) => { out = out.replace(re, en); });

    return out.replace(/\s{2,}/g, ' ').trim();

  }



  /**

   * Prompt LTX : le mouvement utilisateur en premier (sinon LTX ignore le texte).

   */

  buildMotionPrompt(userPrompt, layerTitle) {

    const raw = String(userPrompt || '').trim();

    const title = String(layerTitle || '').trim();

    const motion = this.frenchMotionToEnglish(raw)

      || (title ? `${title} animated with clear visible motion` : 'clear visible motion on the subject');



    return [

      motion,

      'dynamic animation, visible movement over time, mechanical motion',

      'same object design and colors as input image',

      'plain uniform gray background remains still',

    ].join(', ');

  }



  async generateFromSourcePath(sourcePath, options = {}) {

    const userPrompt = String(options.prompt || '').trim();

    const prompt = this.buildMotionPrompt(userPrompt, options.layerTitle);

    const engine = String(options.engine || this.defaultEngine).toLowerCase();

    const sourceBuffer = fs.readFileSync(sourcePath);

    const bg = this.resolveBackgroundRgb(options.backgroundColor);



    const composite = this.composite.compositeOnChroma(sourceBuffer, bg.rgb, {

      maxDimension: options.maxDimension || this.config.maxDimension || 512,

      hardMatte: true,

      alphaThreshold: 200,

    });



    const tempFiles = [];



    try {

      const inputPng = this.videoProcess.writeTempFile(composite.buffer, '.png');

      tempFiles.push(inputPng);



      console.log('[media-studio] i2v prompt utilisateur:', userPrompt.slice(0, 200));

      console.log('[media-studio] i2v prompt LTX:', prompt.slice(0, 300));



      const gen = await this.comfy.generateI2vVideo(prompt, {

        engine,

        imagePath: inputPng,

        width: options.width || composite.width,

        height: options.height || composite.height,

        length: options.length,

        steps: options.steps,

        seed: options.seed,

        strength: options.strength,

        cfg: options.cfg,

        timeoutMs: options.timeoutMs || this.config.timeoutMs,

      });



      if (!this.clipsDir) throw new Error('Répertoire clips non configuré.');



      const rawExt = gen.ext || '.mp4';

      const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

      const clipFilename = `clip-${stamp}${rawExt}`;

      const clipPath = path.join(this.clipsDir, clipFilename);

      fs.writeFileSync(clipPath, gen.buffer);



      const duration = gen.duration || this.videoProcess.probeDuration(clipPath);



      return {

        filename: clipFilename,

        url: `/api/media-studio/clip/${clipFilename}`,

        user_prompt: userPrompt,

        prompt,

        ltx_prompt: prompt,

        engine: gen.engine || engine,

        background_color: bg.hex,

        width: composite.width,

        height: composite.height,

        duration,

        fps: gen.fps || 24,

        frame_count: gen.frameCount || null,

        seed: gen.seed,

        strength: gen.strength,

        cfg: gen.cfg,

        comfy_prompt_id: gen.promptId,

      };

    } finally {

      tempFiles.forEach((f) => this.videoProcess.safeUnlink(f));

    }

  }

}



module.exports = AnimateI2vService;


