FROM node:20-bookworm AS deps
WORKDIR /app
COPY package.json ./
RUN npm install

FROM deps AS build
WORKDIR /app
COPY tsconfig.json ./
COPY prisma ./prisma
COPY src ./src
RUN npm run prisma:generate
RUN npm run build

FROM node:20-bookworm AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY package.json ./package.json
COPY start.sh ./start.sh
RUN npm prune --omit=dev
RUN chmod +x ./start.sh
EXPOSE 3001
CMD ["/bin/sh", "-c", "./start.sh"]
