# Use an official Node runtime as a parent image
FROM node:16

# Set the working directory in the container
WORKDIR /usr/src/app

# Install git
RUN apt-get update && apt-get install -y git

# Clone the latest code from GitHub
RUN git clone https://github.com/iamernie/BookShelf.git .

# Install dependencies
RUN npm install

# Make port available to the world outside this container
EXPOSE 3000

# Define environment variable
ENV NODE_ENV production

# Run the app when the container launches
CMD ["node", "app.js"]
