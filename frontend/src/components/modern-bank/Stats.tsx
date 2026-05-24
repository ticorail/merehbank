const stats = [
  { value: '50+', label: 'Années d\'expérience' },
  { value: '500K+', label: 'Clients satisfaits' },
  { value: '120', label: 'Agences en Haïti' },
  { value: '98%', label: 'Taux de satisfaction' },
]

export default function Stats() {
  return (
    <section className="py-20 bg-primary">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {stats.map((stat, index) => (
            <div key={index} className="text-center">
              <div className="font-serif text-4xl md:text-5xl font-bold text-primary-foreground mb-2">
                {stat.value}
              </div>
              <div className="text-primary-foreground/80 font-medium">
                {stat.label}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
