# GuiaBR

O GuiaBR é uma aplicação PWA desenvolvida para auxiliar na divulgação e promoção da alimentação adequada com base no Guia Alimentar para a População Brasileira.

## Tecnologias

| Camada             | Tecnologia                                                                                  |
| ------------------ | ------------------------------------------------------------------------------------------- |
| Frontend           | Angular 20, TypeScript, RxJS, Dexie (IndexedDB), Service Worker (PWA), `@zxing/ngx-scanner` |
| Backend            | Python, Flask, SQLAlchemy, Flask-JWT-Extended, Gunicorn                                     |
| Banco de dados     | PostgreSQL                                                                                  |
| Infra              | Docker Compose, Nginx, Ngrok (exposição para testes externos)                               |
| Testes             | pytest (backend) · Karma/Jasmine + Cypress (frontend)                                       |
| Integração externa | [Open Food Facts](https://world.openfoodfacts.org/)                                         |

## Como Executar (desenvolvimento local)

```bash
# Banco de dados
cd backend
docker-compose -f docker-compose.db.yml up -d

# Backend
pip install -r requirements-dev.txt
python scripts/seed.py && python scripts/seed_basicos.py   # 1ª vez (ver nota abaixo)
python run.py

# Frontend (em outro terminal, a partir de gapb-app/)
npm install
ng serve --host 0.0.0.0 --ssl true --ssl-cert ./certificados/192.168.1.233.pem --ssl-key ./certificados/192.168.1.233-key.pem
```

_Notas: (1) `data/sazonalidade_consolidada_produtos.csv` não é gerado automaticamente — se estiver ausente/desatualizado, rode `python scripts/xlsx_to_csv.py` antes do seed. (2) `gapb-app/certificados/` é ignorado pelo git (chaves privadas) — um clone novo não vem com os certificados; gere um autoassinado antes do `ng serve` (veja [docs/README-deploy.md](docs/README-deploy.md)). (3) HTTPS é obrigatório para o navegador liberar a câmera._

Para subir a stack completa via Docker e expor publicamente com Ngrok, veja **[docs/README-deploy.md](docs/README-deploy.md)**.

## Testes

```bash
pytest --cov=app --cov-report=term-missing   # backend, a partir de backend/
npm run test:headless                        # frontend unitário, a partir de gapb-app/
npm run e2e:run                               # frontend E2E, a partir de gapb-app/
```
