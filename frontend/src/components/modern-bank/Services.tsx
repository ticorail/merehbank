import { CreditCard, PiggyBank, TrendingUp, Shield, Smartphone, Users } from 'lucide-react'

const services = [
  {
    icon: CreditCard,
    title: 'Comptes Courants',
    description: 'Gérez vos finances quotidiennes avec nos comptes sans frais cachés et des outils de gestion modernes.',
  },
  {
    icon: PiggyBank,
    title: 'Épargne',
    description: 'Faites fructifier votre argent avec nos solutions d\'épargne aux taux compétitifs.',
  },
  {
    icon: TrendingUp,
    title: 'Investissements',
    description: 'Construisez votre patrimoine avec nos conseillers experts et nos outils d\'investissement.',
  },
  {
    icon: Shield,
    title: 'Assurances',
    description: 'Protégez ce qui compte le plus avec nos offres d\'assurance complètes.',
  },
  {
    icon: Smartphone,
    title: 'Banque Mobile',
    description: 'Accédez à vos comptes partout, à tout moment, avec notre application primée.',
  },
  {
    icon: Users,
    title: 'Entreprises',
    description: 'Solutions sur mesure pour accompagner la croissance de votre entreprise.',
  },
]

export default function Services() {
  return (
    <section id="services" className="py-24 bg-card">
      <div className="max-w-7xl mx-auto px-6">
        {/* Section Header */}
        <div className="text-center mb-16">
          <h2 className="font-serif text-4xl md:text-5xl font-semibold text-foreground mb-4 text-balance">
            Nos services financiers
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto text-pretty">
            Une gamme complète de solutions pour répondre à tous vos besoins bancaires
          </p>
        </div>

        {/* Services Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {services.map((service, index) => (
            <div
              key={index}
              className="group p-8 bg-background border border-border rounded-2xl hover:border-primary/30 hover:shadow-lg transition-all duration-300"
            >
              <div className="w-14 h-14 bg-primary/10 rounded-xl flex items-center justify-center mb-6 group-hover:bg-primary/20 transition-colors">
                <service.icon className="w-7 h-7 text-primary" />
              </div>
              <h3 className="text-xl font-semibold text-foreground mb-3">
                {service.title}
              </h3>
              <p className="text-muted-foreground leading-relaxed">
                {service.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
