import '@/styles/modern-bank.css'
import Header from '@/components/modern-bank/Header'
import Hero from '@/components/modern-bank/Hero'
import Services from '@/components/modern-bank/Services'
import Stats from '@/components/modern-bank/Stats'
import Footer from '@/components/modern-bank/Footer'

export default function HomePage() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main>
        <Hero />
        <Services />
        <Stats />
      </main>
      <Footer />
    </div>
  )
}
