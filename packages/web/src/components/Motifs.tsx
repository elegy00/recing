/**
 * Abstract Mediterranean motifs rendered as inline SVG.
 * They are purely decorative (aria-hidden) and tinted via `currentColor`
 * or fixed palette colors, so no image assets are needed.
 */

export function OliveSprig({ className }: { className?: string }) {
	return (
		<svg
			viewBox="0 0 64 36"
			fill="none"
			aria-hidden="true"
			className={className}
		>
			{/* stem */}
			<path
				d="M4 26C18 25 40 17 60 4"
				stroke="currentColor"
				strokeWidth="2.5"
				strokeLinecap="round"
			/>
			{/* leaves — alternating above/below the stem */}
			<ellipse
				cx="16"
				cy="20.5"
				rx="7.5"
				ry="3"
				transform="rotate(-28 16 20.5)"
				fill="currentColor"
				opacity="0.9"
			/>
			<ellipse
				cx="25"
				cy="25.5"
				rx="7.5"
				ry="3"
				transform="rotate(14 25 25.5)"
				fill="currentColor"
				opacity="0.55"
			/>
			<ellipse
				cx="33"
				cy="16"
				rx="7.5"
				ry="3"
				transform="rotate(-28 33 16)"
				fill="currentColor"
				opacity="0.9"
			/>
			<ellipse
				cx="42"
				cy="19.5"
				rx="7"
				ry="2.8"
				transform="rotate(14 42 19.5)"
				fill="currentColor"
				opacity="0.55"
			/>
			<ellipse
				cx="49"
				cy="9"
				rx="7"
				ry="2.8"
				transform="rotate(-30 49 9)"
				fill="currentColor"
				opacity="0.9"
			/>
			{/* olives */}
			<circle cx="12" cy="30.5" r="3.6" fill="currentColor" />
			<circle cx="20.5" cy="31.5" r="3" fill="currentColor" opacity="0.7" />
		</svg>
	);
}

/** One whole fig (left) and one halved fig showing its flesh (right). */
export function Figs({ className }: { className?: string }) {
	return (
		<svg
			viewBox="0 0 100 64"
			fill="none"
			aria-hidden="true"
			className={className}
		>
			{/* whole fig */}
			<path
				d="M30 6v8"
				stroke="#5c6b3c"
				strokeWidth="2.5"
				strokeLinecap="round"
			/>
			<path
				d="M30 13C19 15 12 26 12.5 38C13 50 20 58 30 58C40 58 47 50 47.5 38C48 26 41 15 30 13Z"
				fill="#7a4a5f"
			/>
			<ellipse
				cx="23"
				cy="27"
				rx="4"
				ry="6.5"
				transform="rotate(-18 23 27)"
				fill="#ffffff"
				opacity="0.14"
			/>
			{/* halved fig */}
			<circle cx="72" cy="36" r="23" fill="#7a4a5f" />
			<circle cx="72" cy="36" r="18.5" fill="#e9b3a2" />
			<circle cx="72" cy="36" r="8" fill="#f6ead8" />
			{/* seeds */}
			<circle cx="72" cy="26.5" r="1.4" fill="#7a4a5f" />
			<circle cx="79.5" cy="31.5" r="1.4" fill="#7a4a5f" />
			<circle cx="79.5" cy="40.5" r="1.4" fill="#7a4a5f" />
			<circle cx="72" cy="45.5" r="1.4" fill="#7a4a5f" />
			<circle cx="64.5" cy="40.5" r="1.4" fill="#7a4a5f" />
			<circle cx="64.5" cy="31.5" r="1.4" fill="#7a4a5f" />
		</svg>
	);
}

/** Small centered divider: sprig between two thin rules. */
export function SprigDivider({ className }: { className?: string }) {
	return (
		<div
			aria-hidden="true"
			className={`flex items-center justify-center gap-4 ${className ?? ""}`}
		>
			<span className="h-px w-16 bg-[var(--border)]" />
			<OliveSprig className="h-5 w-9 text-[var(--olive)]" />
			<span className="h-px w-16 bg-[var(--border)]" />
		</div>
	);
}
