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
CMD ["gunicorn", "-b", "0.0.0.0:5000", "app:create_app()"]
