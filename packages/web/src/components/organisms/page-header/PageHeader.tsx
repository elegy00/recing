interface Props {
	title: string;
	subtitle?: string;
	decorativeIcon?: React.ReactNode;
}

export function PageHeader({ title, subtitle, decorativeIcon }: Props) {
	return (
		<div className="mb-10 flex items-end justify-between gap-6">
			<div>
				<h1 className="font-serif text-4xl font-semibold tracking-tight sm:text-5xl">{title}</h1>
				<div className="mt-3 h-1 w-16 rounded-full bg-[var(--accent)]" />
				{subtitle && (
					<p className="mt-4 max-w-xl text-lg leading-relaxed text-[var(--text-secondary)]">
						{subtitle}
					</p>
				)}
			</div>
			{decorativeIcon && <div className="mb-1 hidden sm:block">{decorativeIcon}</div>}
		</div>
	);
}
