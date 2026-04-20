import Navbar from "../components/Navbar";
import Hero from "../components/Hero";

export default function Home() {
    return (
        <>
            <div className="h-screen overflow-hidden flex flex-col">
                <Navbar />
                <Hero />
            </div>
        </>
    );
}
