FROM node:20-slim

WORKDIR /app

# Install build dependencies if needed
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    git \
    && rm -rf /var/lib/apt/lists/*

COPY package.json ./

# Install npm dependencies
RUN npm install

COPY . .

EXPOSE 5173

CMD ["npm", "run", "dev"]
