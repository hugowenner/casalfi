// Responsabilidade: interpretar texto livre em português e extrair dados de transação.
// Usa OpenRouter (Claude) via fetch puro — sem SDK, sem dependências extras.

import type { ParsedTransaction, RawAIResponse } from "@/types/telegram";

// ── Prompt ────────────────────────────────────────────────────────────────
// Regras que passamos para a IA:
// 1. Categorias fixas (as mesmas do constants.ts) — evita alucinações
// 2. Exemplos concretos para cada mapeamento
// 3. Retorno JSON estrito — response_format garante isso no lado do modelo

const SYSTEM_PROMPT = `Você é um assistente financeiro especializado em interpretar mensagens em português brasileiro.

Analise a mensagem e extraia os dados de uma transação financeira.
Retorne SOMENTE um objeto JSON com esta estrutura exata, sem texto adicional:

{
  "type": "expense" | "income",
  "amount": número positivo (null se não conseguir extrair),
  "category": string (escolha da lista abaixo),
  "description": string (máx 80 chars, claro e conciso),
  "confidence": número entre 0.0 e 1.0,
  "splitType": "individual" | "equal" (padrão: "individual")
}

CATEGORIAS DE DESPESA (use exatamente este nome):
- Alimentação → restaurante, lanche, fast food, delivery, ifood, rappi
- Supermercado → mercado, feira, compras de casa, hortifruti
- Transporte → uber, 99, táxi, ônibus, gasolina, combustível, estacionamento
- Moradia → aluguel, condomínio, água, luz, gás, internet, IPTU
- Saúde → farmácia, médico, academia, dentista, plano de saúde
- Educação → curso, livro, escola, faculdade, mensalidade
- Lazer → cinema, show, viagem, passeio, jogo
- Roupas → roupa, calçado, acessório, shopping
- Streaming → netflix, spotify, youtube, amazon prime, disney
- Outros → qualquer despesa que não se encaixa acima

CATEGORIAS DE RECEITA (use exatamente este nome):
- Salário → salário, pagamento, contracheque, vale, holerite
- Freelance → freela, projeto, trabalho extra, bico, consultoria
- Investimentos → dividendo, rendimento, CDB, ação, FII
- Outros → qualquer receita que não se encaixa acima

REGRAS DE NEGÓCIO:
- "dividido", "dividir", "50/50", "metade" → splitType = "equal"
- Valores podem vir como: "80 reais", "R$80", "oitenta reais", "80,50", "gastei 80", "50 no mercado"
- Qualquer número isolado após "gastei", "paguei", "comprei", "recebi" é o valor em reais
- Confiance alto (>0.85): valor e tipo claros. Baixo (<0.5): ambíguo.
- Se não conseguir extrair o valor, retorne amount: null
- description deve ser em português, curta e informativa

EXEMPLOS:
"gastei 80 no mercado" → {"type":"expense","amount":80,"category":"Supermercado","description":"Compras no mercado","confidence":0.95,"splitType":"individual"}
"uber 25 reais" → {"type":"expense","amount":25,"category":"Transporte","description":"Corrida Uber","confidence":0.97,"splitType":"individual"}
"recebi 3000 de salário" → {"type":"income","amount":3000,"category":"Salário","description":"Salário mensal","confidence":0.98,"splitType":"individual"}
"pizza 70 dividido" → {"type":"expense","amount":70,"category":"Alimentação","description":"Pizza","confidence":0.92,"splitType":"equal"}
"comprei uns negócios" → {"type":"expense","amount":null,"category":"Outros","description":"Compra não especificada","confidence":0.2,"splitType":"individual"}`;

// ── parseTransactionFromText ──────────────────────────────────────────────

export async function parseTransactionFromText(
  text: string
): Promise<ParsedTransaction | null> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    console.error("[AI Parser] OPENROUTER_API_KEY não definido");
    return null;
  }

  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        // OpenRouter exige estes headers para identificar o app
        "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL ?? "https://casalfi.app",
        "X-Title": "Casalfi",
      },
      body: JSON.stringify({
        // claude-3-5-haiku é rápido e barato — ideal para parsing de texto curto
        model: "anthropic/claude-3-5-haiku",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: text },
        ],
        // Garante JSON válido na resposta — não precisa usar regex
        response_format: { type: "json_object" },
        max_tokens: 200,
        temperature: 0.1, // Baixo para respostas mais determinísticas
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("[AI Parser] OpenRouter error:", res.status, err);
      return null;
    }

    const data = await res.json() as {
      choices: Array<{ message: { content: string } }>;
    };

    const content = data.choices[0]?.message?.content;
    if (!content) return null;

    const raw = JSON.parse(content) as RawAIResponse;
    return validate(raw);
  } catch (err) {
    console.error("[AI Parser] Erro ao parsear:", err);
    return null;
  }
}

// ── validate ──────────────────────────────────────────────────────────────
// Converte o JSON bruto da IA em ParsedTransaction tipado.
// Se amount for null ou o tipo for inválido, retorna null — o orquestrador
// pedirá confirmação ao usuário.

function validate(raw: RawAIResponse): ParsedTransaction | null {
  if (raw.amount === null || raw.amount <= 0) return null;
  if (raw.type !== "income" && raw.type !== "expense") return null;

  return {
    type: raw.type,
    amount: raw.amount,
    category: raw.category ?? "Outros",
    description: (raw.description ?? "Transação").substring(0, 80),
    confidence: Math.min(1, Math.max(0, raw.confidence ?? 0.5)),
    splitType: raw.splitType === "equal" ? "equal" : "individual",
  };
}
