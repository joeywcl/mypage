import Header from '@/components/Header'
import Hero from '@/components/Hero'
import Highlights from '@/components/Highlights'
import About from '@/components/About'
import Projects from '@/components/Projects'
import DesignSystems from '@/components/DesignSystems'
import BeyondWork from '@/components/BeyondWork'
import Contact from '@/components/Contact'
import Footer from '@/components/Footer'

export default function Page() {
  return (
    <>
      <Header />
      <main>
        <Hero />
        <Highlights />
        <Projects />
        <About />
        <DesignSystems />
        <BeyondWork />
        <Contact />
      </main>
      <Footer />
    </>
  )
}

