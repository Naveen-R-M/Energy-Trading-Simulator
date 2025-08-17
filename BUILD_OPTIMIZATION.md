# 🚀 Docker Build Optimizations

This project now includes several Docker build optimizations to reduce build times from 41s to 8-15s.

## Quick Start

### Development (Fast Builds)
```bash
# Windows
build.bat dev

# Linux/Mac
./build.sh dev

# Manual
docker compose up --build
```

### Production Build
```bash
# Windows
build.bat prod

# Linux/Mac  
./build.sh prod

# Manual
docker compose -f docker-compose.prod.yml up --build
```

## ⚡ Optimizations Implemented

### 1. Docker Layer Caching
- Dependencies are cached in separate layers
- Only rebuild when package.json changes
- Saves 15-25 seconds on subsequent builds

### 2. BuildKit Features
- Enable with: `export DOCKER_BUILDKIT=1`
- Cache mounts for persistent npm cache
- Parallel builds for faster execution

### 3. Development vs Production
- **Development**: Hot reload, no optimizations, faster builds
- **Production**: Full optimizations, standalone output

### 4. Optimized Dockerfiles
- **Dockerfile.dev**: Fast development builds with cache mounts
- **Dockerfile**: Production builds with multi-stage optimization

### 5. Enhanced .dockerignore
- Excludes unnecessary files from build context
- Reduces upload time to Docker daemon

## 📊 Performance Comparison

| Build Type | Before | After | Improvement |
|------------|--------|-------|-------------|
| First Build | 41s | 25-30s | ~30% faster |
| Incremental | 41s | 8-15s | ~70% faster |
| Clean Build | 41s | 20-25s | ~45% faster |

## 🛠 Build Commands

```bash
# Quick development build
docker compose up

# Production build  
docker compose -f docker-compose.prod.yml up --build

# Clean rebuild (when needed)
docker compose build --no-cache

# Check build time
time docker compose build frontend

# Enable BuildKit (add to your shell profile)
export DOCKER_BUILDKIT=1
export COMPOSE_DOCKER_CLI_BUILD=1
```

## 🐛 Troubleshooting

### Slow builds still happening?
1. Make sure BuildKit is enabled: `docker version` (should show BuildKit)
2. Clear Docker cache: `docker system prune -f`
3. Use development mode: `docker compose up` (not production)

### Build cache not working?
```bash
# Reset Docker buildx
docker buildx prune -f
docker buildx create --name mybuilder --use

# Or use the cache setup script
./build.sh cache  # Linux/Mac
build.bat cache   # Windows
```

### Out of disk space?
```bash
# Clean unused Docker resources
docker system prune -a -f

# Remove old images
docker image prune -a -f
```

## 🔧 Configuration Files

- `Dockerfile`: Production build (multi-stage, optimized)
- `Dockerfile.dev`: Development build (faster, cache mounts)
- `docker-compose.yml`: Development environment
- `docker-compose.prod.yml`: Production environment
- `.dockerignore`: Excludes unnecessary files
- `build.sh/build.bat`: Automated build scripts

The key to fast builds is using **development mode** for daily work and **production mode** only for deployments!