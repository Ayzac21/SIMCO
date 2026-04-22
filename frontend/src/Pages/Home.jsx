import Navbar from "../components/Navbar";
import Hero from "../components/Hero";

export default function Home() {
    return (
        <div className="min-h-dvh flex flex-col bg-[#f4f1ee]">
            <Navbar />
            <Hero />
        </div>
    );
}
