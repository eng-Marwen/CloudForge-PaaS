cloudforge/
│
├── frontend/
│
├── backend/
│   ├── src/
│   │   ├── controllers/
│   │   ├── routes/
│   │   ├── services/
│   │   ├── models/
│   │   ├── middleware/
│   │   ├── config/
│   │   │   └── database.js
│   │   └── app.js
│   │
│   ├── tests/
│   ├── Dockerfile
│   ├── package.json
│   └── .env.example
│
├── controller/
│   ├── include/
│   │   ├── controller.hpp
│   │   ├── kubernetes_client.hpp
│   │   ├── deployment_manager.hpp
│   │   └── config.hpp
│   │
│   ├── src/
│   │   ├── main.cpp
│   │   ├── controller.cpp
│   │   ├── kubernetes_client.cpp
│   │   ├── deployment_manager.cpp
│   │   └── config.cpp
│   │
│   ├── tests/
│   ├── CMakeLists.txt
│   ├── Dockerfile
│   └── README.md
│
├── infra/
│   ├── terraform/
│   │   ├── main.tf
│   │   ├── network.tf
│   │   ├── vms.tf
│   │   ├── variables.tf
│   │   └── outputs.tf
│   │
│   ├── kubernetes/
│   │   ├── cloudforge/
│   │   ├── ingress/
│   │   ├── harbor/
│   │   └── monitoring/
│   │
│   └── scripts/
│
├── docs/
│
├── .gitignore
├── README.md
└── docker-compose.yml

first time u run the project 
npm run db:generate
npm run db:push