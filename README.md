# Copa do Mundo das Vendas — Tênis One

Demonstração para GitHub Pages da gincana da Tênis One.

## Acessos

- Gerente / Administrador: senha `2026`
- Vendedor / Acompanhamento: senha `vendas`

## Lógica da campanha

- Time Verde: Isack e Viviane.
- Time Azul: Matheus e Brian.
- O gerente lança vendas por vendedor.
- O sistema soma automaticamente por equipe.
- Cada dia é uma rodada.
- A dupla com maior faturamento no dia marca gol.
- Dias 01 a 10: vitória do dia vale 1 gol.
- Dias 11 a 20: vitória do dia vale 2 gols.
- Dias 21 a 30: vitória do dia vale 3 gols.
- Bônus por dezena: +3 gols para a dupla definida pelo gerente.
- Artilheiro individual: vendedor com maior faturamento acumulado.

## Permissões

### Gerente
Pode cadastrar vendedores, editar figurinhas, enviar fotos, escolher raridade, definir título, lançar vendas, fechar rodadas, aplicar bônus e gerar relatórios.

### Vendedor
Apenas acompanha placar, ranking, vendas, álbum e figurinhas. Não altera dados.

## GitHub Pages

Publique os arquivos na raiz do repositório:
- `index.html`
- `styles.css`
- `app.js`
- `config.js`

## Configurações opcionais

O sistema funciona localmente no navegador. Para usar Firebase Realtime Database e Cloudinary, preencha os dados no `config.js`.
