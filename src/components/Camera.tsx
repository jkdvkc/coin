import { useCallback, useEffect, useRef, useState } from "react";
import { downscaleToDataUrl, loadImage } from "../lib/image";
import { cropCoinCircle } from "../lib/ocr";

export type CaptureResult = { obverse: string; reverse: string };
export type CameraSide = "obverse" | "reverse";

interface CameraProps {
  /** auto = fotí samo pri detekcii mince; manual = klasické fotenie jednej strany */
  mode: "auto" | "manual";
  side?: CameraSide;
  onComplete?: (result: CaptureResult) => void;
  onSingleCapture?: (dataUrl: string) => void;
  onCancel: () => void;
}

/** Ostrosť – variancia Laplaciánu (0..1 grayscale). Pod týmto = rozmazané. */
const SHARP_THRESHOLD = 0.003;
/** Koľko po sebe idúcich dobrých snímok → okamžitý záber (bez odpočtu). */
const STABLE_FRAMES = 2;

interface FrameMetrics {
  coin: { cx: number; cy: number; r: number } | null;
  sharp: boolean;
  dark: boolean;
}

/**
 * Analýza snímky v korešpondencii s objekt-fit: cover.
 * video element zobrazuje cover – pri portréte používateľ vidí len stredový pás
 * videa. Analýza musí brať ten istý výrez, inak by minca v porte nikdy
 * neprešla kontrolou pomeru strán / vycentrovania (deformácia štvorca).
 */
