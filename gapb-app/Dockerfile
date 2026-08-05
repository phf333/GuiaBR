# Etapa 1: Compilação do Angular
FROM node:20-alpine AS builder

WORKDIR /app

# Copia dependências e instala
COPY package*.json ./
RUN npm ci

# Copia todos os arquivos do frontend e compila para produção
COPY . .
RUN npm run build -- --configuration=production

# Etapa 2: Servidor Nginx de Produção
FROM nginx:alpine

# Remove a configuração padrão do Nginx
RUN rm -rf /etc/nginx/conf.d/*

# Copia a configuração customizada do Nginx
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copia os arquivos compilados do Angular (estágio anterior)
COPY --from=builder /app/dist/gapb-app/browser /usr/share/nginx/html

# Expõe as portas de HTTP e HTTPS
EXPOSE 80
EXPOSE 443

CMD ["nginx", "-g", "daemon off;"]
