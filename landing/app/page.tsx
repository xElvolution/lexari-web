import Header from "@/components/Header";
import Hero from "@/components/Hero";
import Desk from "@/components/Desk";
import Memory from "@/components/Memory";
import Roster from "@/components/Roster";
import Seats from "@/components/Seats";
import Access from "@/components/Access";
import Faq from "@/components/Faq";
import Finale from "@/components/Finale";
import Reveal from "@/components/Reveal";

export default function Home() {
  return (
    <main className="overflow-x-clip">
      <Header />
      <Hero />
      <Desk />
      <Memory />
      <Roster />
      <Seats />
      <Access />
      <Faq />
      <Finale />
      <Reveal />
    </main>
  );
}
