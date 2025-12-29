# Use the official Playwright image which comes with all browser dependencies installed
FROM mcr.microsoft.com/playwright:v1.40.0-jammy

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies (Express, Cors, etc.)
# Note: Playwright itself is already in the image, but we might need 'playwright' package in package.json
RUN npm install

# Copy source code
COPY . .

# Expose the port (Hugging Face expects port 7860 by default for some SDKs, but we can set it)
# We'll use 7860 as it's standard for HF Spaces
ENV PORT=7860
EXPOSE 7860

# Start the server
CMD [ "npm", "start" ]
