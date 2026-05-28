# PROMPTS.md — CaseCellShop

Registro resumido dos prompts e decisões orientadoras usados durante o desenvolvimento (via assistente de IA).

## Arquitetura e escopo do desafio

- Implementar checkout fullstack incremental, reduzindo dependência síncrona do ERP.
- Priorizar: não oversell, idempotência, estados claros, resiliência a ERP lento/instável.
- Evitar overengineering; sem Redis/mensageria real na primeira entrega.

## Stack e infraestrutura

- Usar **Postgres + Docker Compose** para padronizar ambiente.
- Inicialmente **sem Redis/BullMQ**; worker interno com outbox/polling; fila como evolução.
- Imports com alias `@/*` → `src/*`; commits semânticos em português.

## Backend

- APIs: `GET /products`, `POST /checkout`, `GET /orders/:id`, `GET /health`.
- Reserva de estoque transacional; `Idempotency-Key` com unique constraint.
- Simulação de ERP com delay e taxa de falha configurável.
- Logs estruturados com `requestId` e `idempotencyKey`.
- Endurecimento: Helmet, Throttler, CORS, proteção de `GET /orders/:id` com idempotency key.

## Frontend

- Tela única: listar/selecionar produto, quantidade, finalizar compra.
- Loading, bloqueio de duplo clique, mensagens humanas por código de erro.
- Idempotência: backend gera chave se ausente; frontend persiste attempt por `productId + quantity` (não chave global no localStorage).
- React Query para cache de produtos.

## Docker

- Stack completa: postgres → api (healthy) → web (healthy).
- Frontend na porta **3001**; API na **3000**.
- Modo dev com `docker-compose.dev.yml` e hot reload.

## Qualidade

- Testes unitários em inglês; cobertura mínima em regras críticas.
- README com instalação, decisões, limitações, diagrama mermaid e estratégia de testes.
