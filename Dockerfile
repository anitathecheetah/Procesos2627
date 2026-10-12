FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev
COPY server ./server
COPY client ./client
# Cloud Run inyecta PORT; el servidor ya lo lee de process.env.PORT
EXPOSE 8080
CMD ["node", "server/index.js"]
