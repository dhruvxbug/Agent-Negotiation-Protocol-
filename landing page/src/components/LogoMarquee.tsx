interface Logo {
	src: string;
	alt: string;
	gradient: { from: string; to: string };
}

const LOGOS: Logo[] = [
	{
		src: "/assets/procure.svg",
		alt: "Procure",
		gradient: { from: "#1d4ed8", to: "#60a5fa" },
	},
	{
		src: "/assets/shopify.svg",
		alt: "Shopify",
		gradient: { from: "#facc15", to: "#fde047" },
	},
	{
		src: "/assets/blender.svg",
		alt: "Blender",
		gradient: { from: "#2563eb", to: "#93c5fd" },
	},
	{
		src: "/assets/figma.svg",
		alt: "Figma",
		gradient: { from: "#7c3aed", to: "#c4b5fd" },
	},
	{
		src: "/assets/spotify.svg",
		alt: "Spotify",
		gradient: { from: "#ec4899", to: "#ef4444" },
	},
	{
		src: "/assets/lottielab.svg",
		alt: "Lottielab",
		gradient: { from: "#facc15", to: "#84cc16" },
	},
	{
		src: "/assets/google-cloud.svg",
		alt: "Google Cloud",
		gradient: { from: "#7dd3fc", to: "#bae6fd" },
	},
	{
		src: "/assets/bing.svg",
		alt: "Bing",
		gradient: { from: "#06b6d4", to: "#2dd4bf" },
	},
];

function LogoCard({ logo }: { logo: Logo }) {
	return (
		<div className="group relative h-24 w-40 shrink-0 flex items-center justify-center rounded-full bg-white border border-slate-200/60 shadow-sm hover:border-slate-300 transition-all overflow-hidden">
			<div
				aria-hidden
				className="absolute inset-0 scale-150 opacity-0 transition-all duration-500 ease-out group-hover:scale-100 group-hover:opacity-100"
				style={{
					backgroundImage: `linear-gradient(135deg, ${logo.gradient.from}, ${logo.gradient.to})`,
				}}
			/>
			<img
				src={logo.src}
				alt={logo.alt}
				loading="lazy"
				draggable={false}
				className="relative z-10 h-9 w-auto max-w-[104px] object-contain transition-all duration-300 group-hover:brightness-0 group-hover:invert"
			/>
		</div>
	);
}

/**
 * Seamless infinite logo scroller. The track holds two identical halves
 * (the list rendered twice inline); a pure CSS keyframe animation slides
 * it from translateX(0) to translateX(-50%) — exactly one half-width —
 * so the loop restarts without a visible seam. Hover pauses the animation.
 */
export default function LogoMarquee() {
	return (
		<div
			className="marquee mt-10 w-full max-w-[1400px] mx-auto overflow-hidden"
			style={{
				maskImage:
					"linear-gradient(to right, transparent, black 12%, black 88%, transparent)",
				WebkitMaskImage:
					"linear-gradient(to right, transparent, black 12%, black 88%, transparent)",
			}}
		>
			<div className="marquee-track flex w-max py-2">
				{[false, true].map((isDuplicate) => (
					<div
						key={String(isDuplicate)}
						aria-hidden={isDuplicate || undefined}
						className="flex items-center gap-5 pr-5"
					>
						{LOGOS.map((logo) => (
							<LogoCard key={`${isDuplicate}-${logo.alt}`} logo={logo} />
						))}
					</div>
				))}
			</div>
		</div>
	);
}
