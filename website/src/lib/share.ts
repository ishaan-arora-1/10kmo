import { usd, usdCents } from "./models";

// Light-theme colors so the shared image looks the same everywhere it's posted.
const PAPER = "#F1F5F0";
const INK = "#14201A";
const MUTED = "#5B6B62";
const MONEY = "#0E7A4B";
const CHECK = "#E4EFE2";
const CHECK_LINE = "#9FBFA9";

const DISPLAY = '"Bricolage Grotesque", "Avenir Next", system-ui, sans-serif';
const BODY = '"Hanken Grotesk", "Helvetica Neue", system-ui, sans-serif';
const MONO = '"IBM Plex Mono", ui-monospace, Menlo, monospace';

function wrapText(
  context: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
): number {
  const words = text.split(" ");
  let line = "";
  let cursorY = y;
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (context.measureText(candidate).width > maxWidth && line) {
      context.fillText(line, x, cursorY);
      line = word;
      cursorY += lineHeight;
    } else {
      line = candidate;
    }
  }
  if (line) context.fillText(line, x, cursorY);
  return cursorY;
}

/** Draws the PAID check as a 1080×1260 PNG for Stories, Messages, and posts. */
export async function renderPaidCheckImage(
  amount: number,
  company: string,
  isSample: boolean,
): Promise<Blob> {
  await document.fonts?.ready;
  const width = 1080;
  const height = 1260;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas is not available");

  context.fillStyle = PAPER;
  context.fillRect(0, 0, width, height);

  // Seal + wordmark
  context.setLineDash([10, 8]);
  context.strokeStyle = MONEY;
  context.lineWidth = 4;
  context.beginPath();
  context.arc(112, 118, 38, 0, Math.PI * 2);
  context.stroke();
  context.setLineDash([]);
  context.fillStyle = MONEY;
  context.font = `800 40px ${DISPLAY}`;
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText("R", 112, 121);
  context.textAlign = "left";
  context.fillStyle = MUTED;
  context.font = `500 34px ${MONO}`;
  context.fillText("Rightful", 172, 120);

  // Headline
  context.textBaseline = "alphabetic";
  context.fillStyle = INK;
  context.font = `700 70px ${DISPLAY}`;
  wrapText(
    context,
    `I got ${usd(amount)} from a settlement I didn’t know I was owed.`,
    72,
    300,
    width - 144,
    82,
  );

  // Check body
  const x = 72;
  const y = 660;
  const w = width - 144;
  const h = 500;
  context.beginPath();
  context.roundRect(x, y, w, h, 18);
  context.fillStyle = CHECK;
  context.fill();
  context.save();
  context.clip();
  context.strokeStyle = "rgba(159, 191, 169, 0.28)";
  context.lineWidth = 2;
  for (let offset = -h; offset < w; offset += 20) {
    context.beginPath();
    context.moveTo(x + offset, y + h);
    context.lineTo(x + offset + h, y);
    context.stroke();
  }
  context.restore();
  context.beginPath();
  context.roundRect(x, y, w, h, 18);
  context.strokeStyle = CHECK_LINE;
  context.lineWidth = 2;
  context.stroke();
  context.fillStyle = PAPER;
  for (let cx = x + 16; cx < x + w - 8; cx += 24) {
    context.beginPath();
    context.arc(cx, y, 7, 0, Math.PI * 2);
    context.fill();
  }

  const left = x + 48;
  const right = x + w - 48;
  const rule = (lineY: number) => {
    context.fillStyle = CHECK_LINE;
    context.fillRect(left, lineY, right - left, 2);
  };

  context.fillStyle = MUTED;
  context.font = `400 26px ${MONO}`;
  context.fillText("PAY TO THE ORDER OF", left, y + 78);
  context.textAlign = "right";
  context.fillText("NO. 0001", right, y + 78);
  context.textAlign = "left";

  context.fillStyle = INK;
  context.font = `700 60px ${DISPLAY}`;
  context.fillText("Me", left, y + 170);
  rule(y + 194);

  context.fillStyle = MUTED;
  context.font = `400 26px ${MONO}`;
  context.fillText("AMOUNT", left, y + 300);
  context.fillStyle = MONEY;
  context.font = `800 104px ${DISPLAY}`;
  context.textAlign = "right";
  context.fillText(usdCents(amount), right, y + 312);
  context.textAlign = "left";

  context.fillStyle = INK;
  context.font = `400 36px ${BODY}`;
  context.fillText(`${company} settlement`, left, y + 390);
  rule(y + 414);

  context.fillStyle = MUTED;
  context.font = `400 26px ${MONO}`;
  context.fillText(isSample ? "SAMPLE · NOT A REAL PAYOUT" : "‖ FIND YOURS ‖ RIGHTFUL", left, y + 466);

  // PAID stamp
  context.save();
  context.translate(right - 110, y + 140);
  context.rotate((-12 * Math.PI) / 180);
  context.strokeStyle = MONEY;
  context.lineWidth = 6;
  context.beginPath();
  context.roundRect(-110, -48, 220, 96, 10);
  context.stroke();
  context.fillStyle = MONEY;
  context.font = `800 60px ${DISPLAY}`;
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText("PAID", 0, 4);
  context.restore();

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Image export failed"))), "image/png");
  });
}

export type ShareOutcome = "shared" | "downloaded" | "cancelled";

export async function shareOrDownload(blob: Blob, filename: string, text: string): Promise<ShareOutcome> {
  const file = new File([blob], filename, { type: "image/png" });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], text });
      return "shared";
    } catch (shareError) {
      if (shareError instanceof DOMException && shareError.name === "AbortError") return "cancelled";
    }
  }
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  return "downloaded";
}
