import Hero from "./components/Hero";
import LogoMarquee from "./components/LogoMarquee";

export default function App() {
	return (
		<main className="min-h-screen w-full px-4 py-8 md:px-8 md:py-12">
			<Hero />
			<LogoMarquee />
		</main>
	);
}
