# Copa do Mundo de Vendas Diária — Tênis One

Sistema demonstrativo para GitHub Pages.

## Acessos

- Gerente / Administrador: senha `2026`
- Vendedores / Acompanhamento: senha `vendas`

## Regra oficial aplicada

- Time Verde: Isack + Viviane
- Time Azul: Matheus + Brian
- Cada dia é uma rodada.
- O gerente lança as vendas por vendedor.
- O sistema soma automaticamente por dupla.
- A dupla com maior faturamento do dia marca gol.
- Dias 01 a 10: vitória do dia = 1 gol.
- Dias 11 a 20: vitória do dia = 2 gols.
- Dias 21 ao fim: vitória do dia = 3 gols.
- Bônus da dezena: +3 gols automáticos para a dupla com maior faturamento acumulado da dezena.
- Artilheiro individual: vendedor com maior faturamento acumulado no mês.

## Fluxo do gerente

1. Entrar como gerente com senha `2026`.
2. Cadastrar ou editar vendedores.
3. Enviar fotos e configurar figurinhas.
4. Lançar a venda diária por vendedor.
5. Ao salvar uma venda, o sistema recalcula automaticamente:
   - total do Time Verde;
   - total do Time Azul;
   - vencedor da rodada;
   - gols da rodada;
   - bônus da dezena;
   - placar geral;
   - ranking individual;
   - artilheiro.

O gerente pode usar os botões de recálculo apenas para conferência ou correção.

## Fluxo do vendedor

1. Entrar como vendedor com senha `vendas`.
2. Escolher o nome.
3. Acompanhar placar, ranking, desempenho, álbum e figurinhas.
4. O vendedor não altera dados.

## Publicação no GitHub Pages

Suba todos os arquivos na raiz do repositório e publique pelo GitHub Pages.

thIAguinho Soluções — tecnologia sob medida.
