import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
// Crawlers send no locale cookie, so they always get the default locale; reading it statically keeps the image prerendered.
import messages from "@/messages/es.json";

export const alt = messages.metadatos.altImagen;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const BACKGROUND = "#0D100D";
const LIME = "#C3E86B";

export default async function Image() {
  const [logo, manrope500, manrope700] = await Promise.all([
    readFile(join(process.cwd(), "public/mango-logo-light.svg"), "utf8"),
    readFile(join(process.cwd(), "assets/Manrope-500.ttf")),
    readFile(join(process.cwd(), "assets/Manrope-700.ttf")),
  ]);
  // The logo's outline shapes (leaf, contour, highlight) drawn alone in lime: the orange body stays out of the palette.
  const outline = (logo.match(/<path fill="#083c2a"[\s\S]*?\/>/g) ?? []).join("").replaceAll("#083c2a", LIME);
  const logoSrc = `data:image/svg+xml;base64,${Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="285 258 520 520">${outline}</svg>`,
  ).toString("base64")}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          gap: 64,
          padding: "0 96px",
          background: BACKGROUND,
          color: LIME,
          fontFamily: "Manrope",
        }}
      >
        <img src={logoSrc} width={340} height={340} alt="" />
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ fontSize: 132, fontWeight: 700, letterSpacing: -4, lineHeight: 1 }}>{messages.metadatos.nombre}</div>
          <div style={{ fontSize: 44, fontWeight: 500, lineHeight: 1.25, maxWidth: 560 }}>{messages.metadatos.frase}</div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Manrope", data: manrope500, weight: 500, style: "normal" },
        { name: "Manrope", data: manrope700, weight: 700, style: "normal" },
      ],
    },
  );
}
