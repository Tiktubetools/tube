import fs from "fs";
import path from "path";
import os from "os";
import axios from "axios";
import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

export interface YouTubeExtractionResult {
  platform: "youtube";
  title: string;
  thumbnail: string;
  formats: {
    quality: "1080p" | "720p";
    url: string;
  }[];
}

let ytdlpCommandPath: string | null = null;
let ytdlpExecutionArgs: string[] = [];

export async function ensureYtdlp(): Promise<{ command: string; argsPrefix: string[] }> {
  if (ytdlpCommandPath) {
    return { command: ytdlpCommandPath, argsPrefix: ytdlpExecutionArgs };
  }

  // 1. Try global yt-dlp first
  try {
    const { stdout } = await execFileAsync("yt-dlp", ["--version"]);
    console.log(`[YouTube Extractor] Global yt-dlp detected: ${stdout.trim()}`);
    ytdlpCommandPath = "yt-dlp";
    ytdlpExecutionArgs = [];
    return { command: "yt-dlp", argsPrefix: [] };
  } catch (err) {
    console.log("[YouTube Extractor] Global yt-dlp not found in path, testing local versions...");
  }

  const localPath = path.join(os.tmpdir(), "yt-dlp");

  // 2. Download latest yt-dlp if not downloaded
  if (!fs.existsSync(localPath)) {
    console.log("[YouTube Extractor] Local yt-dlp binary missing. Fetching latest release...");
    try {
      const response = await axios({
        method: "GET",
        url: "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp",
        responseType: "arraybuffer",
        timeout: 45000,
      });
      fs.writeFileSync(localPath, Buffer.from(response.data));
      fs.chmodSync(localPath, 0o755);
      console.log("[YouTube Extractor] Downloaded yt-dlp successfully and set +x permissions.");
    } catch (dlErr: any) {
      console.error("[YouTube Extractor] Failed download from GitHub:", dlErr);
      throw new Error(`تعذر تنزيل أداة yt-dlp التلقائية من الخادم: ${dlErr.message}`);
    }
  }

  // 3. Verify Direct Execution
  try {
    const { stdout } = await execFileAsync(localPath, ["--version"]);
    console.log(`[YouTube Extractor] Local yt-dlp compiled executable working: ${stdout.trim()}`);
    ytdlpCommandPath = localPath;
    ytdlpExecutionArgs = [];
    return { command: localPath, argsPrefix: [] };
  } catch (directErr: any) {
    console.log("[YouTube Extractor] Direct local binary run failed (noexec/sandbox constraints). Trying python3 option...", directErr.message);

    // Try via python3
    try {
      const { stdout } = await execFileAsync("python3", [localPath, "--version"]);
      console.log(`[YouTube Extractor] Local yt-dlp successfully executed via python3: ${stdout.trim()}`);
      ytdlpCommandPath = "python3";
      ytdlpExecutionArgs = [localPath];
      return { command: "python3", argsPrefix: [localPath] };
    } catch (pyError: any) {
      console.log("[YouTube Extractor] Python3 execution option failed too:", pyError.message);
    }

    // Try via python
    try {
      const { stdout } = await execFileAsync("python", [localPath, "--version"]);
      console.log(`[YouTube Extractor] Local yt-dlp successfully executed via python: ${stdout.trim()}`);
      ytdlpCommandPath = "python";
      ytdlpExecutionArgs = [localPath];
      return { command: "python", argsPrefix: [localPath] };
    } catch (pyError2: any) {
      console.log("[YouTube Extractor] Standard Python execution option failed too:", pyError2.message);
    }

    throw new Error("بيئة الخادم تفتقر إلى yt-dlp أو python3 لتشغيل برنامج التحميل.");
  }
}