function frameMetrics(video: HTMLVideoElement): FrameMetrics {
  const empty: FrameMetrics = { coin: null, sharp: false, dark: false };
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  if (!vw || !vh) return empty;

  const elW = video.clientWidth || 1;
  const elH = video.clientHeight || 1;
  const scale = Math.max(vw / elW, vh / elH); // cover
  const visW = Math.min(vw, elW * scale); // viditeľná šírka v video pixeloch
  const visH = Math.min(vh, elH * scale);
  const offX = (vw - visW) / 2;
  const offY = (vh - visH) / 2;

  const s = 160;
  const c = document.createElement("canvas");
  c.width = s;
  c.height = s;
  const ctx = c.getContext("2d", { willReadFrequently: true });
  if (!ctx) return empty;
  // Kreslíme len VIDITEĽNÚ časť (cover výrez)
  ctx.drawImage(video, offX, offY, visW, visH, 0, 0, s, s);
  const { data } = ctx.getImageData(0, 0, s, s);

  const gray = new Float32Array(s * s);
  let mean = 0;
  for (let i = 0; i < s * s; i++) {
    gray[i] = (0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2]) / 255;
    mean += gray[i];
  }
  mean /= s * s;
  const dark = mean < 0.14 || mean > 0.95;
  if (dark) return { coin: null, sharp: false, dark: true };

  // Gradienty (hrany)
  const grad = new Float32Array(s * s);
  let gmean = 0;
  for (let y = 1; y < s - 1; y++) {
    for (let x = 1; x < s - 1; x++) {
      const i = y * s + x;
      grad[i] = Math.abs(gray[i - 1] - gray[i + 1]) + Math.abs(gray[i - s] - gray[i + s]);
      gmean += grad[i];
    }
  }
  gmean /= s * s;

  let minX = s, maxX = 0, minY = s, maxY = 0, count = 0;
  for (let y = 2; y < s - 2; y++) {
    for (let x = 2; x < s - 2; x++) {
      if (grad[y * s + x] > gmean * 2.8) {
        count++;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (count < 25) return { coin: null, sharp: false, dark: false };

  const w = maxX - minX;
  const h = maxY - minY;
  // Uvoľnené prahy: minca vyplní 30–96 % viditeľnej plochy
  if (w < s * 0.3 || h < s * 0.3 || w > s * 0.96 || h > s * 0.96) {
    return { coin: null, sharp: false, dark: false };
  }
  const aspect = w / h;
  if (aspect < 0.6 || aspect > 1.65) return { coin: null, sharp: false, dark: false };

  const ccx = (minX + maxX) / 2;
  const ccy = (minY + maxY) / 2;
  if (Math.hypot(ccx - s / 2, ccy - s / 2) > s * 0.18) {
    return { coin: null, sharp: false, dark: false };
  }

  // Ostrosť vo vnútri mince
  const ix0 = Math.max(1, Math.round(minX + w * 0.12));
  const ix1 = Math.min(s - 2, Math.round(maxX - w * 0.12));
  const iy0 = Math.max(1, Math.round(minY + h * 0.12));
  const iy1 = Math.min(s - 2, Math.round(maxY - h * 0.12));
  let lSum = 0, l2Sum = 0, n = 0;
  for (let y = iy0; y <= iy1; y++) {
    for (let x = ix0; x <= ix1; x++) {
      const i = y * s + x;
      const lap = 4 * gray[i] - gray[i - 1] - gray[i + 1] - gray[i - s] - gray[i + s];
      lSum += lap;
      l2Sum += lap * lap;
      n++;
    }
  }
  if (n < 120) return { coin: null, sharp: false, dark: false };
  const variance = l2Sum / n - (lSum / n) * (lSum / n);
  const sharp = variance >= SHARP_THRESHOLD;

  return {
    coin: {
      cx: offX + (ccx / s) * visW,
      cy: offY + (ccy / s) * visH,
      r: (Math.max(w, h) / 2 / s) * visW
    },
    sharp,
    dark: false
  };
}

export default function Camera({ mode, onComplete, onSingleCapture, onCancel }: CameraProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const stableRef = useRef(0);
  const focusOkRef = useRef(false);
  const capturedRef = useRef<{ obverse: string | null; reverse: string | null }>({
    obverse: null,
    reverse: null
  });
  const busyRef = useRef(false);

  const [phase, setPhase] = useState<"scan" | "flip" | "scan2" | "done">("scan");
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [focusOk, setFocusOk] = useState(false);
  const [hasCoin, setHasCoin] = useState(false);
  const [isDark, setIsDark] = useState(false);
  const [retryMsg, setRetryMsg] = useState<string | null>(null);
  const [torchOn, setTorchOn] = useState(false);
  const [torchAvailable, setTorchAvailable] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;
  const onSingleRef = useRef(onSingleCapture);
  onSingleRef.current = onSingleCapture;

  const stopStream = useCallback(() => {
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    const stream = streamRef.current;
    if (stream) {
      for (const track of stream.getTracks()) track.stop();
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
    setReady(false);
    setTorchOn(false);
    setTorchAvailable(false);
  }, []);

  const startStream = useCallback(async () => {
    stopStream();
    setError(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("Toto zariadenie nepodporuje kameru v prehliadači. Použi „Kamera / Galéria“.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1920 },
          height: { ideal: 1440 }
        },
        audio: false
      });
      streamRef.current = stream;
      const video = videoRef.current;
      if (video) {
        video.srcObject = stream;
        await video.play().catch(() => undefined);
        setReady(true);
        const track = stream.getVideoTracks()[0];
        const caps = track?.getCapabilities?.() as { torch?: boolean } | undefined;
        setTorchAvailable(!!caps?.torch);
      }
    } catch (e) {
      const err = e as DOMException;
      if (err?.name === "NotAllowedError") {
        setError("Prístup ku kamere bol zamietnutý. Povoľ ho v Nastaveniach prehliadača.");
      } else {
        setError("Kameru sa nepodarilo spustiť. Skús „Kamera / Galéria“.");
      }
    }
  }, [stopStream]);

  useEffect(() => {
    void startStream();
    return () => stopStream();
  }, [startStream, stopStream]);

  const toggleTorch = useCallback(async () => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    const next = !torchOn;
    try {
      await track.applyConstraints({ advanced: [{ torch: next }] } as unknown as MediaTrackConstraints);
      setTorchOn(next);
    } catch {
      // blesk sa nepodarilo prepnúť – ignoruj
    }
  }, [torchOn]);

  /** Snímok – ak poznáme pozíciu mince, vystrihneme len ju (max ostrosť pre OCR). */
  const grabFrame = useCallback(
    (coin?: { cx: number; cy: number; r: number } | null): string | null => {
      const video = videoRef.current;
      if (!video || video.videoWidth === 0) return null;
      const vw = video.videoWidth;
      const vh = video.videoHeight;

      if (coin && coin.r > 20) {
        const pad = 1.3;
        const sideW = Math.min(vw, vh, coin.r * 2 * pad);
        let x0 = coin.cx - sideW / 2;
        let y0 = coin.cy - sideW / 2;
        x0 = Math.max(0, Math.min(x0, vw - sideW));
        y0 = Math.max(0, Math.min(y0, vh - sideW));
        const out = Math.min(1400, Math.round(sideW));
        const canvas = document.createElement("canvas");
        canvas.width = out;
        canvas.height = out;
        const ctx = canvas.getContext("2d");
        if (!ctx) return null;
        ctx.drawImage(video, x0, y0, sideW, sideW, 0, 0, out, out);
        return canvas.toDataURL("image/jpeg", 0.92);
      }

      const maxDim = 1600;
      const scale = Math.min(1, maxDim / Math.max(vw, vh));
      const w = Math.round(vw * scale);
      const h = Math.round(vh * scale);
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) return null;
      ctx.drawImage(video, 0, 0, w, h);
      return canvas.toDataURL("image/jpeg", 0.9);
    },
    []
  );

  const finishAuto = useCallback(() => {
    stopStream();
    setPhase("done");
    const result = capturedRef.current;
    if (result.obverse && result.reverse) {
      onCompleteRef.current?.({ obverse: result.obverse, reverse: result.reverse });
    }
  }, [stopStream]);

  const captureCurrent = useCallback(
    (isReverse: boolean, coin: { cx: number; cy: number; r: number } | null) => {
      busyRef.current = true;
      const dataUrl = grabFrame(coin);
      stableRef.current = 0;
      loadImage(dataUrl ?? "")
        .then((img) => {
          const { canvas: crop } = cropCoinCircle(img);
          if (!(crop.width > 80 && crop.height > 80)) throw new Error("no coin");
          return dataUrl as string;
        })
        .then((shot) => {
          if (!isReverse) {
            capturedRef.current.obverse = shot;
            busyRef.current = false;
            setPhase("flip");
          } else {
            capturedRef.current.reverse = shot;
            busyRef.current = false;
            finishAuto();
          }
        })
        .catch(() => {
          busyRef.current = false;
          setRetryMsg("Mincu som nevidel dosť jasne – ešte raz, drž ju v kruhu.");
          window.setTimeout(() => setRetryMsg(null), 2600);
        });
    },
    [grabFrame, finishAuto]
  );

  // Auto-režim: minca v kruhu + OSTRÁ → OKAMŽITÝ záber (žiadny odpočet)
  useEffect(() => {
    if (mode !== "auto" || !ready) return;
    if (phase === "done" || phase === "flip") return;

    let cancelled = false;
    let lastCoin: { cx: number; cy: number; r: number } | null = null;
    let hasCoinLocal = false;
    let darkLocal = false;

    const tick = () => {
      if (cancelled) return;
      rafRef.current = requestAnimationFrame(tick);
      const video = videoRef.current;
      if (!video || busyRef.current) return;

      const m = frameMetrics(video);
      const ok = !!m.coin && m.sharp && !m.dark;

      if (ok !== focusOkRef.current) {
        focusOkRef.current = ok;
        setFocusOk(ok);
      }
      if (!!m.coin !== hasCoinLocal) {
        hasCoinLocal = !!m.coin;
        setHasCoin(hasCoinLocal);
      }
      if (m.dark !== darkLocal) {
        darkLocal = m.dark;
        setIsDark(darkLocal);
      }

      if (!ok) {
        stableRef.current = 0;
        return;
      }
      lastCoin = m.coin;
      stableRef.current++;
      // 2 stabilné ostré snímky (~30–60 ms) → fotí HNEĎ
      if (stableRef.current >= STABLE_FRAMES) {
        captureCurrent(phase === "scan2", lastCoin);
      }
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      cancelled = true;
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [mode, ready, phase, captureCurrent]);

  const manualCapture = useCallback(() => {
    const dataUrl = grabFrame(null);
    if (!dataUrl) return;
    if (mode === "auto") {
      if (phase === "scan") {
        capturedRef.current.obverse = dataUrl;
        setPhase("flip");
      } else if (phase === "scan2") {
        capturedRef.current.reverse = dataUrl;
        finishAuto();
      }
    } else {
      onSingleRef.current?.(dataUrl);
    }
  }, [mode, phase, grabFrame, finishAuto]);

  const onPickFile = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = "";
      if (!file) return;
      const dataUrl = await downscaleToDataUrl(file);
      if (mode === "auto") {
        if (phase === "scan" || phase === "flip") {
          capturedRef.current.obverse = dataUrl;
          setPhase("scan2");
        } else if (phase === "scan2") {
          capturedRef.current.reverse = dataUrl;
          finishAuto();
        }
      } else {
        onSingleRef.current?.(dataUrl);
      }
    },
    [mode, phase, finishAuto]
  );

  const phaseText =
    phase === "scan"
      ? "Líc – polož mincu do kruhu"
      : phase === "flip"
        ? "Otoč mincu na druhú stranu"
        : phase === "scan2"
          ? "Rub – polož mincu do kruhu"
          : "Hotovo";

  const statusText = retryMsg
    ? retryMsg
    : !ready
      ? "Spúšťam kameru…"
      : error
        ? ""
        : phase === "flip"
          ? ""
          : isDark
            ? "💡 Tma – zapni blesk alebo doplň svetlo"
            : !hasCoin
              ? "Polož mincu do zlatého kruhu"
              : !focusOk
                ? "⚙️ Zaostri – drž telefón pokojne nad mincou"
                : "✓ Ostré – odfotím…";

  return (
    <div className="camera-screen">
      <div className="camera-top">
        <button type="button" className="btn-ghost" onClick={onCancel}>
          ✕ Zavrieť
        </button>
        <div className="camera-title">{phaseText}</div>
        <span style={{ width: 64 }} />
      </div>

      <div className="camera-stage">
        <video ref={videoRef} playsInline autoPlay muted className="camera-video" />
        {!ready && !error && <div className="camera-loading">Spúšťam kameru…</div>}
        {error && (
          <div className="camera-error">
            <p>{error}</p>
          </div>
        )}
        {phase === "flip" ? (
          <div className="flip-overlay">
            <div className="flip-coin" aria-hidden="true">↻</div>
            <p>Otoč mincu a polož ju späť do kruhu</p>
            <button type="button" className="btn-primary" onClick={() => setPhase("scan2")}>
              Otočila som – pokračovať
            </button>
          </div>
        ) : (
          <div
            className={`coin-guide ${
              hasCoin && focusOk ? "coin-guide-green" : hasCoin ? "coin-guide-red" : ""
            }`}
            aria-hidden="true"
          />
        )}
        {ready && !error && phase !== "flip" && (
          <div className={`camera-status ${retryMsg ? "camera-status-warn" : ""}`}>{statusText}</div>
        )}
      </div>

      <div className="camera-controls">
        <button
          type="button"
          className="btn-secondary"
          onClick={() => fileInputRef.current?.click()}
        >
          Kamera / Galéria
        </button>
        <button
          type="button"
          className="btn-shutter"
          onClick={manualCapture}
          disabled={!ready}
          aria-label="Odfotiť teraz"
        >
          <span className="shutter-dot" />
        </button>
        {torchAvailable ? (
          <button
            type="button"
            className={`btn-torch ${torchOn ? "btn-torch-on" : ""}`}
            onClick={() => void toggleTorch()}
            aria-label="Blesk"
          >
            {torchOn ? "💡" : "🔅"}
          </button>
        ) : mode === "auto" && capturedRef.current.obverse ? (
          <img src={capturedRef.current.obverse} alt="líc" className="mini-preview" />
        ) : (
          <span style={{ minWidth: 48 }} />
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={(e) => void onPickFile(e)}
      />
    </div>
  );
}
