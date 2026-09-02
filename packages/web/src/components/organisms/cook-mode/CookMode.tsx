interface Ingredient {
	quantity?: string;
	unit?: string;
	name: string;
}

interface Step {
	text: string;
	timer?: string;
}

export interface CookModeProps {
	step: Step | undefined;
	totalSteps: number;
	currentStepIndex: number;
	progressPct: number;
	ingredients: Ingredient[];
	checkedIngredients: Set<number>;
	onExitCooking: () => void;
	onPrev: () => void;
	onNext: () => void;
	onToggleIngredient: (idx: number) => void;
	hasPrev: boolean;
	hasNext: boolean;
}

export function CookMode({
	step, totalSteps, currentStepIndex, progressPct,
	ingredients, checkedIngredients, onExitCooking, onPrev, onNext,
	onToggleIngredient, hasPrev, hasNext,
}: CookModeProps) {
	return (
		<div>
			{/* Header */}
			<div className="mb-6 flex items-center justify-between gap-4">
				<button onClick={onExitCooking} className="inline-flex items-center justify-center gap-2 rounded-full border border-[var(--border)] bg-transparent px-5 py-3 text-base font-medium transition-colors duration-150 hover:bg-[var(--accent-soft)]">
					Kochen beenden
				</button>
				<span className="text-base tabular-nums text-[var(--text-secondary)]">{progressPct}%</span>
			</div>

			{/* Progress bar */}
			<div className="mb-8 h-2 rounded-full bg-[var(--border)]">
				<div className="h-2 rounded-full bg-[var(--accent)] transition-all duration-300" style={{ width: `${progressPct}%` }} />
			</div>

			{/* Current step */}
			{step && (
				<div className="card mb-8 p-6 sm:p-8">
					<div className="mb-5 flex items-center justify-between gap-4">
						<span className="eyebrow">Schritt {currentStepIndex + 1} von {totalSteps}</span>
						{step.timer && (
							<span className="rounded-full bg-[var(--olive-soft)] px-3.5 py-1 text-base font-medium tabular-nums text-[var(--olive-deep)]">⏱ {step.timer}</span>
						)}
					</div>
					<p className="text-2xl leading-relaxed font-medium sm:text-3xl">{step.text}</p>
				</div>
			)}

			{/* Ingredient checklist */}
			<h3 className="mb-4 font-serif text-2xl font-semibold">Zutaten</h3>
			<div className="space-y-1">
				{ingredients.map((ing, idx) => (
					<label key={idx} className={`flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2.5 text-lg transition-colors ${checkedIngredients.has(idx) ? "text-[var(--text-secondary)] line-through" : "text-[var(--text-primary)]"}`}>
						<input type="checkbox" checked={checkedIngredients.has(idx)} onChange={() => onToggleIngredient(idx)} className="h-5 w-5 shrink-0 accent-[var(--accent)]" />
						<span>
							{ing.quantity && <strong>{ing.quantity} </strong>}
							{ing.unit && <em className="font-serif">{ing.unit} </em>}
							{ing.name}
						</span>
					</label>
				))}
			</div>

			{/* Navigation */}
			<div className="mt-10 flex items-center justify-between gap-4">
				<button onClick={onPrev} disabled={!hasPrev} className="inline-flex items-center justify-center gap-2 rounded-full border border-[var(--border)] bg-transparent px-5 py-3 text-base font-medium transition-colors duration-150 hover:bg-[var(--accent-soft)]">
					Zurück
				</button>
				<span className="text-base tabular-nums text-[var(--text-secondary)]">{currentStepIndex + 1} / {totalSteps}</span>
				{hasNext ? (
					<button onClick={onNext} className="inline-flex items-center justify-center rounded-full bg-[var(--accent)] px-6 py-3 text-base font-medium text-white transition-colors duration-150 hover:bg-[var(--accent-deep)]">
						Weiter
					</button>
				) : (
					<button onClick={onExitCooking} className="inline-flex items-center justify-center gap-2 rounded-full bg-[var(--olive)] px-7 py-3.5 text-lg font-medium text-white transition-colors duration-150 hover:bg-[var(--olive-deep)]">
						Fertig!
					</button>
				)}
			</div>
		</div>
	);
}
