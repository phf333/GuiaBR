# Guia de Execução com Docker e Ngrok

Este guia orienta como iniciar o GuiaBR no seu computador utilizando contêineres Docker e utilizando um túnel do **Ngrok**.

---

## Requisitos Prévios

1. **Docker e Docker Compose** instalado.
2. **Ngrok** instalado em sua máquina.
   - Se não tiver, baixe em [ngrok.com](https://ngrok.com/).
   - Crie uma conta gratuita e configure o seu token de autenticação no terminal:
     ```bash
     ngrok config add-authtoken SEU_AUTHTOKEN_AQUI
     ```

---

## 0. Configurar ENV

Para configurar:

1. Copie o modelo:
   ```bash
   cp .env.example .env
   ```
2. Edite `.env` na raiz do projeto e preencha `POSTGRES_PASSWORD`, `SECRET_KEY` e `JWT_SECRET_KEY` com valores próprios.

3. Se for expor a aplicação num domínio/IP diferente de `localhost`/`192.168.1.233`, ajuste também `ALLOWED_ORIGINS` no `.env` (lista de origens separadas por vírgula, com `https://`).

## 0.1 Certificados HTTPS (obrigatório para o frontend iniciar)

O Nginx do frontend (`gapb-app/nginx.conf`) referencia diretamente os arquivos `gapb-app/certificados/192.168.1.233.pem` e `192.168.1.233-key.pem`.

**O Nginx falha ao iniciar** se esses arquivos não existirem, mesmo que você só vá acessar a aplicação por um túnel do Ngrok. Como a pasta `certificados/` contém chaves privadas, ela é ignorada pelo git — então um clone novo do repositório **não** vem com esses arquivos.

Antes do primeiro `docker compose up`, gere um certificado autoassinado com esses nomes exatos:

```bash
MSYS_NO_PATHCONV=1 openssl req -x509 -nodes -days 825 -newkey rsa:2048 \
  -keyout gapb-app/certificados/192.168.1.233-key.pem \
  -out gapb-app/certificados/192.168.1.233.pem \
  -subj "/CN=localhost"
```

_O prefixo `MSYS_NO_PATHCONV=1` só é necessário no Git Bash do Windows — sem ele, o `/CN=localhost` é interpretado como um caminho de arquivo e o comando falha com um erro confuso. Em Linux/Mac, rode sem esse prefixo._

_Isso é suficiente para o Nginx iniciar e para o fluxo via Ngrok (seção abaixo) funcionar — o conteúdo do certificado não importa nesse caso, só precisa existir._

Se for acessar a aplicação **diretamente pelo IP da máquina** (sem Ngrok), gere o certificado com o IP real no lugar de `localhost` (`-subj "/CN=SEU-IP-AQUI"`) e ajuste `server_name` em `gapb-app/nginx.conf` e os caminhos verificados em `backend/run.py` de acordo — do contrário o navegador vai acusar incompatibilidade entre o certificado e o endereço acessado (mesmo aviso de "conexão não seguro" já esperado com certificados autoassinados).

---

## Como Rodar a Aplicação

### 1. Construir e Iniciar os Contêineres

Na raiz do projeto (onde está o arquivo `docker-compose.yml`), execute o comando para compilar o Angular e montar os serviços:

```bash
docker compose up -d --build
```

_Isso criará o banco Postgres, subirá o backend Flask em produção na porta 5000 (interna) e iniciará o Nginx (frontend) nas portas 80 e 443._

### 2. Criar e Popular o Banco de Dados (Seed)

_O `data/sazonalidade_consolidada_produtos.csv` não é gerado automaticamente — se ele estiver ausente ou desatualizado (nova planilha da CEAGESP), gere-o **antes** do `docker compose up --build` seguindo os passos em [README.md](../README.md#como-executar-desenvolvimento-local), já que o arquivo é copiado pra dentro da imagem no build._

Na primeira execução, é necessário rodar os scripts de seed para criar as tabelas no PostgreSQL, importar a sazonalidade dos alimentos e cadastrar os alimentos básicos do Guia Alimentar:

```bash
# Cria as tabelas e importa alimentos com sazonalidade (CSV)
docker compose exec backend python scripts/seed.py

# Importa alimentos básicos de referência do Guia Alimentar Brasileiro
docker compose exec backend python scripts/seed_basicos.py
```

_Você verá a mensagem de criação das tabelas e importação dos alimentos com sucesso._

Para limpar e recarregar os alimentos do zero (sem apagar usuários, refeições ou progresso), existe também `scripts/reset_db.py` — veja o cabeçalho do arquivo para detalhes do que é preservado.

---

## Como Expor o App para a Internet (Celular / Testes Externos)

### Passo Único: Iniciar o Túnel Ngrok

No seu terminal (fora do Docker), execute o seguinte comando:

```bash
ngrok http https://localhost:443 --host-header=rewrite
```

- **Por que apontar para a porta `https://localhost:443`?** Porque o Nginx local já está configurado para servir HTTPS e tratar os redirecionamentos.
- **Por que `--host-header=rewrite`?** Isso instrui o Ngrok a reescrever o cabeçalho Host para `localhost`, evitando que o Nginx rejeite as conexões por incompatibilidade de nome do servidor.

### Resultado

O Ngrok exibirá uma tela no terminal com o status da conexão e uma linha parecida com esta:

```text
Forwarding     https://5da2-179-108-10-233.ngrok-free.app -> https://localhost:443
```

Copie a URL iniciada com `https://` (ex: `https://5da2-179-108-10-233.ngrok-free.app`) e abra-a no navegador do seu celular!

## Atualizar App após Modificações de Código

Toda vez que alterar o código do Frontend ou do Backend, siga os passos abaixo para aplicar as mudanças:

### 1. Atualizar tudo automaticamente

Para recompilar o que mudou e recriar os contêineres:

```bash
docker compose up -d --build
```

### 2. Atualizar apenas uma das partes

- **Para atualizar apenas o Frontend (Angular/Nginx)**:
  ```bash
  docker compose build frontend
  docker compose up -d frontend
  ```
- **Para atualizar apenas o Backend (Flask)**:
  ```bash
  docker compose build backend
  docker compose up -d backend
  ```

---

## Parar os Serviços

```bash
docker compose down
```
