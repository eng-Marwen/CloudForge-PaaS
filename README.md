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

## Detailed architecture

### Backend

The backend is a TypeScript application built with Express, Prisma, PostgreSQL,
RabbitMQ, and JWT-based cookie authentication.

```text
HTTP request
    │
    ▼
backend/src/app.ts
    ├─ /api/auth  ── authRoute ── authController
    ├─ /api/apps  ── appRoute  ── appController
    └─ /api/health
             │
             ├─ authMiddleware
             │    └─ verifies the HttpOnly auth_token JWT
             │
             ├─ Prisma ── PostgreSQL
             │
             └─ RabbitMQ
                  ├─ deploy.events       (backend → C++ core)
                  └─ deployment.results  (C++ core → backend)
```

#### Backend startup and infrastructure connections

`backend/src/server.ts` starts the HTTP server, initializes the database, and
connects RabbitMQ. `backend/src/queue/queue.ts` owns the RabbitMQ connection,
channel, reconnect behavior, and handlers that must be recreated after a
connection is restored.

The result consumer is started after RabbitMQ connects. It uses a durable
`deployment.results` queue, prefetches one message at a time, persists each
result before acknowledging it, and requeues messages when database
processing fails. Invalid messages are rejected because retrying cannot fix
them.

#### Authentication

`authController.ts` handles registration, login, logout, current-user lookup,
profile updates, and account deletion:

1. Registration hashes passwords with bcrypt and creates a user in PostgreSQL.
2. Login verifies the bcrypt hash and active-user state.
3. A JWT containing public user data is created with the configured expiration.
4. The JWT is returned in an `HttpOnly` cookie named `auth_token`.
5. Protected routes use `authMiddleware` to verify the cookie and attach the
   authenticated user to the Express request.

#### Application API and deployment commands

`appController.ts` owns application validation and persistence:

- `GET /api/apps` lists the authenticated user's applications.
- `POST /api/apps` validates the repository, branch, and environment variables,
  stores the application, and publishes a `deploy` message.
- `GET /api/apps/:id` returns one application.
- `PATCH /api/apps/:id` updates application configuration or deployment state.
  A `deploying` update publishes a deployment event. Stopping an application
  marks it failed, sets it undeployed, and publishes a delete command instead
  of redeploying it.
- `DELETE /api/apps/:id` publishes a delete command and removes the database
  record.
- `GET /api/apps/:id/logs` runs `kubectl logs` for the application's
  deployment and returns the newest 200 lines.
- `GET /api/apps/:id/events` opens an authenticated Server-Sent Events stream
  for real-time deployment updates.

Environment variables are validated as unique, non-empty keys with string
values before they are stored. Application records include deployment status,
stage, image, URL, message, and error fields so the dashboard can represent
the current lifecycle state.

#### RabbitMQ message flow

Deployment commands sent to `deploy.events` have this shape:

```json
{
  "event": "deploy",
  "data": {
    "id": 25,
    "name": "example",
    "repository": "https://github.com/user/example",
    "branch": "main",
    "environmentVariables": []
  }
}
```

Stop and delete commands use:

```json
{
  "event": "delete",
  "data": { "applicationId": 25 }
}
```

The C++ core publishes progress and final results to `deployment.results`.
The backend maps core status `deployed` to the dashboard status `running`,
updates PostgreSQL, and broadcasts the updated application over the SSE
connection.

### C++ deployment core

The core is a C++17 executable built with CMake. It uses the RabbitMQ C client
for messaging, `nlohmann/json` for message parsing, Docker CLI commands for
image operations, and `kubectl` for Kubernetes operations.

```text
deploy.events
    │
    ▼
Queue::consume()
    ├─ event=deploy
    │    └─ Queue::handleDeploy()
    │         ├─ RepositoryManager::cloneRepository()
    │         ├─ RepositoryManager::validateRepository()
    │         ├─ DockerManager::buildImage()
    │         ├─ DockerManager::getExposedPort()
    │         ├─ DockerManager::login()
    │         ├─ DockerManager::pushImage()
    │         ├─ K8sManager::apply()
    │         ├─ K8sManager::waitForRollout()
    │         └─ K8sManager::getUrl()
    │
    └─ event=delete
         └─ Queue::handleDelete()
              └─ K8sManager::remove()

deployment.results
    ▲
    └─ progress and final result messages
```

