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

/** Stabilita kruhu mince v hľadáčku – vráti (cx, cy, radius) v px videa alebo null. */
function detectCoinInFrame(video: HTMLVideoElement): { cx: number; cy: number; r: number } | null {
  if (video.videoWidth === 0) return null;
  const s = 160;
  const c = document.createElement("canvas");
  c.width = s;
  c.height = s;
  const ctx = c.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(video, 0, 0, s, s);
  const { data } = ctx.getImageData(0, 0, s, s);

  const gray = new Float32Array(s * s);
  for (let i = 0; i < s * s; i++) {
    gray[i] = (0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2]) / 255;
  }
  let mean = 0;
  for (let i = 0; i < s * s; i++) mean += gray[i];
  mean /= s * s;
  if (mean < 0.1 || mean > 0.92) return null; // príliš tmavé/svetlé

  const grad = new Float32Array(s * s);
  for (let y = 1; y < s - 1; y++) {
    for (let x = 1; x < s - 1; x++) {
      const i = y * s + x;
      grad[i] = Math.abs(gray[i - 1] - gray[i + 1]) + Math.abs(gray[i - s] - gray[i + s]);
    }
  }
  let gmean = 0;
  for (let i = 0; i < s * s; i++) gmean += grad[i];
  gmean /= s * s;

  let minX = s, maxX = 0, minY = s, maxY = 0, count = 0;
  for (let y = 2; y < s - 2; y++) {
    for (let x = 2; x < s - 2; x++) {
      if (grad[y * s + x] > gmean * 3.2) {
        count++;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (count < 30) return null;
  const w = maxX - minX;
  const h = maxY - minY;
  if (w < s * 0.3 || h < s * 0.3) return null; // minca príliš malá
  const aspect = w / h;
  if (aspect < 0.65 || aspect > 1.55) return null; // nie je kruh

  return {
    cx: ((minX + maxX) / 2 / s) * video.videoWidth,
    cy: ((minY + maxY) / 2 / s) * video.videoHeight,
    r: (Math.max(w, h) / 2 / s) * video.videoWidth
  };
}

export default function Camera({ mode, onComplete, onSingleCapture, onCancel }: CameraProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const stableFrames = useRef(0);
  const capturedRef = useRef<{ obverse: string | null; reverse: string | null }>({
    obverse: null,
    reverse: null
  });
  const busyRef = useRef(false);

  const [phase, setPhase] = useState<"scan" | "hold" | "flip" | "scan2" | "done">("scan");
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(0);
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
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1440 } },
        audio: false
      });
      streamRef.current = stream;
      const video = videoRef.current;
      if (video) {
        video.srcObject = stream;
        await video.play().catch(() => undefined);
        setReady(true);
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

  const grabFrame = useCallback((): string | null => {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0) return null;
    const maxDim = 1280;
    const scale = Math.min(1, maxDim / Math.max(video.videoWidth, video.videoHeight));
    const w = Math.round(video.videoWidth * scale);
    const h = Math.round(video.videoHeight * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0, w, h);
    return canvas.toDataURL("image/jpeg", 0.85);
  }, []);

  const finishAuto = useCallback(() => {
    stopStream();
    setPhase("done");
    const result = capturedRef.current;
    if (result.obverse && result.reverse) {
      onCompleteRef.current?.({ obverse: result.obverse, reverse: result.reverse });
    }
  }, [stopStream]);

  // Auto-režim: detekcia mince → stabilizácia → odpočet → fot → otočenie → fot → hotovo
  useEffect(() => {
    if (mode !== "auto" || !ready) return;
    if (phase === "done") return;

    const tick = () => {
      rafRef.current = requestAnimationFrame(tick);
      const video = videoRef.current;
      if (!video || busyRef.current) return;

      if (phase === "flip") return; // čakáme na klik "Otočila som"

      const detection = detectCoinInFrame(video);
      if (!detection) {
        stableFrames.current = 0;
        if (countdown !== 0) setCountdown(0);
        return;
      }
      stableFrames.current++;
      // minca musí byť stabilná ~1 s (60 snímok) a dostatočne veľká
      if (stableFrames.current === 30) {
        setCountdown(2);
      }
      if (stableFrames.current > 30 && stableFrames.current % 30 === 0 && countdown > 0) {
        setCountdown((c) => Math.max(0, c - 1));
      }
      if (stableFrames.current >= 90) {
        busyRef.current = true;
        const dataUrl = grabFrame();
        stableFrames.current = 0;
        setCountdown(0);
        // validácia: naozaj je na fotke minca (kruh)?
        loadImage(dataUrl ?? "")
          .then((img) => {
            const { canvas: crop } = cropCoinCircle(img);
            const ok = crop.width > 60 && crop.height > 60;
            if (!ok) throw new Error("no coin");
            return dataUrl;
          })
          .then((shot) => {
            if (!shot) throw new Error("empty");
            if (phase === "scan" || phase === "hold") {
              capturedRef.current.obverse = shot;
              setPhase("flip");
            } else if (phase === "scan2") {
              capturedRef.current.reverse = shot;
              busyRef.current = false;
              finishAuto();
              return;
            }
            busyRef.current = false;
          })
          .catch(() => {
            busyRef.current = false;
          });
      }
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, ready, phase, countdown, grabFrame, finishAuto]);

  const manualCapture = useCallback(() => {
    const dataUrl = grabFrame();
    if (!dataUrl) return;
    if (mode === "auto") {
      // manuálna spúšť v auto režime: použije sa pre aktuálnu fázu
      if (phase === "scan" || phase === "hold") {
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
        if (phase === "scan" || phase === "hold" || phase === "flip") {
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
      ? "Polož mincu do kruhu – odfotím sama"
      : phase === "hold"
        ? "Drž pokoj…"
        : phase === "flip"
          ? "Otoč mincu na druhú stranu a polož do kruhu"
          : phase === "scan2"
            ? "Druhá strana – polož do kruhu"
            : "Hotovo";

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
          <div className={`coin-guide ${countdown > 0 ? "coin-guide-lock" : ""}`} aria-hidden="true" />
        )}
        {countdown > 0 && <div className="countdown">{countdown}</div>}
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
        {mode === "auto" && capturedRef.current.obverse ? (
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
