# CloudForge

CloudForge is a private-cloud Platform as a Service (PaaS) that turns a GitHub
repository into a live application. It provides a web dashboard, an API for
application and deployment management, and a C++ deployment controller that
builds Docker images and deploys them to Kubernetes.

## What it does

- Connects applications to GitHub repositories.
- Accepts deployment events through RabbitMQ.
- Clones and validates repositories containing a Dockerfile.
- Builds and pushes versioned Docker images to Docker Hub.
- Creates Kubernetes Deployments, Services, and environment-variable Secrets.
- Waits for the Kubernetes rollout and publishes deployment progress/results.
- Provides a React dashboard for authentication, applications, and deployment
  status.

The current Kubernetes templates expose applications through a `NodePort`.
Prometheus-based metrics and policy-driven autoscaling are part of the planned
controller evolution; the current controller does not yet include a Prometheus
client or an HPA manifest.

## Architecture

```text
React frontend
       │ HTTP
       ▼
TypeScript/Express backend ───── PostgreSQL
       │
       └──────── RabbitMQ: deploy.events
                           │
                           ▼
                    C++ controller
                    ├─ clone/validate repository
                    ├─ docker build/login/push
                    └─ kubectl apply + rollout check
                           │
                           ▼
                       Kubernetes
```

Deployment results are published on the `deployment.results` channel and are
consumed by the backend to update application state.

## Repository layout

```text
frontend/   React + Vite dashboard
backend/    Express API, Prisma/PostgreSQL access, RabbitMQ integration
core/       C++17 deployment controller and Kubernetes templates
```

## Prerequisites

- Node.js and npm
- CMake 3.22 or newer
- A C++17 compiler
- Docker
- `kubectl` configured for the target cluster
- PostgreSQL
- RabbitMQ
- RabbitMQ C client development files (`librabbitmq-dev` on Debian/Ubuntu)
- `nlohmann-json` development files

The C++ controller also expects Docker Hub credentials and access to a
Kubernetes namespace.

## Local setup

### 1. Start PostgreSQL and RabbitMQ

The backend compose file includes local PostgreSQL, pgAdmin, and RabbitMQ
services:

```bash
docker compose -f backend/docker.yml up -d
```

Configure the backend environment before starting the API. At minimum, it
needs a Prisma `DATABASE_URL`, a `RABBITMQ_URL`, and a `JWT_SECRET`. For the
compose services, an example configuration is:

```dotenv
DATABASE_URL="postgresql://marwen:marwen123@localhost:5432/cloudForg_db"
RABBITMQ_URL="amqp://localhost:5672"
JWT_SECRET="replace-with-a-local-secret"
JWT_EXPIRES_IN="1h"
PORT=3000
```

### 2. Start the backend

```bash
cd backend
npm install
npm run db:generate
npm run db:push
npm run dev
```

The API health endpoint is available at
[`http://localhost:3000/api/health`](http://localhost:3000/api/health).

### 3. Start the frontend

```bash
cd frontend
npm install
npm run dev
```

Vite prints the dashboard URL when it starts.

### 4. Build and run the C++ controller

Create `core/.env` from [`core/.env.example`](/home/marwen/Desktop/cloudForge/core/.env.example)
and set values for Docker Hub, Kubernetes, and the target node:

```dotenv
DOCKERHUB_USERNAME=your-user
DOCKERHUB_TOKEN=your-token
DOCKERHUB_REPOSITORY=your-user/cloudforge
K8S_CONTEXT=your-kube-context
K8S_NAMESPACE=cloudforge
K8S_NODE_IP=192.168.1.10
```

Build the controller:

```bash
cd core
cmake -S . -B build
cmake --build build
```

Run the consumer with the environment from `core/.env`:

```bash
cmake --build build --target run
```

The controller consumes the durable `deploy.events` queue. The backend and
controller must be able to reach the same RabbitMQ instance.

## Deployment lifecycle

1. The dashboard requests a deployment through the backend.
2. The backend publishes a deployment event to `deploy.events`.
3. The controller clones the repository and verifies that it contains exactly
   one Dockerfile.
4. Docker builds the image, logs in to Docker Hub, and pushes a unique tag.
5. The controller renders the Kubernetes templates in `core/k8s/` and runs
   `kubectl apply`.
6. The controller waits for the application pods to become Ready.
7. Progress and final success/failure events are published for the backend.

## Development notes

- Do not commit `.env` files, Docker Hub tokens, JWT secrets, or kubeconfig
  credentials.
- Keep deployment-specific behavior in `core/`; keep API and persistence
  behavior in `backend/`.
- The Kubernetes templates currently assume a single replica and a TCP
  readiness probe. Autoscaling should be added with explicit metrics,
  min/max replica bounds, and a documented Prometheus adapter configuration.

## License

No license has been declared yet.
