# syntax=docker/dockerfile:1
FROM node:20-alpine

# instalar ffmpeg y herramientas de compilación (si no necesitas build tools puedes quitar build-base python3)
RUN apk add --no-cache ffmpeg curl build-base python3

WORKDIR /app

# copiar sólo archivos de lock/manifest para aprovechar cache
COPY package.json ./

# instalar solo producción (si necesitas dev deps en build o dev, ajustar)
RUN npm install --omit=dev

# copiar el resto del proyecto (node_modules está en .dockerignore)
COPY . .

EXPOSE 3000
CMD ["node", "src/app.js"]
