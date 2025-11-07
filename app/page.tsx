import Header from '@/components/Header'
import Hero from '@/components/Hero'
import About from '@/components/About'
import Projects from '@/components/Projects'
import DesignSystems from '@/components/DesignSystems'
import Contact from '@/components/Contact'
import Footer from '@/components/Footer'

export default function Page() {
  return (
    <>
      <Header />
      <main>
        <Hero />
        <About />
        <Projects />
        <DesignSystems />
        <Contact />
      </main>
      <Footer />
    </>
  )
}

