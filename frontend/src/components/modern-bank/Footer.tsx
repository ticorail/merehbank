export default function Footer() {
  return (
    <footer id="contact" className="bg-foreground text-background py-16">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid md:grid-cols-4 gap-12 mb-12">
          {/* Brand */}
          <div className="md:col-span-1">
            <a href="/" className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-background rounded-lg flex items-center justify-center">
                <span className="text-foreground font-serif font-bold text-xl">M</span>
              </div>
              <span className="font-serif text-xl font-semibold">Banque Mereh</span>
            </a>
            <p className="text-background/70 text-sm leading-relaxed">
              Votre partenaire financier de confiance en Haïti.
            </p>
          </div>

          {/* Links */}
          <div>
            <h4 className="font-semibold mb-4">Services</h4>
            <ul className="space-y-3 text-sm text-background/70">
              <li><a href="#" className="hover:text-background transition-colors">Comptes courants</a></li>
              <li><a href="#" className="hover:text-background transition-colors">Épargne</a></li>
              <li><a href="#" className="hover:text-background transition-colors">Crédits</a></li>
              <li><a href="#" className="hover:text-background transition-colors">Assurances</a></li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold mb-4">À propos</h4>
            <ul className="space-y-3 text-sm text-background/70">
              <li><a href="#" className="hover:text-background transition-colors">Notre histoire</a></li>
              <li><a href="#" className="hover:text-background transition-colors">Carrières</a></li>
              <li><a href="#" className="hover:text-background transition-colors">Presse</a></li>
              <li><a href="#" className="hover:text-background transition-colors">RSE</a></li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold mb-4">Contact</h4>
            <ul className="space-y-3 text-sm text-background/70">
              <li>contact@banquemereh.ca</li>
              <li>+509 43499854</li>
              <li>Port-au-Prince, Haiti </li>
            </ul>
          </div>
        </div>

        {/* Bottom */}
        <div className="pt-8 border-t border-background/20 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-sm text-background/60">
            © 2026 Banque Mereh. Tous droits réservés.
          </p>
          <div className="flex gap-6 text-sm text-background/60">
            <a href="#" className="hover:text-background transition-colors">Mentions légales</a>
            <a href="#" className="hover:text-background transition-colors">Confidentialité</a>
            <a href="#" className="hover:text-background transition-colors">Cookies</a>
          </div>
        </div>
      </div>
    </footer>
  )
}
