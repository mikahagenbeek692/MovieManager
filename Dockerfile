# Use official Node.js image with version 20
FROM node:20

# Set the working directory inside the container
WORKDIR /app

# Install build tools for native dependencies (not needed for bcryptjs, but useful for other packages)
RUN apt-get update && apt-get install -y build-essential python3

# Copy package.json and yarn.lock to avoid unnecessary rebuilds
COPY package.json yarn.lock ./

# Install dependencies using Yarn
RUN yarn install

# Copy everything else (except ignored files)
COPY . .

# Expose backend port (adjust if necessary)
EXPOSE 5000

# Start the backend
CMD ["node", "src/Backend/server.js"]