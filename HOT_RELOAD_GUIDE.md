# 🔥 Hot Reload Setup Guide

No extra Dockerfiles needed! Everything is configured through docker-compose files.

## ✅ **Two Development Modes**

### **Option 1: Hot Reload Mode (Best for Development)**
```cmd
docker compose -f docker-compose.dev.yml up
```
**Features:**
- ✅ File watching polling enabled (`CHOKIDAR_USEPOLLING=true`)
- ✅ Webpack polling enabled (`WATCHPACK_POLLING=true`) 
- ✅ Faster change detection
- ✅ Optimized for Docker development

### **Option 2: Basic Development Mode**
```cmd
docker compose up
```
**Features:**
- ✅ Standard volume mounting
- ✅ Hot reload (may be slower in Docker)
- ✅ Simpler setup

## 🚀 **Usage**

### **Recommended Development Workflow:**
```cmd
# Start with hot reload optimization
docker compose -f docker-compose.dev.yml up

# Make changes to any frontend file
# Changes appear automatically in 1-3 seconds!
```

### **When You DON'T Need to Restart:**
- ✅ Edit React components (`.tsx`, `.jsx`)
- ✅ Modify styles (`.css`, `.scss`)  
- ✅ Change pages in `app/` directory
- ✅ Update components in `components/`
- ✅ Modify most frontend code

### **When You DO Need to Restart:**
- ❌ Add new npm dependencies (`package.json`)
- ❌ Change `next.config.ts`
- ❌ Modify Docker or environment configuration
- ❌ Change environment variables

## 🛠 **Commands**

```cmd
# Hot reload development (recommended)
docker compose -f docker-compose.dev.yml up

# Basic development  
docker compose up

# Production build
docker compose -f docker-compose.prod.yml up

# View logs (hot reload)
docker compose -f docker-compose.dev.yml logs -f frontend

# Restart frontend only (if needed)
docker compose -f docker-compose.dev.yml restart frontend
```

## 🧪 **Test Hot Reload**

1. Start containers: `docker compose -f docker-compose.dev.yml up`
2. Edit any file in `frontend/app/` or `frontend/components/`
3. Save the file
4. Check browser - changes should appear in 1-3 seconds! 🔥

## 📁 **File Structure**

```
├── docker-compose.yml          # Basic development
├── docker-compose.dev.yml      # Hot reload optimized  
├── docker-compose.prod.yml     # Production build
└── frontend/
    ├── Dockerfile              # Production build
    └── Dockerfile.dev.simple   # Development build
```

No extra Dockerfiles needed - just use the right compose file! 🎯