# Use the latest Node.js runtime as a parent image
FROM node:24-alpine

# Enable Corepack so the pinned pnpm version from package.json is used
RUN corepack enable

# Set the working directory
WORKDIR /usr/src/app

# Copy the full workspace (apps/cli's `prepare` script builds @carlba/core's
# dependencies during install, so source must be present before `pnpm install`)
COPY . .

# Install dependencies and compile TypeScript across the workspace
RUN pnpm install --frozen-lockfile
RUN pnpm run build

VOLUME /mnt /config

# Run the CLI; args passed to `docker run` (e.g. `greet --name Carl`) are appended
ENTRYPOINT ["node", "apps/cli/dist/cli.js"]
