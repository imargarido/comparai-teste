# Comparaí · versão de teste

Comparador de preços de supermercado alimentado por notas fiscais (NFC-e) enviadas pelos usuários.

- Front-end: PWA estático (HTML/CSS/JS), sem build.
- Back-end: Supabase (projeto `comparai`): tabelas `mercados`, `notas`, `precos`; função `enviar-nota` interpreta o texto da nota.
- Só o preço unitário é usado na comparação. Nenhum dado pessoal (CPF) é salvo.
