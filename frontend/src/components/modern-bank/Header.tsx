import { Menu, X } from 'lucide-react'
import { useState } from 'react'

export default function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b border-border">
      <div className="max-w-7xl mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <a href="/" className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
              <span className="text-primary-foreground font-serif font-bold text-xl">M</span>
            </div>
            <span className="font-serif text-xl font-semibold text-foreground">Banque Mereh</span>
          </a>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-8">
            <a href="#services" className="text-muted-foreground hover:text-foreground transition-colors font-medium">
              Services
            </a>
            <a href="#about" className="text-muted-foreground hover:text-foreground transition-colors font-medium">
              À propos
            </a>
            <a href="#contact" className="text-muted-foreground hover:text-foreground transition-colors font-medium">
              Contact
            </a>
          </nav>

          {/* CTA Buttons */}
          <div className="hidden md:flex items-center gap-4">
            <a
              href="/login"
              className="px-5 py-2.5 text-foreground font-medium hover:text-primary transition-colors"
            >
              Connexion
            </a>
            <a
              href="/login"
              className="px-5 py-2.5 bg-primary text-primary-foreground font-medium rounded-lg hover:bg-primary/90 transition-colors"
            >
              Ouvrir un compte
            </a>
          </div>

          {/* Mobile Menu Button */}
          <button
            className="md:hidden p-2 text-foreground"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            aria-label="Toggle menu"
          >
            {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

        {/* Mobile Navigation */}
        {isMenuOpen && (
          <nav className="md:hidden mt-4 pb-4 border-t border-border pt-4 flex flex-col gap-4">
            <a href="#services" className="text-muted-foreground hover:text-foreground transition-colors font-medium">
              Services
            </a>
            <a href="#about" className="text-muted-foreground hover:text-foreground transition-colors font-medium">
              À propos
            </a>
            <a href="#contact" className="text-muted-foreground hover:text-foreground transition-colors font-medium">
              Contact
            </a>
            <div className="flex flex-col gap-3 pt-4 border-t border-border">
              <a
                href="/login"
                className="px-5 py-2.5 text-center text-foreground font-medium border border-border rounded-lg"
              >
                Connexion
              </a>
              <a
                href="/login"
                className="px-5 py-2.5 text-center bg-primary text-primary-foreground font-medium rounded-lg"
              >
                Ouvrir un compte
              </a>
            </div>
          </nav>
        )}
      </div>
    </header>
  )
}
