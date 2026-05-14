// ── Categorias padrão ────────────────────────────────────────────────────

export const DEFAULT_CATEGORIES = [
  // DESPESAS
  { name: "Alimentação",    icon: "UtensilsCrossed", color: "#f97316", type: "expense" },
  { name: "Supermercado",   icon: "ShoppingCart",    color: "#ef4444", type: "expense" },
  { name: "Transporte",     icon: "Car",             color: "#8b5cf6", type: "expense" },
  { name: "Moradia",        icon: "Home",            color: "#06b6d4", type: "expense" },
  { name: "Saúde",          icon: "Heart",           color: "#ec4899", type: "expense" },
  { name: "Educação",       icon: "GraduationCap",  color: "#3b82f6", type: "expense" },
  { name: "Lazer",          icon: "Gamepad2",        color: "#a855f7", type: "expense" },
  { name: "Roupas",         icon: "Shirt",           color: "#f59e0b", type: "expense" },
  { name: "Streaming",      icon: "Tv",              color: "#10b981", type: "expense" },
  { name: "Outros",         icon: "MoreHorizontal",  color: "#6b7280", type: "expense" },
  // RECEITAS
  { name: "Salário",        icon: "Briefcase",       color: "#10b981", type: "income"  },
  { name: "Freelance",      icon: "Laptop",          color: "#06b6d4", type: "income"  },
  { name: "Investimentos",  icon: "TrendingUp",      color: "#8b5cf6", type: "income"  },
  { name: "Outros",         icon: "Plus",            color: "#6b7280", type: "income"  },
] as const;

// ── Tipos de conta ────────────────────────────────────────────────────────

export const ACCOUNT_TYPES = [
  { value: "checking",    label: "Conta Corrente", icon: "Building2"  },
  { value: "savings",     label: "Poupança",        icon: "PiggyBank"  },
  { value: "wallet",      label: "Carteira",        icon: "Wallet"     },
  { value: "investment",  label: "Investimento",    icon: "TrendingUp" },
] as const;

// ── Bandeiras de cartão ───────────────────────────────────────────────────

export const CARD_BRANDS = [
  { value: "visa",       label: "Visa"        },
  { value: "mastercard", label: "Mastercard"  },
  { value: "elo",        label: "Elo"         },
  { value: "amex",       label: "Amex"        },
  { value: "hipercard",  label: "Hipercard"   },
  { value: "other",      label: "Outro"       },
] as const;

// ── Tipos de split ────────────────────────────────────────────────────────

export const SPLIT_TYPES = [
  { value: "individual",   label: "Individual (só eu)"       },
  { value: "equal",        label: "50/50 (igualmente)"       },
  { value: "proportional", label: "Proporcional"              },
  { value: "custom",       label: "Personalizado"             },
] as const;

// ── Cores disponíveis ─────────────────────────────────────────────────────

export const PALETTE = [
  "#ef4444", "#f97316", "#f59e0b", "#10b981",
  "#06b6d4", "#3b82f6", "#8b5cf6", "#ec4899",
  "#6b7280", "#84cc16", "#14b8a6", "#a855f7",
] as const;
