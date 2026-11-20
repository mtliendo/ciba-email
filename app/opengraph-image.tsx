import { ImageResponse } from "next/og";

export const alt = "Approve a Calendar event by email with Auth0";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", gap: 28, padding: 90, height: "100%", width: "100%", background: "#ecfdf5", color: "#022c22" }}>
      <div style={{ display: "flex", fontSize: 30, color: "#065f46" }}>AUTH0 DEMO · EMAIL CIBA</div>
      <div style={{ display: "flex", fontSize: 76, fontWeight: 700, lineHeight: 1.06 }}>Approve a Calendar event by email</div>
      <div style={{ display: "flex", fontSize: 32 }}>Google Calendar · Auth0 Token Vault</div>
    </div>,
    size,
  );
}
