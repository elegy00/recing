import { Tldraw, createShapeId, toRichText } from 'tldraw';
import 'tldraw/tldraw.css';

// ─── tldraw color tokens ────────────────────────────────────────────────────
// tldraw shape props only accept named palette colors, not arbitrary hex values.
type TldrawColor = 'black' | 'grey' | 'red' | 'white';

const TEXT_PRI: TldrawColor = 'black';
const TEXT_SEC: TldrawColor = 'grey';
const BORDER: TldrawColor = 'grey';
const SCREEN: TldrawColor = 'white';
const ACCENT: TldrawColor = 'red';

// Tablet frame (iPad Air-like dimensions)
const PAD = 60;                          // canvas padding around tablet
const TABLET_W = 820, TABLET_H = 1180;
const BEZEL = 36;

function screen() {
	return { x: PAD + BEZEL, y: PAD + BEZEL, w: TABLET_W - BEZEL * 2, h: TABLET_H - BEZEL * 2 };
}

// ─── Main app component ──────────────────────────────────────────────────────
export default function App() {
	return (
		<div style={{ position: 'fixed', inset: 0 }}>
			<Tldraw
				hideUi
				onMount={(editor) => {
					const s = screen();

					// ── Shape creation helpers (editor captured from onMount) ──
					function rect(
						x: number, y: number, w: number, h: number,
						color: TldrawColor = BORDER, fillStyle: 'solid' | 'none' = 'none'
					) {
						editor.createShape({
							id: createShapeId(), type: 'geo', x, y,
							props: { geo: 'rectangle' as const, w, h, color, fill: fillStyle } as any,
						});
					}

					function ellipse(
						cx: number, cy: number, rx: number, ry: number,
						color: TldrawColor = BORDER, fillStyle: 'solid' | 'none' = 'none'
					) {
						editor.createShape({
							id: createShapeId(), type: 'geo', x: cx - rx, y: cy - ry,
							props: { geo: 'ellipse' as const, w: rx * 2, h: ry * 2, color, fill: fillStyle } as any,
						});
					}

					function lineShape(
						x1: number, y1: number, x2: number, y2: number,
						color: TldrawColor = BORDER
					) {
						const x = Math.min(x1, x2);
						const y = Math.min(y1, y2);
						editor.createShape({
							id: createShapeId(), type: 'line', x, y,
							props: {
								color,
								dash: 'solid' as const,
								size: 's' as const,
								spline: 'line' as const,
								points: {
									start: { id: 'start', index: 'a1' as const, x: x1 - x, y: y1 - y },
									end: { id: 'end', index: 'a2' as const, x: x2 - x, y: y2 - y },
								},
								scale: 1,
							} as any,
						});
					}

					function text(
						x: number, y: number, content: string,
						opts?: { w?: number; color?: TldrawColor; font?: 'sans' | 'serif'; size?: 's' | 'm' | 'l' | 'xl'; align?: 'start' | 'middle' | 'end'; italic?: boolean }
					) {
						const richText = opts?.italic
							? ({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: content, marks: [{ type: 'italic' }] }] }] })
							: toRichText(content);

						editor.createShape({
							id: createShapeId(), type: 'text', x, y,
							props: {
								richText,
								color: (opts?.color ?? TEXT_PRI) as any,
								font: opts?.font ?? 'sans' as const,
								size: opts?.size ?? 'm' as const,
								textAlign: (opts?.align ?? 'start') as 'start' | 'middle' | 'end',
								w: opts?.w ?? Math.max(20, content.length * 10),
								autoSize: !opts?.w,
							},
						});
					}

					// ── Tablet bezel (outer frame) ────────────────
					rect(PAD + 16, PAD + 16, TABLET_W + 32, TABLET_H + 32, TEXT_PRI, 'solid');

					// ── Tablet screen background ──────────────────
					rect(s.x, s.y, s.w, s.h, SCREEN, 'solid');

					// ── Blueprint grid lines (decorative) ────────
					for (let gy = s.y + 60; gy < s.y + s.h - 60; gy += 80) {
						lineShape(s.x + 30, gy, s.x + s.w - 30, gy);
					}
					for (let gx = s.x + 50; gx < s.x + s.w - 50; gx += 80) {
						lineShape(gx, s.y + 40, gx, s.y + s.h - 40);
					}

					// ── Header bar ────────────────────────────────
					const headerY = s.y + 4;
					rect(s.x + 4, headerY - 2, s.w - 8, 50, BORDER);

					// "Recing" logo (serif)
					text(s.x + 20, headerY, 'Recing', { font: 'serif', size: 'l' });

					// Nav: "About" link with dot separator
					const aboutX = s.x + s.w - 130;
					ellipse(aboutX + 60, headerY + 24, 2.5, 2.5);
					text(aboutX + 72, headerY + 4, 'About', { w: 60, color: TEXT_SEC });

					// "Submit" active nav link (bold) + terracotta underline
					const submitLabel = s.x + s.w - 192;
					text(submitLabel, headerY + 4, 'Submit', { font: 'sans', size: 'm' });
					rect(submitLabel, headerY + 38, 56, 3, ACCENT, 'solid');

					// ── Page title (Garamond serif) ───────────────
					let y = s.y + 90;
					text(s.x + 24, y, 'SUBMIT A RECIPE URL', { font: 'serif', size: 'xl' });

					// ── Description text ──────────────────────────
					y += 52;
					const maxW = s.w - 48;
					text(s.x + 24, y, "Paste the URL of any recipe and we'll extract all details using our local AI model.", { w: maxW - 160, color: TEXT_SEC });

					// ── Divider line ──────────────────────────────
					y += 48;
					lineShape(s.x + 24, y - 6, s.x + maxW, y - 6);

					// ── URL input field ───────────────────────────
					const inputY = y + 30;
					const inputW = maxW;

					rect(s.x + 24, inputY, inputW, 52, BORDER, 'solid');

					// Accent icon circle (left side of input)
					const iconX = s.x + 48;
					ellipse(iconX, inputY + 26, 14, 14, ACCENT, 'solid');
					// White inner circle
					ellipse(iconX, inputY + 26, 9, 9, BORDER, 'solid');

					// URL placeholder text (italic)
					text(s.x + 72, inputY + 10, 'https://example.com/chocolate-cake', { w: inputW - 200, color: TEXT_SEC, italic: true });

					// ── Submit button (terracotta CTA) ────────────
					const btnW = 140;
					const btnX = s.x + s.w - 24 - btnW;
					rect(btnX, inputY + 2, btnW, 48, ACCENT, 'solid');

					// Button text (white on terracotta bg)
					text(btnX + 16, inputY + 10, 'Submit →', { w: btnW - 32, color: TEXT_PRI, size: 'm', align: 'middle' });

					// ── Status hint (idle) ────────────────────────
					y = inputY + 76;
					text(s.x + 24, y, 'Status: idle — enter a URL above to begin extraction', { w: maxW - btnW - 40, color: TEXT_SEC, italic: true });

					// ── Decorative circle (bottom-right area) ─────
					ellipse(s.x + s.w - 80, y + 60, 32, 32);

					// ── Vertical edge annotations ─────────────────
					text(s.x + s.w - 10, s.y + 240, 'RECING v0.1.0 · TABLET VIEW', { w: 16, color: BORDER, font: 'sans', size: 's' });
					text(s.x + 2, s.y + 240, 'SHEET 01 · SUBMIT', { w: 14, color: BORDER, font: 'sans', size: 's' });

					// ── Footer ────────────────────────────────────
					const footerY = s.y + s.h - 36;
					text(s.x + 24, footerY, '© 2026 Recing · Terms · Help', { w: maxW, color: TEXT_SEC });

					// Zoom to fit the tablet frame
					editor.zoomToBounds({ x: PAD - 40, y: PAD - 40, w: TABLET_W + 80, h: TABLET_H + 80 });
				}}
			/>
		</div>
	);
}
