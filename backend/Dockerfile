FROM python:3.11-slim

WORKDIR /app

# Instala gunicorn e dependências
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copia os arquivos do backend para dentro do contêiner
COPY . .

# Expõe a porta que o Flask/Gunicorn escuta
EXPOSE 5000

# Variáveis de ambiente padrão
ENV FLASK_ENV=production
ENV PYTHONUNBUFFERED=1

# Comando para iniciar o backend de produção via Gunicorn
# Um processo com threads: a consulta ao Open Food Facts não bloqueia as demais requisições
# e o rate limit em memória continua valendo para todas elas.
CMD ["gunicorn", "-b", "0.0.0.0:5000", "--threads", "4", "app:create_app()"]
