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
python scripts/seed.py   # 1ª vez: aplica as migrações e carrega os alimentos (ver nota abaixo)
python run.py

# Frontend (em outro terminal, a partir de gapb-app/)
npm install
ng serve --host 0.0.0.0 --ssl true --ssl-cert ./certificados/192.168.1.233.pem --ssl-key ./certificados/192.168.1.233-key.pem
```

_Notas: (1) `data/sazonalidade_consolidada_produtos.csv` não é gerado automaticamente — se estiver ausente/desatualizado, rode `python scripts/xlsx_to_csv.py` antes do seed. Para apagar e recarregar os alimentos, use `python scripts/seed.py --reset`. (2) `gapb-app/certificados/` é ignorado pelo git (chaves privadas) — um clone novo não vem com os certificados; gere um autoassinado antes do `ng serve` (veja [docs/README-deploy.md](docs/README-deploy.md)). (3) HTTPS é obrigatório para o navegador liberar a câmera. (4) `python run.py` sobe sem o depurador do Flask; para ligar depurador e recarga automática, defina `FLASK_DEBUG=1` antes de rodar._

Para subir a stack completa via Docker e expor publicamente com Ngrok, veja **[docs/README-deploy.md](docs/README-deploy.md)**.

## Migrações do banco

O schema é versionado com Flask-Migrate (Alembic), em `backend/migrations/`. Comandos a partir de `backend/`:

```bash
python -m flask db upgrade                    # aplica as migrações pendentes
python -m flask db migrate -m "descrição"     # gera uma migração a partir de mudanças em app/models.py
python -m flask db downgrade                  # desfaz a última migração
```

O `scripts/seed.py` já roda o `upgrade`, então um banco novo não precisa de outro passo. Depois de atualizar o código, rode `python -m flask db upgrade` para aplicar as migrações novas.

**Banco criado antes das migrações** (pelo `db.create_all()` de versões anteriores): marque-o uma única vez como estando na revisão inicial e então atualize. O seed avisa quando esse é o caso.

```bash
python -m flask db stamp 0001
python -m flask db upgrade
```

Ao mudar `app/models.py`, gere a migração, revise o arquivo criado em `migrations/versions/` e faça o commit dele junto com a mudança; `tests/test_migracoes.py` falha se os modelos e as migrações divergirem.

## Testes

```bash
pytest --cov=app --cov-report=term-missing   # backend, a partir de backend/
npm run test:headless                        # frontend unitário (Windows + Edge), a partir de gapb-app/
npm run test:ci                              # frontend unitário (Linux/Mac/CI, usa o Chrome instalado)
npm run e2e:run                               # frontend E2E, a partir de gapb-app/
```