#### Core components

- `Queue` owns the RabbitMQ connection, durable queue declarations,
  one-message-at-a-time consumption, event dispatch, acknowledgements, and
  result publishing.
- `DeployEvent` is the typed representation of an application deployment
  message, including repository information and environment variables.
- `RepositoryManager` clones repositories into `core/repos`, finds the
  Dockerfile, requires exactly one Dockerfile, and removes temporary clones.
- `DockerManager` creates unique image tags, builds images, reads the exposed
  application port, authenticates to the registry, pushes images, and provides
  image cleanup helpers.
- `K8sManager` renders the Kubernetes templates with application values,
  applies Secrets and application resources, waits for rollout readiness,
  reads the assigned NodePort URL, and removes resources when an application
  is stopped or deleted.
- `processUtil` provides the subprocess boundary used to execute Docker,
  Git, and `kubectl` commands while capturing output and exit status.

#### Deployment state machine

For a deployment, the core reports:

```text
cloned → built → pushed → k8s-applied → deployed
```

Intermediate stages publish `deployment.progress` messages with status
`deploying`. A successful rollout publishes `deployment.succeeded` with status
`deployed`, image, and URL. Any failure publishes `deployment.failed` with the
failed stage and error details. The backend persists each message and exposes
the state to the dashboard.

The core acknowledges a RabbitMQ command only after it has handled the event
and published its result. The result queue uses persistent messages, allowing
the backend to recover deployment outcomes after a restart.

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

## Infrastructure architecture

The `infrastructure/` directory provisions the local Kubernetes environment
with Terraform and libvirt. It creates a small KVM-based cluster made of one
control-plane VM and two worker VMs:

```text
Host machine
    │
    └─ libvirt / KVM
         ├─ cp       (Kubernetes control plane)
         ├─ work-1   (Kubernetes worker)
         └─ work-2   (Kubernetes worker)
```

### Provisioning components

- `providers.tf` configures the libvirt, TLS, and external Terraform providers.
- `variables.tf` defines VM resources, fixed MAC/IP addresses, the private
  network, Kubernetes pod CIDR, Calico version, SSH key, and kubeadm token.
- `main.tf` creates the Ubuntu base image, QCOW2 VM disks, cloud-init disks,
  and KVM domains.
- `networks.tf` creates the private NAT network and DHCP reservations for the
  control plane and workers.
- `pki.tf` provides the certificates used during node initialization.
- `cloud-init/` installs and bootstraps Kubernetes on each VM. The control
  plane runs kubeadm initialization; workers join using the generated
  bootstrap configuration. Calico provides the pod network.
- `helm/values.yml` configures Grafana with a persistent 10 GiB volume and a
  NodePort on port `30000`.

The default cluster uses the `192.168.71.0/24` private network:

| Node | Role | Address | Resources |
|---|---|---:|---|
| `cp` | Control plane | `192.168.71.104` | 4 GiB RAM, 2 vCPU, 20 GiB disk |
| `work-1` | Worker | `192.168.71.105` | 4 GiB RAM, 2 vCPU, 20 GiB disk |
| `work-2` | Worker | `192.168.71.106` | 4 GiB RAM, 2 vCPU, 20 GiB disk |

### Cluster lifecycle

`run_cluster.sh` applies the Terraform configuration, starts the three VMs,
waits for SSH and the control-plane kubeconfig, copies that kubeconfig to the
host, and waits until the Kubernetes API responds to `kubectl get nodes`.
`stop_cluster.sh` gracefully shuts down the control-plane and worker VMs.

After the cluster is available, the C++ core uses the configured Kubernetes
context and namespace to apply application manifests. The backend can call
`kubectl logs` directly for the dashboard's log viewer, while deployment and
deletion commands continue to flow through RabbitMQ to the C++ core.

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
