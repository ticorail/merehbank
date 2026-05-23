"use client"

import { ArrowLeftRight, Smartphone, Zap, CreditCard, Plus } from "lucide-react"
import { cn } from "@/services/utils"

const quickActions = [
  {
    icon: ArrowLeftRight,
    label: "Transfert",
    description: "Entre comptes",
    color: "bg-primary/10 text-primary",
  },
  {
    icon: Smartphone,
    label: "Recharge",
    description: "Mobile & Data",
    color: "bg-accent/10 text-accent",
  },
  {
    icon: Zap,
    label: "Factures",
    description: "EDH, Eau...",
    color: "bg-chart-3/10 text-chart-3",
  },
  {
    icon: CreditCard,
    label: "Carte",
    description: "Virtuelle",
    color: "bg-chart-4/10 text-chart-4",
  },
]

export function QuickActions() {
  return (
    <div className="rounded-2xl bg-card p-6">
      <h2 className="text-lg font-semibold">Actions rapides</h2>
      
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {quickActions.map((action) => (
          <button
            key={action.label}
            type="button"
            onClick={() => {
              if (action.label === 'Transfert') {
                window.location.assign('/dashboard/transfers')
              }
            }}
            className="group flex flex-col items-center rounded-xl border border-border bg-secondary/30 p-4 transition-all hover:border-primary/30 hover:bg-secondary"
          >
            <div
              className={cn(
                "flex h-12 w-12 items-center justify-center rounded-xl transition-transform group-hover:scale-110",
                action.color
              )}
            >
              <action.icon className="h-5 w-5" />
            </div>
            <p className="mt-3 font-medium">{action.label}</p>
            <p className="text-xs text-muted-foreground">{action.description}</p>
          </button>
        ))}
      </div>
    </div>
  )
}
