FROM node:16 as builder

COPY package*.json ./
RUN npm ci --legacy-peer-deps

COPY . .
RUN npm run build

FROM node:16

WORKDIR /home/github/spk-indexer-node

COPY --from=builder package.json package-lock.json ./

RUN npm ci --only-production --legacy-peer-deps && \
    npm cache clean --force 

COPY --from=builder dist dist

CMD [ "npm", "run", "start"]
