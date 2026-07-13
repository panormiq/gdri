/**
 * Post-traitement vidéo — chroma key via ffmpeg, métadonnées.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync, spawnSync } = require('child_process');

function hexToFfmpegColor(hex) {
  const h = String(hex || '#FF00FF').replace('#', '').trim();
  if (h.length !== 6) return '0xFF00FF';
  return `0x${h.toUpperCase()}`;
}

class VideoProcessService {
  constructor(config = {}) {
    this.ffmpegPath = config.ffmpegPath || process.env.FFMPEG_PATH || null;
    this.colorkeySimilarity = config.colorkeySimilarity ?? 0.18;
    this.colorkeyBlend = config.colorkeyBlend ?? 0.06;
  }

  findFfmpeg() {
    if (this.ffmpegPath && fs.existsSync(this.ffmpegPath)) return this.ffmpegPath;

    const candidates = [
      process.env.FFMPEG_PATH,
      'ffmpeg',
      path.join(process.env.LOCALAPPDATA || '', 'Microsoft', 'WinGet', 'Links', 'ffmpeg.exe'),
      'C:\\ffmpeg\\bin\\ffmpeg.exe',
      'C:\\Program Files\\ffmpeg\\bin\\ffmpeg.exe',
      'C:\\Program Files (x86)\\ffmpeg\\bin\\ffmpeg.exe',
    ].filter(Boolean);

    const wingetRoot = path.join(process.env.LOCALAPPDATA || '', 'Microsoft', 'WinGet', 'Packages');
    if (fs.existsSync(wingetRoot)) {
      try {
        const dirs = fs.readdirSync(wingetRoot, { withFileTypes: true });
        dirs.forEach((entry) => {
          if (!entry.isDirectory() || !/ffmpeg/i.test(entry.name)) return;
          const bin = path.join(wingetRoot, entry.name, 'ffmpeg-8.1.2-full_build', 'bin', 'ffmpeg.exe');
          const altBin = path.join(wingetRoot, entry.name, 'bin', 'ffmpeg.exe');
          candidates.push(bin, altBin);
          try {
            const sub = fs.readdirSync(path.join(wingetRoot, entry.name), { withFileTypes: true });
            sub.forEach((subEntry) => {
              if (!subEntry.isDirectory() || !/ffmpeg/i.test(subEntry.name)) return;
              candidates.push(path.join(wingetRoot, entry.name, subEntry.name, 'bin', 'ffmpeg.exe'));
            });
          } catch { /* ignore */ }
        });
      } catch { /* ignore */ }
    }

    const seen = new Set();
    for (const cmd of candidates) {
      if (!cmd || seen.has(cmd)) continue;
      seen.add(cmd);
      if (cmd !== 'ffmpeg' && !fs.existsSync(cmd)) continue;
      try {
        execFileSync(cmd, ['-version'], { stdio: 'ignore', windowsHide: true });
        this.ffmpegPath = cmd;
        return cmd;
      } catch {
        /* try next */
      }
    }
    return null;
  }

  probeDuration(inputPath) {
    const ff = this.findFfmpeg();
    if (!ff) return null;
    try {
      const out = execFileSync(
        ff,
        ['-hide_banner', '-i', inputPath, '-f', 'null', '-'],
        { encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] }
      );
      void out;
    } catch (err) {
      const text = (err.stderr || err.message || '').toString();
      const m = text.match(/Duration:\s*(\d+):(\d+):([\d.]+)/);
      if (m) {
        return parseInt(m[1], 10) * 3600 + parseInt(m[2], 10) * 60 + parseFloat(m[3]);
      }
    }
    return null;
  }

  /**
   * Applique chroma key et encode WebM VP9 avec alpha (OBS).
   */
  chromaKeyToWebm(inputPath, outputPath, hexColor, options = {}) {
    const ff = this.findFfmpeg();
    if (!ff) {
      throw new Error('ffmpeg introuvable. Installez ffmpeg (winget install ffmpeg) pour le détourage vidéo.');
    }
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    const color = hexToFfmpegColor(hexColor);
    const sim = options.similarity ?? this.colorkeySimilarity;
    const blend = options.blend ?? this.colorkeyBlend;
    const fps = options.fps ? `,fps=${options.fps}` : '';
    const vf = `colorkey=${color}:${sim}:${blend}${fps}`;

    const args = [
      '-y',
      '-i', inputPath,
      '-vf', vf,
      '-an',
      '-c:v', 'libvpx-vp9',
      '-pix_fmt', 'yuva420p',
      '-auto-alt-ref', '0',
      '-b:v', '0',
      '-crf', String(options.crf ?? 32),
      outputPath,
    ];

    const result = spawnSync(ff, args, { encoding: 'utf8', windowsHide: true });
    if (result.status !== 0 || !fs.existsSync(outputPath)) {
      const errText = (result.stderr || result.stdout || '').slice(0, 400);
      throw new Error(`ffmpeg chroma key échoué: ${errText || 'code ' + result.status}`);
    }

    const duration = this.probeDuration(outputPath);
    return { outputPath, duration, fps: options.fps || 24 };
  }

  writeTempFile(buffer, ext = '.webp') {
    const dir = path.join(os.tmpdir(), 'gdri-media-studio');
    fs.mkdirSync(dir, { recursive: true });
    const filePath = path.join(dir, `i2v-${Date.now()}-${Math.random().toString(36).slice(2, 6)}${ext}`);
    fs.writeFileSync(filePath, buffer);
    return filePath;
  }

  safeUnlink(filePath) {
    try {
      if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath);
    } catch {
      /* ignore */
    }
  }
}

module.exports = VideoProcessService;
