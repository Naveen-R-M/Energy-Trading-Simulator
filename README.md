# ⚡ Virtual Energy Trading Simulator

A comprehensive simulation platform for virtual energy trading in **Day-Ahead (DA)** and **Real-Time (RT)** electricity markets. Built with modern web technologies and designed to help understand energy market dynamics while providing a realistic trading experience.

![Virtual Energy Trading Platform](https://img.shields.io/badge/Status-Production%20Ready-green)
![Tech Stack](https://img.shields.io/badge/Stack-React%20%7C%20Next.js%20%7C%20FastAPI-blue)
![API Management](https://img.shields.io/badge/API-Multi--layer%20Rate%20Limiting-orange)

---

## 🎯 Project Overview

This platform simulates an energy trader who can:
- 📊 View **Day-Ahead hourly** and **Real-Time 5-minute** electricity prices
- 💰 Submit **Day-Ahead buy/sell orders** for specific hourly time slots  
- ⚡ Simulate **order matching** against Day-Ahead closing prices
- 📈 Calculate **real-time P&L** by comparing DA fills against RT market prices
- 📋 Manage **trading positions** with comprehensive order tracking
- 🎮 Use **Fake Mode** for testing and development without market constraints

---

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │    Backend      │    │   Data Layer    │
│                 │    │                 │    │                 │
│ Next.js 15.2    │◄──►│ FastAPI         │◄──►│ SQLite          │
│ React 18        │    │ Python 3.11+    │    │ GridStatus API  │
│ Arco Design     │    │ Multi-layer     │    │ Rate Limiting   │
│ TypeScript      │    │ Rate Limiting   │    │ Caching         │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### Tech Stack

**Frontend:**
- ⚛️ **Next.js 15.2** with Turbo for fast development
- 🎨 **Arco Design** for professional UI components
- 📊 **Recharts** for interactive data visualizations
- 🎯 **TypeScript** for type safety
- 🔥 **Hot Reload** with Docker development setup

**Backend:**  
- 🚀 **FastAPI** for high-performance API endpoints
- 🐍 **Python 3.11+** with modern async support
- 🗄️ **SQLite** database with SQLAlchemy ORM
- 🔄 **Sophisticated Rate Limiting** system (4-layer protection)
- 📦 **Docker** containerization for all environments

**Data Integration:**
- 🌐 **GridStatus API** for real market data
- 🔑 **Multi-API Key Pool** with round-robin rotation
- 💾 **Intelligent Caching** (5-minute TTL with fallbacks)
- 📥 **Request Queuing** with 2-second intervals

---

## 🚀 Quick Start

### Prerequisites

- **Docker & Docker Compose** (recommended)
- OR **Python 3.11+** and **Node.js 18+** for local development
- **GridStatus API Key(s)** - Get free keys at [GridStatus.io](https://api.gridstatus.io)

### 🐳 Docker Setup (Recommended)

1. **Clone the repository:**
   ```bash
   git clone https://github.com/your-username/energy-trading-simulator.git
   cd Energy-Trading-Simulator
   ```

2. **Configure environment:**
   ```bash
   cp .env.example .env
   # Edit .env with your GridStatus API keys
   ```

3. **Start with hot reload (development):**
   ```bash
   # Windows
   docker compose -f docker-compose.dev.yml up

   # Linux/Mac
   docker-compose -f docker-compose.dev.yml up
   ```

4. **Access the application:**
   - 🌐 **Frontend**: http://localhost:3000
   - 📡 **Backend API**: http://localhost:8000
   - 📚 **API Documentation**: http://localhost:8000/docs

### 🛠️ Local Development Setup

<details>
<summary>Click to expand local development instructions</summary>

**Backend Setup:**
```bash
cd backend
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\\Scripts\\activate
pip install -r requirements.txt

# Initialize database
python -c \"from fake_order_manager import db_manager; db_manager.init_db()\"

# Start FastAPI server
uvicorn app:app --reload --host 0.0.0.0 --port 8000
```

**Frontend Setup:**
```bash
cd frontend
npm install
npm run dev
```

</details>

---

## 💡 Key Features

### 🎮 **Fake Mode Trading**
- **Instant Order Placement**: Place orders anytime without market hour restrictions
- **Auto-Moderation**: Orders automatically approved/rejected with 70% success rate  
- **Realistic Timing**: Moderation occurs at next 5-minute interval + 45s buffer
- **Real Database Storage**: Orders stored in SQLite with full lifecycle tracking

### 📊 **Advanced Rate Limiting**
- **4-Layer Protection**: Cache → Queue → Key Pool → Retry Logic
- **Round-Robin Key Rotation**: Intelligent distribution across multiple API keys
- **5-Second Cooldowns**: Fast recovery from rate limits (reduced from 1.5 minutes)
- **Comprehensive Monitoring**: Real-time stats for cache, queue, and API pool health

### 💰 **Live P&L Calculation**
- **Real-Time Mark-to-Market**: Live P&L using current RT prices vs DA fills
- **Formula**: `(RT_Price - DA_Price) × Quantity × Side_Multiplier`
- **5-minute Updates**: Synchronized with RT data publication schedule
- **Multi-Location Support**: Handles orders across different grid nodes

### 📋 **Position Management**
- **Comprehensive Order Tracking**: Full lifecycle from submission to settlement
- **Status Monitoring**: PENDING → APPROVED → CLEARED progression
- **P&L Analytics**: Both approval-time snapshots and live mark-to-market
- **Historical Data**: Complete audit trail of all trading activity

---

## 🎯 Usage Examples

### Basic Trading Flow

1. **Select Market & Date**
   - Choose grid node (e.g., PJM-RTO)  
   - Select trading date

2. **View Market Data**
   - Day-Ahead hourly prices
   - Real-Time 5-minute prices
   - Historical price charts

3. **Place Orders**
   - **Live Mode**: Respects 11:00 AM ET cutoff
   - **Fake Mode**: Place orders anytime for testing

4. **Monitor Positions**
   - Track order status and approvals
   - View live P&L calculations  
   - Analyze trading performance

### Fake Mode Demo

```bash
# 1. Toggle Fake Mode in UI
# 2. Fill out trade ticket:
#    - Side: BUY
#    - Quantity: 5 MWh  
#    - Limit Price: $45.00
#    - Hour: Auto-selected (current + 1 hour)
# 3. Click \"Create Fake Order\"
# 4. Order stored as PENDING
# 5. Auto-moderation at next 5-min interval
# 6. View result in Positions table
```

---

## 📡 API Documentation

### Core Endpoints

```bash
# Market Data
GET  /api/v1/dayahead/latest?market=pjm&location=PJM-RTO
GET  /api/v1/realtime/latest?market=pjm&location=PJM-RTO

# Order Management  
POST /api/v1/orders/fake
GET  /api/v1/fetch_orders

# Admin & Monitoring
GET  /api/v1/admin/health
GET  /api/v1/admin/cache/stats
GET  /api/v1/admin/queue/stats
GET  /api/v1/admin/pool/stats
```

### Rate Limiting Management

```bash
# Clear cache
POST /api/v1/admin/cache/clear

# Reset queue
POST /api/v1/admin/queue/clear

# Reset API key pool  
POST /api/v1/admin/pool/reset
```

**Full API documentation available at**: http://localhost:8000/docs

---

## 🛠️ Development Commands

### Docker Commands

```bash
# Development with hot reload
docker compose -f docker-compose.dev.yml up

# Production build
docker compose -f docker-compose.prod.yml up --build

# View logs
docker compose logs -f frontend
docker compose logs -f backend

# Clean rebuild
docker compose build --no-cache
```

### Management Scripts

```bash
# Windows
build.bat dev     # Development build
build.bat prod    # Production build  
build.bat cache   # Setup build cache

# Linux/Mac
./build.sh dev    # Development build
./build.sh prod   # Production build
./build.sh cache  # Setup build cache
```

---

## 📊 Monitoring & Debugging

### Health Checks

```bash
# Overall system health
curl http://localhost:8000/api/v1/admin/health

# Component-specific stats
curl http://localhost:8000/api/v1/admin/cache/stats
curl http://localhost:8000/api/v1/admin/queue/stats  
curl http://localhost:8000/api/v1/admin/pool/stats
```

### Real-time Monitoring

```bash
# Watch system health
watch -n 5 \"curl -s http://localhost:8000/api/v1/admin/health | jq\"

# Monitor API pool status
watch -n 10 \"curl -s http://localhost:8000/api/v1/admin/pool/stats | jq .available_keys\"
```

---

## 📚 Documentation

- 🔄 **[API Rate Limiting System](docs/API_RATE_LIMITING_SYSTEM.md)** - Complete guide to the 4-layer rate limiting architecture
- 🔥 **[Hot Reload Guide](docs/HOT_RELOAD_GUIDE.md)** - Development environment setup
- 🚀 **[Build Optimization](docs/BUILD_OPTIMIZATION.md)** - Docker build performance improvements
- 🎯 **[Fake Mode Implementation](docs/FAKE_MODE_IMPLEMENTATION.md)** - Testing and development features
- 💰 **[Live P&L Implementation](docs/LIVE_PNL_IMPLEMENTATION.md)** - Real-time profit/loss calculations
- 📊 **[Positions Integration](docs/POSITIONS_INTEGRATION.md)** - Trading position management

---

## 🔧 Configuration

### Environment Variables

Create a `.env` file in the root directory:

```env
# GridStatus API Configuration
GRIDSTATUS_API_KEYS=key1,key2,key3,key4    # Comma-separated API keys

# Rate Limiting Configuration  
API_POOL_STRATEGY=round_robin               # round_robin, random, least_used
CACHE_TTL_MINUTES=5                         # Cache lifetime
QUEUE_INTERVAL_SECONDS=2.0                  # Request queue interval
API_COOLDOWN_SECONDS=5                      # Cooldown after rate limit

# Database Configuration
DB_PATH=/app/data/trading.db                # SQLite database path

# Market Configuration
DEFAULT_MARKET=pjm                          # Default market (pjm, ercot, etc.)
DEFAULT_LOCATION=PJM-RTO                    # Default grid location
MARKET_TZ=America/New_York                  # Market timezone
```

### Performance Tuning

**Development Settings:**
- `QUEUE_INTERVAL_SECONDS=1.0` - Faster responses
- `CACHE_TTL_MINUTES=2` - Shorter cache for development
- `API_COOLDOWN_SECONDS=5` - Quick recovery

**Production Settings:**  
- `QUEUE_INTERVAL_SECONDS=2.0` - Balanced performance
- `CACHE_TTL_MINUTES=5` - Optimal cache lifetime
- `API_COOLDOWN_SECONDS=5` - Fast but safe recovery

---

## 🚨 Troubleshooting

### Common Issues

**API Rate Limiting:**
- Check API key pool status: `GET /api/v1/admin/pool/stats`
- Reset if all keys are rate-limited: `POST /api/v1/admin/pool/reset`
- Add more API keys to environment variable

**Slow Performance:**
- Monitor cache hit rate: `GET /api/v1/admin/cache/stats`
- Check queue depth: `GET /api/v1/admin/queue/stats`
- Increase cache TTL if appropriate

**Docker Issues:**
- Use development compose file: `docker-compose -f docker-compose.dev.yml up`
- Clear Docker cache: `docker system prune -f`
- Rebuild without cache: `docker compose build --no-cache`

**Hot Reload Not Working:**
- Ensure using dev compose file
- Check file permissions in Docker volumes
- Restart containers: `docker compose restart frontend`

---

## 🤝 Contributing

This project is designed for educational and demonstration purposes. Key areas for contribution:

- 📊 Additional market data sources and grid operators
- 🧮 More sophisticated P&L calculation methods  
- 🎨 Enhanced UI/UX for trading interface
- 📈 Advanced analytics and reporting features
- ⚡ Performance optimizations and scaling improvements

---

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- **[GridStatus.io](https://gridstatus.io)** - Real-time grid data API
- **[Arco Design](https://arco.design)** - React UI component library
- **[FastAPI](https://fastapi.tiangolo.com)** - High-performance Python web framework
- **[Next.js](https://nextjs.org)** - React production framework

---

## 📞 Support

For questions, issues, or feature requests:

1. 📖 Check the [documentation](docs/) first
2. 🔍 Search existing issues on GitHub  
3. 💬 Create a new issue with detailed information
4. 📧 Contact the development team

---

**Built with ❤️ for the energy trading community**

*Last Updated: August 17, 2025 • Version: 1.0.0*