export async function extractYouTubeMetadata(url: string): Promise<YouTubeExtractionResult> {
  if (!url) {
    throw new Error("رابط يوتيوب مطلوب");
  }

  const COBALT_INSTANCES = [
    "https://api.cobalt.tools/api/json",
    "https://cobalt.api.ryz.cx/api/json",
    "https://co.wuk.sh/api/json"
  ];

  const getYouTubeId = (inputUrl: string): string | null => {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = inputUrl.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
  };

  const fetchYouTubeTitleFallback = async (inputUrl: string): Promise<string> => {
    try {
      const res = await axios.get(inputUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Accept-Language": "ar,en-US;q=0.9,en;q=0.8"
        },
        timeout: 6000
      });
      const html = res.data;
      const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
      if (titleMatch && titleMatch[1]) {
        return titleMatch[1].replace(/\s*-\s*YouTube/gi, "").trim();
      }
    } catch (e) {
      console.error("[YouTube Fallback Title Fetch Error]:", e);
    }
    return "مقطع فيديو يوتيوب";
  };

  // JSON array to Netscape cookies converter
  const convertJsonToNetscape = (rawInput: string): string => {
    const trimmed = rawInput.trim();
    if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          let out = "# Netscape HTTP Cookie File\n# This is a converted JSON cookie file\n\n";
          for (const item of parsed) {
            if (!item.domain || !item.name) continue;
            const flag = item.domain.startsWith(".") ? "TRUE" : "FALSE";
            const p = item.path || "/";
            const s = item.secure ? "TRUE" : "FALSE";
            let expiration = "0";
            if (typeof item.expirationDate === "number") {
              expiration = Math.round(item.expirationDate).toString();
            } else if (typeof item.expiry === "number") {
              expiration = Math.round(item.expiry).toString();
            } else {
              expiration = (Math.round(Date.now() / 1000) + 315360000).toString();
            }
            const name = item.name;
            const value = item.value || "";
            out += `${item.domain}\t${flag}\t${p}\t${s}\t${expiration}\t${name}\t${value}\n`;
          }
          console.log("[YouTube Extractor] Successfully converted pasted JSON cookies to Netscape format.");
          return out;
        }
      } catch (e: any) {
        console.error("[YouTube Extractor] JSON Cookie Conversion Error:", e.message || e);
      }
    }
    return trimmed;
  };

  // Check custom cookies
  let cookiesPath: string | null = null;
  const settingsPath = path.join(process.cwd(), "uploads", "admin_global_settings.json");
  if (fs.existsSync(settingsPath)) {
    try {
      const settings = JSON.parse(fs.readFileSync(settingsPath, "utf-8"));
      if (settings.youtubeCookies && settings.youtubeCookies.trim()) {
        cookiesPath = path.join(os.tmpdir(), "youtube-cookies.txt");
        const formattedCookies = convertJsonToNetscape(settings.youtubeCookies);
        fs.writeFileSync(cookiesPath, formattedCookies, "utf-8");
        console.log("[YouTube Extractor] Custom cookies loaded and written to tmp.");
      }
    } catch (e) {
      console.error("[YouTube Extractor] Failed to read settings file:", e);
    }
  }

  try {
    const { command, argsPrefix } = await ensureYtdlp();
    console.log(`[YouTube Extractor] Inspecting via ${command} ${argsPrefix.join(" ")} --dump-json: ${url}`);
    
    const runArgs = [
      ...argsPrefix,
      "--dump-json",
      "--no-warnings",
      "--js-runtimes", "node:" + process.execPath,
      "--extractor-args", "youtube:player-client=ios,android,web,mweb",
    ];
    if (cookiesPath) {
      runArgs.push("--cookies", cookiesPath);
    }
    runArgs.push(url.trim());

    const { stdout } = await execFileAsync(command, runArgs);
    const metadata = JSON.parse(stdout);

    const title = metadata.title || "مقطع فيديو يوتيوب";
    const videoId = metadata.id || "";
    const thumbnail = metadata.thumbnail || (videoId ? `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg` : "");

    // Sanitize filename to avoid weird character issues
    const safeTitle = title.replace(/[^\u0600-\u06FFa-zA-Z0-9_\-\s]/g, "").substring(0, 50).trim() || "video";

    return {
      platform: "youtube",
      title,
      thumbnail,
      formats: [
        {
          quality: "1080p",
          url: `/api/download?url=${encodeURIComponent(url.trim())}&platform=youtube&quality=1080p&filename=${encodeURIComponent(`${safeTitle}_1080p.mp4`)}`
        },
        {
          quality: "720p",
          url: `/api/download?url=${encodeURIComponent(url.trim())}&platform=youtube&quality=720p&filename=${encodeURIComponent(`${safeTitle}_720p.mp4`)}`
        }
      ]
    };
  } catch (error: any) {
    console.error("[YouTube Extractor Error, entering premium Cobalt fallback]:", error.message || error);
    
    // Cobalt fallback
    const videoId = getYouTubeId(url) || "";
    const thumbnail = videoId ? `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg` : "";
    const title = await fetchYouTubeTitleFallback(url);
    const safeTitle = title.replace(/[^\u0600-\u06FFa-zA-Z0-9_\-\s]/g, "").substring(0, 50).trim() || "video";

    let direct720Url = "";
    let direct1080Url = "";

    // 1. Try to fetch 720p from Cobalt
    for (const instance of COBALT_INSTANCES) {
      try {
        console.log(`[YouTube Extraction Fallback] Testing Cobalt instance: ${instance} for 720p`);
        const res = await axios.post(instance, {
          url: url.trim(),
          videoQuality: "720",
          downloadMode: "video"
        }, {
          headers: {
            "Accept": "application/json",
            "Content-Type": "application/json"
          },
          timeout: 10000
        });

        if (res.data && res.data.url) {
          direct720Url = res.data.url;
          console.log(`[YouTube Extraction Fallback] Cobalt 720p success: ${res.data.url}`);
          break;
        }
      } catch (err: any) {
        console.warn(`[YouTube Extraction Fallback] Cobalt 720p instance ${instance} error:`, err.message);
      }
    }

    // 2. Try to fetch 1080p from Cobalt
    for (const instance of COBALT_INSTANCES) {
      try {
        console.log(`[YouTube Extraction Fallback] Testing Cobalt instance: ${instance} for 1080p`);
        const res = await axios.post(instance, {
          url: url.trim(),
          videoQuality: "1080",
          downloadMode: "video"
        }, {
          headers: {
            "Accept": "application/json",
            "Content-Type": "application/json"
          },
          timeout: 10000
        });

        if (res.data && res.data.url) {
          direct1080Url = res.data.url;
          console.log(`[YouTube Extraction Fallback] Cobalt 1080p success: ${res.data.url}`);
          break;
        }
      } catch (err: any) {
        console.warn(`[YouTube Extraction Fallback] Cobalt 1080p instance ${instance} error:`, err.message);
      }
    }

    // If we managed to grab direct stream links via Cobalt, return them directly proxying without running yt-dlp transcoding
    if (direct720Url || direct1080Url) {
      return {
        platform: "youtube",
        title,
        thumbnail,
        formats: [
          {
            quality: "1080p",
            url: direct1080Url 
              ? `/api/download?url=${encodeURIComponent(direct1080Url)}&platform=youtube_direct&filename=${encodeURIComponent(`${safeTitle}_1080p.mp4`)}`
              : `/api/download?url=${encodeURIComponent(url.trim())}&platform=youtube&quality=1080p&filename=${encodeURIComponent(`${safeTitle}_1080p.mp4`)}`
          },
          {
            quality: "720p",
            url: direct720Url 
              ? `/api/download?url=${encodeURIComponent(direct720Url)}&platform=youtube_direct&filename=${encodeURIComponent(`${safeTitle}_720p.mp4`)}`
              : `/api/download?url=${encodeURIComponent(url.trim())}&platform=youtube&quality=720p&filename=${encodeURIComponent(`${safeTitle}_720p.mp4`)}`
          }
        ]
      };
    }

    // If cobalt also failed, re-throw the original error to notify the user
    throw new Error(`فشل جلب تفاصيل الفيديو عبر yt-dlp وجداول البث السحابية الكبرى بشكل متبادل. فحص البوت مفعّل لعنوان الـ IP الحالي. الرجاء إضافة كوكيز لليوتيوب في إدارة إعدادات الهوية لتجاوز الحظر.`);
  }
}
